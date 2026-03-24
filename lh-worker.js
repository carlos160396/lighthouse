/**
 * Worker: ejecuta una sola auditoría de Lighthouse (un proceso por URL para evitar condiciones de carrera).
 * Uso: node lh-worker.js <url> <resultPath> [formFactor]
 * formFactor: 'desktop' | 'mobile' (por defecto: mobile)
 * Usa throttling y user-agent como PageSpeed Insights para resultados más comparables.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = require('./module.cjs');
const { chromePath, settings } = config.ci.collect;
const chromeFlags = settings?.chromeFlags || ['--headless=new', '--no-sandbox', '--disable-gpu'];

const url = process.argv[2];
const resultPath = process.argv[3];
const formFactor = (process.argv[4] || 'mobile').toLowerCase() === 'desktop' ? 'desktop' : 'mobile';

if (!url || !resultPath) {
  console.error('Uso: node lh-worker.js <url> <resultPath> [desktop|mobile]');
  process.exit(1);
}

// Emulación de pantalla según Lighthouse (debe coincidir con formFactor)
const screenEmulationByFormFactor = {
  mobile: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
  desktop: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
};

// Cargar constantes de Lighthouse (mismo throttling y user-agent que PageSpeed Insights)
const lighthouseRoot = path.dirname(require.resolve('lighthouse'));
const constantsPath = path.join(lighthouseRoot, 'config/constants.js');
const constants = await import(pathToFileURL(constantsPath).href);

async function run() {
  const chrome = await chromeLauncher.launch({
    chromePath: chromePath || undefined,
    chromeFlags,
  });

  try {
    const options = {
      logLevel: 'silent',
      output: 'html',
      formFactor,
      screenEmulation: screenEmulationByFormFactor[formFactor],
      throttling: formFactor === 'mobile' ? constants.throttling.mobileSlow4G : constants.throttling.desktopDense4G,
      throttlingMethod: 'simulate',
      emulatedUserAgent: constants.userAgents[formFactor],
      onlyCategories: settings?.onlyCategories || ['accessibility'],
      port: chrome.port,
    };
    const runnerResult = await lighthouse(url, options);
    const payload = { url, lhr: runnerResult.lhr, report: runnerResult.report };
    fs.writeFileSync(resultPath, JSON.stringify(payload), 'utf8');
  } finally {
    try {
      await chrome.kill();
    } catch (e) {
      // chrome-launcher a veces falla al borrar /tmp (ENOTEMPTY) con muchas instancias; el resultado ya está guardado
      if (e?.code !== 'ENOTEMPTY' && e?.code !== 'EBUSY') throw e;
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
