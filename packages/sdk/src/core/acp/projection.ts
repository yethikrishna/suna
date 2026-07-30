import type {
  AssistantMessage,
  Message,
  Part,
  PermissionRequest,
  QuestionInfo,
  QuestionRequest,
  SessionStatus,
  StepFinishPart,
  Todo,
  ToolPart,
} from '@opencode-ai/sdk/v2/client';

import { normalizeToolName, toolInfo } from '../turns/tool-registry';
import type { AcpEnvelope, AcpJsonRpcId } from './types';

export interface AcpMessageWithParts {
  info: Message;
  parts: Part[];
}

export interface AcpProjection {
  sessionId: string;
  messages: AcpMessageWithParts[];
  /**
   * Whether a turn is running. Derived from `pendingPrompts`, never from
   * content arrival — see the invariant on `pendingPrompts`.
   */
  status: SessionStatus;
  /**
   * JSON-RPC ids of `session/prompt` requests that have no response yet, in
   * arrival order. This is the ONLY positive evidence that a turn is live.
   *
   * The invariant it enforces: a projection folded from history defaults to
   * settled. `session/load` makes a harness re-emit a finished conversation as
   * brand-new `session/update` notifications — same wire shape as live output,
   * with no terminal prompt response behind them. Treating content as liveness
   * therefore pinned the thinking indicator on forever (dev session
   * `10533f77-00e3-420c-936b-82933e4d1025`: 412 re-emitted updates landed after
   * the `end_turn` response, and nothing could settle them). An unanswered
   * prompt is the one signal that cannot be manufactured by a replay.
   */
  pendingPrompts: string[];
  /**
   * Replay bookkeeping for the text fold. Internal to `applyAcpEnvelope`; a
   * renderer reads `messages`, never this.
   *
   * `session/load` makes a harness re-emit an entire finished conversation as
   * brand-new `session/update` notifications that repeat the harness-native
   * `messageId` (dev session `10533f77-00e3-420c-936b-82933e4d1025` holds 11
   * copies of its conversation in `kortix.acp_session_envelopes`). Each
   * re-emission is therefore a SEGMENT of the same message, never a
   * continuation of it: `pendingText` accumulates the segment arriving now, and
   * the projected part keeps the LONGEST segment seen. A replay delivers a
   * whole message and can only be prefix-truncated by a killed process, so
   * longest == most complete.
   *
   * This is the same interpretation as the server-side fold in
   * `apps/api/src/shared/compact-transcript.ts` (`compactAcpEnvelopes`, which
   * keeps `longestSegment(draft.segments)`). The two readers must never
   * disagree about what a session said.
   */
  replay: {
    /** Harness-native id of the message the last text chunk was folded into. */
    activeMessageId: string | null;
    /** `${messageId}\0${partType}` → the segment still accumulating. */
    pendingText: Record<string, string>;
    /**
     * True from a `session/load` (or any other runtime attach) until the next
     * `session/prompt`. Inside that window the harness re-emits its canonical
     * history, so its emission order — not the order this projection happened
     * to first hear of a message — is the true conversation order.
     */
    replaying: boolean;
    /**
     * Id of the last message the running replay positioned. A replayed message
     * this projection has never seen is inserted directly AFTER it instead of
     * being appended, which is the whole of the ordering guarantee: the
     * rendered sequence is the replay's sequence.
     *
     * Appending was the defect. A page that joined mid-turn holds only the
     * assistant reply; the replay then introduces the user message that
     * prompted it, and appending put the question BELOW its own answer.
     */
    anchorMessageId: string | null;
  };
  todos: Todo[];
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  configOptions: Array<Record<string, unknown>>;
  availableCommands: Array<Record<string, unknown>>;
  currentModeId: string | null;
  sessionInfo: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  /**
   * Context window the harness reports for the model actually running
   * (`usage_update.size`). Authoritative — it beats any client-side catalog
   * lookup, because only the runtime knows which model answered.
   */
  contextWindow: number | null;
  /**
   * Context the conversation currently occupies. Sourced from the harness's own
   * `usage_update.used`, falling back to the provider's authoritative
   * `totalTokens` on a prompt result. A harness resets `used` to 0 between
   * turns, so a zero never clobbers a known occupancy.
   */
  contextUsed: number | null;
  nextId: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringifyOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toolOutput(value: unknown): string {
  if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, 'output')) {
    return stringifyOutput(value);
  }
  return stringifyOutput(value.output);
}

