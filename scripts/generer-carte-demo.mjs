// Script ponctuel : place les blocs de data/blocs.csv sur le plan invente
// de public/cartes/demo.svg, a peu pres au hasard le long de la bande murale
// qui correspond a leur style. Genere data/cartes/demo.json.
//
// Pas execute par le site ni par la suite de tests : usage unique, garde ici
// pour tracer comment le fichier a ete produit et pouvoir le regenerer si le
// plan ou les donnees changent.
import { readFileSync, writeFileSync } from 'node:fs'

const COULEUR_PAR_NOM = { Bleu: 'bleu', Vert: 'vert', Jaune: 'jaune', Rouge: 'rouge', Noir: 'noir' }

// Bandes murales du plan invente (coordonnees du viewBox 1000x700 de demo.svg),
// avec une marge pour que les pastilles debordent le moins possible sur le
// sol ou sur le mur voisin.
const ZONES = {
  Dalle: { x0: 25, x1: 475, y0: 25, y1: 105 },
  Toit: { x0: 525, x1: 975, y0: 25, y1: 105 },
  Devers: { x0: 895, x1: 975, y0: 25, y1: 325 },
  Arete: { x0: 895, x1: 975, y0: 375, y1: 675 },
  Cave: { x0: 525, x1: 975, y0: 595, y1: 675 },
  Traverse: { x0: 25, x1: 475, y0: 595, y1: 675 },
  Competition: { x0: 25, x1: 105, y0: 375, y1: 675 },
  Prow: { x0: 25, x1: 105, y0: 25, y1: 325 },
}
const LARGEUR = 1000
const HAUTEUR = 700

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

const blocs = lignes.map((ligne) => {
  const valeurs = ligne.split(',')
  const bloc = Object.fromEntries(colonnes.map((c, i) => [c, valeurs[i]]))
  const zone = ZONES[bloc.secteur]
  if (!zone) throw new Error(`Style sans zone sur le plan : ${bloc.secteur}`)
  const alea = pseudoAleatoire(graineDe(bloc.id))
  const x = (zone.x0 + alea() * (zone.x1 - zone.x0)) / LARGEUR
  const y = (zone.y0 + alea() * (zone.y1 - zone.y0)) / HAUTEUR
  return {
    id: bloc.id,
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
