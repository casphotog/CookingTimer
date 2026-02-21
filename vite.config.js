import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    legacy({
      // Targets for the legacy (nomodule) bundle — Babel-transpiled ES5
      // with full polyfills for browsers without ES module support.
      targets: ['ios >= 12'],
      // Also inject runtime polyfills into the modern (ES module) bundle.
      // iOS 12 supports <script type="module"> but lacks APIs like WeakRef
      // (used by Svelte 5 internally), so the modern bundle needs them too.
      modernPolyfills: true,
    }),
  ],
})
