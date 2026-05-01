'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const hn = require('../adapters/hn');
const reddit = require('../adapters/reddit');
const arxiv = require('../adapters/arxiv');

test('hn.buildUrl: tag=front_page', () => {
  const u = hn.buildUrl({ tag: 'front_page', minPoints: 100 });
  assert.ok(u.startsWith('https://hn.algolia.com/api/v1/search?'));
  assert.ok(u.includes('numericFilters=points%3E%3D100'));
});

test('hn.parse: maps Algolia hit to item', () => {
  const res = { hits: [{
    objectID: '123',
    title: 'Example',
    url: 'https://example.com/a',
    author: 'alice',
    points: 150,
    created_at_i: 1700000000,
  }]};
  const items = hn.parse(res);
  assert.equal(items.length, 1);
  assert.equal(items[0].guid, 'hn-123');
  assert.equal(items[0].title, 'Example');
  assert.equal(items[0].url, 'https://example.com/a');
  assert.equal(items[0].publishedAtMs, 1700000000 * 1000);
});

test('reddit.buildUrl: subreddit=rust', () => {
  const u = reddit.buildUrl({ subreddit: 'rust', sort: 'top', t: 'day' });
  assert.ok(u.startsWith('https://www.reddit.com/r/rust/top.json'));
  assert.ok(u.includes('t=day'));
});

test('reddit.parse: self posts', () => {
  const res = { data: { children: [
    { kind: 't3', data: {
      id: 'abc',
      title: 'Hello',
      permalink: '/r/rust/comments/abc/hello/',
      url: 'https://self.link',
      author: 'bob',
      selftext: 'body text',
      is_self: true,
      created_utc: 1700000000,
      score: 42,
    }}
  ]}};
  const items = reddit.parse(res);
  assert.equal(items.length, 1);
  assert.equal(items[0].guid, 'reddit-abc');
  assert.equal(items[0].url, 'https://www.reddit.com/r/rust/comments/abc/hello/');
  assert.ok(items[0].summary.includes('body text'));
});

test('arxiv.buildUrl: category=cs.LG', () => {
  const u = arxiv.buildUrl({ category: 'cs.LG', maxResults: 20 });
  assert.ok(u.startsWith('http://export.arxiv.org/api/query?'));
  assert.ok(u.includes('search_query=cat%3Acs.LG'));
  assert.ok(u.includes('max_results=20'));
});

test('arxiv.parse: atom entries', () => {
  const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>Paper Title Here</title>
    <summary>Abstract text.</summary>
    <published>2026-04-01T10:00:00Z</published>
    <link href="http://arxiv.org/abs/2401.00001v1"/>
    <author><name>Jane Doe</name></author>
  </entry>
</feed>`;
  const items = arxiv.parse(atom);
  assert.equal(items.length, 1);
  assert.equal(items[0].guid, 'arxiv-2401.00001v1');
  assert.equal(items[0].title, 'Paper Title Here');
  assert.ok(items[0].url.includes('2401.00001'));
});

test('arxiv.parse: extracts author name', () => {
  const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00002v1</id>
    <title>Another Paper</title>
    <summary>X.</summary>
    <published>2026-04-01T10:00:00Z</published>
    <author><name>Ada Lovelace</name></author>
  </entry>
</feed>`;
  const items = arxiv.parse(atom);
  assert.equal(items.length, 1);
  assert.equal(items[0].author, 'Ada Lovelace');
});

test('reddit.parse: link post summary falls back to url', () => {
  const res = { data: { children: [
    { kind: 't3', data: {
      id: 'xyz',
      title: 'Check this out',
      permalink: '/r/rust/comments/xyz/check/',
      url: 'https://external.example/article',
      author: 'carol',
      is_self: false,
      created_utc: 1700000000,
      score: 10,
    }}
  ]}};
  const items = reddit.parse(res);
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, 'https://external.example/article');
});
