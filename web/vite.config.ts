import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The hidden page's chunk gets a neutral file name so nothing in the
// asset list points at it.
const HIDDEN = /^Obsession/

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        chunkFileNames: c => (HIDDEN.test(c.name) ? 'assets/h-[hash].js' : 'assets/[name]-[hash].js'),
        assetFileNames: a => (HIDDEN.test(a.names?.[0] ?? a.name ?? '') ? 'assets/h-[hash][extname]' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
})
