import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOgUrl } from './og-fetcher';

test('accepts plain public http and https URLs', () => {
  assert.equal(validateOgUrl('https://example.com/').ok, true);
  assert.equal(validateOgUrl('http://example.com/').ok, true);
  assert.equal(validateOgUrl('https://user:pass@example.com/').ok, true);
});

test('rejects non-http/https protocols', () => {
  for (const url of [
    'ftp://example.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,hi',
    'mailto:test@example.com',
  ]) {
    const result = validateOgUrl(url);
    assert.equal(result.ok, false, url);
    assert.ok('reason' in result && (result as { reason: string }).reason.includes('protocol'));
  }
});

test('rejects localhost and .localhost hosts', () => {
  assert.equal(validateOgUrl('http://localhost/').ok, false);
  assert.equal(validateOgUrl('http://app.localhost/').ok, false);
  assert.equal(validateOgUrl('http://localhost:3000/').ok, false);
});

test('rejects IPv4 loopback, private, link-local and reserved ranges', () => {
  const blocked = [
    'http://127.0.0.1/',
    'http://10.0.0.1/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://169.254.1.1/',
    'http://224.0.0.1/',
    'http://240.0.0.1/',
    'http://192.0.2.1/',
    'http://198.18.0.1/',
    'http://203.0.113.1/',
  ];
  for (const url of blocked) {
    const result = validateOgUrl(url);
    assert.equal(result.ok, false, url);
    assert.ok('reason' in result && (result as { reason: string }).reason.includes('Private'));
  }
});

test('rejects IPv6 loopback, link-local, unique-local and multicast addresses', () => {
  const blocked = [
    'http://[::1]/',
    'http://[::]/',
    'http://[fe80::1]/',
    'http://[fc00::1]/',
    'http://[fd00::1]/',
    'http://[ff02::1]/',
  ];
  for (const url of blocked) {
    const result = validateOgUrl(url);
    assert.equal(result.ok, false, url);
    assert.ok('reason' in result && (result as { reason: string }).reason.includes('Private'));
  }
});

test('rejects malformed URLs', () => {
  const result = validateOgUrl('not a url');
  assert.equal(result.ok, false);
  assert.ok('reason' in result && (result as { reason: string }).reason === 'Invalid URL');
});
