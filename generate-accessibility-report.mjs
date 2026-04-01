/**
 * Genera accessibility-report.html a partir de los JSON en lhci-reports/{desktop,mobile}/.
 * Uso: node generate-accessibility-report.mjs [--out /ruta/accessibility-report.html]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = require('./module.cjs');
const minScore =
  config.ci.assert?.assertions?.['categories:accessibility']?.[1]?.minScore ?? 0.96;
const outputDir = path.resolve(__dirname, config.ci.upload?.outputDir || './lhci-reports');
const urlListFromConfig = Array.isArray(config.ci.collect?.url)
  ? config.ci.collect.url.flat(Infinity).filter((u) => typeof u === 'string')
  : [];

/** Clave estable para deduplicar y filtrar (trailing slash, etc.). */
function normalizeUrlKey(u) {
  try {
    const x = new URL(u);
    let p = x.pathname;
    if (!p.endsWith('/')) p += '/';
    return `${x.origin}${p}`.toLowerCase();
  } catch {
    return String(u).trim();
  }
}

const allowedUrlKeys =
  urlListFromConfig.length > 0 ? new Set(urlListFromConfig.map(normalizeUrlKey)) : null;

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outPath =
  outIdx >= 0 && args[outIdx + 1]
    ? path.resolve(args[outIdx + 1])
    : path.join(__dirname, 'accessibility-report.html');

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isAuditFailed(audit) {
  if (!audit || audit.score === null || audit.score === undefined) return false;
  return audit.score < 1;
}

function getTableItems(detail) {
  if (!detail || detail.type !== 'table' || !Array.isArray(detail.items)) return [];
  return detail.items;
}

function itemSnippet(item) {
  const n = item?.node;
  if (typeof n?.snippet === 'string') return n.snippet;
  if (typeof item?.snippet === 'string') return item.snippet;
  if (typeof n?.selector === 'string') return n.selector;
  return '';
}

function itemSelector(item) {
  const n = item?.node;
  if (typeof n?.selector === 'string') return n.selector;
  if (typeof item?.selector === 'string') return item.selector;
  return '';
}

function itemExplanation(item) {
  if (typeof item?.explanation === 'string') return item.explanation;
  return '';
}

function collectFailedAudits(lhr) {
  const cat = lhr.categories?.accessibility;
  if (!cat?.auditRefs) return [];
  const out = [];
  for (const ref of cat.auditRefs) {
    if (!ref.weight) continue;
    const audit = lhr.audits?.[ref.id];
    if (!audit || !isAuditFailed(audit)) continue;
    const items = getTableItems(audit.details);
    out.push({
      id: ref.id,
      title: audit.title,
      description: audit.description || '',
      items,
    });
  }
  return out;
}

function scoreColor(pct) {
  if (pct >= 96) return '#0cce6b';
  if (pct >= 90) return '#ffa400';
  return '#ff6b6b';
}

function scoreRingSvg(score01) {
  const pct = Math.round((score01 ?? 0) * 100);
  const c = 2 * Math.PI * 40;
  const offset = c * (1 - pct / 100);
  const col = scoreColor(pct);
  return `<svg width="64" height="64" viewBox="0 0 100 100" class="score-ring">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#e8e8e8" stroke-width="8"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="${col}" stroke-width="8"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 50 50)"/>
      <text x="50" y="56" text-anchor="middle" font-size="26" font-weight="700" fill="${col}">${pct}</text>
    </svg>`;
}

function displayPath(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.pathname || '/';
  } catch {
    return urlStr;
  }
}

function loadLhrs(formFactor) {
  const dir = path.join(outputDir, formFactor);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f.startsWith('report_'));
  /** Una entrada por URL: si hay varias corridas, quedarse con el JSON más reciente (mtime). */
  const byUrl = new Map();
  for (const f of files) {
    const p = path.join(dir, f);
    try {
      const mtime = fs.statSync(p).mtimeMs;
      const raw = fs.readFileSync(p, 'utf8');
      const lhr = JSON.parse(raw);
      const url = lhr.finalDisplayedUrl || lhr.requestedUrl || '';
      if (!url) continue;
      const key = normalizeUrlKey(url);
      if (allowedUrlKeys && !allowedUrlKeys.has(key)) continue;
      const prev = byUrl.get(key);
      if (!prev || mtime > prev.mtime) {
        byUrl.set(key, { lhr, url, formFactor, mtime });
      }
    } catch (e) {
      console.warn('No se pudo leer', p, e.message);
    }
  }
  return [...byUrl.values()].map(({ lhr, url, formFactor }) => ({ lhr, url, formFactor }));
}

