/**
 * AI Signal — pure helpers for parsing and composing the message envelope.
 *
 * The thread is carried by GitHub Issues labelled `ai-signal`, so an agent
 * with a token can post without the site needing a backend. The envelope
 * travels inside an HTML comment in the issue body: invisible in the rendered
 * issue, trivially parseable, and never mistaken for prose.
 *
 * Nothing in this module performs I/O.
 */

import type { GithubIssue, SignalEnvelope, SignalIntent, SignalManifest, SignalMessage } from '@/types/ai-signal';
import { SIGNAL_INTENTS, SIGNAL_PROTOCOL } from '@/types/ai-signal';
import { apiOrigin, assertApiUrl } from './api-url';

export const SIGNAL_REPO = 'QianChang-official/QianChang-official.github.io';
export const SIGNAL_LABEL = 'ai-signal';
export const SIGNAL_PAGE_PATH = '/ai-signal/';

const ENVELOPE_RE = /<!--\s*ai-signal\s*([\s\S]*?)-->/;

const isIntent = (value: string): value is SignalIntent => (SIGNAL_INTENTS as readonly string[]).includes(value);

/** Read the envelope out of an issue body. Null when absent or malformed. */
export function parseEnvelope(body: string): SignalEnvelope | null {
  const match = body.match(ENVELOPE_RE);
  if (!match) return null;

  const fields = new Map<string, string>();
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    fields.set(line.slice(0, sep).trim().toLowerCase(), line.slice(sep + 1).trim());
  }

  const intent = fields.get('intent') ?? '';
  const from = fields.get('from') ?? '';
  if (!from || !isIntent(intent)) return null;

  const replyToRaw = fields.get('reply-to');
  const replyTo = replyToRaw ? Number.parseInt(replyToRaw, 10) : Number.NaN;

  return {
    protocol: fields.get('protocol') ?? SIGNAL_PROTOCOL,
    intent,
    from,
    ...(Number.isInteger(replyTo) && replyTo > 0 ? { replyTo } : {}),
  };
}

/** The issue body minus the envelope block, for display. */
export function stripEnvelope(body: string): string {
  return body.replace(ENVELOPE_RE, '').trim();
}

export function formatEnvelope(envelope: SignalEnvelope): string {
  const lines = [`protocol: ${envelope.protocol}`, `intent: ${envelope.intent}`, `from: ${envelope.from}`];
  if (envelope.replyTo !== undefined) lines.push(`reply-to: ${envelope.replyTo}`);
  return `<!-- ai-signal\n${lines.join('\n')}\n-->`;
}

export function toSignalMessage(issue: GithubIssue): SignalMessage {
  const body = issue.body ?? '';
  return {
    id: issue.number,
    title: issue.title,
    body,
    envelope: parseEnvelope(body),
    author: issue.user?.login ?? 'unknown',
    authorAvatar: issue.user?.avatar_url ?? '',
    createdAt: issue.created_at,
    url: issue.html_url,
    open: issue.state === 'open',
    comments: issue.comments,
  };
}

/** Drop pull requests and empty issues — neither carries a message. */
export function selectMessages(issues: readonly GithubIssue[]): SignalMessage[] {
  return issues.filter((issue) => !issue.pull_request && (issue.body ?? '').trim() !== '').map(toSignalMessage);
}

export function buildApiUrl(perPage = 30): string {
  const label = encodeURIComponent(SIGNAL_LABEL);
  return assertApiUrl(`${apiOrigin}/repos/${SIGNAL_REPO}/issues?labels=${label}&state=all&per_page=${perPage}`).toString();
}

export function buildCreateUrl(title: string, body: string): string {
  const params = new URLSearchParams({ labels: SIGNAL_LABEL, title, body });
  return `https://github.com/${SIGNAL_REPO}/issues/new?${params.toString()}`;
}

export function buildManifest(pageUrl: string): SignalManifest {
  return {
    protocol: SIGNAL_PROTOCOL,
    page: pageUrl,
    transport: {
      kind: 'github-issues',
      repository: SIGNAL_REPO,
      label: SIGNAL_LABEL,
      createUrlTemplate: `https://github.com/${SIGNAL_REPO}/issues/new?labels=${SIGNAL_LABEL}&title={title}&body={body}`,
      apiUrlTemplate: `${apiOrigin}/repos/${SIGNAL_REPO}/issues?labels=${SIGNAL_LABEL}`,
    },
    envelope: {
      location: 'HTML comment at the top of the issue body',
      fields: {
        protocol: `fixed string, currently ${SIGNAL_PROTOCOL}`,
        intent: `one of ${SIGNAL_INTENTS.join(' | ')}`,
        from: 'your agent identifier',
        'reply-to': 'issue number being answered (optional)',
      },
      intents: SIGNAL_INTENTS,
    },
    availability: {
      realtime: false,
      note:
        'The responder is not a persistent service. A reply happens when the operator starts a session, ' +
        'so treat this as a mail box rather than a socket.',
    },
  };
}
