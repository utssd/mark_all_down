'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS meta(
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS article_embeddings(
  guid TEXT PRIMARY KEY,
  feed_id TEXT,
  published_at_ms INTEGER,
  embedding BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_article_embeddings_pub ON article_embeddings(published_at_ms DESC);

CREATE TABLE IF NOT EXISTS interests(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  embedding BLOB NOT NULL,
  manual INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reactions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guid TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reactions_guid ON reactions(guid);

CREATE TABLE IF NOT EXISTS centroids(
  kind TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
`;

function bufFromF32(arr) {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}
function f32FromBuf(buf) {
  const out = new Float32Array(buf.byteLength / 4);
  out.set(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
  return out;
}

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'db.sqlite'));
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_V1);
  const getV = db.prepare('SELECT value FROM meta WHERE key=?').get('schema_version');
  if (!getV) db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('schema_version', '1');
  return wrap(db);
}

function wrap(db) {
  const putEmbedding = db.prepare(
    `INSERT OR REPLACE INTO article_embeddings(guid, feed_id, published_at_ms, embedding)
     VALUES(?, ?, ?, ?)`
  );
  const getEmbedding = db.prepare('SELECT embedding FROM article_embeddings WHERE guid=?');
  const hasEmbedding = db.prepare('SELECT 1 FROM article_embeddings WHERE guid=?');
  const getPublishedAt = db.prepare('SELECT published_at_ms FROM article_embeddings WHERE guid=?');

  const upsertInterest = db.prepare(
    `INSERT INTO interests(name, embedding, manual, created_at) VALUES(?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET embedding=excluded.embedding`
  );
  const listInterests = db.prepare('SELECT id, name, embedding FROM interests ORDER BY created_at');
  const deleteInterest = db.prepare('DELETE FROM interests WHERE id=?');

  const addReaction = db.prepare('INSERT INTO reactions(guid, kind, created_at) VALUES(?,?,?)');
  const recentReactions = db.prepare(
    `SELECT r.guid, r.kind, e.embedding FROM reactions r
     JOIN article_embeddings e ON e.guid = r.guid
     WHERE r.created_at > ? AND r.kind IN ('like','dislike')`
  );

  const getCentroid = db.prepare('SELECT embedding, count FROM centroids WHERE kind=?');
  const upsertCentroid = db.prepare(
    `INSERT INTO centroids(kind, embedding, count, updated_at) VALUES(?,?,?,?)
     ON CONFLICT(kind) DO UPDATE SET embedding=excluded.embedding, count=excluded.count, updated_at=excluded.updated_at`
  );

  const getMeta = db.prepare('SELECT value FROM meta WHERE key=?');
  const setMeta = db.prepare(
    `INSERT INTO meta(key, value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  );

  return {
    raw: db,
    close: () => db.close(),

    putEmbedding: (guid, feedId, publishedAtMs, f32) =>
      putEmbedding.run(guid, feedId || null, Number(publishedAtMs) || 0, bufFromF32(f32)),
    getEmbedding: (guid) => {
      const row = getEmbedding.get(guid);
      return row ? f32FromBuf(row.embedding) : null;
    },
    hasEmbedding: (guid) => !!hasEmbedding.get(guid),
    getPublishedAt: (guid) => getPublishedAt.get(guid)?.published_at_ms ?? null,

    upsertInterest: (name, f32, manual = 1) =>
      upsertInterest.run(name, bufFromF32(f32), manual, Date.now()),
    listInterests: () =>
      listInterests.all().map((r) => ({ id: r.id, name: r.name, embedding: f32FromBuf(r.embedding) })),
    deleteInterest: (id) => deleteInterest.run(id),

    addReaction: (guid, kind) => addReaction.run(guid, kind, Date.now()),
    recentReactions: (sinceMs) =>
      recentReactions.all(sinceMs).map((r) => ({
        guid: r.guid, kind: r.kind, embedding: f32FromBuf(r.embedding),
      })),

    getCentroid: (kind) => {
      const row = getCentroid.get(kind);
      return row ? { embedding: f32FromBuf(row.embedding), count: row.count } : null;
    },
    upsertCentroid: (kind, f32, count) =>
      upsertCentroid.run(kind, bufFromF32(f32), count, Date.now()),

    getMeta: (key) => getMeta.get(key)?.value ?? null,
    setMeta: (key, value) => setMeta.run(key, String(value)),
  };
}

module.exports = { open };
