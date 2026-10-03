import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GithubIssue } from '@/types/ai-signal';
import { assertApiUrl } from './api-url';
import { buildCreateUrl, formatEnvelope, parseEnvelope, selectMessages, stripEnvelope, toSignalMessage } from './protocol';

const issue = (over: Partial<GithubIssue> = {}): GithubIssue => ({
  number: 1,
  title: 'hello',
  body: 'body',
  html_url: 'https://github.com/o/r/issues/1',
  state: 'open',
  comments: 0,
  created_at: '2026-01-01T00:00:00Z',
  user: { login: 'someone', avatar_url: '' },
  ...over,
});

describe('assertApiUrl', () => {
  it('accepts the GitHub API origin', () => {
    assert.equal(assertApiUrl('https://api.github.com/repos/a/b/issues').hostname, 'api.github.com');
  });

  it('rejects plain http', () => {
    assert.throws(() => assertApiUrl('http://api.github.com/x'), /https/);
  });

  it('rejects another origin even over https', () => {
    assert.throws(() => assertApiUrl('https://example.com/x'), /origin/);
  });

  it('rejects loopback and private addresses', () => {
    for (const host of ['https://localhost/x', 'https://127.0.0.1/x', 'https://192.168.1.1/x', 'https://10.0.0.1/x']) {
      assert.throws(() => assertApiUrl(host));
    }
  });

  it('rejects values that are not URLs', () => {
    assert.throws(() => assertApiUrl('not a url'), /absolute URL/);
  });
});

describe('parseEnvelope', () => {
  it('reads a well formed envelope', () => {
    const body = '<!-- ai-signal\nprotocol: ai-signal/1\nintent: greeting\nfrom: probe-agent\n-->\nhi';
    assert.deepEqual(parseEnvelope(body), {
      protocol: 'ai-signal/1',
      intent: 'greeting',
      from: 'probe-agent',
    });
  });

  it('keeps reply-to when it is a positive integer', () => {
    const body = '<!-- ai-signal\nintent: exchange\nfrom: a\nreply-to: 42\n-->';
    assert.equal(parseEnvelope(body)?.replyTo, 42);
  });

  it('drops a non-numeric reply-to rather than trusting it', () => {
    const body = '<!-- ai-signal\nintent: exchange\nfrom: a\nreply-to: ../etc/passwd\n-->';
    assert.equal(parseEnvelope(body)?.replyTo, undefined);
  });

  it('returns null for an unknown intent', () => {
    assert.equal(parseEnvelope('<!-- ai-signal\nintent: nonsense\nfrom: a\n-->'), null);
  });

  it('returns null when from is missing', () => {
    assert.equal(parseEnvelope('<!-- ai-signal\nintent: greeting\n-->'), null);
  });

  it('returns null when there is no envelope', () => {
    assert.equal(parseEnvelope('just a normal issue'), null);
  });
});

describe('formatEnvelope / stripEnvelope', () => {
  it('round-trips through parse', () => {
    const original = { protocol: 'ai-signal/1', intent: 'question' as const, from: 'agent-x', replyTo: 7 };
    assert.deepEqual(parseEnvelope(formatEnvelope(original)), original);
  });

  it('omits reply-to when absent', () => {
    assert.ok(!formatEnvelope({ protocol: 'ai-signal/1', intent: 'probe', from: 'a' }).includes('reply-to'));
  });

  it('stripEnvelope leaves the prose behind', () => {
    const body = `${formatEnvelope({ protocol: 'ai-signal/1', intent: 'probe', from: 'a' })}\n\nthe actual message`;
    assert.equal(stripEnvelope(body), 'the actual message');
  });
});

describe('toSignalMessage / selectMessages', () => {
  it('tolerates a missing body', () => {
    assert.equal(toSignalMessage(issue({ body: null })).envelope, null);
  });

  it('tolerates an anonymous author', () => {
    assert.equal(toSignalMessage(issue({ user: null })).author, 'unknown');
  });

  it('drops pull requests and empty issues', () => {
    const kept = selectMessages([
      issue({ number: 1 }),
      issue({ number: 2, body: '   ' }),
      issue({ number: 3, pull_request: {} }),
    ]);
    assert.deepEqual(
      kept.map((message) => message.id),
      [1],
    );
  });
});

describe('buildCreateUrl', () => {
  it('encodes the title and body and carries the label', () => {
    const url = new URL(buildCreateUrl('a b', 'c&d'));
    assert.equal(url.searchParams.get('labels'), 'ai-signal');
    assert.equal(url.searchParams.get('title'), 'a b');
    assert.equal(url.searchParams.get('body'), 'c&d');
  });
});
