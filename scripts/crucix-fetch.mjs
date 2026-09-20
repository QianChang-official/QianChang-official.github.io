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
  // Reddit JSON 不需要 key，但限流严格；改用 old.reddit.com
  const d = await fetchJson('https://old.reddit.com/r/worldnews/hot.json?limit=10', {
    headers: { 'User-Agent': 'CrucixBot/1.0 (research; contact: qianchanglys@gmail.com)' },
  });
  return (d.data?.children || []).map((c) => ({
    title: c.data.title,
    url: 'https://reddit.com' + c.data.permalink,
    score: c.data.score,
    comments: c.data.num_comments,
  }));
}

async function gdelt() {
  // GDELT 全球事件数据库：最近的中文相关报道
  const d = await fetchJson(
    'https://api.gdeltproject.org/api/v2/doc/doc?query=china&mode=artlist&maxrecords=12&format=json&sort=datedesc',
    { headers: { 'User-Agent': UA, Accept: 'application/json' } }
  );
  return (d.articles || []).map((a) => ({
    title: a.title,
    url: a.url,
    source: a.domain,
    time: a.seendate,
  }));
}

async function nasaEonet() {
  // NASA EONET 自然灾害事件（野火、风暴、火山）
  const d = await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?limit=12&status=open', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  return (d.events || []).map((e) => ({
    title: e.title,
    category: e.categories?.[0]?.title,
    updated: e.geometry?.[0]?.date,
    link: e.link,
  }));
}

async function opensky() {
  // OpenSky 军事热点空域（免 key 有限流，取台湾海峡+中东）
  const regions = [
    { name: '台湾海峡', bbox: [22.5, 117.5, 25.5, 121.5] },
    { name: '中东', bbox: [24, 44, 33, 58] },
    { name: '东欧', bbox: [44, 22, 52, 40] },
  ];
  const out = [];
  for (const r of regions) {
    const [lat1, lon1, lat2, lon2] = r.bbox;
    const d = await fetchJson(
      `https://opensky-network.org/api/states/all?lamin=${lat1}&lomin=${lon1}&lamax=${lat2}&lomax=${lon2}`
    ).catch(() => null);
    const states = d?.states || [];
    const military = states.filter((s) => {
      const cs = (s[1] || '').toUpperCase();
      return /^(RCH|CFC|MMF|NATO|USAF|LAGR|BAF|GAF|RAF|JAKE|DUKE)/.test(cs);
    });
    out.push({ region: r.name, total: states.length, military: military.length });
  }
  return out;
}

async function noaaAlerts() {
  // NOAA 美国天气预警（用 point 接口避免 400）
  const d = await fetchJson('https://api.weather.gov/alerts/active?status=actual&limit=12', {
    headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
  });
  return (d.features || []).map((f) => ({
    event: f.properties.event,
    area: f.properties.areaDesc,
    severity: f.properties.severity,
    headline: f.properties.headline,
    sent: f.properties.sent,
  }));
}

async function worldBank() {
  // 世界银行：全球 GDP 增长最新数据
  const d = await fetchJson(
    'https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=5&date=2020:2026'
  );
  return (d[1] || []).filter(Boolean).map((r) => ({
    year: r.date,
    value: r.value ? +r.value.toFixed(2) : null,
  }));
}

async function usgsSignificant() {
  // USGS 显著地震（过去 7 天）
  const d = await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson');
  return (d.features || []).slice(0, 10).map((f) => ({
    mag: f.properties.mag,
    place: f.properties.place,
    time: new Date(f.properties.time).toISOString(),
    tsunami: f.properties.tsunami === 1,
    url: f.properties.url,
  }));
}

async function whoOutbreaks() {
  // WHO 疫情爆发新闻
  const d = await fetchJson('https://www.who.int/api/emergencies/diseaseoutbreaknews?$top=10&$orderby=PublicationDate desc');
  return (d.value || []).map((o) => ({
    title: o.Title,
    date: o.PublicationDate,
    summary: o.Summary?.slice(0, 160),
    url: 'https://www.who.int' + (o.ItemDefaultUrl || ''),
  }));
}

async function spaceX() {
  // SpaceX 最近一次发射（用 r-spacex 镜像，官方 API 不稳定）
  const d = await fetchJson('https://api.spacexdata.com/v4/launches/latest');
  return {
    name: d.name,
    date: d.date_utc,
    success: d.success,
    details: d.details?.slice(0, 200),
    links: { webcast: d.links?.webcast, article: d.links?.article },
  };
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
  gdelt,
  'nasa-eonet': nasaEonet,
  'opensky-military': opensky,
  'noaa-alerts': noaaAlerts,
  'worldbank-gdp': worldBank,
  'usgs-significant': usgsSignificant,
  spacex: spaceX,
  'who-outbreaks': whoOutbreaks,
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
