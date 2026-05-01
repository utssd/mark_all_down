'use strict';

const { UA } = require('./_ua');

function buildUrl({ subreddit, sort = 'top', t = 'day', limit = 50 } = {}) {
  if (!subreddit) throw new Error('subreddit required');
  const qs = new URLSearchParams({ t, limit: String(limit) });
  return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort}.json?${qs.toString()}`;
}

function parse(json) {
  const children = json?.data?.children;
  if (!Array.isArray(children)) return [];
  return children
    .filter((c) => c?.kind === 't3' && c.data)
    .map((c) => {
      const d = c.data;
      return {
        guid: `reddit-${d.id}`,
        title: d.title || '(untitled)',
        url: `https://www.reddit.com${d.permalink}`,
        author: d.author || '',
        summary: d.is_self ? String(d.selftext || '').slice(0, 500) : (d.url || ''),
        publishedAtMs: (d.created_utc || 0) * 1000,
      };
    });
}

async function fetchItems(opts) {
  const res = await fetch(buildUrl(opts), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  return parse(await res.json());
}

module.exports = { buildUrl, parse, fetchItems };
