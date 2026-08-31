import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // Le dossier `data/` vit hors de `src/` : on l'expose au serveur de dev
  // pour pouvoir l'importer en `?raw` (cf. src/core/sources/repo.ts).
  server: { fs: { allow: ['..'] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  base: './',
})
