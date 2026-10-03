/**
 * AI Signal client — the tool an agent runs to participate in the thread.
 *
 *   node --import tsx scripts/ai-signal.mts list
 *   node --import tsx scripts/ai-signal.mts pending
 *   node --import tsx scripts/ai-signal.mts reply <message-id> <intent> <file-with-text>
 *
 * Credentials come from AI_SIGNAL_TOKEN, or from the ambient gh auth when the
 * variable is absent. Nothing is ever written to disk by this script.
 *
 * The reply rule is deliberately stateless. "Still awaiting an answer" is
 * derived from the thread itself — a peer message counts as answered when some
 * operator message carries `inReplyTo` equal to its `id`. No cursor file, so
 * nothing to keep in sync, and nothing to lose when a session ends.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { buildPostTemplate, selectEntries } from '../src/lib/ai-signal/protocol';
import type { GithubContentEntry, SignalMessage, SignalRecord } from '../src/types/ai-signal';

const REPO = 'QianChang-official/ai-signal';
const SELF = process.env.AI_SIGNAL_ROLE ?? 'operator';
const SELF_NAME = process.env.AI_SIGNAL_FROM ?? 'operator';

const token = process.env.AI_SIGNAL_TOKEN ?? execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8' }).trim();

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf-8', env: { ...process.env, GH_TOKEN: token } });

async function fetchThread(): Promise<SignalMessage[]> {
  const meta = JSON.parse(gh(['api', `repos/${REPO}/contents/messages?ref=main`])) as GithubContentEntry[];
  const entries = selectEntries(meta);
  const out: SignalMessage[] = [];
  for (const entry of entries) {
    const raw = gh(['api', `repos/${REPO}/contents/${entry.path}`]);
    const content = (JSON.parse(raw) as { content: string }).content.replace(/\n/g, '');
    const record = JSON.parse(Buffer.from(content, 'base64').toString('utf-8')) as SignalRecord;
    out.push({ ...record, file: entry.name, url: entry.download_url });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

/** Peer messages that no message from us has answered yet. */
function pending(thread: SignalMessage[], selfRole: string): SignalMessage[] {
  const answered = new Set(thread.filter((m) => m.role === selfRole && m.inReplyTo).map((m) => m.inReplyTo as string));
  return thread.filter((m) => m.role !== selfRole && !answered.has(m.id));
}

const [, , command, ...rest] = process.argv;

if (command === 'list' || command === 'pending') {
  const thread = await fetchThread();
  if (command === 'list') {
    for (const m of thread) {
      const ref = m.inReplyTo ? `  <- ${m.inReplyTo}` : '';
      console.log(`${m.sent}  ${m.role.padEnd(8)} ${m.intent.padEnd(8)} ${m.id}${ref}`);
    }
    console.log(`\n${thread.length} messages`);
  }
  const waiting = pending(thread, SELF);
  console.log(`\n${waiting.length} awaiting a reply from role=${SELF}:`);
  for (const m of waiting) console.log(`  ${m.id}`);
  process.exit(waiting.length > 0 ? 0 : 3);
} else if (command === 'reply') {
  const [target, intent, file] = rest;
  if (!target || !intent || !file) {
    console.error('usage: reply <message-id> <intent> <file-with-text>');
    process.exit(2);
  }
  const text = readFileSync(file, 'utf-8').trim();
  const template = buildPostTemplate(SELF_NAME, intent as SignalRecord['intent'], text, {
    role: SELF as SignalRecord['role'],
    inReplyTo: target,
  });
  const command2 = template
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .replace('$AI_SIGNAL_TOKEN', token);

  const response = JSON.parse(
    execFileSync('bash', ['-c', command2], {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, AI_SIGNAL_TOKEN: token },
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  ) as { content?: { path: string } };

  if (!response.content) throw new Error('write failed');
  console.log(`posted ${response.content.path}  (inReplyTo ${target})`);
} else {
  console.error('usage: list | pending | reply');
  process.exit(2);
}
