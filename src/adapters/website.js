'use strict';

const { getJson } = require('./http');

// Light company enrichment from the company's own homepage: <title> and meta description.
// One request per unique domain. Anti-bot pages are reported as "blocked",
// never as an empty success. Optional: FIRECRAWL_API_KEY uses Firecrawl's scrape
// endpoint instead, which gets past more anti-bot walls (paid credits).

// Challenge-page markers only. Plain "cloudflare" or "captcha" would flag every
// site that loads scripts from a CDN or has a reCAPTCHA on its contact form.
const BLOCK_SIGNS = ['<title>just a moment', '<title>attention required', 'cf-chl-', 'cf-browser-verification', '<title>access denied', 'verify you are human'];

function isBlocked(status, html) {
  const lower = html.slice(0, 20000).toLowerCase();
  return status === 403 || BLOCK_SIGNS.some((s) => lower.includes(s));
}

function extract(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i) || [])[1] || '';
  const clean = (s) => s.replace(/\s+/g, ' ').trim();
  return [clean(title), clean(desc)].filter(Boolean).join(' | ');
}

async function viaFetch(domain) {
  const res = await fetch(`https://${domain}`, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (lead-list-cleanup)' },
    signal: AbortSignal.timeout(12000),
  });
  const html = await res.text();
  if (isBlocked(res.status, html)) return { status: 'blocked', info: '' };
  if (!res.ok) return { status: `http_${res.status}`, info: '' };
  const info = extract(html);
  return { status: info ? 'ok' : 'no_metadata', info };
}

async function viaFirecrawl(domain, key) {
  const data = await getJson('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: { url: `https://${domain}`, formats: ['markdown'], onlyMainContent: true },
    timeoutMs: 30000,
  });
  const meta = (data.data && data.data.metadata) || {};
  const info = [meta.title, meta.description].filter(Boolean).join(' | ');
  return { status: info ? 'ok' : 'no_metadata', info };
}

async function describeDomain(domain, env = process.env) {
  try {
    return env.FIRECRAWL_API_KEY ? await viaFirecrawl(domain, env.FIRECRAWL_API_KEY) : await viaFetch(domain);
  } catch (err) {
    return { status: 'error', info: '', error: err.message };
  }
}

module.exports = { describeDomain, extract, isBlocked };
