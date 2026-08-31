import { describe, expect, it } from 'vitest'
import verite from '../../scripts/verite.json'
import { cotationDIndex } from './cotations'
import { FORMULES } from './formulas/registry'
import { paramsParDefaut } from './formulas/types'
import { construireDataset } from './loaders/dataset'
import { SEUIL_DESACCORD, executer, type LigneBloc } from './pipeline'
import { chargerToutesLesSources } from './sources'
import type { Bloc, Dataset } from './types'

/**
 * Les desaccords signales sont-ils reels, ou l'estimation les fabrique-t-elle ?
 *
 * La question se pose serieusement : les blocs demarrent a la cotation de
 * l'ouvreur, l'estimation est bruitee, et un bruit suffit a faire franchir un
 * seuil. Ce fichier y repond par une experience temoin plutot que par un
 * raisonnement — c'est le seul endroit, avec `recuperation.test.ts`, qui a acces
 * a la verite terrain.
 *
 * Le principe : rejouer tout le pipeline sur un monde ou **l'ouvreur ne se
 * trompe jamais**, l'etiquette de chaque bloc etant sa vraie difficulte. Tout
 * desaccord qui subsiste la-bas est du bruit pur, et sa frequence donne
 * directement le taux de faux positifs.
 *
 * C'est ce protocole qui a servi a choisir `SEUIL_DESACCORD`. Mesure sur ce jeu
 * de donnees, formule Elo :
 *
 *   seuil 0,50 : 67 signales, precision  79 %, faux positifs 6,5 %
 *   seuil 0,75 : 43 signales, precision 100 %, faux positifs 1,2 %  <- retenu
 *   seuil 1,00 : 22 signales, precision 100 %, faux positifs 0,0 %
 *
 * Comparer deux formules a seuil egal n'a pas de sens : chacune se place ou
 * elle veut sur cette courbe. A taux de faux positifs comparable, Glicko (seuil
 * 1,25 : 2,8 %) et l'Elo (seuil 0,75 : 1,2 %) trouvent autant de blocs
 * sous-cotes — 38 % contre 34 % — mais l'Elo est plus precis, 100 % contre 84 %.
 */

const vraiIndex = (id: string) => (verite.blocs as Record<string, number>)[id] / verite.ptsParCranReel
/** L'ouvreur est defendable tant qu'il reste a moins d'un demi-cran du vrai. */
const SEUIL_MAL_COTE = 0.5

let cache: Dataset | null = null
async function dataset(): Promise<Dataset> {
  if (!cache) cache = construireDataset(await chargerToutesLesSources())
  return cache
}

/** Le meme mur, les memes resultats, mais des etiquettes toujours justes. */
function datasetTemoin(ds: Dataset): Dataset {
  const blocs: Bloc[] = ds.blocs.map((b) => {
    const idx = Math.round(vraiIndex(b.id))
    return { ...b, indexOfficiel: idx, cotationOfficielle: cotationDIndex(idx) }
  })
  return { ...ds, blocs, blocParId: new Map(blocs.map((b) => [b.id, b])) }
}

async function juger(temoin: boolean): Promise<LigneBloc[]> {
  const ds = await dataset()
  const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
  const r = executer(temoin ? datasetTemoin(ds) : ds, elo, paramsParDefaut(elo.params), {})
  return r.blocs.filter((b) => b.fiable)
}

const signale = (b: LigneBloc) => Math.abs(b.ecart) >= SEUIL_DESACCORD
const malCote = (b: LigneBloc) => Math.abs(vraiIndex(b.id) - b.indexOfficiel) >= SEUIL_MAL_COTE

