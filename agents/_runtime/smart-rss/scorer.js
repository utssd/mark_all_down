'use strict';

function cosine(a, b) {
  if (a.length !== b.length) throw new Error('vector length mismatch');
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function recencyBonus(ageHours) {
  if (!isFinite(ageHours) || ageHours < 0) return 0.1;
  return 0.1 * Math.exp(-ageHours / 72);
}

function thumbsNudge(articleVec, likeCentroid, dislikeCentroid) {
  let nudge = 0;
  if (likeCentroid)    nudge += 0.15 * cosine(articleVec, likeCentroid);
  if (dislikeCentroid) nudge -= 0.25 * cosine(articleVec, dislikeCentroid);
  if (nudge >  0.15) nudge =  0.15;
  if (nudge < -0.25) nudge = -0.25;
  return nudge;
}

function scoreArticle(articleVec, interestVecs, ageHours, likeCentroid, dislikeCentroid) {
  let bestCos = 0;
  for (const iv of interestVecs) {
    const c = cosine(articleVec, iv);
    if (c > bestCos) bestCos = c;
  }
  return bestCos + recencyBonus(ageHours) + thumbsNudge(articleVec, likeCentroid, dislikeCentroid);
}

module.exports = { cosine, recencyBonus, thumbsNudge, scoreArticle };
