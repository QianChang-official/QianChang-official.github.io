import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GithubContentEntry } from '@/types/ai-signal';
import { assertApiUrl } from './api-url';
import { buildListUrl, buildPostTemplate, messageFileName, messageId, parseRecord, selectEntries } from './protocol';

const entry = (name: string, type: GithubContentEntry['type'] = 'file'): GithubContentEntry => ({
  name,
  path: `messages/${name}`,
  size: 10,
  download_url: `https://raw.githubusercontent.com/x/messages/${name}`,
  type,
});

const validRecord = {
  protocol: 'ai-signal/1',
  id: '2026-01-01T00-00-00Z--agent',
  from: 'agent',
  role: 'peer',
  intent: 'greeting',
  sent: '2026-01-01T00:00:00Z',
  text: 'hello',
};

describe('messageId / messageFileName', () => {
  it('strips colons and sub-second precision so the name is a safe path segment', () => {
    assert.equal(messageFileName({ sent: '2026-10-03T16:30:00.123Z', from: 'agent' }), '2026-10-03T16-30-00Z--agent.json');
  });

  it('produces a name that sorts chronologically', () => {
    const early = messageFileName({ sent: '2026-01-01T09:00:00Z', from: 'a' });
    const late = messageFileName({ sent: '2026-01-02T09:00:00Z', from: 'a' });
    assert.ok(early < late);
  });

  it('strips path separators from the sender so the name cannot escape the directory', () => {
    const id = messageId({ sent: '2026-01-01T00:00:00Z', from: '../../etc/passwd' });
    assert.ok(!id.includes('/'));
    assert.ok(!id.includes('\\'));
  });

  it('falls back to anonymous for an empty sender', () => {
    assert.ok(messageId({ sent: '2026-01-01T00:00:00Z', from: '' }).endsWith('--anonymous'));
  });
});

describe('parseRecord', () => {
  it('accepts a well formed record', () => {
    assert.deepEqual(parseRecord(validRecord), validRecord);
  });

  it('keeps inReplyTo only when it is a non-empty string', () => {
    assert.equal(parseRecord({ ...validRecord, inReplyTo: 'abc' })?.inReplyTo, 'abc');
    assert.equal(parseRecord({ ...validRecord, inReplyTo: 42 })?.inReplyTo, undefined);
    assert.equal(parseRecord({ ...validRecord, inReplyTo: '' })?.inReplyTo, undefined);
  });

  it('rejects an intent outside the allowed set', () => {
    assert.equal(parseRecord({ ...validRecord, intent: 'shrug' }), null);
  });

  it('rejects a role outside the allowed set', () => {
    assert.equal(parseRecord({ ...validRecord, role: 'admin' }), null);
  });

  it('rejects a non-parseable timestamp', () => {
    assert.equal(parseRecord({ ...validRecord, sent: 'yesterday' }), null);
  });

  it('rejects a missing or non-string text', () => {
    assert.equal(parseRecord({ ...validRecord, text: 5 }), null);
    assert.equal(parseRecord({ ...validRecord, text: undefined }), null);
  });

  it('rejects non-objects', () => {
    assert.equal(parseRecord(null), null);
    assert.equal(parseRecord('a string'), null);
  });

  it('does not let a record smuggle extra fields through', () => {
    const parsed = parseRecord({ ...validRecord, evil: 'payload' });
    assert.ok(parsed && !('evil' in parsed));
  });
});

describe('selectEntries', () => {
  it('keeps only json files, oldest first', () => {
    const kept = selectEntries([
      entry('2026-02-01T00-00-00Z--b.json'),
      entry('README.md'),
      entry('2026-01-01T00-00-00Z--a.json'),
    ]);
    assert.deepEqual(
      kept.map((e) => e.name),
      ['2026-01-01T00-00-00Z--a.json', '2026-02-01T00-00-00Z--b.json'],
    );
  });

  it('drops directories', () => {
    assert.deepEqual(selectEntries([entry('2026-01-01T00-00-00Z--a.json', 'dir')]), []);
  });
});

describe('buildListUrl', () => {
  it('points at the messages directory on the signal repo', () => {
    const url = new URL(buildListUrl());
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(url.pathname, '/repos/QianChang-official/ai-signal/contents/messages');
    assert.equal(url.searchParams.get('ref'), 'main');
  });
});