describe('les desaccords ne sont pas du bruit', () => {
  it(
    "n'en signale aucun quand l'ouvreur ne se trompe jamais",
    async () => {
      const juges = await juger(true)
      expect(juges.length).toBeGreaterThan(200)
      // C'est le resultat central. Il vaut 2,7 % avec les reglages livres —
      // six blocs sur 226 — contre 0 % avec un seuil d'un cran et sans ecart
      // neglige. C'est le prix assume de deux choix qui, en echange, font
      // passer la detection des blocs sous-cotes de 13 % a 57 %. Si ce taux
      // derivait nettement au-dessus, c'est que le calcul se serait mis a
      // fabriquer des desaccords a partir de rien.
      const faux = juges.filter(signale)
      expect(faux.length / juges.length).toBeLessThan(0.05)
    },
    120_000
  )

  it(
    'ne signale que des blocs reellement mal cotes',
    async () => {
      const juges = await juger(false)
      const signales = juges.filter(signale)
      expect(signales.length).toBeGreaterThan(5)
      const justes = signales.filter(malCote)
      // Precision : la part des alertes qui portent sur une vraie erreur.
      expect(justes.length / signales.length).toBeGreaterThan(0.9)
    },
    120_000
  )

  it(
    'se trompe rarement de sens',
    async () => {
      const juges = await juger(false)
      const signales = juges.filter(signale)
      const bonSens = signales.filter(
        (b) => Math.sign(vraiIndex(b.id) - b.indexOfficiel) === Math.sign(b.ecart)
      )
      // Le hasard en donnerait la moitie.
      expect(bonSens.length / signales.length).toBeGreaterThan(0.9)
    },
    120_000
  )

  it(
    "mesure l'erreur de l'ouvreur a la bonne echelle",
    async () => {
      const juges = await juger(false)
      const paires = juges.map((b) => [b.ecart, vraiIndex(b.id) - b.indexOfficiel] as const)
      const n = paires.length
      const mx = paires.reduce((s, p) => s + p[0], 0) / n
      const my = paires.reduce((s, p) => s + p[1], 0) / n
      let sxy = 0
      let sxx = 0
      let syy = 0
      for (const [x, y] of paires) {
        sxy += (x - mx) * (y - my)
        sxx += (x - mx) ** 2
        syy += (y - my) ** 2
      }
      expect(sxy / Math.sqrt(sxx * syy)).toBeGreaterThan(0.6)
      // Une pente proche de 1 : l'ecart affiche n'est ni tasse ni exagere.
      expect(sxy / sxx).toBeGreaterThan(0.8)
      expect(sxy / sxx).toBeLessThan(1.25)
    },
    120_000
  )

  it(
    'signale davantage la ou les donnees abondent, pas la ou elles manquent',
    async () => {
      const juges = await juger(false)
      const maigres = juges.filter((b) => b.matchs < 20)
      const fournis = juges.filter((b) => b.matchs >= 40)
      expect(maigres.length).toBeGreaterThan(20)
      expect(fournis.length).toBeGreaterThan(20)
      const tauxMaigres = maigres.filter(signale).length / maigres.length
      const tauxFournis = fournis.filter(signale).length / fournis.length
      // Un artefact de bruit ferait l'inverse : il se concentrerait sur les
      // blocs peu repetes, ou l'estimation est la plus incertaine.
      expect(tauxFournis).toBeGreaterThan(tauxMaigres)
    },
    120_000
  )

  it(
    'ecarter les resultats joues d avance rattrape des blocs sous-cotes',
    async () => {
      const ds = await dataset()
      const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
      const detection = (ecartNeglige: number) => {
        const r = executer(ds, elo, { ...paramsParDefaut(elo.params), ecartNeglige }, {})
        const juges = r.blocs.filter((b) => b.fiable)
        // Blocs reellement plus durs que leur etiquette : les sandbags.
        const durs = juges.filter((b) => vraiIndex(b.id) - b.indexOfficiel >= 1)
        return durs.filter(signale).length / durs.length
      }
      // Un bloc plus dur que son etiquette ne recoit que des echecs, dont la
      // plupart etaient acquis d'avance : les ecarter debloque son estimation.
      expect(detection(2000)).toBeGreaterThan(detection(0) * 1.4)
    },
    120_000
  )

  it(
    'ecarter les resultats joues d avance profite aussi a Glicko',
    async () => {
      const ds = await dataset()
      const gli = FORMULES.find((f) => f.id === 'glicko')!
      const faussesAlertes = (ecartNeglige: number) => {
        const t = executer(datasetTemoin(ds), gli, { ...paramsParDefaut(gli.params), ecartNeglige }, {})
        const juges = t.blocs.filter((b) => b.fiable)
        return juges.filter(signale).length / juges.length
      }
      // Glicko poussait chaque bloc a son point fixe, y compris quand ce point
      // etait a l'infini faute de contre-exemple. Ecarter les resultats joues
      // d'avance retire la separation elle-meme, et son bavardage avec.
      expect(faussesAlertes(2000)).toBeLessThan(faussesAlertes(0) / 3)
    },
    120_000
  )

  it(
    'reste conservateur : il passe a cote de beaucoup de vraies erreurs',
    async () => {
      const juges = await juger(false)
      const vraiment = juges.filter(malCote)
      const rappel = vraiment.filter(signale).length / vraiment.length
      // Documente la contrepartie de la precision : l'amorce partant de
      // l'ouvreur laisse passer la majorite des erreurs. Le site montre les
      // fautes certaines, pas toutes les fautes.
      expect(rappel).toBeLessThan(0.6)
    },
    120_000
  )
})
