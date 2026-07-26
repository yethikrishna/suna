/**
 * Shared shapes for the voice room UI. Kept separate from the LiveKit event
 * plumbing in `page.tsx` so the presentational components below don't need
 * to know anything about `livekit-client` — they just render plain data.
 */

/** Mirrors LiveKit's ConnectionState plus a deliberate, non-error "left". */
export type ConnectionPhase = 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'left';

export interface PresenceEntry {
  identity: string;
  name: string;
  isLocal: boolean;
  isAgent: boolean;
  micEnabled: boolean;
  speaking: boolean;
}

export interface TranscriptEntry {
  id: string;
  identity: string;
  name: string;
  isLocal: boolean;
  isAgent: boolean;
  text: string;
  /** false while the STT result is still being revised. */
  final: boolean;
  firstReceivedTime: number;
  lastReceivedTime: number;
}
