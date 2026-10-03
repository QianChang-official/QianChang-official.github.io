import { buildManifest } from '@lib/ai-signal';
import type { APIRoute } from 'astro';
import { getLocaleStaticPaths } from '../_shared/utils';

// `[lang]` is a dynamic route, so the mirror has to enumerate its own paths.
export const getStaticPaths = getLocaleStaticPaths;

/** Mirror of `/ai-signal.json`, scoped under a locale prefix. */
export const GET: APIRoute = ({ site, params }) => {
  const origin = site ? new URL(site).origin : 'https://qianchanglys.top';
  const locale = params.lang ?? '';
  const pageUrl = locale ? `${origin}/${locale}/ai-signal/` : `${origin}/ai-signal/`;
  const body = JSON.stringify(buildManifest(pageUrl), null, 2);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
