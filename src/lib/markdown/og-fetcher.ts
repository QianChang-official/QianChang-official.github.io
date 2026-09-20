/**
 * Build-time Open Graph metadata fetcher (fetch + metascraper).
 * Never throws: failures are returned as an `error` field so callers can cache them.
 */

import { isIP } from 'node:net';
import metascraper from 'metascraper';
import metascraperDescription from 'metascraper-description';
import metascraperImage from 'metascraper-image';
import metascraperLogo from 'metascraper-logo';
import metascraperLogoFavicon from 'metascraper-logo-favicon';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';

export interface OGData {
  originUrl: string;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  logo?: string;
  error?: string;
  author?: string;
}

const TIMEOUT_MS = 5000; // 5 second timeout (most sites respond within 1-2s)

const scraper = metascraper([
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
  metascraperTitle(),
  metascraperUrl(),
  metascraperLogoFavicon(),
]);

function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 private, loopback, link-local, reserved and multicast ranges.
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b, c] = parts;
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224 && a <= 239) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 240) return true;
    return false;
  }

  // IPv6 loopback, link-local, unique-local, multicast and unspecified addresses.
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('ff')) return true;
    return false;
  }

  return false;
}

export function validateOgUrl(urlString: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `Disallowed protocol: ${url.protocol}` };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, reason: 'Localhost host is not allowed' };
  }

  const ipCandidate = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (isPrivateOrReservedIp(ipCandidate)) {
    return { ok: false, reason: 'Private or reserved IP address is not allowed' };
  }

  return { ok: true, url };
}

/**
 * Fetch OG data from a URL at build time using metascraper.
 * With timeout to avoid hanging builds.
 */
export async function fetchOGData(url: string): Promise<OGData> {
  const validation = validateOgUrl(url);
  if (!validation.ok) {
    console.warn(`[Link Embed] Blocked unsafe URL ${url}: ${validation.reason}`);
    return {
      originUrl: url,
      url,
      error: `Blocked unsafe URL: ${validation.reason}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Link Embed] Failed to fetch ${url}: ${response.status}`);
      return {
        originUrl: url,
        url,
        error: `Failed to fetch: ${response.status}`,
      };
    }

    const html = await response.text();
    const metadata = await scraper({ html, url });

    return {
      originUrl: url,
      url: metadata.url || url,
      title: metadata.title,
      description: metadata.description,
      image: metadata.image,
      logo: metadata?.logo || metadata?.favicon,
      author: metadata?.author || metadata?.publisher,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Link Embed] Timeout fetching ${url}`);
      return {
        originUrl: url,
        url,
        error: 'Request timeout',
      };
    }
    console.warn(`[Link Embed] Error fetching ${url}:`, error);
    return {
      originUrl: url,
      url,
      error: error instanceof Error ? error.message : 'Failed to fetch',
    };
  }
}
