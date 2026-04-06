import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron', 'better-sqlite3'] },
          },
        },
        onstart(options) {
          options.startup()
        },
      },
      {
        // Preload for cockpit window
        entry: 'electron/preload-cockpit.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
          },
        },
        onstart(options) {
          options.reload()
        },
      },
      {
        // Preload for display window
        entry: 'electron/preload-display.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
          },
        },
        onstart(options) {
          options.reload()
        },
      },
      {
        // Preload for studio window
        entry: 'electron/preload-studio.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
          },
        },
        onstart(options) {
          options.reload()
        },
      },
      {
        // Preload for hub window
        entry: 'electron/preload-hub.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
          },
        },
        onstart(options) {
          options.reload()
        },
      },
    ]),
    renderer(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        display: resolve(__dirname, 'display.html'),
        hub: resolve(__dirname, 'hub.html'),
        studio: resolve(__dirname, 'studio.html'),
      },
    },
  },
})
