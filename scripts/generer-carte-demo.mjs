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
// Les bandes du haut et du bas couvrent toute la largeur (y compris les
// coins) ; celles de gauche et de droite s'arretent donc strictement entre
// les deux pour ne jamais empieter sur un coin deja couvert par l'autre axe
// (sans quoi deux zones "voisines" au coin pourraient y placer des pastilles
// l'une sur l'autre).
// Les bandes laterales (Coordo, Devers) sont plus larges que les huit
// anciennes (80 -> 95 unites) : avec seulement quatre zones au lieu de neuf,
// chacune recoit environ deux fois plus de blocs (une douzaine plutot qu'une
// demi-douzaine), et une bande etroite en une seule colonne ne suffit plus a
// garder SEPARATION_MIN sur toute sa longueur. Elargir permet a la grille de
// passer a deux colonnes, ce qui suffit (verifie programmatiquement).
const ZONES = {
  Dalle: { x0: 25, x1: 975, y0: 25, y1: 105 },
  Dévers: { x0: 880, x1: 975, y0: 105, y1: 595 },
  Joker: { x0: 25, x1: 975, y0: 595, y1: 675 },
  Coordo: { x0: 25, x1: 120, y0: 105, y1: 595 },
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

/** Retrait depuis les bords de la zone : les pastilles ne collent ni au mur, ni a la zone voisine. */
const MARGE_ZONE = 10
/**
 * Separation minimale garantie entre deux centres de pastilles, en unites du
 * viewBox (1000x700). Calibree sur la taille de reference documentee dans le
 * README (rayon 20px pour une carte affichee a ~1150px de large, donc un
 * viewBox unit y vaut ~1150/1000 px) : un diametre de 40px de reference
 * correspond a ~35 unites de viewBox, 36 ajoute une petite marge. La taille
 * des pastilles etant proportionnelle a la largeur affichee (RAYON dans
 * VueCarte.tsx), cette garantie tient a toute taille d'ecran tant que le
 * plancher de 5px du rayon n'entre pas en jeu (cartes affichees sous
 * ~280px de large, hors de l'usage normal).
 */
const SEPARATION_MIN = 36

/**
 * Place `n` pastilles dans une zone selon une grille qui epouse ses
 * proportions, avec un leger jitter deterministe par bloc pour eviter un
 * alignement trop mecanique. Le jitter est plafonne pour ne jamais faire
 * descendre la separation entre deux pastilles voisines sous SEPARATION_MIN,
 * meme dans le pire cas (les deux jitters au maximum, l'un vers l'autre).
 */
function positionsEnGrille(zone, n) {
  const x0 = zone.x0 + MARGE_ZONE
  const x1 = zone.x1 - MARGE_ZONE
  const y0 = zone.y0 + MARGE_ZONE
  const y1 = zone.y1 - MARGE_ZONE
  const largeurZone = Math.max(1, x1 - x0)
  const hauteurZone = Math.max(1, y1 - y0)
  // Essaie toutes les repartitions en colonnes possibles et garde celle qui
  // maximise la plus petite dimension de cellule : une formule basee sur le
  // seul ratio largeur/hauteur de la zone (ex. racine carree) choisit parfois
  // une grille etroite en colonnes alors qu'une seule rangee, plus large,
  // laisserait bien plus d'espace entre les pastilles.
  let meilleur = null
  for (let colonnes = 1; colonnes <= n; colonnes++) {
    const lignes = Math.ceil(n / colonnes)
    const cellW = largeurZone / colonnes
    const cellH = hauteurZone / lignes
    const score = Math.min(cellW, cellH)
    if (!meilleur || score > meilleur.score) meilleur = { colonnes, cellW, cellH, score }
  }
  const { colonnes, cellW, cellH, score } = meilleur
  const jitter = Math.max(0, (score - SEPARATION_MIN) / 2)
  return Array.from({ length: n }, (_, i) => ({
    cx: x0 + cellW * ((i % colonnes) + 0.5),
    cy: y0 + cellH * (Math.floor(i / colonnes) + 0.5),
    jitter,
  }))
}

const groupesParZone = quotas.map(({ style, blocsDeLaZone, quota }) => {
  if (!ZONES[style]) throw new Error(`Style sans zone sur le plan : ${style}`)
  const choisis = [...blocsDeLaZone].sort((a, b) => scoreSelection(a.id) - scoreSelection(b.id)).slice(0, quota)
  return { zone: ZONES[style], choisis }
})

const blocs = groupesParZone.flatMap(({ zone, choisis }) => {
  const positions = positionsEnGrille(zone, choisis.length)
  return choisis.map((bloc, i) => {
    const { cx, cy, jitter } = positions[i]
    const alea = pseudoAleatoire(graineDe(bloc.id))
    const x = cx + (alea() * 2 - 1) * jitter
    const y = cy + (alea() * 2 - 1) * jitter
    return {
      id: bloc.id,
      nom: bloc.nom,
      x: Number((x / LARGEUR).toFixed(4)),
      y: Number((y / HAUTEUR).toFixed(4)),
      cotation: bloc.cotation_officielle,
      couleur: COULEUR_PAR_NOM[bloc.couleur] ?? 'bleu',
      style: bloc.secteur,
    }
  })
})

const carte = { fond: 'cartes/demo.svg', blocs }
writeFileSync(new URL('../data/cartes/demo.json', import.meta.url), JSON.stringify(carte, null, 2) + '\n')
console.log(`${blocs.length} blocs ecrits dans data/cartes/demo.json`)
