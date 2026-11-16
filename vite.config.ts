import { defineConfig } from 'vite';

export default defineConfig({
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
