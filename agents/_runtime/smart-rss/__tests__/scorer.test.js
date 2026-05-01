'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cosine, recencyBonus, thumbsNudge, scoreArticle,
} = require('../scorer');

function vec(...nums) {
  return Float32Array.from(nums);
}

test('cosine: identical vectors → 1', () => {
  const a = vec(0.6, 0.8);
  assert.ok(Math.abs(cosine(a, a) - 1) < 1e-6);
});

test('cosine: orthogonal vectors → 0', () => {
  assert.ok(Math.abs(cosine(vec(1, 0), vec(0, 1))) < 1e-6);
});

test('cosine: opposite vectors → -1', () => {
  assert.ok(Math.abs(cosine(vec(1, 0), vec(-1, 0)) + 1) < 1e-6);
});

test('cosine: throws on length mismatch', () => {
  assert.throws(() => cosine(vec(1, 0), vec(1, 0, 0)));
});

test('recencyBonus: 0 hours → ~0.1', () => {
  assert.ok(Math.abs(recencyBonus(0) - 0.1) < 1e-6);
});

test('recencyBonus: 72 hours → 0.1/e', () => {
  const got = recencyBonus(72);
  assert.ok(Math.abs(got - 0.1 / Math.E) < 1e-6);
});

test('recencyBonus: huge hours → approaches 0', () => {
  assert.ok(recencyBonus(10_000) < 1e-6);
});

test('thumbsNudge: no centroids → 0', () => {
  assert.equal(thumbsNudge(vec(1, 0), null, null), 0);
});

test('thumbsNudge: perfectly matches like centroid → +0.15', () => {
  const a = vec(1, 0);
  assert.ok(Math.abs(thumbsNudge(a, a, null) - 0.15) < 1e-6);
});

test('thumbsNudge: perfectly matches dislike centroid → -0.25', () => {
  const a = vec(1, 0);
  assert.ok(Math.abs(thumbsNudge(a, null, a) + 0.25) < 1e-6);
});

test('thumbsNudge: clamps to [-0.25, 0.15]', () => {
  // Both like and dislike match: 0.15 - 0.25 = -0.10 (in range, no clamp)
  const a = vec(1, 0);
  assert.ok(Math.abs(thumbsNudge(a, a, a) + 0.10) < 1e-6);
});

test('scoreArticle: no interests → just recency + nudge', () => {
  const art = vec(1, 0);
  const s = scoreArticle(art, [], 0, null, null);
  assert.ok(Math.abs(s - 0.1) < 1e-6); // recency at 0 hours
});

test('scoreArticle: uses max cosine across interests', () => {
  const art = vec(1, 0);
  const interests = [vec(0, 1), vec(1, 0)];
  const s = scoreArticle(art, interests, 72, null, null);
  // max cosine = 1, recency = 0.1/e, nudge = 0
  assert.ok(Math.abs(s - (1 + 0.1 / Math.E)) < 1e-6);
});
