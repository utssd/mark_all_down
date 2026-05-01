// LLM Wiki — Tier-2 custom output renderer.
//
// Exports renderOutput(host, data) per the framework convention documented
// in agents/_runtime/ui-host.js. The ui-host dispatcher invokes this when
// the agent completes, letting us replace the default marked.parse(…) dump
// with a compact result-header card + chip grid of touched pages.
//
// Contract with worker.js:
//   data = { markdown, meta: { op, rounds, touched, wikiRoot } }
//
// If `meta` is absent (defensive — older worker or unexpected shape), we
// fall back to the plain markdown body so nothing breaks.

const OP_LABEL = {
  ingest: 'Ingest',
  query:  'Query',
  lint:   'Lint',
};
const OP_NUMERAL = {
  ingest: 'I',
  query:  'II',
  lint:   'III',
};

function ensureDirPath(p) {
  const s = String(p || '/').trim() || '/';
  const withLead = s.startsWith('/') ? s : '/' + s;
  return withLead.endsWith('/') ? withLead : withLead + '/';
}

function absWikiHref(wikiRoot, rel) {
  if (!rel) return '';
  if (rel.startsWith('/')) return rel;
  const root = ensureDirPath(wikiRoot);
  const prefix = root === '/' ? '' : root.replace(/\/$/, '');
  const relClean = rel.replace(/^\/+/, '');
  return `${prefix}/${relClean}`;
}

function mdToHtml(markdown) {
  try {
    if (typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(String(markdown || ''));
    }
  } catch (_) {
    /* fall through */
  }
  // Fallback — escape and wrap in <pre> so nothing breaks if marked is late.
  const escaped = String(markdown || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre>${escaped}</pre>`;
}

function buildResultCard(meta) {
  const card = document.createElement('div');
  card.className = 'lw-result-card';
  card.dataset.op = meta.op || '';

  const dot = document.createElement('span');
  dot.className = 'lw-result-dot';
  dot.setAttribute('aria-hidden', 'true');
  card.appendChild(dot);

  const opEl = document.createElement('span');
  opEl.className = 'lw-result-op';
  const numeral = document.createElement('span');
  numeral.className = 'lw-result-numeral';
  numeral.textContent = OP_NUMERAL[meta.op] || '';
  opEl.appendChild(numeral);
  opEl.appendChild(document.createTextNode(OP_LABEL[meta.op] || meta.op || '—'));
  card.appendChild(opEl);

  const stats = document.createElement('span');
  stats.className = 'lw-result-stats';
  const roundsEl = document.createElement('span');
  const rounds = Number.isFinite(meta.rounds) ? meta.rounds : '—';
  roundsEl.innerHTML = `<strong>${rounds}</strong>${rounds === 1 ? 'round' : 'rounds'}`;
  stats.appendChild(roundsEl);
  const touchedCount = Array.isArray(meta.touched) ? meta.touched.length : 0;
  const pagesEl = document.createElement('span');
  pagesEl.innerHTML = `<strong>${touchedCount}</strong>${touchedCount === 1 ? 'page touched' : 'pages touched'}`;
  stats.appendChild(pagesEl);
  card.appendChild(stats);

  return card;
}

function buildChips(meta) {
  const touched = Array.isArray(meta.touched) ? meta.touched : [];
  if (touched.length === 0) return null;

  const wrap = document.createElement('div');
  wrap.className = 'lw-touched';

  const label = document.createElement('div');
  label.className = 'lw-touched-label';
  label.textContent = 'Touched pages';
  wrap.appendChild(label);

  const chips = document.createElement('div');
  chips.className = 'lw-chips';
  for (const rel of touched) {
    const a = document.createElement('a');
    a.className = 'lw-chip';
    a.href = absWikiHref(meta.wikiRoot, rel);
    a.textContent = rel;
    chips.appendChild(a);
  }
  wrap.appendChild(chips);
  return wrap;
}

export function renderOutput(host, data) {
  if (!host) return false;
  // Accept either { markdown, meta } or plain { markdown } (legacy).
  const markdown = (data && typeof data.markdown === 'string') ? data.markdown : '';
  const meta = (data && typeof data.meta === 'object' && data.meta) ? data.meta : null;

  host.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'llm-wiki-output';

  if (meta) {
    root.appendChild(buildResultCard(meta));
  }

  const body = document.createElement('div');
  body.className = 'lw-body';
  body.innerHTML = mdToHtml(markdown);
  root.appendChild(body);

  if (meta) {
    const chips = buildChips(meta);
    if (chips) root.appendChild(chips);
  }

  host.appendChild(root);
  return true;
}
