// Script ponctuel : place les blocs de data/blocs.csv sur le plan invente
// de public/cartes/demo.svg, a peu pres au hasard le long de la bande murale
// qui correspond a leur style. Genere data/cartes/demo.json.
//
// Pas execute par le site ni par la suite de tests : usage unique, garde ici
// pour tracer comment le fichier a ete produit et pouvoir le regenerer si le
// plan ou les donnees changent.
//
// ZONES doit rester en phase avec les bandes murales dessinees dans
// demo.svg, et ses cles avec `src/core/stylesBloc.ts` (STYLES_BLOC).
import { readFileSync, writeFileSync } from 'node:fs'

const COULEUR_PAR_NOM = { Bleu: 'bleu', Vert: 'vert', Jaune: 'jaune', Rouge: 'rouge', Noir: 'noir' }

// Bandes murales du plan invente (coordonnees du viewBox 1000x700 de demo.svg),
// avec une marge pour que les pastilles debordent le moins possible sur le
// sol ou sur le mur voisin.
const ZONES = {
  'Dalle/pied': { x0: 25, x1: 308, y0: 25, y1: 105 },
  'Dalle/force': { x0: 358, x1: 642, y0: 25, y1: 105 },
  'Dalle/doigts': { x0: 692, x1: 975, y0: 25, y1: 105 },
  'Dévers/force': { x0: 895, x1: 975, y0: 25, y1: 325 },
  'Dévers/doigts': { x0: 895, x1: 975, y0: 375, y1: 675 },
  'Technique/force': { x0: 525, x1: 975, y0: 595, y1: 675 },
  'Technique/doigt': { x0: 25, x1: 475, y0: 595, y1: 675 },
  Dyno: { x0: 25, x1: 105, y0: 375, y1: 675 },
  Coordo: { x0: 25, x1: 105, y0: 25, y1: 325 },
}
const LARGEUR = 1000
const HAUTEUR = 700
/** Total de blocs a placer sur la carte : la salle simulee en a 369, largement
 *  plus que ce qu'une carte peut montrer lisiblement. */
const TOTAL_BLOCS = 50

/** PRNG deterministe (mulberry32), pour que la disposition soit reproductible. */
function pseudoAleatoire(graine) {
  let a = graine
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function graineDe(texte) {
  let h = 0
  for (let i = 0; i < texte.length; i++) h = (Math.imul(h, 31) + texte.charCodeAt(i)) | 0
  return h
}

const csv = readFileSync(new URL('../data/blocs.csv', import.meta.url), 'utf8')
const [entete, ...lignes] = csv.trim().split('\n')
const colonnes = entete.split(',')

const tousLesBlocs = lignes.map((ligne) => {
  const valeurs = ligne.split(',')
  return Object.fromEntries(colonnes.map((c, i) => [c, valeurs[i]]))
})

// Quota par zone proportionnel a son effectif reel, arrondi par la methode
// du plus grand reste pour tomber exactement sur TOTAL_BLOCS.
const parZone = new Map()
for (const bloc of tousLesBlocs) {
  if (!parZone.has(bloc.secteur)) parZone.set(bloc.secteur, [])
  parZone.get(bloc.secteur).push(bloc)
}
const quotas = [...parZone].map(([style, blocsDeLaZone]) => {
  const exact = (TOTAL_BLOCS * blocsDeLaZone.length) / tousLesBlocs.length
  return { style, blocsDeLaZone, quota: Math.floor(exact), reste: exact - Math.floor(exact) }
})
let manquants = TOTAL_BLOCS - quotas.reduce((s, q) => s + q.quota, 0)
for (const q of [...quotas].sort((a, b) => b.reste - a.reste)) {
  if (manquants <= 0) break
  q.quota += 1
  manquants -= 1
}

/** Score deterministe dans [0, 1), pour choisir un sous-ensemble reproductible. */
const scoreSelection = (id) => pseudoAleatoire(graineDe(`${id}:selection`))()

const blocsChoisis = quotas.flatMap(({ style, blocsDeLaZone, quota }) => {
  if (!ZONES[style]) throw new Error(`Style sans zone sur le plan : ${style}`)
  return [...blocsDeLaZone].sort((a, b) => scoreSelection(a.id) - scoreSelection(b.id)).slice(0, quota)
})

const blocs = blocsChoisis.map((bloc) => {
  const zone = ZONES[bloc.secteur]
  const alea = pseudoAleatoire(graineDe(bloc.id))
  const x = (zone.x0 + alea() * (zone.x1 - zone.x0)) / LARGEUR
  const y = (zone.y0 + alea() * (zone.y1 - zone.y0)) / HAUTEUR
  return {
    id: bloc.id,
    nom: bloc.nom,
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    cotation: bloc.cotation_officielle,
    couleur: COULEUR_PAR_NOM[bloc.couleur] ?? 'bleu',
    style: bloc.secteur,
  }
})

const carte = { fond: 'cartes/demo.svg', blocs }
writeFileSync(new URL('../data/cartes/demo.json', import.meta.url), JSON.stringify(carte, null, 2) + '\n')
console.log(`${blocs.length} blocs ecrits dans data/cartes/demo.json`)
