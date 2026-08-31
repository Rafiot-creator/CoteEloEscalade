/**
 * Genere un jeu de donnees factice mais credible dans data/ : une salle de bloc
 * et sa communaute d'habitues.
 * Deterministe (RNG seede) : relancer produit exactement les memes fichiers.
 *
 *   npm run data:generate
 *
 * L'echelle est celle du projet : **un cran V vaut 1000 points**, et 1000 points
 * valent dix chances contre une. Un V1 vaut donc 1000, un V2 2000, un V10
 * 10 000 — et un grimpeur situe un cran au-dessus d'un bloc l'envoie neuf fois
 * sur dix. Les grimpeurs sont tires dans une normale centree sur 5000 (V5) avec
 * un ecart-type de 1000 (un cran).
 *
 * Choix de modelisation, et pourquoi ils comptent pour la suite du calcul :
 *
 *  - **Une seule salle.** Tous les grimpeurs affrontent le meme mur, donc toutes
 *    les cotes sont reliees entre elles. C'est le cas le plus favorable au
 *    classement : il n'y a pas d'echelles separees a raccorder.
 *  - **Autant de blocs par cran, de V1 a V10.** C'est un choix d'ouverture, pas
 *    une consequence : une salle reelle ouvre surtout du facile. La contrepartie
 *    apparait dans les resultats — les blocs les plus durs sortent du champ de
 *    la communaute et ne peuvent etre que bornes, pas mesures.
 *  - **Les ouvertures tournent** : 50 blocs neufs par mois, chacun en place une
 *    dizaine de semaines. Un bloc recent a donc peu de duels.
 *  - **Les grimpeurs ont une tenacite variable** : chacun consacre un nombre
 *    limite de seances a un projet avant de l'abandonner. C'est ce qui produit
 *    les defaites, seule information vraiment discriminante du modele.
 */
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(RACINE, 'data')

// --- Reglages ---------------------------------------------------------------
const GYM = 'Rose Bloc Vieux-Longueuil'
const N_GRIMPEURS = 55
const BLOCS_PAR_MOIS = 50
/** Duree de vie d'un bloc : fixe le nombre de blocs simultanement au mur. */
const SEMAINES_EN_PLACE = 10
const SEANCES_PAR_SEMAINE = 1.7
const JOUR = 86400000
const MOIS = 30 * JOUR
const DEBUT = Date.UTC(2026, 3, 1)
const FIN = Date.UTC(2026, 7, 31)

// --- L'echelle --------------------------------------------------------------
/** Cotations ouvertes par la salle : autant de blocs de chacune. */
const V_MIN = 1
const V_MAX = 10
/** Un cran V = 1000 points = dix chances contre une. */
const PTS_PAR_V = 1000
const ECHELLE_REELLE = 1000
/** Niveau des grimpeurs : normale centree sur V5, un cran d'ecart-type. */
const NIVEAU_MOYEN = 5000
const NIVEAU_ECART_TYPE = 1000

const COTATIONS = Array.from({ length: 13 }, (_, i) => `V${i}`)
const idxVersRating = (idx) => idx * PTS_PAR_V

// --- RNG deterministe -------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260903)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const gauss = (mu, sigma) => {
  const u = Math.max(rnd(), 1e-9)
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// --- Vocabulaire ------------------------------------------------------------
const PRENOMS_F = ['Camille', 'Lea', 'Maude', 'Chloe', 'Elise', 'Sarah', 'Julie', 'Alice', 'Noemie', 'Ines', 'Clara', 'Maya', 'Anouk', 'Lucie', 'Emma', 'Zoe', 'Rosalie', 'Florence', 'Justine', 'Marianne']
const PRENOMS_M = ['Thomas', 'Antoine', 'Hugo', 'Nicolas', 'Julien', 'Maxime', 'Felix', 'Olivier', 'Samuel', 'Lucas', 'Simon', 'Etienne', 'Gabriel', 'Victor', 'Adrien', 'Xavier', 'Mathis', 'Raphael']
const NOMS = ['Bergeron', 'Tremblay', 'Gagnon', 'Roy', 'Cote', 'Bouchard', 'Fortin', 'Pelletier', 'Levesque', 'Lavoie', 'Ouellet', 'Belanger', 'Girard', 'Morin', 'Caron', 'Beaulieu', 'Cloutier', 'Dube', 'Poirier', 'Thibault', 'Nadeau', 'Boucher', 'Simard', 'Lemieux', 'Paquette', 'Desjardins']

