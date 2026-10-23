import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/**
 * Point d'enregistrement de l'outil de developpement `outils/tracer.html`
 * (trace des plans de salle) : lui permet d'ecrire son resultat directement
 * dans `data/cartes/` au lieu de passer par le dossier Telechargements.
 *
 * `configureServer` ne s'execute que sous `npm run dev` : rien de tout ceci
 * n'existe dans le site construit, qui reste strictement statique.
 */
function tracerPlan(): Plugin {
  return {
    name: 'tracer-plan',
    configureServer(serveur) {
      serveur.middlewares.use('/__tracer/enregistrer', (requete, reponse, suivant) => {
        if (requete.method !== 'POST') return suivant()
        let corps = ''
        requete.on('data', (morceau) => (corps += morceau))
        requete.on('end', () => {
          reponse.setHeader('content-type', 'application/json')
          try {
            const { fichier, contenu } = JSON.parse(corps)
            // Garde-fou : un nom simple, sans separateur de chemin ni `..`, pour
            // qu'on ne puisse jamais ecrire ailleurs que dans data/cartes/.
            if (!/^[\w.-]+\.json$/.test(fichier) || fichier.includes('..')) {
              throw new Error('nom de fichier refuse')
            }
            const chemin = fileURLToPath(new URL(`./data/cartes/${fichier}`, import.meta.url))
            writeFileSync(chemin, `${JSON.stringify(contenu, null, 2)}\n`)
            reponse.statusCode = 200
            reponse.end(JSON.stringify({ ok: true, chemin }))
          } catch (e) {
            reponse.statusCode = 400
            reponse.end(JSON.stringify({ ok: false, erreur: (e as Error).message }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tracerPlan()],
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
