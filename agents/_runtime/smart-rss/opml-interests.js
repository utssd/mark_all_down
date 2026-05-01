'use strict';

// Pure: no DOMParser in worker. Use a tolerant regex pass to extract
// <outline> hierarchy. Full OPML parsing for feed URLs already lives in
// the renderer; here we only need folder names that contain 2+ feed entries.

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function inferInterestsFromOpml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return [];
  if (!/<opml[\s>]/i.test(xmlText)) return [];

  // Tokenize outlines: <outline ...> / </outline> / <outline ... />.
  const tokenRe = /<outline\b([^>]*?)(\/?)>|<\/outline\s*>/gi;
  const attrRe = /(\w[\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  const stack = []; // array of { text, feedCount }
  const folderCounts = new Map(); // folderText → feedCount

  let m;
  while ((m = tokenRe.exec(xmlText)) !== null) {
    const full = m[0];
    if (full.startsWith('</')) {
      const frame = stack.pop();
      if (frame) {
        const prev = folderCounts.get(frame.text) || 0;
        folderCounts.set(frame.text, prev + frame.feedCount);
      }
      continue;
    }
    const attrs = {};
    let a;
    const attrStr = m[1] || '';
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(attrStr)) !== null) attrs[a[1].toLowerCase()] = a[2] ?? a[3];

    const isSelfClosing = m[2] === '/';
    const hasUrl = !!attrs.xmlurl;
    const text = decodeEntities(attrs.text || attrs.title || '').trim();

    if (hasUrl) {
      // Feed outline — increment parent folder count.
      if (stack.length) stack[stack.length - 1].feedCount += 1;
    } else if (!isSelfClosing) {
      stack.push({ text, feedCount: 0 });
    }
  }

  // Any frames still open (missing </outline>) → flush. This intentionally
  // recovers partial data from truncated OPML; the top-level <opml gate is
  // what rejects non-OPML input outright. Pinned by the "truncated but
  // opml-looking" test below.
  while (stack.length) {
    const frame = stack.pop();
    const prev = folderCounts.get(frame.text) || 0;
    folderCounts.set(frame.text, prev + frame.feedCount);
  }

  const out = [];
  for (const [name, count] of folderCounts.entries()) {
    if (name && count >= 2) out.push({ name, source: 'opml' });
  }
  return out;
}

module.exports = { inferInterestsFromOpml };
