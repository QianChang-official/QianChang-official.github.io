/**
 * Outbound URL guard for the AI Signal thread.
 *
 * The page reads public issues from one known origin and nothing else. This
 * guard makes that a checked invariant rather than a comment: if a base URL is
 * ever swapped, or a redirect points elsewhere, the fetch stops here instead of
 * quietly reaching a different origin — possibly a loopback or private address
 * on the visitor's machine.
 */

const ALLOWED_ORIGIN = 'https://api.github.com';

/** Reserved and private ranges that must never be reached from a visitor's browser. */
const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^\[?::1\]?$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\.+$/,
  /[.]local$/i,
];

export function assertApiUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('ai-signal: not a valid absolute URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('ai-signal: only https is permitted');
  }

  const host = url.hostname;
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    throw new Error('ai-signal: refusing request to a reserved address');
  }

  if (url.origin !== ALLOWED_ORIGIN) {
    throw new Error('ai-signal: unexpected origin');
  }

  return url;
}

export const apiOrigin = ALLOWED_ORIGIN;
