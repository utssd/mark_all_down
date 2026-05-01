'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inferInterestsFromOpml } = require('../opml-interests');

const SAMPLE = `<?xml version="1.0"?>
<opml version="1.0">
  <body>
    <outline text="Rust">
      <outline text="This Week in Rust" xmlUrl="https://this-week-in-rust.org/rss.xml"/>
      <outline text="Rust Blog" xmlUrl="https://blog.rust-lang.org/feed.xml"/>
    </outline>
    <outline text="Cooking">
      <outline text="Serious Eats" xmlUrl="https://www.seriouseats.com/feed"/>
    </outline>
    <outline text="Mixed">
      <outline text="Solo feed" xmlUrl="https://example.com/feed.xml"/>
    </outline>
    <outline text="Tech / AI &amp; ML">
      <outline text="Latent Space" xmlUrl="https://latent.space/feed"/>
      <outline text="Simon Willison" xmlUrl="https://simonwillison.net/atom/everything/"/>
    </outline>
  </body>
</opml>`;

test('extracts folder names with 2+ feeds as interests', () => {
  const interests = inferInterestsFromOpml(SAMPLE);
  const names = interests.map((i) => i.name);
  assert.ok(names.includes('Rust'));
  assert.ok(names.includes('Tech / AI & ML'));
});

test('ignores folders with <2 feeds', () => {
  const interests = inferInterestsFromOpml(SAMPLE);
  const names = interests.map((i) => i.name);
  assert.ok(!names.includes('Cooking'));
  assert.ok(!names.includes('Mixed'));
});

test('returns empty array on malformed XML', () => {
  assert.deepEqual(inferInterestsFromOpml('<not-opml>'), []);
});

test('returns empty array on empty string', () => {
  assert.deepEqual(inferInterestsFromOpml(''), []);
});

test('interest name is trimmed and HTML-decoded', () => {
  const interests = inferInterestsFromOpml(SAMPLE);
  const tech = interests.find((i) => i.name.includes('Tech'));
  assert.equal(tech.name, 'Tech / AI & ML');
});

test('accepts single-quoted xmlUrl attributes', () => {
  const xml = `<opml><body>
    <outline text="Rust">
      <outline text="TWiR" xmlUrl='https://this-week-in-rust.org/rss.xml'/>
      <outline text="RustBlog" xmlUrl='https://blog.rust-lang.org/feed.xml'/>
    </outline>
  </body></opml>`;
  const names = inferInterestsFromOpml(xml).map((i) => i.name);
  assert.ok(names.includes('Rust'));
});

test('duplicate folder names: feed counts sum across occurrences', () => {
  const xml = `<opml><body>
    <outline text="News">
      <outline text="A" xmlUrl="https://a/"/>
    </outline>
    <outline text="News">
      <outline text="B" xmlUrl="https://b/"/>
    </outline>
  </body></opml>`;
  const names = inferInterestsFromOpml(xml).map((i) => i.name);
  assert.ok(names.includes('News'),
    'two "News" folders with 1 feed each should aggregate to 2');
});

test('attribute order does not matter', () => {
  const xml = `<opml><body>
    <outline text="AI">
      <outline xmlUrl="https://a/" text="A"/>
      <outline xmlUrl="https://b/" text="B"/>
    </outline>
  </body></opml>`;
  const names = inferInterestsFromOpml(xml).map((i) => i.name);
  assert.ok(names.includes('AI'));
});

test('3-level nesting: grandchild feeds do NOT count toward grandparent', () => {
  const xml = `<opml><body>
    <outline text="Outer">
      <outline text="Inner">
        <outline text="a" xmlUrl="https://a/"/>
        <outline text="b" xmlUrl="https://b/"/>
      </outline>
    </outline>
  </body></opml>`;
  const names = inferInterestsFromOpml(xml).map((i) => i.name);
  assert.ok(names.includes('Inner'));
  assert.ok(!names.includes('Outer'), 'Outer has 0 direct feed children');
});

test('malformed (opml-looking but truncated): recovers partial data', () => {
  const xml = `<opml><body><outline text="Rust"><outline xmlUrl="https://a/"/><outline xmlUrl="https://b/"/>`;
  const names = inferInterestsFromOpml(xml).map((i) => i.name);
  assert.ok(names.includes('Rust'));
});
