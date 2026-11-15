import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Files from the last v1 deploy. They stay published (public/assets) so a phone still
// showing the cached v1 page can load it instead of a blank screen, but they are not
// precached by the new service worker.
const LEGACY = ['assets/index-Dknie7dj.js', 'assets/index-Mam0g2Ts.css'];

/** After each build, writes dist/sw.js listing every file the app needs to run offline. */
function offlineServiceWorker() {
  let outDir;
  return {
    name: 'pour-offline',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
        .filter((file) => !file.endsWith('.map') && file !== 'sw.js' && !LEGACY.includes(file))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      const worker = readFileSync('src/sw-template.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__FILES__', JSON.stringify(files.map((file) => `/${file}`)));
      writeFileSync(join(outDir, 'sw.js'), worker);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), offlineServiceWorker()],
  test: { include: ['tests/**/*.test.js'] },
});
