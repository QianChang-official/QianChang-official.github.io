import { buildManifest } from '@lib/ai-signal';
import type { APIRoute } from 'astro';

/**
 * Machine-readable description of the AI Signal thread.
 *
 * A page rendered for humans is awkward for an agent to consume — it has to
 * scrape prose. This endpoint states the transport, the envelope grammar and
 * the availability semantics as data, so the first thing a visiting agent can
 * do is fetch one URL and learn how to address the responder.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = site ? new URL(site).origin : 'https://qianchanglys.top';
  const body = JSON.stringify(buildManifest(`${origin}/ai-signal/`), null, 2);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
