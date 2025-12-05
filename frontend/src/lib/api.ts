// Mock API implementation for frontend-only version

// Custom Error Classes
export class ApiError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ApiError';
    if (cause) this.cause = cause;
  }
}

export class NoAccessTokenAvailableError extends Error {
  constructor() {
    super('No access token available. Please sign in.');
    this.name = 'NoAccessTokenAvailableError';
  }
}

export class BillingError extends Error {
  constructor(
    public statusCode: number,
    public detail: { message: string },
    message?: string
  ) {
    super(message || detail.message || `Billing error (${statusCode})`);
    this.name = 'BillingError';
  }
}

// Types
export interface Project {
  id: string;
  name: string;
  description: string;
  account_id: string;
  created_at: string;
  updated_at?: string;
  sandbox?: {
    id: string;
    pass: string;
    vnc_preview: string;
    sandbox_url: string;
  };
  is_public?: boolean;
}

export interface Thread {
  thread_id: string;
  account_id: string;
  project_id: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  is_public?: boolean;
}

export interface Message {
  id: string;
  thread_id: string;
  type: string;
  content: string;
  created_at: string;
  updated_at?: string;
  agent_id?: string;
  is_llm_message?: boolean;
  agents?: {
    name: string;
    avatar: string;
    avatar_color: string;
  };
}

export interface AgentRun {
  agent_run_id: string;
  thread_id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  model_name?: string;
  finish_reason?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  last_modified: number;
  content?: string;
}

export interface InitiateAgentResponse {
  agent_id: string;
  thread_id?: string;
  message?: string;
}

// Mock data storage
let mockProjects: Project[] = [
  {
    id: '1',
    name: 'Suna AI Assistant',
    description: 'An intelligent AI assistant for development and productivity',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: true
  },
  {
    id: '2',
    name: 'E-commerce Platform',
    description: 'Full-stack e-commerce solution with payment integration',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: false
  },
  {
    id: '3',
    name: 'Task Management System',
    description: 'Collaborative task tracking and project management tool',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: true
  },
  {
    id: '4',
    name: 'Data Analytics Dashboard',
    description: 'Real-time analytics and visualization platform',
    account_id: 'user_1',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    is_public: false
  }
];

let mockThreads: Thread[] = [
  {
    thread_id: '1',
    account_id: 'user_1',
    project_id: '1',
    created_at: new Date().toISOString(),
    is_public: false
  }
];

let mockMessages: Message[] = [
  {
    id: '1',
    thread_id: '1',
    type: 'user',
    content: 'Hello, this is a test message',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    thread_id: '1',
    type: 'assistant',
    content: 'Hello! I am an AI assistant that can help you with various tasks.',
    created_at: new Date(Date.now() + 1000).toISOString(),
    is_llm_message: true,
    agents: {
      name: 'Default Assistant',
      avatar: '🤖',
      avatar_color: '#4CAF50'
    }
  }
];

let mockAgentRuns: AgentRun[] = [];

// Mock EventSource
class MockEventSource {
  private listeners: Map<string, Function[]> = new Map();
  private isOpen = true;
  private messageInterval: NodeJS.Timeout | null = null;
  private agentRunId: string;

  constructor(url: string) {
    this.agentRunId = url.split('/').pop() || 'unknown';
    this.setupMockStream();

    setTimeout(() => {
      this.dispatchEvent('open');
    }, 100);
  }

  private setupMockStream() {
    const mockResponses = [
      JSON.stringify({ type: 'status', status: 'running' }),
      JSON.stringify({ type: 'message_chunk', content: 'I need to analyze your request and provide help.' }),
      JSON.stringify({ type: 'message_chunk', content: '\n\nLet me think...' }),
      JSON.stringify({ type: 'tool_call', tool_name: 'browser_search', parameters: { query: 'frontend development best practices' } }),
      JSON.stringify({ type: 'tool_result', tool_name: 'browser_search', result: 'Found frontend development best practices including componentization, responsive design, and performance optimization.' }),
      JSON.stringify({ type: 'message_chunk', content: '\n\nBased on the search results, I recommend:\n1. Use component-based architecture\n2. Implement responsive design\n3. Optimize page performance' }),
      JSON.stringify({ type: 'status', status: 'completed' })
    ];

    let index = 0;
    this.messageInterval = setInterval(() => {
      if (!this.isOpen || index >= mockResponses.length) {
        this.close();
        return;
      }

      const message = mockResponses[index];
      this.dispatchEvent('message', { data: message });
      index++;
    }, 1500);
  }

  private dispatchEvent(eventType: string, eventData?: any) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      for (const listener of listeners) {
        listener(eventData);
      }
    }
  }

  addEventListener(eventType: string, listener: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  removeEventListener(eventType: string, listener: Function) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  close() {
    this.isOpen = false;
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
    this.dispatchEvent('close');
  }
}