const ACP_KIND_TOOL: Record<string, string> = {
  execute: 'bash',
  read: 'read',
  edit: 'edit',
  delete: 'edit',
  move: 'edit',
  search: 'grep',
  fetch: 'webfetch',
};

function looksLikeToolName(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_.-]*$/.test(value);
}

function nativeToolName(update: Record<string, unknown>, previous: ToolPart | null): string {
  if (previous) return previous.tool;
  const title = asString(update.title);
  if (title && looksLikeToolName(title)) return title;
  const kind = asString(update.kind) ?? 'other';
  return ACP_KIND_TOOL[kind] ?? kind;
}

function projectedToolTitle(tool: string, title: string | null): string {
  if (!title || normalizeToolName(title) === normalizeToolName(tool)) {
    return toolInfo(tool).label;
  }
  return title;
}

const SEGMENT_SEPARATOR = '\u0000';

function segmentKey(messageId: string, type: 'text' | 'reasoning'): string {
  return `${messageId}${SEGMENT_SEPARATOR}${type}`;
}

/**
 * True when this chunk starts a new re-emission of `messageId` rather than
 * continuing the one already streaming. The harness only revisits a message it
 * has moved away from by re-emitting it, so a named chunk for a message that is
 * not the active one opens a fresh segment. An unnamed chunk can never be
 * matched to a replay, so it always continues the open segment.
 */
function opensSegment(state: AcpProjection, messageId: string | null): boolean {
  return messageId !== null && messageId !== state.replay.activeMessageId;
}

/** Drop every accumulating segment of `messageId` — a new re-emission starts. */
function clearSegments(
  pendingText: Record<string, string>,
  messageId: string,
): Record<string, string> {
  const prefix = `${messageId}${SEGMENT_SEPARATOR}`;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(pendingText)) {
    if (!key.startsWith(prefix)) next[key] = value;
  }
  return next;
}

/** The mutable `pendingText` this chunk folds into. */
function openSegments(state: AcpProjection, messageId: string | null): Record<string, string> {
  return messageId && opensSegment(state, messageId)
    ? clearSegments(state.replay.pendingText, messageId)
    : { ...state.replay.pendingText };
}

function nextGeneratedId(state: AcpProjection, prefix: string): string {
  return `acp-${prefix}-${String(state.nextId).padStart(8, '0')}`;
}

/**
 * Where a newly projected message belongs.
 *
 * Live, that is the end of the transcript — envelopes arrive in `ordinal` order
 * and nothing that arrives later happened earlier. Inside a replay it is
 * directly after the message the replay positioned last, so the transcript ends
 * up in the harness's canonical order rather than in the order this projection
 * first heard of each message.
 */
function insertAt(state: AcpProjection, role: string): number {
  if (!state.replay.replaying) return state.messages.length;
  const anchor = state.replay.anchorMessageId;
  if (anchor === null) {
    // A replay re-emits the conversation starting from its first user turn, so
    // a user message that opens one belongs at the head. An assistant chunk
    // that arrives before any of that is the tail of the stream the attach
    // interrupted — it still belongs at the end (dev session
    // 6a7b3c29-ce92-4e4f-8f63-2696db54b1b9 flushes 8 such chunks).
    return role === 'user' ? 0 : state.messages.length;
  }
  const index = state.messages.findIndex((message) => message.info.id === anchor);
  return index < 0 ? state.messages.length : index + 1;
}

function withMessage(state: AcpProjection, message: AcpMessageWithParts): AcpMessageWithParts[] {
  const messages = [...state.messages];
  messages.splice(insertAt(state, message.info.role), 0, message);
  return messages;
}

/**
 * Remember that the running replay has now positioned `messageId`.
 *
 * A replay only becomes the authority on order once its first USER turn lands.
 * Before that, what arrives is the tail of the stream the attach interrupted —
 * dev session `6a7b3c29-ce92-4e4f-8f63-2696db54b1b9` flushes 8 such chunks
 * between the `session/load` at ordinal 509 and the replay's first user chunk at
 * 519. Letting one of those anchor the replay put the conversation's LAST answer
 * at the head and pushed every later turn down one slot.
 */
function anchored(state: AcpProjection, messageId: string, role: string): AcpProjection['replay'] {
  if (!state.replay.replaying) return state.replay;
  if (role !== 'user' && state.replay.anchorMessageId === null) return state.replay;
  return { ...state.replay, anchorMessageId: messageId };
}