const SECTEURS = ['Cave', 'Dalle', 'Devers', 'Competition', 'Traverse', 'Arete', 'Prow', 'Toit']

/**
 * En salle, la couleur des prises suit en general une plage de cotation, avec
 * des debordements. La couleur n'entre dans aucun calcul, c'est de la metadonnee.
 */
const PLAGES_COULEUR = [
  { couleur: 'Jaune', min: 1, max: 2 },
  { couleur: 'Vert', min: 3, max: 4 },
  { couleur: 'Bleu', min: 5, max: 6 },
  { couleur: 'Rouge', min: 7, max: 8 },
  { couleur: 'Noir', min: 9, max: 10 },
]
function couleurPour(idx) {
  if (rnd() < 0.1) return pick(PLAGES_COULEUR).couleur // erreur d'etiquetage assumee
  return (PLAGES_COULEUR.find((p) => idx >= p.min && idx <= p.max) ?? PLAGES_COULEUR[0]).couleur
}

const csv = (entetes, lignes) =>
  [
    entetes.join(','),
    ...lignes.map((l) =>
      l
        .map((champ) => {
          const s = String(champ)
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
        })
        .join(',')
    ),
  ].join('\n') + '\n'

const iso = (t) => new Date(t).toISOString().slice(0, 10)

// --- Grimpeurs --------------------------------------------------------------
const grimpeurs = []
const nomsUtilises = new Set()
const dureeAnnees = (FIN - DEBUT) / (365.25 * JOUR)

for (let i = 0; i < N_GRIMPEURS; i++) {
  const sexe = rnd() < 0.47 ? 'F' : 'M'
  let nom
  do {
    nom = pick(sexe === 'F' ? PRENOMS_F : PRENOMS_M) + ' ' + pick(NOMS)
  } while (nomsUtilises.has(nom))
  nomsUtilises.add(nom)

  // La distribution demandee — N(5000, 1000) — porte sur le niveau *atteint*,
  // celui que les cotes estiment. On en deduit le niveau de depart en retirant
  // la progression de la periode.
  const progression = Math.max(0, gauss(400, 350)) // points gagnes par an
  const niveauFinal = gauss(NIVEAU_MOYEN, NIVEAU_ECART_TYPE)

  // Niveau annonce a l'inscription : les gens se jugent a un cran pres, et
  // un sur quatre ne repond pas.
  const niveau0 = niveauFinal - progression * dureeAnnees
  const declare =
    rnd() < 0.25 ? '' : 'V' + clamp(Math.round(niveau0 / PTS_PAR_V + gauss(0, 0.7)), 0, 12)

  grimpeurs.push({
    id: 'g' + String(i + 1).padStart(3, '0'),
    nom,
    sexe,
    gym_principal: GYM,
    premiere_saison: 2018 + Math.floor(rnd() * 8),
    niveau_declare: declare,
    // Champs caches : la verite terrain que les formules doivent estimer.
    _niveauFinal: niveauFinal,
    _niveau0: niveau0,
    _progression: progression,
    _assiduite: clamp(gauss(1, 0.4), 0.3, 2.2),
    _tenacite: clamp(gauss(3, 1.4), 1, 8),
  })
}

// --- Blocs ------------------------------------------------------------------
/**
 * Une ouverture par mois. La cotation *affichee* est tiree uniformement de V1 a
 * V10 : c'est la consigne d'ouverture. La difficulte *reelle* s'en ecarte, parce
 * qu'un ouvreur se trompe — c'est precisement ce que le classement doit
 * retrouver.
 */
