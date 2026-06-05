/**
 * SDLT policy tracker — clean editorial renderer.
 * Structure: intro → scenario advice cards (expandable detail) → key dates → references
 */
(function () {
  'use strict';

  let data = null;

  // Global source registry — url → sequential number
  let globalSources = [];
  let sourceRegistry = new Map();

  // ── Utilities ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return iso; }
  }

  function mergeData(incoming) {
    const base = window.SDLT_POLICY_TRACKER_DATA || {};
    if (!incoming || typeof incoming !== 'object') return JSON.parse(JSON.stringify(base));
    return { ...base, ...incoming, meta: { ...base.meta, ...(incoming.meta || {}) } };
  }

  // ── Source chip system ─────────────────────────────────────────────────────

  function resetSources() {
    globalSources = [];
    sourceRegistry = new Map();
  }

  function registerSource(src) {
    if (!src || !src.url) return 0;
    if (sourceRegistry.has(src.url)) return sourceRegistry.get(src.url);
    globalSources.push(src);
    const num = globalSources.length;
    sourceRegistry.set(src.url, num);
    return num;
  }

  /** Replace [cite:N] tokens with interactive chips. Non-token text is escaped. */
  function parseCitations(text, sources) {
    return text.split(/(\[cite:\d+\])/).map(part => {
      const m = part.match(/^\[cite:(\d+)\]$/);
      if (m) {
        const src = sources && sources[parseInt(m[1], 10)];
        if (!src) return '';
        const num = registerSource(src);
        return `<a class="cite-chip" href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" aria-label="Source ${num}: ${escapeHtml(src.title)}"><span class="cite-badge">${num}</span><span class="cite-label">${escapeHtml(src.title)}</span></a>`;
      }
      return escapeHtml(part);
    }).join('');
  }

  // ── Scenario cards ─────────────────────────────────────────────────────────

  function renderExample(ex) {
    if (!ex || !ex.rows || !ex.rows.length) return '';
    const rows = ex.rows.map(r => {
      const sdltClass = r.sdlt && r.sdlt.match(/^£0/) ? ' class="sdlt-exempt"'
        : r.sdlt && r.sdlt.match(/^Nil/)              ? ' class="sdlt-nil"'
        : ' class="sdlt-due"';
      return `<tr><td>${escapeHtml(r.year)}</td><td>${escapeHtml(r.npv)}</td><td${sdltClass}>${escapeHtml(r.sdlt)}</td></tr>`;
    }).join('');

    return `
      <div class="scenario-example">
        <p class="example-label">${escapeHtml(ex.label)}</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Year</th><th>Cumulative NPV</th><th>SDLT due</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderScenario(s) {
    // Advice paragraphs (always shown)
    const adviceHtml = (s.advice || [])
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('');

    // Detail paragraphs with citations (inside expandable)
    const detailHtml = (s.detail || [])
      .map(p => `<p>${parseCitations(p, s.sources)}</p>`)
      .join('');

    // Sources list for detail section
    const srcListHtml = (s.sources && s.sources.length)
      ? `<div class="detail-sources">` +
        s.sources.map(src => {
          const num = registerSource(src);
          return `<span class="detail-src-item"><span class="cite-badge cite-badge-sm">${num}</span><a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(src.title)}</a></span>`;
        }).join('') +
        `</div>`
      : '';

    const hasDetail = detailHtml || s.example;

    return `
      <article class="scenario-card scenario-${escapeHtml(s.status)}" id="${escapeHtml(s.id)}">
        <header class="scenario-head">
          <span class="scenario-badge badge-${escapeHtml(s.status)}">${escapeHtml(s.statusLabel)}</span>
          <h2 class="scenario-heading">${escapeHtml(s.heading)}</h2>
        </header>
        <div class="scenario-advice">${adviceHtml}</div>
        ${hasDetail ? `
        <details class="scenario-detail">
          <summary class="detail-toggle">
            <span>The reasoning</span>
            <span class="toggle-icon" aria-hidden="true"></span>
          </summary>
          <div class="detail-body">
            ${detailHtml}
            ${renderExample(s.example)}
            ${srcListHtml}
          </div>
        </details>` : ''}
      </article>`;
  }

  function renderScenarios() {
    const scenarios = data.scenarios || [];
    if (!scenarios.length) return '';
    return `<section class="scenarios-section">${scenarios.map(renderScenario).join('')}</section>`;
  }

  // ── Key dates ──────────────────────────────────────────────────────────────

  function renderKeyDates() {
    const dates = data.keyDates || data.timeline || [];
    if (!dates.length) return '';

    const items = [...dates]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(d => {
        const dateStr = d.date ? formatDate(d.date) : 'Pending';
        const linkHtml = d.url
          ? ` <a class="date-link" href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`
          : '';
        return `
        <div class="date-row${d.milestone ? ' date-milestone' : ''}">
          <div class="date-col">
            <time>${escapeHtml(dateStr)}</time>
          </div>
          <div class="date-content">
            <strong>${escapeHtml(d.headline)}</strong>
            <p>${escapeHtml(d.summary)}${linkHtml}</p>
          </div>
        </div>`;
      }).join('');

    return `
      <section class="dates-section" id="key-dates">
        <h2>Key dates</h2>
        ${items}
      </section>`;
  }

  // ── References ─────────────────────────────────────────────────────────────

  function renderReferences() {
    if (!globalSources.length) return '';
    const items = globalSources.map((s, i) =>
      `<li class="ref-item">
        <span class="cite-badge">${i + 1}</span>
        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>
      </li>`
    ).join('');

    return `
      <section class="refs-section" id="references">
        <h2>Sources</h2>
        <p class="refs-note">Numbers correspond to the inline citations in the reasoning sections above.</p>
        <ol class="ref-list">${items}</ol>
      </section>`;
  }

  // ── Page assembly ──────────────────────────────────────────────────────────

  function renderPage() {
    const el = document.getElementById('page-content');
    if (!el) return;

    resetSources();

    const intro = data.intro || '';
    const disclaimer = data.disclaimer || '';

    el.innerHTML =
      (disclaimer ? `<p class="disclaimer">${escapeHtml(disclaimer)}</p>` : '') +
      (intro ? `<p class="intro-text">${escapeHtml(intro)}</p>` : '') +
      renderScenarios() +
      renderKeyDates() +
      renderReferences();

    bindInteractivity();
  }

  function renderMeta() {
    const m = data.meta || {};
    const titleEl    = document.getElementById('page-title');
    const subEl      = document.getElementById('page-subtitle');
    const verifiedEl = document.getElementById('last-verified');
    if (titleEl)    titleEl.textContent    = m.title    || 'SDLT on residential tenancies';
    if (subEl)      subEl.textContent      = m.subtitle || '';
    if (verifiedEl) verifiedEl.textContent = m.lastVerified
      ? 'Last reviewed: ' + formatDate(m.lastVerified) : '';
  }

  // ── Interactivity ──────────────────────────────────────────────────────────

  function bindInteractivity() {
    // Nothing complex needed — <details> handles expand/collapse natively.
    // Just smooth-scroll any hash links.
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.getElementById(a.getAttribute('href').slice(1));
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    data = mergeData(null);
    renderMeta();
    renderPage();

    window.addEventListener('message', event => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'health-ping') {
        window.parent.postMessage({ type: 'health-ping' }, '*');
        return;
      }
      if (msg.type === 'tracker-data') {
        data = mergeData(msg.data);
        renderMeta();
        renderPage();
        window.parent.postMessage({ type: 'tracker-ready' }, '*');
      }
    });

    window.parent.postMessage({ type: 'tracker-ready' }, '*');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