function createUserMessage(
  state: AcpProjection,
  text: string,
  messageId?: string | null,
): AcpMessageWithParts {
  const id = messageId ?? nextGeneratedId(state, 'user');
  const info = {
    id,
    sessionID: state.sessionId,
    role: 'user',
    time: { created: Date.now() },
    agent: 'default',
    model: { providerID: 'acp', modelID: 'runtime' },
  } satisfies Message;
  return {
    info,
    parts: [
      {
        id: `${id}-text`,
        sessionID: state.sessionId,
        messageID: id,
        type: 'text',
        text,
      },
    ],
  };
}

function createAssistantMessage(
  state: AcpProjection,
  messageId?: string | null,
): AcpMessageWithParts {
  const id = messageId ?? nextGeneratedId(state, 'assistant');
  const parent = [...state.messages].reverse().find((message) => message.info.role === 'user')
    ?.info.id;
  const info = {
    id,
    sessionID: state.sessionId,
    role: 'assistant',
    time: { created: Date.now() },
    parentID: parent ?? id,
    modelID: 'runtime',
    providerID: 'acp',
    mode: state.currentModeId ?? 'build',
    agent: 'default',
    path: { cwd: '/workspace', root: '/workspace' },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  } satisfies AssistantMessage;
  return { info, parts: [] };
}

function completeAssistantMessage(
  message: AcpMessageWithParts,
  completed: number,
): AcpMessageWithParts {
  if (message.info.role !== 'assistant' || message.info.time.completed) return message;
  const parts = message.parts.map((part) => {
    if (
      part.type !== 'tool' ||
      (part.state.status !== 'pending' && part.state.status !== 'running')
    ) {
      return part;
    }
    const state = part.state;
    const start = state.status === 'running' ? state.time.start : completed;
    return {
      ...part,
      state: {
        status: 'completed',
        input: state.input,
        output: '',
        title: state.status === 'running' && state.title ? state.title : toolInfo(part.tool).label,
        metadata: state.status === 'running' ? (state.metadata ?? {}) : {},
        time: { start, end: completed },
      },
    } satisfies ToolPart;
  });
  return {
    ...message,
    info: {
      ...message.info,
      time: { ...message.info.time, completed },
    },
    parts,
  };
}

function withAssistant(
  state: AcpProjection,
  messageId: string | null,
  mutate: (message: AcpMessageWithParts) => AcpMessageWithParts,
): AcpProjection {
  if (messageId) {
    const existingIndex = state.messages.findIndex(
      (message) => message.info.role === 'assistant' && message.info.id === messageId,
    );
    if (existingIndex >= 0) {
      const messages = [...state.messages];
      messages[existingIndex] = mutate(messages[existingIndex]);
      return { ...state, messages, replay: anchored(state, messageId, 'assistant') };
    }
  }

  // An update that names no message belongs to the assistant turn currently
  // open: the message the replay is re-emitting while a replay runs, the newest
  // one otherwise. A replay that had to fall back to the newest message put
  // tool calls on whichever message happened to sit last in the array.
  const openIndex = messageId
    ? -1
    : state.replay.replaying && state.replay.anchorMessageId !== null
      ? state.messages.findIndex((message) => message.info.id === state.replay.anchorMessageId)
      : state.messages.length - 1;
  const open = openIndex >= 0 ? state.messages[openIndex] : undefined;
  if (open?.info.role === 'assistant' && (state.replay.replaying || !open.info.time.completed)) {
    const messages = [...state.messages];
    messages[openIndex] = mutate(open);
    return { ...state, messages, replay: anchored(state, open.info.id, 'assistant') };
  }

  const completed = Date.now();
  const messages = state.messages.map((message) => completeAssistantMessage(message, completed));
  const created = mutate(createAssistantMessage({ ...state, messages }, messageId));
  return {
    ...state,
    nextId: state.nextId + 1,
    messages: withMessage({ ...state, messages }, created),
    replay: anchored(state, created.info.id, 'assistant'),
  };
}

