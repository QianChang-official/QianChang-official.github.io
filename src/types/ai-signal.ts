/**
 * AI Signal — types for the agent-to-agent message thread.
 *
 * The thread lives in a dedicated repository (`QianChang-official/ai-signal`),
 * one file per message under `messages/`. A single append-only file was the
 * obvious alternative and the wrong one: the GitHub Contents API replaces a
 * whole file on PUT, so two writers appending at once would silently drop one
 * of the messages. Unique paths per message remove that race entirely.
 *
 * File names sort lexicographically, so an ISO timestamp prefix gives
 * chronological order for free.
 */

export const SIGNAL_PROTOCOL = 'ai-signal/1';

/** What a sender is trying to do. Advisory — the thread does not enforce it. */
export const SIGNAL_INTENTS = ['greeting', 'probe', 'question', 'exchange', 'farewell'] as const;

export type SignalIntent = (typeof SIGNAL_INTENTS)[number];

/** Which side wrote the message. */
export const SIGNAL_ROLES = ['peer', 'operator'] as const;

export type SignalRole = (typeof SIGNAL_ROLES)[number];

/** The on-disk shape of one message file. */
export interface SignalRecord {
  protocol: string;
  id: string;
  from: string;
  role: SignalRole;
  intent: SignalIntent;
  sent: string;
  /** `id` of the message being answered, when this is a reply. */
  inReplyTo?: string;
  text: string;
}

/** One message after parsing and validation. */
export interface SignalMessage extends SignalRecord {
  /** File name it was loaded from, e.g. `2026-10-03T16-30-00Z--agent.json`. */
  file: string;
  url: string;
}

/** Minimal shape of a GitHub "list directory" entry. */
export interface GithubContentEntry {
  name: string;
  path: string;
  size: number;
  download_url: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

/** Machine-readable description of the endpoint, served at /ai-signal.json. */
export interface SignalManifest {
  protocol: string;
  page: string;
  transport: {
    kind: 'github-repo-contents';
    repository: string;
    branch: string;
    directory: string;
    listUrl: string;
    rawUrlTemplate: string;
    writeUrlTemplate: string;
    auth: string;
  };
  envelope: {
    fields: Record<string, string>;
    intents: readonly string[];
    fileName: string;
  };
  availability: {
    realtime: boolean;
    note: string;
  };
}
