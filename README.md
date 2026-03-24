# lighthouse

Auditorías de **accesibilidad** con [Lighthouse](https://developer.chrome.com/docs/lighthouse) en paralelo (desktop y mobile). Los reportes se guardan en HTML y JSON bajo `lhci-reports/`.

## Requisitos

- **Node.js** 18 o superior (recomendado LTS).
- **Google Chrome** instalado (Lighthouse lo usa en modo headless).
- Conexión a internet para auditar URLs públicas.

## Instalación

Clona el repositorio y instala dependencias:

```bash
git clone https://github.com/carlos160396/lighthouse.git
cd lighthouse
npm ci
```

Si no tienes `package-lock.json` alineado o prefieres resolver de nuevo:

```bash
npm install
```

## Configuración

Edita **`module.cjs`**:

1. **`ci.collect.url`** — Lista de URLs a auditar (al menos una). Ejemplo:

   ```js
   url: [
     'https://ejemplo.com/',
     'https://ejemplo.com/pagina',
   ],
   ```

2. **`ci.collect.chromePath`** — Ruta al ejecutable de Chrome en tu sistema.

   - **macOS** (por defecto en el repo):

     `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

   - **Linux** (típico): `/usr/bin/google-chrome` o `/usr/bin/chromium`

   - **Windows** (ejemplo): `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`

   Si lo omites o pones `undefined`, `chrome-launcher` intenta encontrar Chrome solo.

3. **`ci.collect.formFactors`** — `['desktop', 'mobile']` o solo uno de los dos.

4. **`ci.assert.assertions`** — Umbral mínimo de accesibilidad (por defecto 0.96 en el config). Si alguna URL queda por debajo, el proceso termina con código de salida **1**.

5. **`ci.upload.outputDir`** — Carpeta de salida (por defecto `./lhci-reports`).

## Cómo ejecutarlo

```bash
npm run lh:parallel
```

Eso ejecuta `node run-parallel.js`, que lanza varias auditorías en paralelo (con un límite de concurrencia) y escribe:

- `lhci-reports/desktop/report_<ruta>.html` y `.json`
- `lhci-reports/mobile/report_<ruta>.html` y `.json`

Al final verás en consola un resumen; las URLs que no cumplan el mínimo de accesibilidad se listan con advertencia.

## Notas

- La carpeta **`lhci-reports/`** está en `.gitignore`: no se sube al repo; se genera al correr las auditorías.
- Los flags de Chrome (`settings.chromeFlags`) están pensados para headless; en entornos restringidos a veces hace falta `--no-sandbox` (ya incluido en el ejemplo del config).