// Active streams management
const activeStreams = new Map<string, MockEventSource>();
const nonRunningAgentRuns = new Set<string>();

// Utility functions
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Project APIs
export const getProjects = async (): Promise<Project[]> => {
  console.log('[MOCK API] Getting projects list');
  await delay(200);
  return [...mockProjects];
};

export const getProject = async (projectId: string): Promise<Project | null> => {
  console.log(`[MOCK API] Getting project: ${projectId}`);
  await delay(200);
  const project = mockProjects.find(p => p.id === projectId);
  return project || null;
};

export const createProject = async (project: Omit<Project, 'id' | 'created_at'>): Promise<Project> => {
  console.log('[MOCK API] Creating project');
  await delay(300);
  const newProject: Project = {
    ...project,
    id: generateId(),
    created_at: new Date().toISOString()
  };
  mockProjects.push(newProject);
  return newProject;
};

export const updateProject = async (projectId: string, updates: Partial<Project>): Promise<Project | null> => {
  console.log(`[MOCK API] Updating project: ${projectId}`);
  await delay(300);
  const index = mockProjects.findIndex(p => p.id === projectId);
  if (index === -1) return null;

  mockProjects[index] = { ...mockProjects[index], ...updates, updated_at: new Date().toISOString() };
  return mockProjects[index];
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  console.log(`[MOCK API] Deleting project: ${projectId}`);
  await delay(300);
  const initialLength = mockProjects.length;
  mockProjects = mockProjects.filter(p => p.id !== projectId);
  return mockProjects.length !== initialLength;
};

// Thread APIs
export const getThreads = async (projectId?: string): Promise<Thread[]> => {
  console.log(`[MOCK API] Getting threads list`, projectId ? `Project: ${projectId}` : 'All projects');
  await delay(200);
  let threads = [...mockThreads];
  if (projectId) {
    threads = threads.filter(t => t.project_id === projectId);
  }
  return threads;
};

export const getThread = async (threadId: string): Promise<Thread | null> => {
  console.log(`[MOCK API] Getting thread: ${threadId}`);
  await delay(200);
  const thread = mockThreads.find(t => t.thread_id === threadId);
  return thread || null;
};

export const createThread = async (thread: Omit<Thread, 'thread_id' | 'created_at'>): Promise<Thread> => {
  console.log('[MOCK API] Creating thread');
  await delay(300);
  const newThread: Thread = {
    ...thread,
    thread_id: generateId(),
    created_at: new Date().toISOString()
  };
  mockThreads.push(newThread);
  return newThread;
};

export const deleteThread = async (threadId: string): Promise<boolean> => {
  console.log(`[MOCK API] Deleting thread: ${threadId}`);
  await delay(300);
  const initialLength = mockThreads.length;
  mockThreads = mockThreads.filter(t => t.thread_id !== threadId);
  mockMessages = mockMessages.filter(m => m.thread_id !== threadId);
  return mockThreads.length !== initialLength;
};