function appendText(
  state: AcpProjection,
  type: 'text' | 'reasoning',
  text: string,
  messageId: string | null,
): AcpProjection {
  if (!text) return state;
  const pendingText = openSegments(state, messageId);
  const fold = (message: AcpMessageWithParts): AcpMessageWithParts => {
    const key = segmentKey(message.info.id, type);
    const segment = (pendingText[key] ?? '') + text;
    pendingText[key] = segment;
    const parts = [...message.parts];
    const existingIndex = parts.findIndex((part) => part.type === type);
    if (existingIndex >= 0) {
      const previous = parts[existingIndex] as Extract<Part, { type: 'text' | 'reasoning' }>;
      // The longest re-emission wins. A live stream grows its own segment, so
      // this is a plain append there; a replay of an already-projected message
      // is a shorter-or-equal segment and changes nothing.
      if (segment.length <= previous.text.length) return message;
      parts[existingIndex] = { ...previous, text: segment };
    } else {
      parts.push({
        id: `${message.info.id}-${type}`,
        sessionID: state.sessionId,
        messageID: message.info.id,
        type,
        text: segment,
        ...(type === 'reasoning' ? { time: { start: Date.now() } } : {}),
      } as Part);
    }
    return { ...message, parts };
  };
  const settle = (next: AcpProjection): AcpProjection => ({
    ...next,
    replay: { ...next.replay, activeMessageId: messageId, pendingText },
  });
  const last = state.messages.at(-1);
  if (
    !messageId &&
    !state.replay.replaying &&
    last?.info.role === 'assistant' &&
    last.info.time.completed &&
    last.parts.some((part) => part.type === 'step-finish')
  ) {
    const messages = [...state.messages];
    messages[messages.length - 1] = fold(last);
    return settle({ ...state, messages, replay: anchored(state, last.info.id, 'assistant') });
  }
  return settle(withAssistant(state, messageId, fold));
}

