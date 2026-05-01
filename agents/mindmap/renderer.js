/* MindMap Visualization Renderer — standalone module.
 *
 * Renders `<div class="mindmap-viz-block" data-viz-json="...">` blocks into
 * an interactive d3 chart that starts as a static poster and expands to a
 * fullscreen interactive view on click.
 *
 * Exposes:
 *   window.MindmapVizRenderer   — the renderer class
 *   window.__madRenderMindmapViz(containerEl) — mounts all blocks inside
 *
 * External runtime deps:
 *   window.d3
 *   window.pagesNavigate / window.pagesNavigateFromHref (optional click handler)
 */
(function () {
  'use strict';

  const MINDMAP_THREAD_COLORS = [
    '#6366f1', // indigo
    '#06b6d4', // cyan
    '#f59e0b', // amber
    '#10b981', // emerald
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  const MINDMAP_NODE_W = 180;
  const MINDMAP_NODE_H = 64;
  const MINDMAP_NODE_SPACING = 230;
  const MINDMAP_LANE_PAD_LEFT = 180;
  const MINDMAP_BRANCH_OFFSET_Y = 80;
  const MINDMAP_LANE_BASE_HEIGHT = 140;
  const MINDMAP_BRANCH_GAP = 20;
  const MINDMAP_LABEL_ROW_H = 28;
  const MINDMAP_NODE_GAP = 20;

  class MindmapVizRenderer {
    constructor(containerEl, data) {
      this._container = containerEl;
      this._data = data;
      this._svg = null;
      this._contentGroup = null;
      this._nodePositions = new Map();
    }

    render() {
      const d3 = window.d3;
      if (!d3) {
        this._container.innerHTML = '<p style="color:var(--text-secondary)">d3.js is required for mind map visualization.</p>';
        return;
      }

      const { threads, connections, title, greeting, generatedAt, stats } = this._data;
      if (!threads || threads.length === 0) {
        this._container.innerHTML = '<p style="color:var(--text-secondary)">No threads to visualize.</p>';
        return;
      }

      this._layoutNodes(threads);
      const maxX = this._getMaxX() + MINDMAP_NODE_W + 80;
      const lastLane = this._laneYPositions[this._laneYPositions.length - 1] || { labelY: 80 };
      const totalHeight = lastLane.labelY + MINDMAP_LANE_BASE_HEIGHT + 80;
      const vbW = Math.max(maxX, 800);
      const vbH = Math.max(totalHeight, 400);

      if (this._container._mindmapResizeObserver) {
        this._container._mindmapResizeObserver.disconnect();
        this._container._mindmapResizeObserver = null;
      }
      this._container.innerHTML = '';
      this._container.classList.add('mindmap-viz-container');
      this._container.classList.add('is-poster');
      this._container.classList.remove('is-fullscreen', 'is-interactive');

      const header = document.createElement('div');
      header.className = 'mindmap-viz-header';
      const metaItems = [];
      if (generatedAt) {
        metaItems.push('<span class="mindmap-viz-meta-item mindmap-viz-date">' + this._escHtml(generatedAt) + '</span>');
      }
      if (stats && typeof stats.totalFiles === 'number') {
        metaItems.push('<span class="mindmap-viz-meta-item">' + stats.totalFiles + ' files</span>');
      }
      if (stats && typeof stats.changedCount === 'number' && stats.changedCount > 0) {
        metaItems.push('<span class="mindmap-viz-meta-item">' + stats.changedCount + ' new</span>');
      }
      header.innerHTML =
        '<div class="mindmap-viz-kicker">Mind Map</div>' +
        '<h2 class="mindmap-viz-title">' + this._escHtml(title || 'Your Knowledge Map') + '</h2>' +
        (greeting ? '<p class="mindmap-viz-subtitle">' + this._escHtml(greeting) + '</p>' : '') +
        (metaItems.length ? '<div class="mindmap-viz-meta">' + metaItems.join('') + '</div>' : '');
      this._container.appendChild(header);

      const stage = document.createElement('div');
      stage.className = 'mindmap-viz-stage';
      stage.style.setProperty('--viz-aspect', `${vbW} / ${vbH}`);
      this._container.appendChild(stage);
      this._stage = stage;

      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.setAttribute('class', 'mindmap-viz-svg');
      svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      stage.appendChild(svgEl);
      this._svg = d3.select(svgEl);

      const defs = this._svg.append('defs');
      const glowFilter = defs.append('filter').attr('id', 'mindmap-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
      glowFilter.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d) => d);

      this._contentGroup = this._svg.append('g').attr('class', 'mindmap-viz-content');

      this._zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          this._contentGroup.attr('transform', event.transform);
        });

      threads.forEach((thread, i) => {
        this._renderThread(thread, i);
      });

      this._renderConnections(connections || [], threads);

      this._mountPoster();
    }

    _activate() {
      if (this._container.classList.contains('is-interactive')) return;
      const d3 = window.d3;
      if (!d3 || !this._svg || !this._zoom) return;

      this._container.classList.remove('is-poster');
      this._container.classList.add('is-interactive');

      if (this._poster) {
        this._poster.remove();
        this._poster = null;
      }

      this._svg.call(this._zoom);
      const zoom = this._zoom;

      const controls = document.createElement('div');
      controls.className = 'mindmap-viz-controls';
      controls.innerHTML = [
        '<button type="button" class="mindmap-viz-ctrl mindmap-viz-ctrl--back" data-act="back" title="Back to preview" aria-label="Back to preview">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 6 10l6 6"/></svg>',
        '<span class="mindmap-viz-ctrl-label">Back to preview</span>',
        '</button>',
        '<span class="mindmap-viz-ctrl-divider" aria-hidden="true"></span>',
        '<button type="button" class="mindmap-viz-ctrl" data-act="zoom-in" title="Zoom in" aria-label="Zoom in">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>',
        '</button>',
        '<button type="button" class="mindmap-viz-ctrl" data-act="zoom-out" title="Zoom out" aria-label="Zoom out">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="10" x2="16" y2="10"/></svg>',
        '</button>',
        '<button type="button" class="mindmap-viz-ctrl" data-act="fit" title="Reset view" aria-label="Reset view">',
        '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M16 7V4h-3M4 13v3h3M16 13v3h-3"/></svg>',
        '</button>',
      ].join('');
      controls.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.mindmap-viz-ctrl');
        if (!btn) return;
        const act = btn.dataset.act;
        const svgSel = this._svg;
        if (act === 'zoom-in') {
          svgSel.transition().duration(180).call(zoom.scaleBy, 1.3);
        } else if (act === 'zoom-out') {
          svgSel.transition().duration(180).call(zoom.scaleBy, 1 / 1.3);
        } else if (act === 'fit') {
          svgSel.transition().duration(220).call(zoom.transform, d3.zoomIdentity);
        } else if (act === 'back') {
          this._deactivate();
        }
      });
      this._container.appendChild(controls);
      this._controls = controls;

      this._enterFullscreen();
    }

    _deactivate() {
      if (!this._container.classList.contains('is-interactive')) return;

      if (this._container.classList.contains('is-fullscreen')) {
        this._exitFullscreen();
      }

      if (this._svg && this._zoom) {
        this._svg.on('.zoom', null);
        if (this._contentGroup) this._contentGroup.attr('transform', null);
      }

      if (this._controls) {
        this._controls.remove();
        this._controls = null;
      }

      this._container.style.width = '';
      this._container.style.maxWidth = '';
      this._container.style.marginLeft = '';
      if (this._container._mindmapResizeObserver) {
        this._container._mindmapResizeObserver.disconnect();
        this._container._mindmapResizeObserver = null;
      }

      this._container.classList.remove('is-interactive');
      this._container.classList.add('is-poster');

      this._mountPoster();
    }

    _mountPoster() {
      if (this._poster) return;
      const poster = document.createElement('button');
      poster.type = 'button';
      poster.className = 'mindmap-viz-poster';
      poster.setAttribute('aria-label', 'Activate interactive mind map');
      poster.innerHTML = [
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--tl"></span>',
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--tr"></span>',
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--bl"></span>',
        '<span class="mindmap-viz-poster-corner mindmap-viz-poster-corner--br"></span>',
        '<span class="mindmap-viz-poster-cta">',
        '<span class="mindmap-viz-poster-cta-icon" aria-hidden="true">',
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
        '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
        '</svg>',
        '</span>',
        '<span class="mindmap-viz-poster-cta-label">',
        '<span class="mindmap-viz-poster-cta-eyebrow">Preview</span>',
        '<span class="mindmap-viz-poster-cta-text">Click to explore</span>',
        '</span>',
        '</span>',
      ].join('');
      poster.addEventListener('click', () => this._activate());
      this._container.appendChild(poster);
      this._poster = poster;
    }

    _enterFullscreen() {
      const el = this._container;
      if (el.classList.contains('is-fullscreen')) return;
      el.classList.add('is-fullscreen');
      el.style.width = '';
      el.style.maxWidth = '';
      el.style.marginLeft = '';
      document.body.classList.add('mindmap-viz-fullscreen-lock');
      this._escHandler = (ev) => {
        if (ev.key === 'Escape') this._deactivate();
      };
      window.addEventListener('keydown', this._escHandler);
      if (this._svg && this._zoom && window.d3) {
        this._svg.transition().duration(180).call(this._zoom.transform, window.d3.zoomIdentity);
      }
    }

    _exitFullscreen() {
      const el = this._container;
      if (!el.classList.contains('is-fullscreen')) return;
      el.classList.remove('is-fullscreen');
      document.body.classList.remove('mindmap-viz-fullscreen-lock');
      if (this._escHandler) {
        window.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
    }

    _layoutNodes(threads) {
      this._nodePositions.clear();
      this._laneYPositions = [];

      let currentY = 80;

      for (let threadIdx = 0; threadIdx < threads.length; threadIdx++) {
        const labelY = currentY;
        const cardY = currentY + MINDMAP_LABEL_ROW_H;
        this._laneYPositions.push({ labelY, cardY });

        const items = threads[threadIdx].items || [];
        const mainItems = items.filter((i) => !i.parentPath);
        const branchItems = items.filter((i) => i.parentPath);

        mainItems.forEach((item, idx) => {
          const x = MINDMAP_LANE_PAD_LEFT + idx * MINDMAP_NODE_SPACING;
          this._nodePositions.set(item.path, { x, y: cardY, threadIdx, isBranch: false });
        });

        const branchesByParent = new Map();
        for (const item of branchItems) {
          const list = branchesByParent.get(item.parentPath) || [];
          list.push(item);
          branchesByParent.set(item.parentPath, list);
        }

        let hasBranches = false;
        for (const [parentPath, siblings] of branchesByParent) {
          const parent = this._nodePositions.get(parentPath);
          if (!parent) {
            siblings.forEach((item, i) => {
              const x = MINDMAP_LANE_PAD_LEFT + (mainItems.length + i) * MINDMAP_NODE_SPACING;
              this._nodePositions.set(item.path, { x, y: cardY, threadIdx, isBranch: false });
            });
            continue;
          }
          hasBranches = true;
          siblings.forEach((item, i) => {
            const x = parent.x + (i + 1) * (MINDMAP_NODE_W + MINDMAP_BRANCH_GAP);
            const y = parent.y + MINDMAP_BRANCH_OFFSET_Y;
            this._nodePositions.set(item.path, { x, y, threadIdx, isBranch: true });
          });
        }

        this._resolveCollisions(items);

        const laneHeight = MINDMAP_LABEL_ROW_H + (hasBranches
          ? MINDMAP_NODE_H + MINDMAP_BRANCH_OFFSET_Y + MINDMAP_NODE_H + 40
          : MINDMAP_NODE_H + 60);
        currentY += Math.max(laneHeight, MINDMAP_LANE_BASE_HEIGHT);
      }
    }

    _resolveCollisions(items) {
      const rowMap = new Map();
      for (const item of items) {
        const pos = this._nodePositions.get(item.path);
        if (!pos) continue;
        const row = rowMap.get(pos.y) || [];
        row.push({ path: item.path, x: pos.x });
        rowMap.set(pos.y, row);
      }

      for (const [, row] of rowMap) {
        row.sort((a, b) => a.x - b.x);
        for (let i = 1; i < row.length; i++) {
          const prevRight = row[i - 1].x + MINDMAP_NODE_W + MINDMAP_NODE_GAP;
          if (row[i].x < prevRight) {
            row[i].x = prevRight;
            const pos = this._nodePositions.get(row[i].path);
            pos.x = prevRight;
          }
        }
      }
    }

    _getMaxX() {
      let max = 0;
      for (const pos of this._nodePositions.values()) {
        if (pos.x > max) max = pos.x;
      }
      return max;
    }

    _renderThread(thread, threadIdx) {
      const d3 = window.d3;
      const color = MINDMAP_THREAD_COLORS[threadIdx % MINDMAP_THREAD_COLORS.length];
      const lanePos = this._laneYPositions[threadIdx];
      const g = this._contentGroup.append('g').attr('class', 'thread-lane').attr('data-thread', thread.title);

      const mainPositions = [];
      for (const item of thread.items || []) {
        const pos = this._nodePositions.get(item.path);
        if (pos && !pos.isBranch) {
          mainPositions.push(pos);
        }
      }

      if (mainPositions.length >= 2) {
        const riverPoints = mainPositions.map((p) => [p.x + MINDMAP_NODE_W / 2, p.y + MINDMAP_NODE_H / 2]);
        const first = riverPoints[0];
        const last = riverPoints[riverPoints.length - 1];
        const extended = [[first[0] - 60, first[1]], ...riverPoints, [last[0] + 60, last[1]]];

        const line = d3.line().curve(d3.curveBasis);
        g.append('path')
          .attr('class', 'thread-river')
          .attr('d', line(extended))
          .attr('stroke', color)
          .attr('stroke-width', Math.max(3, Math.min(thread.items.length * 2, 12)));
      } else if (mainPositions.length === 1) {
        const p = mainPositions[0];
        g.append('line')
          .attr('class', 'thread-river')
          .attr('x1', p.x - 30).attr('y1', p.y + MINDMAP_NODE_H / 2)
          .attr('x2', p.x + MINDMAP_NODE_W + 30).attr('y2', p.y + MINDMAP_NODE_H / 2)
          .attr('stroke', color).attr('stroke-width', 4);
      }

      g.append('text')
        .attr('class', 'thread-label')
        .attr('x', 16)
        .attr('y', lanePos.labelY + 16)
        .attr('fill', color)
        .text(thread.title);

      for (const item of thread.items || []) {
        if (!item.parentPath) continue;
        const childPos = this._nodePositions.get(item.path);
        const parentPos = this._nodePositions.get(item.parentPath);
        if (!childPos || !parentPos) continue;

        const x1 = parentPos.x + MINDMAP_NODE_W / 2;
        const y1 = parentPos.y + MINDMAP_NODE_H;
        const x2 = childPos.x + MINDMAP_NODE_W / 2;
        const y2 = childPos.y;
        const midY = (y1 + y2) / 2;

        g.append('path')
          .attr('class', 'branch-line')
          .attr('d', `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`)
          .attr('stroke', color);
      }

      for (const item of thread.items || []) {
        const pos = this._nodePositions.get(item.path);
        if (!pos) continue;
        this._renderNodeCard(g, item, pos, color);
      }
    }

    _renderNodeCard(parentGroup, item, pos, color) {
      const g = parentGroup.append('g')
        .attr('class', 'node-card')
        .attr('data-path', item.path)
        .attr('transform', `translate(${pos.x},${pos.y})`)
        .style('cursor', 'pointer');

      g.append('rect')
        .attr('rx', 8).attr('ry', 8)
        .attr('width', MINDMAP_NODE_W).attr('height', MINDMAP_NODE_H)
        .attr('stroke', color).attr('stroke-opacity', 0.6);

      const dotColor = item.importance === 'high' ? '#22c55e' : item.importance === 'medium' ? '#eab308' : '#6b7280';
      g.append('circle')
        .attr('cx', MINDMAP_NODE_W - 14).attr('cy', 14)
        .attr('r', 4).attr('fill', dotColor);

      const titleText = this._truncate(item.title || '', 22);
      g.append('text')
        .attr('class', 'node-title')
        .attr('x', 12).attr('y', 24)
        .text(titleText);

      const summaryText = this._truncate(item.summary || '', 32);
      g.append('text')
        .attr('class', 'node-summary')
        .attr('x', 12).attr('y', 44)
        .text(summaryText);

      const titleEl = g.node();
      const tip = document.createElement('div');
      tip.className = 'mindmap-viz-tooltip';
      tip.innerHTML =
        '<div class="mindmap-viz-tip-title">' + this._escHtml(item.title || '') + '</div>' +
        '<div class="mindmap-viz-tip-summary">' + this._escHtml(item.summary || '') + '</div>' +
        '<div class="mindmap-viz-tip-path">' + this._escHtml(item.path || '') + '</div>';

      titleEl.addEventListener('mouseenter', () => {
        g.select('rect').attr('filter', 'url(#mindmap-glow)').attr('stroke-opacity', 1);
        this._container.appendChild(tip);
        const rect = titleEl.getBoundingClientRect();
        const containerRect = this._container.getBoundingClientRect();
        tip.style.left = (rect.left - containerRect.left + MINDMAP_NODE_W / 2 - tip.offsetWidth / 2) + 'px';
        tip.style.top = (rect.top - containerRect.top - tip.offsetHeight - 8) + 'px';
      });
      titleEl.addEventListener('mouseleave', () => {
        g.select('rect').attr('filter', null).attr('stroke-opacity', 0.6);
        if (tip.parentNode) tip.parentNode.removeChild(tip);
      });

      titleEl.addEventListener('click', () => {
        if (typeof window.pagesNavigate === 'function') {
          window.pagesNavigate(item.path, true, { type: 'file' });
        } else if (typeof window.pagesNavigateFromHref === 'function') {
          window.pagesNavigateFromHref(item.path);
        }
      });
    }

    _renderConnections(connections, threads) {
      if (!connections.length) return;
      const g = this._contentGroup.append('g').attr('class', 'cross-connections');

      const threadIndexByTitle = new Map();
      threads.forEach((t, i) => threadIndexByTitle.set(t.title, i));

      for (const conn of connections) {
        const fromIdx = threadIndexByTitle.get(conn.from);
        const toIdx = threadIndexByTitle.get(conn.to);
        if (fromIdx === undefined || toIdx === undefined || fromIdx === toIdx) continue;

        const fromY = this._laneYPositions[fromIdx].cardY + MINDMAP_NODE_H / 2;
        const toY = this._laneYPositions[toIdx].cardY + MINDMAP_NODE_H / 2;
        const x = MINDMAP_LANE_PAD_LEFT + 60;
        const midY = (fromY + toY) / 2;
        const arcX = x - 40;
        const arcD = `M${x},${fromY} Q${arcX},${midY} ${x},${toY}`;

        g.append('path')
          .attr('class', 'cross-link')
          .attr('d', arcD);

        const hitPath = g.append('path')
          .attr('d', arcD)
          .attr('fill', 'none')
          .attr('stroke', 'transparent')
          .attr('stroke-width', 16)
          .style('cursor', 'pointer');

        const insightText = conn.insight || '';
        if (insightText) {
          const tip = document.createElement('div');
          tip.className = 'mindmap-viz-tooltip';
          tip.innerHTML =
            '<div class="mindmap-viz-tip-title">' +
            this._escHtml(conn.from) + ' \u2194 ' + this._escHtml(conn.to) +
            '</div>' +
            '<div class="mindmap-viz-tip-summary">' + this._escHtml(insightText) + '</div>';

          const hitEl = hitPath.node();
          hitEl.addEventListener('mouseenter', () => {
            this._container.appendChild(tip);
            const rect = hitEl.getBoundingClientRect();
            const containerRect = this._container.getBoundingClientRect();
            tip.style.left = (rect.left - containerRect.left + rect.width / 2 - tip.offsetWidth / 2) + 'px';
            tip.style.top = (rect.top - containerRect.top - tip.offsetHeight - 8) + 'px';
            tip.style.opacity = '1';
          });
          hitEl.addEventListener('mouseleave', () => {
            tip.style.opacity = '0';
            if (tip.parentNode) tip.parentNode.removeChild(tip);
          });
        }
      }
    }

    _truncate(str, max) {
      if (str.length <= max) return str;
      return str.substring(0, max - 1) + '\u2026';
    }

    _escHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  function renderMindmapVizBlocks(container) {
    const blocks = container.querySelectorAll('.mindmap-viz-block');
    for (const block of blocks) {
      try {
        const jsonStr = decodeURIComponent(block.dataset.vizJson);
        const data = JSON.parse(jsonStr);
        const renderer = new MindmapVizRenderer(block, data);
        renderer.render();
      } catch (err) {
        block.innerHTML = '<p style="color:var(--text-secondary)">Failed to render mind map visualization: ' + (err.message || err) + '</p>';
      }
    }
  }

  window.MindmapVizRenderer = MindmapVizRenderer;
  window.__madRenderMindmapViz = renderMindmapVizBlocks;
})();
