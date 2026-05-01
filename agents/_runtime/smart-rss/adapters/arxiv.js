'use strict';

const { UA } = require('./_ua');

function buildUrl({ category, maxResults = 20 } = {}) {
  if (!category) throw new Error('category required');
  const qs = new URLSearchParams({
    search_query: `cat:${category}`,
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    max_results: String(maxResults),
  });
  return `http://export.arxiv.org/api/query?${qs.toString()}`;
}

function extract(body, tag) {
  // Anchored with a word-boundary lookahead so <tag> doesn't also match
  // <tagsomething>. Non-namespaced — sufficient for arXiv's current Atom output.
  const m = body.match(new RegExp(`<${tag}(?=[\\s>])[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return m ? m[1].trim() : '';
}

function parse(atomXml) {
  if (!atomXml || typeof atomXml !== 'string') return [];
  const entries = atomXml.split(/<entry[\s>]/i).slice(1);
  const out = [];
  for (const raw of entries) {
    const body = '<entry ' + raw;
    const id = extract(body, 'id');
    const title = extract(body, 'title').replace(/\s+/g, ' ').trim();
    const summary = extract(body, 'summary').replace(/\s+/g, ' ').trim();
    const published = extract(body, 'published');
    const arxivId = (id.match(/arxiv\.org\/abs\/([^\s<]+)/i) || [])[1] || id;
    const authorMatch = body.match(/<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i);
    const author = authorMatch ? authorMatch[1].replace(/\s+/g, ' ').trim() : '';
    out.push({
      guid: `arxiv-${arxivId}`,
      title: title || '(untitled)',
      url: id || `http://arxiv.org/abs/${arxivId}`,
      author,
      summary: summary.slice(0, 500),
      publishedAtMs: published ? Date.parse(published) : 0,
    });
  }
  return out;
}

async function fetchItems(opts) {
  const res = await fetch(buildUrl(opts), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  return parse(await res.text());
}

module.exports = { buildUrl, parse, fetchItems };