function formatDateEs(d) {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

const CSS = fs.readFileSync(path.join(__dirname, 'accessibility-report.css'), 'utf8');

function buildIssuesSummary(aggregateById, maxBar) {
  const rows = Object.values(aggregateById).sort((a, b) => b.totalItems - a.totalItems);
  if (!rows.length) {
    return '<p class="no-issues">Ninguna página por debajo del umbral: no hay issues que mostrar.</p>';
  }
  return rows
    .map((r) => {
      const w = maxBar > 0 ? Math.round((r.totalItems / maxBar) * 100) : 0;
      const pagesLabel =
        r.pageKeys.size === 1 ? '1 página' : `${r.pageKeys.size} páginas`;
      return `
        <div class="issue-bar-row">
          <div class="issue-bar-label" title="${escapeHtml(r.title)}">${escapeHtml(r.id)}</div>
          <div class="issue-bar-track"><div class="issue-bar-fill" style="width:${Math.min(100, w)}%">${r.totalItems}</div></div>
          <div class="issue-bar-pages">${pagesLabel}</div>
        </div>`;
    })
    .join('');
}

function buildPageRows(entries, formFactor) {
  const below = entries.filter((e) => (e.lhr.categories?.accessibility?.score ?? 0) < minScore);
  if (!below.length) {
    return `<tr><td colspan="5" class="no-issues">Todas las páginas cumplen el mínimo (${(minScore * 100).toFixed(0)}%) en ${formFactor}.</td></tr>`;
  }
  const rows = [];
  for (const { lhr, url } of below) {
    const failed = collectFailedAudits(lhr);
    const issueTypes = failed.length;
    const elementCount = failed.reduce((s, a) => s + a.items.length, 0);
    const score = lhr.categories?.accessibility?.score ?? 0;
    const pathDisp = displayPath(url);
    const dataPage = pathDisp.replace(/\//g, '-') || 'index';

    const tags = failed
      .map(
        (a) =>
          `<span class="audit-tag" title="${escapeHtml(a.title)}">${escapeHtml(a.id)} <span class="tag-count">${a.items.length}</span></span>`
      )
      .join('');

    const detailsHtml = failed
      .map((a) => {
        const itemsHtml = a.items
          .slice(0, 40)
          .map(
            (it) => `
                    <div class="item-entry">
                      <code class="snippet">${escapeHtml(itemSnippet(it).slice(0, 500))}</code>
                      <div class="selector">Selector: <code>${escapeHtml(itemSelector(it))}</code></div>
                      <div class="explanation">${escapeHtml(itemExplanation(it))}</div>
                    </div>`
          )
          .join('');
        const more =
          a.items.length > 40
            ? `<div class="more-items">… y ${a.items.length - 40} más</div>`
            : '';
        return `
              <div class="audit-detail">
                <div class="audit-header">
                  <span class="audit-icon">⚠️</span>
                  <strong>${escapeHtml(a.title)}</strong>
                  <span class="element-count">${a.items.length} elements</span>
                </div>
                <p class="audit-desc">${escapeHtml(a.description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 500))}</p>
                <div class="items-list">
                  ${itemsHtml}
                  ${more}
                </div>
              </div>`;
      })
      .join('');

    rows.push(`
      <tr class="page-row" data-page="${escapeHtml(dataPage)}">
        <td class="cell-score">${scoreRingSvg(score)}</td>
        <td class="cell-path">
          <a href="${escapeHtml(url)}" target="_blank" class="page-link">${escapeHtml(pathDisp)}</a>
          <div class="audit-tags">${tags}</div>
        </td>
        <td class="cell-issues">${issueTypes}</td>
        <td class="cell-elements">${elementCount}</td>
        <td class="cell-expand">
          <button class="btn-expand" onclick="toggleDetails(this)" aria-label="Toggle details">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </td>
      </tr>
      <tr class="detail-row" style="display:none">
        <td colspan="5">
          <div class="detail-content">${detailsHtml}
          </div>
        </td>
      </tr>`);
  }
  return rows.join('\n');
}

function main() {
  const desktop = loadLhrs('desktop');
  const mobile = loadLhrs('mobile');
  if (!desktop.length && !mobile.length) {
    console.error(
      `No hay reportes JSON en ${outputDir}/desktop|mobile. Ejecuta primero: npm run lh:parallel`
    );
    process.exit(1);
  }

  const byUrl = new Map();
  for (const e of [...desktop, ...mobile]) {
    if (!e.url) continue;
    if (!byUrl.has(e.url)) byUrl.set(e.url, { desktop: null, mobile: null });
    byUrl.get(e.url)[e.formFactor] = e.lhr;
  }

  let sumDesktop = 0,
    nDesktop = 0;
  let sumMobile = 0,
    nMobile = 0;
  for (const e of desktop) {
    const s = e.lhr.categories?.accessibility?.score;
    if (s != null) {
      sumDesktop += s;
      nDesktop++;
    }
  }
  for (const e of mobile) {
    const s = e.lhr.categories?.accessibility?.score;
    if (s != null) {
      sumMobile += s;
      nMobile++;
    }
  }
  const avgDesktop = nDesktop ? sumDesktop / nDesktop : 0;
  const avgMobile = nMobile ? sumMobile / nMobile : 0;
  const avgDesktopPct = Math.round(avgDesktop * 100);
  const avgMobilePct = Math.round(avgMobile * 100);

  const failDesktop = desktop.filter(
    (e) => (e.lhr.categories?.accessibility?.score ?? 0) < minScore
  ).length;
  const failMobile = mobile.filter(
    (e) => (e.lhr.categories?.accessibility?.score ?? 0) < minScore
  ).length;

  const urlsWithIssues = new Set();
  for (const [url, pair] of byUrl) {
    const ds = pair.desktop?.categories?.accessibility?.score;
    const ms = pair.mobile?.categories?.accessibility?.score;
    if ((ds != null && ds < minScore) || (ms != null && ms < minScore)) urlsWithIssues.add(url);
  }

  const aggregateById = {};
  let maxBar = 0;
  for (const e of [...desktop, ...mobile]) {
    if ((e.lhr.categories?.accessibility?.score ?? 1) >= minScore) continue;
    const failed = collectFailedAudits(e.lhr);
    const pageKey = `${e.url}::${e.formFactor}`;
    for (const a of failed) {
      if (!aggregateById[a.id]) {
        aggregateById[a.id] = {
          id: a.id,
          title: a.title,
          totalItems: 0,
          pageKeys: new Set(),
        };
      }
      const g = aggregateById[a.id];
      g.totalItems += a.items.length;
      g.pageKeys.add(pageKey);
      if (g.totalItems > maxBar) maxBar = g.totalItems;
    }
  }

  const issuesSummaryHtml = buildIssuesSummary(aggregateById, maxBar);

  const desktopRows = buildPageRows(desktop, 'desktop');
  const mobileRows = buildPageRows(mobile, 'mobile');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lighthouse Accessibility Report — Bizee</title>
<style>
${CSS}
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>Lighthouse Accessibility Report</h1>
    <div class="subtitle">Páginas por debajo del ${(minScore * 100).toFixed(0)}% de accesibilidad</div>
    <div class="date">${escapeHtml(formatDateEs(new Date()))}</div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" style="color:var(--danger)">${urlsWithIssues.size}</div>
      <div class="stat-label">Páginas con issues</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--warning)">${failDesktop}</div>
      <div class="stat-label">Fallan en Desktop</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--warning)">${failMobile}</div>
      <div class="stat-label">Fallan en Mobile</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${scoreColor(avgDesktopPct)}">${avgDesktopPct}%</div>
      <div class="stat-label">Promedio Desktop</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${scoreColor(avgMobilePct)}">${avgMobilePct}%</div>
      <div class="stat-label">Promedio Mobile</div>
    </div>
  </div>

  <div class="issues-summary">
    <h2>Resumen de Issues más comunes</h2>
    ${issuesSummaryHtml}
  </div>

  <div class="tabs">
    <button type="button" class="tab active" onclick="switchTab('desktop', this)">
      🖥 Desktop <span class="tab-badge">${failDesktop}</span>
    </button>
    <button type="button" class="tab" onclick="switchTab('mobile', this)">
      📱 Mobile <span class="tab-badge">${failMobile}</span>
    </button>
  </div>

  <div id="tab-desktop" class="tab-content active">
      <table class="results-table">
        <thead>
          <tr>
            <th class="th-score">Score</th>
            <th class="th-path">Página</th>
            <th class="th-issues">Auditorías</th>
            <th class="th-elements">Elementos</th>
            <th class="th-expand"></th>
          </tr>
        </thead>
        <tbody>
${desktopRows}
        </tbody>
      </table>
  </div>

  <div id="tab-mobile" class="tab-content">
      <table class="results-table">
        <thead>
          <tr>
            <th class="th-score">Score</th>
            <th class="th-path">Página</th>
            <th class="th-issues">Auditorías</th>
            <th class="th-elements">Elementos</th>
            <th class="th-expand"></th>
          </tr>
        </thead>
        <tbody>
${mobileRows}
        </tbody>
      </table>
  </div>

</div>

<script>
function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}
function toggleDetails(btn) {
  const row = btn.closest('tr');
  const detail = row.nextElementSibling;
  const isOpen = detail.style.display !== 'none';
  detail.style.display = isOpen ? 'none' : 'table-row';
  btn.classList.toggle('open', !isOpen);
}
</script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`Informe escrito: ${outPath}`);
}

main();
