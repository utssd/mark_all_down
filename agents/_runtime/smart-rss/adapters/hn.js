'use strict';

const { UA } = require('./_ua');

function buildUrl({ tag = 'front_page', minPoints = 100 } = {}) {
  const qs = new URLSearchParams({
    tags: tag,
    numericFilters: `points>=${Math.max(0, minPoints | 0)}`,
    hitsPerPage: '50',
  });
  return `https://hn.algolia.com/api/v1/search?${qs.toString()}`;
}

function parse(json) {
  if (!json || !Array.isArray(json.hits)) return [];
  return json.hits.map((h) => ({
    guid: `hn-${h.objectID}`,
    title: h.title || h.story_title || '(untitled)',
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    author: h.author || '',
    summary: h.story_text ? String(h.story_text).slice(0, 500) : '',
    publishedAtMs: (h.created_at_i || 0) * 1000,
  }));
}

async function fetchItems(opts) {
  const res = await fetch(buildUrl(opts), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HN ${res.status}`);
  return parse(await res.json());
}

module.exports = { buildUrl, parse, fetchItems };
