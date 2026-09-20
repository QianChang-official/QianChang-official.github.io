#!/usr/bin/env node
/**
 * Crucix 数据抓取脚本（GitHub Actions 定时运行）
 * 抓取免 key 的公开数据源，输出静态 JSON 到 public/crucix/data/
 * 博客页面直接 fetch 本地 JSON，无需后端
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/crucix/data');
mkdirSync(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (compatible; CrucixBot/1.0)';
const TIMEOUT = 12000;

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...opts.headers },
      ...opts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ============ 数据源 ============

async function githubTrending() {
  // GitHub 趋势（非官方 API，用搜索近似）
  const d = await fetchJson(
    'https://api.github.com/search/repositories?q=created:>2026-09-01&sort=stars&order=desc&per_page=12'
  );
  return (d.items || []).map((r) => ({
    name: r.full_name,
    desc: r.description,
    stars: r.stargazers_count,
    lang: r.language,
    url: r.html_url,
  }));
}

async function earthquakes() {
  const d = await fetchJson(
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
  );
  return (d.features || []).slice(0, 15).map((f) => ({
    mag: f.properties.mag,
    place: f.properties.place,
    time: new Date(f.properties.time).toISOString(),
    url: f.properties.url,
    coords: f.geometry?.coordinates?.slice(0, 2),
  }));
}

async function spaceflightNews() {
  const d = await fetchJson('https://api.spaceflightnewsapi.net/v4/articles/?limit=10&format=json');
  return (d.results || []).map((a) => ({
    title: a.title,
    url: a.url,
    published: a.published_at,
    summary: a.summary?.slice(0, 160),
  }));
}

async function cisaKev() {
  const d = await fetchJson(
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
  );
  const vulns = (d.vulnerabilities || [])
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 12);
  return vulns.map((v) => ({
    cve: v.cveID,
    vendor: v.vendorProject,
    product: v.product,
    name: v.vulnerabilityName,
    added: v.dateAdded,
    due: v.dueDate,
  }));
}

async function exchangeRates() {
  const d = await fetchJson('https://open.er-api.com/v6/latest/USD');
  const pick = ['CNY', 'EUR', 'JPY', 'GBP', 'KRW', 'HKD'];
  return {
    base: 'USD',
    updated: d.time_last_update_utc,
    rates: Object.fromEntries(pick.map((c) => [c, d.rates?.[c]])),
  };
}

async function launches() {
  const d = await fetchJson(
    'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&format=json'
  );
  return (d.results || []).map((l) => ({
    name: l.name,
    net: l.net,
    provider: l.launch_service_provider?.name,
    location: l.pad?.location?.name,
    status: l.status?.name,
  }));
}

async function hackerNews() {
  const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
  const top = (ids || []).slice(0, 12);
  const items = await Promise.all(
    top.map((id) =>
      fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
    )
  );
  return items
    .filter(Boolean)
    .map((it) => ({ title: it.title, url: it.url, score: it.score, by: it.by }));
}

async function redditWorld() {
  // Reddit JSON 不需要 key，但限流严格
  const d = await fetchJson('https://www.reddit.com/r/worldnews/hot.json?limit=10', {
    headers: { 'User-Agent': 'CrucixBot/1.0 (research)' },
  });
  return (d.data?.children || []).map((c) => ({
    title: c.data.title,
    url: 'https://reddit.com' + c.data.permalink,
    score: c.data.score,
    comments: c.data.num_comments,
  }));
}

// ============ 主流程 ============

const tasks = {
  'github-trending': githubTrending,
  earthquakes,
  'spaceflight-news': spaceflightNews,
  'cisa-kev': cisaKev,
  'exchange-rates': exchangeRates,
  launches,
  'hacker-news': hackerNews,
  'reddit-world': redditWorld,
};

const meta = { generatedAt: new Date().toISOString(), sources: {} };

for (const [name, fn] of Object.entries(tasks)) {
  try {
    const data = await fn();
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ ok: true, data, fetchedAt: new Date().toISOString() }));
    meta.sources[name] = { ok: true, count: Array.isArray(data) ? data.length : Object.keys(data).length };
    console.log(`✓ ${name}: ${meta.sources[name].count} 条`);
  } catch (e) {
    writeFileSync(
      join(OUT, `${name}.json`),
      JSON.stringify({ ok: false, error: e.message, fetchedAt: new Date().toISOString() })
    );
    meta.sources[name] = { ok: false, error: e.message };
    console.log(`✗ ${name}: ${e.message}`);
  }
}

writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
console.log('\n完成:', OUT);