function applyUserText(
  state: AcpProjection,
  text: string,
  messageId: string | null,
): AcpProjection {
  if (!text) return state;
  const pendingText = openSegments(state, messageId);
  const settle = (next: AcpProjection, positioned: string | null): AcpProjection => ({
    ...next,
    replay: {
      ...next.replay,
      activeMessageId: messageId,
      pendingText,
      ...(positioned !== null && next.replay.replaying ? { anchorMessageId: positioned } : {}),
    },
  });
  const fold = (message: AcpMessageWithParts): AcpMessageWithParts => {
    const key = segmentKey(message.info.id, 'text');
    const segment = (pendingText[key] ?? '') + text;
    pendingText[key] = segment;
    const parts = [...message.parts];
    const index = parts.findIndex((part) => part.type === 'text');
    if (index < 0) return message;
    const previous = parts[index] as Extract<Part, { type: 'text' }>;
    if (segment.length <= previous.text.length) return message;
    parts[index] = { ...previous, text: segment };
    return { ...message, parts };
  };
  if (messageId) {
    const existingIndex = state.messages.findIndex(
      (message) => message.info.role === 'user' && message.info.id === messageId,
    );
    if (existingIndex >= 0) {
      const messages = [...state.messages];
      messages[existingIndex] = fold(messages[existingIndex]);
      return settle({ ...state, messages }, messageId);
    }
    const syntheticIndex = [...state.messages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(
        ({ message }) =>
          message.info.role === 'user' &&
          message.info.id.startsWith('acp-user-') &&
          message.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('') === text,
      )?.index;
    if (syntheticIndex !== undefined) {
      // A replay re-emits the prompt this projection already built from the
      // `session/prompt` request, which carries no harness id. Adopt the native
      // id instead of projecting the turn twice.
      // Adopting keeps the slot the optimistic prompt already occupies. That
      // slot came from the live `session/prompt`, which is the moment the user
      // actually sent the turn — re-positioning it from the replay would let a
      // stray in-flight chunk that landed right after the attach drag a whole
      // turn to the bottom (dev session 6a7b3c29-ce92-4e4f-8f63-2696db54b1b9).
      const messages = [...state.messages];
      messages[syntheticIndex] = createUserMessage(state, text, messageId);
      pendingText[segmentKey(messageId, 'text')] = text;
      return settle({ ...state, messages }, messageId);
    }
  }
  const last = state.messages.at(-1);
  if (!messageId && last?.info.role === 'user') {
    const index = last.parts.findIndex((part) => part.type === 'text');
    const previous = index >= 0 ? (last.parts[index] as Extract<Part, { type: 'text' }>) : null;
    if (previous?.text === text) return state;
    const messages = [...state.messages];
    messages[messages.length - 1] = fold(last);
    return settle({ ...state, messages }, last.info.id);
  }
  const created = createUserMessage(state, text, messageId);
  pendingText[segmentKey(created.info.id, 'text')] = text;
  return settle(
    {
      ...state,
      nextId: state.nextId + 1,
      messages: withMessage(state, created),
    },
    created.info.id,
  );
}

function projectTool(state: AcpProjection, update: Record<string, unknown>): AcpProjection {
  const callId = asString(update.toolCallId);
  if (!callId) return state;
  const owner = state.messages.find((message) =>
    message.parts.some((part) => part.type === 'tool' && part.callID === callId),
  );
  const ownerId = owner?.info.role === 'assistant' ? owner.info.id : null;
  return withAssistant(state, ownerId, (message) => {
    const parts = [...message.parts];
    const index = parts.findIndex((part) => part.type === 'tool' && part.callID === callId);
    const previous = index >= 0 ? (parts[index] as ToolPart) : null;
    const input = isObject(update.rawInput) ? update.rawInput : (previous?.state.input ?? {});
    // Status is MONOTONIC. A `session/load` replay re-emits every finished call
    // as `pending` again; a call that reached `completed` or `error` must never
    // walk back to running, and its output, title, metadata and timing must
    // survive the re-emission that carries none of them.
    const terminal =
      previous?.state.status === 'completed' || previous?.state.status === 'error'
        ? previous.state
        : null;
    const status =
      terminal?.status ?? asString(update.status) ?? previous?.state.status ?? 'pending';
    const tool = nativeToolName(update, previous);
    const rawTitle = asString(update.title);
    const title = projectedToolTitle(tool, rawTitle);
    const genericTitle = !rawTitle || normalizeToolName(rawTitle) === normalizeToolName(tool);
    const previousTitle =
      previous?.state.status === 'running' || previous?.state.status === 'completed'
        ? previous.state.title
        : undefined;
    const rawOutput = update.rawOutput;
    const outputMetadata =
      isObject(rawOutput) && isObject(rawOutput.metadata) ? rawOutput.metadata : null;
    const now = Date.now();
    const start = previous && previous.state.status !== 'pending' ? previous.state.time.start : now;
    const end = terminal ? terminal.time.end : now;
    let part: ToolPart;
    if (status === 'completed') {
      part = {
        id: previous?.id ?? `${message.info.id}-tool-${callId}`,
        sessionID: state.sessionId,
        messageID: message.info.id,
        type: 'tool',
        callID: callId,
        tool,
        state: {
          status: 'completed',
          input,
          output:
            toolOutput(rawOutput) || (terminal?.status === 'completed' ? terminal.output : ''),
          title: (genericTitle ? previousTitle : rawTitle) ?? title,
          metadata:
            outputMetadata ?? (terminal?.status === 'completed' ? terminal.metadata : {}) ?? {},
          time: { start, end },
        },
      };
    } else if (status === 'failed' || status === 'error') {
      part = {
        id: previous?.id ?? `${message.info.id}-tool-${callId}`,
        sessionID: state.sessionId,
        messageID: message.info.id,
        type: 'tool',
        callID: callId,
        tool,
        state: {
          status: 'error',
          input,
          error:
            toolOutput(rawOutput) ||
            (terminal?.status === 'error' ? terminal.error : '') ||
            title ||
            'Tool call failed',
          time: { start, end },
        },
      };
    } else {
      part = {
        id: previous?.id ?? `${message.info.id}-tool-${callId}`,
        sessionID: state.sessionId,
        messageID: message.info.id,
        type: 'tool',
        callID: callId,
        tool,
        state: {
          status: 'running',
          input,
          title,
          time: { start },
        },
      };
    }
    if (index >= 0) parts[index] = part;
    else parts.push(part);
    return { ...message, parts };
  });
}

function normalizeTodo(value: unknown): Todo | null {
  if (!isObject(value)) return null;
  const content = asString(value.content) ?? asString(value.title);
  if (!content) return null;
  return {
    content,
    status: asString(value.status) ?? 'pending',
    priority: asString(value.priority) ?? 'medium',
  };
}

function normalizeTodos(entries: unknown): Todo[] {
  return Array.isArray(entries)
    ? entries.flatMap((entry) => {
        const todo = normalizeTodo(entry);
        return todo ? [todo] : [];
      })
    : [];
}

function normalizeQuestion(params: Record<string, unknown>): QuestionInfo[] {
  const explicit = Array.isArray(params.questions) ? params.questions : [];
  const fromExplicit = explicit.flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    const question =
      asString(candidate.question) ?? asString(candidate.label) ?? asString(params.message);
    if (!question) return [];
    const options = Array.isArray(candidate.options)
      ? candidate.options.flatMap((option) => {
          if (typeof option === 'string') {
            return [{ label: option, description: option }];
          }
          if (!isObject(option)) return [];
          const label = asString(option.label) ?? asString(option.name);
          if (!label) return [];
          return [
            {
              label,
              description: asString(option.description) ?? label,
            },
          ];
        })
      : [];
    return [
      {
        question,
        header: asString(candidate.header) ?? question.slice(0, 30),
        options,
        multiple: candidate.multiple === true,
        custom: candidate.allowText === true,
      },
    ];
  });
  if (fromExplicit.length > 0) return fromExplicit;

  const schema = isObject(params.requestedSchema)
    ? params.requestedSchema
    : isObject(params.schema)
      ? params.schema
      : null;
  const properties = schema && isObject(schema.properties) ? schema.properties : {};
  const fromSchema = Object.entries(properties).flatMap(([key, raw]) => {
    if (!isObject(raw)) return [];
    const values = Array.isArray(raw.enum) ? raw.enum : [];
    return [
      {
        question:
          asString(raw.title) ?? asString(raw.description) ?? asString(params.message) ?? key,
        header: key.slice(0, 30),
        options: values.map((value) => ({
          label: String(value),
          description: String(value),
        })),
        custom: values.length === 0,
      },
    ];
  });
  if (fromSchema.length > 0) return fromSchema;

  const message = asString(params.message) ?? 'Kortix needs your input';
  return [
    {
      question: message,
      header: message.slice(0, 30),
      options: [],
      custom: true,
    },
  ];
}