const blocs = []
let compteur = 0
const premiereOuverture = DEBUT - SEMAINES_EN_PLACE * 7 * JOUR
for (let t = premiereOuverture; t < FIN; t += MOIS) {
  for (let i = 0; i < BLOCS_PAR_MOIS; i++) {
    const secteur = SECTEURS[i % SECTEURS.length]
    const idxAffiche = V_MIN + ((compteur + Math.floor(rnd() * 3)) % (V_MAX - V_MIN + 1))

    // Erreur de l'ouvreur : juste la plupart du temps, un cran a cote souvent,
    // deux crans rarement. Plus un bruit continu a l'interieur du cran.
    let biais = 0
    if (rnd() < 0.3) biais += rnd() < 0.5 ? -1 : 1
    if (rnd() < 0.06) biais += rnd() < 0.5 ? -1 : 1
    const vraiIdx = clamp(idxAffiche + biais + gauss(0, 0.22), 0, 12)

    const duree = (SEMAINES_EN_PLACE * 7 + Math.floor(rnd() * 21) - 10) * JOUR
    compteur += 1
    blocs.push({
      id: 'b' + String(compteur).padStart(4, '0'),
      nom: `${secteur.slice(0, 2).toUpperCase()}-${String(compteur).padStart(4, '0')}`,
      gym: GYM,
      secteur,
      couleur: couleurPour(idxAffiche),
      cotation_officielle: COTATIONS[idxAffiche],
      date_ouverture: iso(Math.max(t, premiereOuverture)),
      date_retrait: iso(t + duree),
      _t0: t,
      _t1: t + duree,
      _vraiRating: idxVersRating(vraiIdx),
    })
  }
}

// --- Seances et ascensions --------------------------------------------------
const ascensions = []
/** `${grimpeur}|${bloc}` -> { envoye, seances } */
const suivi = new Map()

for (const g of grimpeurs) {
  const semaines = (FIN - DEBUT) / (7 * JOUR)
  const nbSeances = Math.round(clamp(semaines * SEANCES_PAR_SEMAINE * g._assiduite, 8, 250))

  for (let s = 0; s < nbSeances; s++) {
    const t = DEBUT + rnd() * (FIN - DEBUT)
    const annees = (t - DEBUT) / (365.25 * JOUR)
    const niveau = g._niveau0 + g._progression * annees

    const dispo = blocs.filter((b) => t >= b._t0 && t < b._t1)
    if (dispo.length < 6) continue

    const etat = (b) => suivi.get(g.id + '|' + b.id) ?? { envoye: false, seances: 0 }

    // Echauffement : un ou deux blocs deja envoyes. Ces lignes existent dans les
    // donnees ; c'est le repliement en duels qui les absorbe.
    const dejaFaits = dispo.filter((b) => etat(b).envoye)
    const nbEchauffement = dejaFaits.length ? Math.floor(rnd() * 3) : 0
    let rang = 0
    for (let k = 0; k < nbEchauffement; k++) {
      const b = pick(dejaFaits)
      ascensions.push({
        date: iso(t + rang++ * 60000),
        grimpeur_id: g.id,
        bloc_id: b.id,
        resultat: 'reussite',
        essais: 1,
      })
    }

    const projets = dispo.filter((b) => {
      const e = etat(b)
      return !e.envoye && e.seances > 0 && e.seances < g._tenacite
    })
    const neufs = dispo.filter((b) => etat(b).seances === 0)

    const nbBlocs = 6 + Math.floor(rnd() * 5)
    const vus = new Set()

    for (let k = 0; k < nbBlocs; k++) {
      // On reprend un projet en cours, ou on decouvre. La cible est proche du
      // niveau du jour, avec de l'ambition : sans elle, personne ne toucherait
      // jamais aux blocs durs et ils resteraient invisibles au classement.
      const source = projets.length && rnd() < 0.45 ? projets : neufs.length ? neufs : dispo
      const ambition = rnd() < 0.15 ? gauss(1800, 900) : 0
      const cible = niveau + gauss(150, 900) + ambition
      let b = null
      let meilleur = Infinity
      for (const c of source) {
        if (vus.has(c.id)) continue
        const d = Math.abs(c._vraiRating - cible) * (0.7 + rnd() * 0.6)
        if (d < meilleur) {
          meilleur = d
          b = c
        }
      }
      if (!b) break
      vus.add(b.id)

      const cle = g.id + '|' + b.id
      const e = etat(b)
      // Chaque seance sur un projet ameliore un peu les chances : on apprend les
      // mouvements. Plafonne a un demi-cran.
      const bonus = Math.min(500, e.seances * 200)
      const marge = niveau - b._vraiRating + bonus
      const pReussite = 1 / (1 + Math.pow(10, -marge / ECHELLE_REELLE))
      const reussi = rnd() < pReussite

      // Le nombre d'essais suit la marge : un bloc largement dans les cordes
      // tombe au premier essai, un bloc a la limite en demande une dizaine.
      // Il ne decide jamais de l'issue, mais il porte de l'information sur le
      // rapport de force — c'est ce que la ponderation du style exploite.
      const aisance = 1 / (1 + Math.pow(10, -marge / 700))
      const essaisMoyen = 1 + 11 * (1 - aisance)
      const essais = Math.max(1, Math.round(essaisMoyen * (0.5 + rnd())))

      ascensions.push({
        date: iso(t + rang++ * 60000),
        grimpeur_id: g.id,
        bloc_id: b.id,
        resultat: reussi ? 'reussite' : 'echec',
        essais,
      })
      suivi.set(cle, { envoye: e.envoye || reussi, seances: e.seances + 1 })
    }
  }
}
ascensions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

