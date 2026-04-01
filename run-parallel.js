import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = require('./module.cjs');
const { url: urlList, formFactors = ['desktop', 'mobile'] } = config.ci.collect;
// Acepta lista plana o anidada por error (un [ extra hace que Node pase un array como argv → URL inválida)
const urls = Array.isArray(urlList) ? urlList.flat(Infinity).filter((u) => typeof u === 'string') : [];
const minAccessibility = config.ci.assert?.assertions?.['categories:accessibility']?.[1]?.minScore ?? 0.9;
const outputDir = path.resolve(__dirname, config.ci.upload?.outputDir || './lhci-reports');
// Máximo de workers a la vez (evita ENOTEMPTY y sobrecarga con muchas URLs)
const CONCURRENCY = 6;

function runAuditInProcess(url, formFactor) {
  const resultPath = path.join(tmpdir(), `lhci-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'lh-worker.js'), url, resultPath, formFactor],
      { stdio: 'inherit', env: { ...process.env } }
    );
    child.on('close', (code) => {
      if (code !== 0) {
        try { fs.unlinkSync(resultPath); } catch (_) {}
        reject(new Error(`Worker salió con código ${code}`));
        return;
      }
      try {
        const raw = fs.readFileSync(resultPath, 'utf8');
        fs.unlinkSync(resultPath);
        resolve({ ...JSON.parse(raw), formFactor });
      } catch (e) {
        reject(e);
      }
    });
    child.on('error', reject);
  });
}

function safeName(url) {
  const name = new URL(url).pathname.replace(/\//g, '_') || 'index';
  return name.slice(1) || 'index';
}

function regenerateAccessibilityReport() {
  const reportPath = path.join(__dirname, 'accessibility-report.html');
  const scriptPath = path.join(__dirname, 'generate-accessibility-report.mjs');
  console.log('\nActualizando accessibility-report.html…');
  const r = spawnSync(process.execPath, [scriptPath, '--out', reportPath], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (r.status !== 0) {
    console.warn('No se pudo generar accessibility-report.html (¿hay JSON en lhci-reports?).');
  }
}

async function main() {
  const total = urls.length * formFactors.length;
  fs.mkdirSync(outputDir, { recursive: true });
  formFactors.forEach((f) => fs.mkdirSync(path.join(outputDir, f), { recursive: true }));

  console.log(`Ejecutando Lighthouse: ${urls.length} URL(s) × ${formFactors.length} (${formFactors.join(', ')}) = ${total} auditorías (máx. ${CONCURRENCY} en paralelo)\n`);

  const start = Date.now();
  const allTasks = [];
  for (const formFactor of formFactors) {
    for (const url of urls) {
      allTasks.push(() => runAuditInProcess(url, formFactor));
    }
  }
  // Ejecutar en lotes de CONCURRENCY para no saturar Chrome
  const results = [];
  for (let i = 0; i < allTasks.length; i += CONCURRENCY) {
    const batch = allTasks.slice(i, i + CONCURRENCY).map((fn) => fn());
    results.push(...(await Promise.all(batch)));
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\nListo en ${elapsed}s.\n`);

  let failedCount = 0;
  for (const formFactor of formFactors) {
    const subset = results.filter((r) => r.formFactor === formFactor);
    let printedHeader = false;
    for (const { url, lhr, report, formFactor: f } of subset) {
      const dir = path.join(outputDir, f);
      const base = safeName(url);
      const jsonPath = path.join(dir, `report_${base}.json`);
      const htmlPath = path.join(dir, `report_${base}.html`);

      fs.writeFileSync(jsonPath, JSON.stringify(lhr, null, 2), 'utf8');
      if (typeof report === 'string') fs.writeFileSync(htmlPath, report, 'utf8');

      const score = lhr?.categories?.accessibility?.score ?? 0;
      const ok = score >= minAccessibility;
      if (!ok) failedCount++;
      if (!ok) {
        if (!printedHeader) {
          console.log(`--- ${formFactor.toUpperCase()} ---`);
          printedHeader = true;
        }
        console.log(`⚠️ ${url}`);
        console.log(`   Accesibilidad: ${(score * 100).toFixed(0)}% (mínimo ${minAccessibility * 100}%)`);
        console.log(`   Reporte: ${jsonPath}\n`);
      }
    }
    if (printedHeader) console.log('');
  }

  regenerateAccessibilityReport();

  if (failedCount > 0) {
    process.exitCode = 1;
    console.log(`${failedCount} auditoría(s) por debajo del mínimo de accesibilidad.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
