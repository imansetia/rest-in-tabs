import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copy each bundled font's OFL licence to dist/licenses/<family>/OFL.txt, so the
 * licences ship with the fonts. A font folder without OFL.txt fails the build.
 */
function fontLicences(): Plugin {
  const fontsDir = fileURLToPath(new URL('./src/assets/fonts/', import.meta.url));
  return {
    name: 'rest-in-tabs:font-licences',
    apply: 'build',
    generateBundle() {
      for (const entry of readdirSync(fontsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        this.emitFile({
          type: 'asset',
          fileName: `licenses/${entry.name}/OFL.txt`,
          source: readFileSync(join(fontsDir, entry.name, 'OFL.txt'), 'utf8'),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [fontLicences()],
  build: {
    rollupOptions: {
      input: {
        'service-worker': 'src/background/service-worker.ts',
        graveyard: 'src/graveyard/index.html',
        popup: 'src/popup/index.html',
        options: 'src/options/index.html',
      },
      output: {
        // manifest.json points at a fixed service worker file name
        entryFileNames: (chunk) =>
          chunk.name === 'service-worker' ? '[name].js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