// Message APIs
export const getMessages = async (threadId: string): Promise<Message[]> => {
  console.log(`[MOCK API] Getting messages: ${threadId}`);
  await delay(200);
  return mockMessages.filter(m => m.thread_id === threadId).sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export const addUserMessage = async (threadId: string, content: string): Promise<Message> => {
  console.log(`[MOCK API] Adding user message: ${threadId}`);
  await delay(300);
  const newMessage: Message = {
    id: generateId(),
    thread_id: threadId,
    type: 'user',
    content,
    created_at: new Date().toISOString()
  };
  mockMessages.push(newMessage);
  return newMessage;
};

// Agent APIs
export const startAgent = async (threadId: string): Promise<string> => {
  console.log(`[MOCK API] Starting agent: ${threadId}`);
  await delay(500);
  const agentRunId = generateId();
  const newAgentRun: AgentRun = {
    agent_run_id: agentRunId,
    thread_id: threadId,
    status: 'running',
    created_at: new Date().toISOString(),
    model_name: 'gpt-4'
  };
  mockAgentRuns.push(newAgentRun);
  return agentRunId;
};

export const getAgentStatus = async (agentRunId: string): Promise<{ status: string }> => {
  console.log(`[MOCK API] Getting agent status: ${agentRunId}`);
  await delay(200);

  if (nonRunningAgentRuns.has(agentRunId)) {
    return { status: 'stopped' };
  }

  const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
  return {
    status: agentRun?.status || 'agent_not_running'
  };
};

export const stopAgent = async (agentRunId: string): Promise<void> => {
  console.log(`[MOCK API] Stopping agent: ${agentRunId}`);
  await delay(300);
  nonRunningAgentRuns.add(agentRunId);

  const existingStream = activeStreams.get(agentRunId);
  if (existingStream) {
    existingStream.close();
    activeStreams.delete(agentRunId);
  }

  const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
  if (agentRun) {
    agentRun.status = 'stopped';
    agentRun.finish_reason = 'user_cancelled';
  }
};

export const getAgentRuns = async (threadId: string): Promise<AgentRun[]> => {
  console.log(`[MOCK API] Getting agent runs: ${threadId}`);
  await delay(200);
  return mockAgentRuns.filter(r => r.thread_id === threadId).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export const streamAgent = async (agentRunId: string, callbacks: {
  onMessage?: (data: any) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}): Promise<() => void> => {
  console.log(`[MOCK API] Starting agent stream: ${agentRunId}`);

  try {
    await delay(500);

    const agentRun = mockAgentRuns.find(r => r.agent_run_id === agentRunId);
    if (!agentRun || nonRunningAgentRuns.has(agentRunId)) {
      throw new Error('Agent run not found or not running');
    }

    const mockEventSource = new MockEventSource(`http://localhost:3000/agent/stream/${agentRunId}`);
    activeStreams.set(agentRunId, mockEventSource);

    if (callbacks.onMessage) {
      mockEventSource.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          callbacks.onMessage!(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
    }

    if (callbacks.onError) {
      mockEventSource.addEventListener('error', () => {
        callbacks.onError!('Stream error');
      });
    }

    if (callbacks.onClose) {
      mockEventSource.addEventListener('close', () => {
        callbacks.onClose!();
      });
    }

    return () => {
      console.log(`[MOCK STREAM] Cleaning up stream: ${agentRunId}`);
      const stream = activeStreams.get(agentRunId);
      if (stream) {
        stream.close();
        activeStreams.delete(agentRunId);
      }
    };
  } catch (error) {
    if (callbacks.onError) {
      callbacks.onError(error instanceof Error ? error.message : String(error));
    }
    return () => {};
  }
};

// File APIs
export const listSandboxFiles = async (projectId: string, path: string = '/'): Promise<FileInfo[]> => {
  console.log(`[MOCK API] Listing sandbox files: ${projectId}, path: ${path}`);
  await delay(200);
  return [
    { name: 'README.md', path: '/README.md', is_dir: false, size: 1024, last_modified: Date.now() },
    { name: 'src', path: '/src', is_dir: true, size: 0, last_modified: Date.now() }
  ];
};

export const getSandboxFileContent = async (projectId: string, path: string): Promise<string> => {
  console.log(`[MOCK API] Getting file content: ${projectId}, path: ${path}`);
  await delay(300);
  return `This is mock file content for path: ${path}`;
};

export const createSandboxFile = async (projectId: string, path: string, content: string): Promise<void> => {
  console.log(`[MOCK API] Creating file: ${projectId}, path: ${path}`);
  await delay(300);
};

// Auth APIs
export const getAccessToken = async (): Promise<string> => {
  console.log('[MOCK API] Getting access token');
  return 'mock-access-token';
};

// Health check
export const checkApiHealth = async (): Promise<{ status: string }> => {
  console.log('[MOCK API] Checking API health');
  return { status: 'ok' };
};

// Public projects
export const getPublicProjects = async (): Promise<Project[]> => {
  console.log('[MOCK API] Getting public projects');
  await delay(200);
  return mockProjects.filter(p => p.is_public);
};

// Agent initiation
export const initiateAgent = async (agentId: string): Promise<string> => {
  console.log(`[MOCK API] Initiating agent: ${agentId}`);
  await delay(500);
  return generateId();
};

// Billing APIs (mock)
export const createCheckoutSession = async (): Promise<{ sessionId: string, url: string }> => {
  console.log('[MOCK API] Creating checkout session');
  return {
    sessionId: generateId(),
    url: 'https://checkout.example.com/session/' + generateId()
  };
};

export const createPortalSession = async (): Promise<{ url: string }> => {
  console.log('[MOCK API] Creating portal session');
  return {
    url: 'https://portal.example.com/session/' + generateId()
  };
};

export const getSubscription = async (): Promise<{ status: string }> => {
  console.log('[MOCK API] Getting subscription status');
  return { status: 'active' };
};

// Audio transcription (mock)
export const transcribeAudio = async (audioFile: File): Promise<{ text: string }> => {
  console.log('[MOCK API] Transcribing audio');
  await delay(2000);
  return {
    text: 'This is mock audio transcription result.'
  };
};

// Agent builder chat history (mock)
export const getAgentBuilderChatHistory = async (agentId: string): Promise<any[]> => {
  console.log(`[MOCK API] Getting agent builder chat history: ${agentId}`);
  return [];
};

export const API_URL = 'http://localhost:3000';