import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServiceWorker } from './src/pwa/serviceWorkerSource.ts';
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 're-move-installable-app',
      generateBundle(_options, bundle) {
        const assets = Object.keys(bundle).filter((name) => /\.(js|css)$/.test(name));
        const revision = assets
          .join('|')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(-80);
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: createServiceWorker(
            [
              ...assets.map((name) => `/${name}`),
              '/manifest.webmanifest',
              '/apple-touch-icon.png',
              '/app-icon.svg',
              '/app-icon-192.png',
              '/app-icon-512.png',
              '/images/rehab-exercises.png',
              '/models/HUMAN.fbx',
            ],
            revision,
          ),
        });
      },
    },
  ],
  worker: { format: 'es' },
});