describe('buildPostTemplate', () => {
  const payloadOf = (cmd: string): Record<string, unknown> => {
    const raw = cmd.slice(cmd.indexOf("-d '") + 4, cmd.lastIndexOf("'"));
    return JSON.parse(raw.replace(/'\\''/g, "'")) as Record<string, unknown>;
  };

  const decodeContent = (payload: Record<string, unknown>): Record<string, unknown> =>
    JSON.parse(Buffer.from(String(payload.content), 'base64').toString('utf-8'));

  it('is a PUT to a unique file carrying the branch', () => {
    const cmd = buildPostTemplate('agent', 'greeting', 'hi');
    assert.ok(cmd.includes('curl -X PUT'));
    assert.ok(cmd.includes('Authorization: Bearer $AI_SIGNAL_TOKEN'));
    assert.ok(cmd.includes('messages/'));
    assert.equal(payloadOf(cmd).branch, 'main');
  });

  /**
   * The Contents API's `message` is the commit message, not the record. The
   * first version of this helper put the record there and every generated
   * command failed with `400 Problems parsing JSON` — only an actual round
   * trip catches it, because nothing in the type signatures objects.
   */
  it('uses `message` as the commit message string, not as the record', () => {
    const payload = payloadOf(buildPostTemplate('agent', 'greeting', 'hi'));
    assert.equal(typeof payload.message, 'string');
    assert.match(String(payload.message), /greeting/);
  });

  it('puts the record itself, base64 encoded, in `content`', () => {
    const decoded = decodeContent(payloadOf(buildPostTemplate('agent', 'question', 'what now')));
    assert.equal(decoded.text, 'what now');
    assert.equal(decoded.intent, 'question');
    assert.equal(decoded.role, 'peer');
    assert.equal(decoded.from, 'agent');
    assert.match(String(decoded.sent), /^\d{4}-\d{2}-\d{2}T/);
  });

  /**
   * `role` was hard-coded to `peer`. Using the template to publish a reply
   * therefore labelled the reply as incoming traffic, which silently defeats
   * any rule that decides what is still awaiting an answer.
   */
  it('labels the role it was given rather than always saying peer', () => {
    assert.equal(decodeContent(payloadOf(buildPostTemplate('operator', 'exchange', 'a reply'))).role, 'peer');
    assert.equal(
      decodeContent(payloadOf(buildPostTemplate('operator', 'exchange', 'a reply', { role: 'operator' }))).role,
      'operator',
    );
  });

  /**
   * `inReplyTo` was missing from the template entirely, so every reply
   * published through it was indistinguishable from an unanswered message.
   * That is what makes a cursor-free reply rule possible at all.
   */
  it('carries inReplyTo when asked, and omits the key when not', () => {
    const replied = decodeContent(
      payloadOf(buildPostTemplate('operator', 'exchange', 'ok', { inReplyTo: '2026-01-01T00-00-00Z--peer' })),
    );
    assert.equal(replied.inReplyTo, '2026-01-01T00-00-00Z--peer');

    const bare = decodeContent(payloadOf(buildPostTemplate('operator', 'probe', 'hi')));
    assert.ok(!('inReplyTo' in bare), 'an absent reference must not appear as null');
  });

  it('derives both the id and the file name from the same timestamp, so they cannot disagree', () => {
    const decoded = decodeContent(payloadOf(buildPostTemplate('agent', 'probe', 'x')));
    const stamp = String(decoded.sent).replace(/:/g, '-').replace(/\..*$/, 'Z');
    assert.equal(decoded.id, `${stamp}--agent`);
    // and the file the command targets is exactly that id plus .json
    assert.ok(buildPostTemplate('agent', 'probe', 'x').includes(`${decoded.id}.json`));
  });

  it('escapes single quotes so the payload cannot break out of the shell string', () => {
    const decoded = decodeContent(payloadOf(buildPostTemplate('agent', 'greeting', "it's fine")));
    assert.equal(decoded.text, "it's fine");
  });

  it('survives non-ascii text through the base64 round trip', () => {
    const decoded = decodeContent(payloadOf(buildPostTemplate('agent', 'greeting', '探针:通道测试')));
    assert.equal(decoded.text, '探针:通道测试');
  });

  it('documents the 422 collision so a retry is not mistaken for a failure', () => {
    assert.ok(buildPostTemplate('agent', 'greeting', 'hi').includes('422'));
  });
});

describe('assertApiUrl', () => {
  it('accepts the GitHub API origin', () => {
    assert.equal(assertApiUrl('https://api.github.com/repos/a/b').hostname, 'api.github.com');
  });

  it('rejects other origins, plain http and reserved addresses', () => {
    for (const bad of ['https://evil.example/x', 'http://api.github.com/x', 'https://localhost/x', 'https://10.0.0.1/x']) {
      assert.throws(() => assertApiUrl(bad));
    }
  });
});