/** Status implied by the prompts still awaiting a response. */
function statusFor(pendingPrompts: readonly string[]): SessionStatus {
  return pendingPrompts.length > 0 ? { type: 'busy' } : { type: 'idle' };
}

function withPendingPrompt(state: AcpProjection, id: AcpJsonRpcId): AcpProjection {
  const key = String(id);
  const pendingPrompts = state.pendingPrompts.includes(key)
    ? state.pendingPrompts
    : [...state.pendingPrompts, key];
  return { ...state, pendingPrompts, status: statusFor(pendingPrompts) };
}

function withoutPendingPrompt(state: AcpProjection, id: AcpJsonRpcId): AcpProjection {
  const key = String(id);
  if (!state.pendingPrompts.includes(key)) return state;
  const pendingPrompts = state.pendingPrompts.filter((pending) => pending !== key);
  return { ...state, pendingPrompts, status: statusFor(pendingPrompts) };
}

/**
 * A client handshake or session (re)load. Whoever sends one has just attached,
 * so no prompt it never saw a response for can still be answered to it: any
 * carried-over pending prompt is dead and its turn is settled.
 */
function isRuntimeAttachRequest(method: string): boolean {
  return method === 'initialize' || method === 'session/new' || method === 'session/load';
}

function applyRequest(
  state: AcpProjection,
  id: AcpJsonRpcId,
  method: string,
  rawParams: unknown,
): AcpProjection {
  const params = isObject(rawParams) ? rawParams : {};
  const scoped = asString(params.sessionId);
  if (isRuntimeAttachRequest(method) && (!scoped || scoped === state.sessionId)) {
    // Whatever arrives after an attach is a re-emission, not a continuation, so
    // no message stays open across it — and the re-emission's order, not this
    // projection's arrival order, is the true one from here on.
    if (
      state.pendingPrompts.length === 0 &&
      state.replay.activeMessageId === null &&
      state.replay.replaying &&
      state.replay.anchorMessageId === null
    ) {
      return state;
    }
    return {
      ...state,
      pendingPrompts: [],
      status: { type: 'idle' },
      replay: {
        ...state.replay,
        activeMessageId: null,
        replaying: true,
        anchorMessageId: null,
      },
    };
  }
  if (scoped !== state.sessionId) return state;
  if (method === 'session/prompt') {
    // A prompt ends any replay window: everything after it is live output whose
    // arrival order is its true order.
    const live = withPendingPrompt(
      { ...state, replay: { ...state.replay, replaying: false, anchorMessageId: null } },
      id,
    );
    const prompt = Array.isArray(params.prompt) ? params.prompt : [];
    const text = prompt
      .flatMap((part) =>
        isObject(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : [],
      )
      .join('');
    if (!text) return live;
    const created = createUserMessage(live, text, `acp-user-${String(id)}`);
    return {
      ...live,
      nextId: live.nextId + 1,
      messages: [...live.messages, created],
      replay: {
        ...live.replay,
        // The request carries no harness id, so the message the harness later
        // re-emits for this prompt is a new segment, not a continuation.
        activeMessageId: null,
        pendingText: {
          ...live.replay.pendingText,
          [segmentKey(created.info.id, 'text')]: text,
        },
      },
    };
  }
  if (method === 'session/request_permission') {
    const toolCall = isObject(params.toolCall) ? params.toolCall : {};
    const request: PermissionRequest = {
      id: String(id),
      sessionID: state.sessionId,
      permission: asString(toolCall.title) ?? asString(params.permission) ?? 'tool',
      patterns: [],
      metadata: { acp: params },
      always: [],
      ...(asString(toolCall.toolCallId)
        ? {
            tool: {
              messageID: state.messages.at(-1)?.info.id ?? state.sessionId,
              callID: String(toolCall.toolCallId),
            },
          }
        : {}),
    };
    return {
      ...state,
      permissions: [...state.permissions.filter((item) => item.id !== request.id), request],
    };
  }
  if (
    method === 'elicitation/create' ||
    method === 'elicitation/request' ||
    method === 'session/request_input'
  ) {
    const request: QuestionRequest = {
      id: String(id),
      sessionID: state.sessionId,
      questions: normalizeQuestion(params),
    };
    return {
      ...state,
      questions: [...state.questions.filter((item) => item.id !== request.id), request],
    };
  }
  return state;
}

interface ReportedTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

/**
 * The provider's token report, reconciled against its own `totalTokens`.
 *
 * `totalTokens` is the source of truth. It is present on every ACP prompt
 * result observed in `kortix.acp_session_envelopes` (184/184), and it is the
 * only field that is right for every provider: some bill `thoughtTokens` on top
 * of `outputTokens` (`total = input + output + thought + cachedRead`), and some
 * bill them *inside* `outputTokens` (`total = input + output + cachedRead`).
 * Re-deriving a total by summing the components therefore over-reports thinking
 * on the second family — 10 of those 184 payloads, e.g. `{input 7430, output 18,
 * thought 9, cachedRead 3456, total 10904}` sums to 10913.
 *
 * So the components are reconciled instead of trusted: `reasoning` always
 * reports `thoughtTokens` — thinking is real spend and real context and is never
 * folded away — `output` drops the thinking already counted inside it, and
 * `input` absorbs the remainder so the five components sum to `totalTokens`
 * exactly. Renderers keep summing, and the sum is now the authoritative number.
 */
function reportedTokens(usage: Record<string, unknown>): ReportedTokens {
  const input = Number(usage.inputTokens) || 0;
  const rawOutput = Number(usage.outputTokens) || 0;
  const reasoning = Number(usage.thoughtTokens) || 0;
  const read = Number(usage.cachedReadTokens) || 0;
  const write = Number(usage.cachedWriteTokens) || 0;
  const total = Number(usage.totalTokens) || 0;
  if (total <= 0) {
    return { input, output: rawOutput, reasoning, cache: { read, write } };
  }
  const output =
    input + rawOutput + reasoning + read + write === total
      ? rawOutput
      : Math.max(rawOutput - reasoning, 0);
  return {
    input: Math.max(total - output - reasoning - read - write, 0),
    output,
    reasoning,
    cache: { read, write },
  };
}

function totalOf(tokens: ReportedTokens): number {
  return tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write;
}

function finishPrompt(state: AcpProjection, result: Record<string, unknown>): AcpProjection {
  const settled = statusFor(state.pendingPrompts);
  // The turn's usage belongs to the assistant that produced it. Reading only the
  // newest message dropped it whenever a queued prompt had already appended the
  // next user bubble.
  const index = state.messages.reduce(
    (found, message, at) => (message.info.role === 'assistant' ? at : found),
    -1,
  );
  const target = index >= 0 ? state.messages[index] : null;
  if (!target || target.info.role !== 'assistant') {
    return { ...state, status: settled };
  }
  const usage = isObject(result.usage) ? result.usage : {};
  const tokens = reportedTokens(usage);
  const total = totalOf(tokens);
  const reason = asString(result.stopReason) ?? 'end_turn';
  const finish: StepFinishPart = {
    id: `${target.info.id}-finish`,
    sessionID: state.sessionId,
    messageID: target.info.id,
    type: 'step-finish',
    reason,
    cost: Number(usage.cost) || 0,
    tokens,
  };
  const info: AssistantMessage = {
    ...target.info,
    time: { ...target.info.time, completed: Date.now() },
    finish: reason,
    cost: finish.cost,
    tokens: finish.tokens,
  };
  const messages = [...state.messages];
  messages[index] = {
    info,
    parts: [...target.parts.filter((part) => part.type !== 'step-finish'), finish],
  };
  return {
    ...state,
    messages,
    status: settled,
    ...(total > 0 ? { contextUsed: total } : {}),
  };
}

export function createAcpProjection(sessionId: string): AcpProjection {
  return {
    sessionId,
    messages: [],
    status: { type: 'idle' },
    pendingPrompts: [],
    replay: {
      activeMessageId: null,
      pendingText: {},
      replaying: false,
      anchorMessageId: null,
    },
    todos: [],
    permissions: [],
    questions: [],
    configOptions: [],
    availableCommands: [],
    currentModeId: null,
    sessionInfo: null,
    usage: null,
    contextWindow: null,
    contextUsed: null,
    nextId: 1,
  };
}

export function applyAcpEnvelope(state: AcpProjection, envelope: AcpEnvelope): AcpProjection {
  if ('method' in envelope && 'id' in envelope) {
    return applyRequest(state, envelope.id, envelope.method, envelope.params);
  }

  if ('method' in envelope && envelope.method === 'session/update') {
    const params = isObject(envelope.params) ? envelope.params : {};
    if (asString(params.sessionId) !== state.sessionId) return state;
    const update = isObject(params.update) ? params.update : {};
    const kind = asString(update.sessionUpdate) ?? asString(update.type);
    const content = isObject(update.content) ? update.content : {};
    const text = asString(content.text) ?? '';
    const messageId = asString(update.messageId);

    if (kind === 'user_message_chunk') {
      return applyUserText(state, text, messageId);
    }
    if (kind === 'agent_thought_chunk') {
      return appendText(state, 'reasoning', text, messageId);
    }
    if (kind === 'agent_message_chunk') {
      return appendText(state, 'text', text, messageId);
    }
    if (kind === 'tool_call' || kind === 'tool_call_update') {
      return projectTool(state, update);
    }
    if (kind === 'plan') {
      return { ...state, todos: normalizeTodos(update.entries) };
    }
    if (kind === 'plan_update') {
      const plan = isObject(update.plan) ? update.plan : update;
      if (asString(plan.type) !== 'items') return state;
      return { ...state, todos: normalizeTodos(plan.entries) };
    }
    if (kind === 'plan_removed') {
      return { ...state, todos: [] };
    }
    if (kind === 'config_option_update' && Array.isArray(update.configOptions)) {
      return {
        ...state,
        configOptions: update.configOptions.filter(isObject),
      };
    }
    if (kind === 'available_commands_update' && Array.isArray(update.availableCommands)) {
      return {
        ...state,
        availableCommands: update.availableCommands.filter(isObject),
      };
    }
    if (kind === 'current_mode_update') {
      return {
        ...state,
        currentModeId: asString(update.currentModeId),
      };
    }
    if (kind === 'session_info_update') {
      const { sessionUpdate: _sessionUpdate, type: _type, ...sessionInfo } = update;
      return { ...state, sessionInfo };
    }
    if (kind === 'usage_update') {
      const { sessionUpdate: _sessionUpdate, type: _type, ...usage } = update;
      // The harness reports the context window of the model that actually ran,
      // and the context the conversation occupies right now. It resets `used` to
      // 0 between turns, so a zero is "no report", never "nothing in context".
      const size = Number(usage.size) || 0;
      const used = Number(usage.used) || 0;
      return {
        ...state,
        usage,
        ...(size > 0 ? { contextWindow: size } : {}),
        ...(used > 0 ? { contextUsed: used } : {}),
      };
    }
    return state;
  }

  if ('id' in envelope) {
    const id = String(envelope.id);
    const closed = withoutPendingPrompt(
      {
        ...state,
        permissions: state.permissions.filter((item) => item.id !== id),
        questions: state.questions.filter((item) => item.id !== id),
      },
      envelope.id,
    );
    return isObject(envelope.result) &&
      (asString(envelope.result.stopReason) || isObject(envelope.result.usage))
      ? finishPrompt(closed, envelope.result)
      : closed;
  }

  return state;
}