// On ne livre que les blocs reellement grimpes : un bloc sans aucune ligne
// n'apprend rien et gonfle les fichiers pour rien.
const blocsVus = new Set(ascensions.map((a) => a.bloc_id))
const blocsLivres = blocs.filter((b) => blocsVus.has(b.id))

// --- Ecriture ---------------------------------------------------------------
try {
  rmSync(join(OUT, 'voies.csv'))
} catch {
  /* fichier d'un ancien modele : rien a faire s'il n'existe pas */
}

writeFileSync(
  join(OUT, 'grimpeurs.csv'),
  csv(
    ['id', 'nom', 'sexe', 'gym_principal', 'premiere_saison', 'niveau_declare'],
    grimpeurs.map((g) => [g.id, g.nom, g.sexe, g.gym_principal, g.premiere_saison, g.niveau_declare])
  )
)
writeFileSync(
  join(OUT, 'blocs.csv'),
  csv(
    ['id', 'nom', 'gym', 'secteur', 'couleur', 'cotation_officielle', 'date_ouverture', 'date_retrait'],
    blocsLivres.map((b) => [b.id, b.nom, b.gym, b.secteur, b.couleur, b.cotation_officielle, b.date_ouverture, b.date_retrait])
  )
)
writeFileSync(
  join(OUT, 'ascensions.csv'),
  csv(
    ['date', 'grimpeur_id', 'bloc_id', 'resultat', 'essais'],
    ascensions.map((a) => [a.date, a.grimpeur_id, a.bloc_id, a.resultat, a.essais])
  )
)

writeFileSync(
  join(RACINE, 'scripts', 'verite.json'),
  JSON.stringify(
    {
      _lisezmoi: 'Genere par generate-data.mjs. Reserve aux tests : ne pas exposer dans data/.',
      ptsParCranReel: PTS_PAR_V,
      echelleReelle: ECHELLE_REELLE,
      ratingBase: 0,
      blocs: Object.fromEntries(blocsLivres.map((b) => [b.id, Math.round(b._vraiRating)])),
      grimpeurs: Object.fromEntries(grimpeurs.map((g) => [g.id, Math.round(g._niveauFinal)])),
    },
    null,
    2
  ) + '\n'
)

// --- Rapport ----------------------------------------------------------------
const duels = new Map()
for (const a of ascensions) {
  const cle = a.grimpeur_id + '|' + a.bloc_id
  const d = duels.get(cle) ?? { gagne: false, bloc: a.bloc_id }
  if (a.resultat === 'reussite') d.gagne = true
  duels.set(cle, d)
}
const parBloc = new Map()
for (const d of duels.values()) parBloc.set(d.bloc, (parBloc.get(d.bloc) ?? 0) + 1)
const compte = [...parBloc.values()].sort((x, y) => x - y)
const gagnes = [...duels.values()].filter((d) => d.gagne).length

const parCran = new Map()
for (const b of blocsLivres) {
  const c = b.cotation_officielle
  const e = parCran.get(c) ?? { total: 0, duels: 0 }
  e.total += 1
  e.duels += parBloc.get(b.id) ?? 0
  parCran.set(c, e)
}

console.log(
  `${grimpeurs.length} grimpeurs (niveau moyen ${Math.round(
    grimpeurs.reduce((s, g) => s + g._niveauFinal, 0) / grimpeurs.length
  )}), ${blocsLivres.length} blocs, ${ascensions.length} lignes\n` +
    `-> ${duels.size} duels (${Math.round((100 * gagnes) / duels.size)} % gagnes, ${duels.size - gagnes} perdus)\n` +
    `-> duels par bloc : mediane ${compte[Math.floor(compte.length / 2)]}\n` +
    `-> repartition :\n` +
    [...parCran]
      .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
      .map(([c, e]) => `     ${c.padEnd(3)} ${String(e.total).padStart(3)} blocs, ${String(Math.round(e.duels / e.total)).padStart(3)} duels/bloc`)
      .join('\n')
)
