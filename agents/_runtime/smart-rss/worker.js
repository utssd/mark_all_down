'use strict';
const path = require('path');
const db = require('./db');
const embedder = require('./embedder');
const scorer = require('./scorer');
const { inferInterestsFromOpml } = require('./opml-interests');
const hn = require('./adapters/hn');
const reddit = require('./adapters/reddit');
const arxiv = require('./adapters/arxiv');

const dataDir = process.env.SMART_RSS_DATA_DIR;
if (!dataDir) {
  console.error('SMART_RSS_DATA_DIR not set; worker exiting');
  process.exit(1);
}

const store = db.open(dataDir);
let extractorPromise = null;
function getExtractor() {
  if (!extractorPromise) extractorPromise = embedder.load(path.join(dataDir, 'model'));
  return extractorPromise;
}

const handlers = {
  async ping() { return { pong: true, pid: process.pid }; },

  async embedArticles({ articles }) {
    const ext = await getExtractor();
    let embedded = 0;
    for (const a of articles) {
      if (!a?.guid) continue;
      if (store.hasEmbedding(a.guid)) continue;
      const text = [a.title, a.summary].filter(Boolean).join('. ');
      const vec = await embedder.embed(ext, text);
      if (!vec) continue;
      store.putEmbedding(a.guid, a.feedId || null, a.publishedAtMs || 0, vec);
      embedded++;
    }
    return { embedded };
  },

  async listInterests() {
    return {
      interests: store.listInterests().map((i) => ({ id: i.id, name: i.name })),
    };
  },

  async addInterest({ name }) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('name required');
    const ext = await getExtractor();
    const vec = await embedder.embed(ext, clean);
    store.upsertInterest(clean, vec, 1);
    return { ok: true };
  },

  async removeInterest({ id }) {
    store.deleteInterest(id);
    return { ok: true };
  },

  async suggestInterestsFromOpml({ opmlText }) {
    return { suggestions: inferInterestsFromOpml(opmlText) };
  },

  async score({ guids }) {
    const interestVecs = store.listInterests().map((i) => i.embedding);
    const like = store.getCentroid('like')?.embedding || null;
    const dislike = store.getCentroid('dislike')?.embedding || null;
    const nowMs = Date.now();
    const out = {};
    for (const g of guids) {
      const v = store.getEmbedding(g);
      if (!v) { out[g] = null; continue; }
      const pubMs = store.getPublishedAt(g) ?? (nowMs - 72 * 3600_000);
      const ageH = Math.max(0, (nowMs - pubMs) / 3600_000);
      const s = scorer.scoreArticle(v, interestVecs, ageH, like, dislike);
      out[g] = (dislike && scorer.cosine(v, dislike) > 0.7) ? -Infinity : s;
    }
    return { scores: out };
  },

  async react({ guid, kind }) {
    if (!['like','dislike','save','hide'].includes(kind)) throw new Error('bad kind');
    store.addReaction(guid, kind);
    if (kind === 'dislike' || kind === 'like') {
      const v = store.getEmbedding(guid);
      if (v) {
        store.raw.transaction(() => {
          const existing = store.getCentroid(kind);
          const n = existing ? existing.count : 0;
          const prev = existing ? existing.embedding : new Float32Array(v.length);
          const nn = n + 1;
          const next = new Float32Array(v.length);
          for (let i = 0; i < v.length; i++) next[i] = (prev[i] * n + v[i]) / nn;
          store.upsertCentroid(kind, next, nn);
        })();
      }
    }
    return { ok: true };
  },

  async getDislikeCentroid() {
    const c = store.getCentroid('dislike');
    if (!c) return { embedding: null };
    return { embedding: Array.from(c.embedding), count: c.count };
  },

  async runNightlyPromote() {
    const interests = store.listInterests();
    const likes = store.recentReactions(Date.now() - 30 * 86400_000).filter((r) => r.kind === 'like');
    let updated = 0;
    for (const it of interests) {
      const matching = likes.filter((l) => scorer.cosine(it.embedding, l.embedding) > 0.5);
      if (matching.length === 0) continue;
      const mean = new Float32Array(it.embedding.length);
      for (const m of matching) for (let i = 0; i < mean.length; i++) mean[i] += m.embedding[i];
      for (let i = 0; i < mean.length; i++) mean[i] /= matching.length;
      const next = new Float32Array(it.embedding.length);
      for (let i = 0; i < next.length; i++) next[i] = 0.95 * it.embedding[i] + 0.05 * mean[i];
      let norm = 0;
      for (let i = 0; i < next.length; i++) norm += next[i] * next[i];
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < next.length; i++) next[i] /= norm;
      store.upsertInterest(it.name, next, 1);
      updated++;
    }
    store.setMeta('last_promote_ms', Date.now());
    return { updated };
  },

  async fetchSource({ kind, opts }) {
    if (kind === 'hn') return { items: await hn.fetchItems(opts) };
    if (kind === 'reddit') return { items: await reddit.fetchItems(opts) };
    if (kind === 'arxiv') return { items: await arxiv.fetchItems(opts) };
    throw new Error(`unknown source kind: ${kind}`);
  },
};

process.on('message', async (msg) => {
  if (!msg || typeof msg !== 'object') return;
  const { id, type, payload } = msg;
  const fn = handlers[type];
  if (!fn) {
    process.send({ id, ok: false, error: `unknown type: ${type}` });
    return;
  }
  try {
    const result = await fn(payload || {});
    process.send({ id, ok: true, result });
  } catch (err) {
    process.send({ id, ok: false, error: String(err?.message || err), stack: err?.stack });
  }
});

process.send({ ready: true });
