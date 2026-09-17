import { describe, expect, it } from 'vitest'
import { calibrer } from './calibrage'
import { cotationDIndex, ecartEnCrans, formaterIndex, indexDeCotation } from './cotations'
import {
  ECHELLE_REFERENCE,
  amorceBloc,
  amorcesGrimpeurs,
  construireDuels,
  construireEvenements,
  cote,
  esperance,
  kEffectif,
  moteurElo,
} from './formulas/lib'
import { FORMULES } from './formulas/registry'
import { normaliserParams, paramsParDefaut } from './formulas/types'
import { STYLES_BLOC } from './stylesBloc'
import { construireDataset } from './loaders/dataset'
import { executer } from './pipeline'
import { chargerToutesLesSources } from './sources'
import type { Ascension, Bloc, Dataset, Grimpeur } from './types'

let cache: Dataset | null = null
async function dataset(): Promise<Dataset> {
  if (!cache) cache = construireDataset(await chargerToutesLesSources())
  return cache
}

/** Un grimpeur, un bloc : le decor minimal pour eprouver le moteur. */
function datasetMinimal(o: { niveauDeclare?: number | null; indexBloc?: number } = {}): Dataset {
  const grimpeur: Grimpeur = {
    id: 'g1',
    nom: 'Grimpeur',
    sexe: 'X',
    gymPrincipal: 'Salle',
    premiereSaison: 2024,
    niveauDeclare: o.niveauDeclare === undefined ? null : o.niveauDeclare,
  }
  const bloc: Bloc = {
    id: 'b1',
    nom: 'Bloc',
    gym: 'Salle',
    secteur: 'Cave',
    couleur: 'Bleu',
    cotationOfficielle: `V${o.indexBloc ?? 5}`,
    indexOfficiel: o.indexBloc ?? 5,
    dateOuverture: '2026-01-01',
    dateRetrait: null,
  }
  return {
    grimpeurs: [grimpeur],
    blocs: [bloc],
    ascensions: [],
    grimpeurParId: new Map([['g1', grimpeur]]),
    blocParId: new Map([['b1', bloc]]),
    fichiers: [],
    rapport: { anomalies: [], lignesLues: {}, lignesRetenues: {} },
  }
}

describe('cotations', () => {
  it('fait l aller-retour cotation <-> index', () => {
    expect(indexDeCotation('V5')).toBe(5)
    expect(indexDeCotation('v5')).toBe(5)
    expect(cotationDIndex(5)).toBe('V5')
    expect(indexDeCotation('V99')).toBeNull()
    expect(indexDeCotation('6b+')).toBeNull()
  })

  it('accepte le numero nu que produisent les exports de salle', () => {
    expect(indexDeCotation('4')).toBe(4)
    expect(indexDeCotation(' 0 ')).toBe(0)
  })

  it('affiche la fraction plutot que de la masquer', () => {
    expect(formaterIndex(5)).toBe('V5')
    expect(formaterIndex(5.4)).toBe('V5 (+0,4)')
    expect(formaterIndex(4.7)).toBe('V5 (−0,3)')
  })

  it('compte les crans dans le bon sens', () => {
    expect(ecartEnCrans('V7', 'V6')).toBe(1)
    expect(ecartEnCrans('V3', 'V5')).toBe(-2)
  })
})

// --- L'echelle ---------------------------------------------------------------

describe('echelle des cotes', () => {
  it('place dix chances contre une a 1000 points d ecart', () => {
    expect(ECHELLE_REFERENCE).toBe(1000)
    expect(cote(2500, 1500, ECHELLE_REFERENCE)).toBeCloseTo(10, 9)
    // Dix fois plus de chances de reussir que d'echouer, c'est 10/11.
    expect(esperance(2500, 1500, ECHELLE_REFERENCE)).toBeCloseTo(10 / 11, 9)
    // Et symetriquement, le bloc l'emporte une fois sur onze.
    expect(esperance(1500, 2500, ECHELLE_REFERENCE)).toBeCloseTo(1 / 11, 9)
  })

  it('donne 50 % a niveau egal, et reste symetrique', () => {
    expect(esperance(1500, 1500, ECHELLE_REFERENCE)).toBeCloseTo(0.5)
    expect(esperance(2000, 1500, ECHELLE_REFERENCE) + esperance(1500, 2000, ECHELLE_REFERENCE)).toBeCloseTo(1)
  })

  it('doublement de l ecart = cote au carre', () => {
    expect(cote(3500, 1500, ECHELLE_REFERENCE)).toBeCloseTo(100, 6)
  })

  it('fait decroitre K avec l experience, sans passer sous le plancher', () => {
    expect(kEffectif(200, 30, 150, 0)).toBe(200)
    expect(kEffectif(200, 30, 150, 150)).toBeCloseTo(100)
    expect(kEffectif(200, 30, 150, 10_000)).toBe(30)
  })

  it('fait demarrer un V1 a 1000, un V2 a 2000, et ainsi de suite', () => {
    for (let v = 0; v <= 10; v++) {
      expect(amorceBloc(v, 5000, 1000, 'cotation')).toBe(v * 1000)
    }
    // En mode uniforme, la cotation de l'ouvreur n'entre pas dans le calcul.
    expect(amorceBloc(7, 5000, 1000, 'uniforme')).toBe(5000)
  })

  it('un cran V vaut dix chances contre une', () => {
    // Consequence directe de "1 cran = 1000 points" et "1000 points = 10 contre 1".
    const bloc = amorceBloc(5, 5000, 1000, 'cotation')
    const grimpeurUnCranAuDessus = amorceBloc(6, 5000, 1000, 'cotation')
    expect(cote(grimpeurUnCranAuDessus, bloc, ECHELLE_REFERENCE)).toBeCloseTo(10, 9)
  })
})

// --- Un affrontement par couple ----------------------------------------------

function ligne(jour: number, grimpeurId: string, blocId: string, resultat: 'reussite' | 'echec', essais = 1): Ascension {
  return {
    date: `2026-01-${String(jour).padStart(2, '0')}`,
    t: Date.UTC(2026, 0, jour),
    grimpeurId,
    blocId,
    resultat,
    essais,
  }
}

describe('un affrontement par couple grimpeur-bloc', () => {
  const historique = [
    ligne(1, 'g1', 'b1', 'echec', 5),
    ligne(2, 'g1', 'b1', 'echec', 4),
    ligne(3, 'g1', 'b1', 'reussite', 2), // g1 finit par l'envoyer : il gagne
    ligne(4, 'g1', 'b1', 'reussite', 1), // echauffement : ne rejoue rien
    ligne(5, 'g1', 'b1', 'echec', 3), // le duel est clos, meme apres un echec
    ligne(6, 'g2', 'b1', 'echec', 9), // g2 n'y arrivera pas : il perd
    ligne(7, 'g2', 'b1', 'echec', 6),
    ligne(8, 'g1', 'b2', 'reussite', 1), // flash
  ]

  it('replie tout l historique d un couple en une seule partie', () => {
    const { duels } = construireDuels(historique)
    expect(duels).toHaveLength(3)
    expect(duels.map((d) => `${d.grimpeurId}-${d.blocId}:${d.gagne ? 'gagne' : 'perdu'}`)).toEqual([
      'g1-b1:gagne',
      'g2-b1:perdu',
      'g1-b2:gagne',
    ])
  })

  it('donne la victoire des lors que le bloc a fini par tomber', () => {
    const { duels } = construireDuels(historique)
    const g1b1 = duels.find((d) => d.grimpeurId === 'g1' && d.blocId === 'b1')!
    expect(g1b1.gagne).toBe(true)
    // Essais cumules jusqu'a l'envoi : 5 + 4 + 2. Ce qui vient apres ne compte pas.
    expect(g1b1.essais).toBe(11)
    expect(g1b1.seances).toBe(3)
    // Le duel est date du jour de l'envoi.
    expect(g1b1.t).toBe(Date.UTC(2026, 0, 3))
  })

  it('donne la defaite quand le bloc n a jamais ete envoye', () => {
    const { duels } = construireDuels(historique)
    const g2b1 = duels.find((d) => d.grimpeurId === 'g2')!
    expect(g2b1.gagne).toBe(false)
    expect(g2b1.essais).toBe(15)
    // Date de la derniere tentative : c'est la que l'issue est connue.
    expect(g2b1.t).toBe(Date.UTC(2026, 0, 7))
  })

  it('reconnait un flash', () => {
    const { duels } = construireDuels(historique)
    const flash = duels.find((d) => d.blocId === 'b2')!
    expect(flash.gagne).toBe(true)
    expect(flash.essais).toBe(1)
    expect(flash.seances).toBe(1)
  })

  it('rend les duels tries chronologiquement', () => {
    const { duels } = construireDuels(historique)
    for (let i = 1; i < duels.length; i++) expect(duels[i].t).toBeGreaterThanOrEqual(duels[i - 1].t)
  })

  it('replie reellement les donnees livrees', async () => {
    const ds = await dataset()
    const a = construireDuels(ds.ascensions)
    expect(a.lignes).toBe(ds.ascensions.length)
    expect(a.duels.length).toBeLessThan(ds.ascensions.length)
    // Un duel par couple distinct, ni plus ni moins.
    const couples = new Set(ds.ascensions.map((x) => x.grimpeurId + '|' + x.blocId))
    expect(a.duels.length).toBe(couples.size)
  })
})

// --- Le moment ou les cotes bougent -----------------------------------------

describe('defaite provisoire et remboursement', () => {
  const projet = [
    ligne(1, 'g1', 'b1', 'echec', 4),
    ligne(2, 'g1', 'b1', 'echec', 6),
    ligne(9, 'g1', 'b1', 'reussite', 3),
  ]

  it('retient la date du premier echec et celle de l envoi', () => {
    const { duels } = construireDuels(projet)
    const d = duels[0]
    expect(d.tPremierEchec).toBe(Date.UTC(2026, 0, 1))
    expect(d.tEnvoi).toBe(Date.UTC(2026, 0, 9))
    expect(d.gagne).toBe(true)
  })

  it('joue la defaite des le premier echec, puis la victoire a l envoi', () => {
    const evenements = construireEvenements(construireDuels(projet).duels)
    expect(evenements.map((e) => e.type)).toEqual(['defaite', 'victoire'])
    expect(evenements[0].t).toBe(Date.UTC(2026, 0, 1))
    expect(evenements[1].t).toBe(Date.UTC(2026, 0, 9))
    // Seul le premier evenement compte l'effectif ; le second rembourse.
    expect(evenements[0].premier).toBe(true)
    expect(evenements[1].premier).toBe(false)
    expect(evenements[1].annuleDefaite).toBe(true)
  })

  it('ne joue qu une victoire quand le bloc tombe du premier coup', () => {
    const evenements = construireEvenements(construireDuels([ligne(1, 'g1', 'b1', 'reussite')]).duels)
    expect(evenements.map((e) => e.type)).toEqual(['victoire'])
    expect(evenements[0].annuleDefaite).toBe(false)
  })

  it('ne joue qu une defaite, datee du premier echec, quand le bloc resiste', () => {
    const evenements = construireEvenements(
      construireDuels([ligne(3, 'g1', 'b1', 'echec'), ligne(8, 'g1', 'b1', 'echec')]).duels
    )
    expect(evenements.map((e) => e.type)).toEqual(['defaite'])
    // Le classement n'attend pas la derniere tentative pour trancher.
    expect(evenements[0].t).toBe(Date.UTC(2026, 0, 3))
  })

  it('rend exactement les points de la defaite', () => {
    // A K constant, un projet echoue puis envoye doit laisser les memes cotes
    // qu'un envoi direct : la defaite provisoire a ete integralement remboursee.
    const options = {
      // Le test isole le remboursement : on ne veut ni ecartement de duels
      // attendus, ni decroissance de K, qui brouilleraient l'egalite exacte.
      ecartNeglige: 0,
      ratingInitial: 5000,
      k: 30,
      kMin: 30,
      kDemiVie: 0,
      echelle: ECHELLE_REFERENCE,
      passes: 1,
      amorce: 'cotation',
      ptsParCran: 1000,
      score: () => 0.8,
    }
    const apres = (lignes: Ascension[]) => {
      const ds = datasetMinimal()
      const duels = construireDuels(lignes).duels
      const sortie = moteurElo(ds, {
        ...options,
        duels,
        amorcesGrimpeurs: new Map([['g1', 5000]]),
      })
      return {
        grimpeur: sortie.grimpeurs.get('g1')!.rating,
        bloc: sortie.blocs.get('b1')!.rating,
      }
    }

    const avecProjet = apres(projet)
    const directement = apres([ligne(9, 'g1', 'b1', 'reussite', 3)])
    expect(avecProjet.grimpeur).toBeCloseTo(directement.grimpeur, 9)
    expect(avecProjet.bloc).toBeCloseTo(directement.bloc, 9)
  })

  it('compte le duel une seule fois malgre ses deux evenements', () => {
    const ds = datasetMinimal()
    const sortie = moteurElo(ds, {
      duels: construireDuels(projet).duels,
      amorcesGrimpeurs: new Map([['g1', 5000]]),
      ecartNeglige: 0,
      ratingInitial: 5000,
      k: 30,
      kMin: 8,
      kDemiVie: 200,
      echelle: ECHELLE_REFERENCE,
      passes: 1,
      amorce: 'cotation',
      ptsParCran: 1000,
      score: () => 0.8,
    })
    expect(sortie.grimpeurs.get('g1')!.matchs).toBe(1)
    expect(sortie.grimpeurs.get('g1')!.reussites).toBe(1)
    expect(sortie.blocs.get('b1')!.matchs).toBe(1)
  })
})

describe('resultats joues d avance', () => {
  const options = {
    ratingInitial: 5000,
    k: 30,
    kMin: 30,
    kDemiVie: 0,
    echelle: ECHELLE_REFERENCE,
    passes: 1,
    amorce: 'cotation' as const,
    ptsParCran: 1000,
    score: () => 1,
  }

  /** Un grimpeur cote `niveau` affronte un bloc V5, et gagne ou perd. */
  const jouer = (niveau: number, resultat: 'reussite' | 'echec', ecartNeglige: number) => {
    const ds = datasetMinimal({ indexBloc: 5 })
    const sortie = moteurElo(ds, {
      ...options,
      ecartNeglige,
      duels: construireDuels([ligne(1, 'g1', 'b1', resultat)]).duels,
      amorcesGrimpeurs: new Map([['g1', niveau]]),
    })
    return {
      grimpeur: sortie.grimpeurs.get('g1')!.rating,
      bloc: sortie.blocs.get('b1')!.rating,
      duels: sortie.blocs.get('b1')!.matchs,
    }
  }

  it('ne bouge rien quand un grimpeur tres au-dessous echoue', () => {
    // 3000 contre un bloc a 5000 : deux crans d'ecart, l'echec etait acquis.
    const r = jouer(3000, 'echec', 2000)
    expect(r.grimpeur).toBe(3000)
    expect(r.bloc).toBe(5000)
    // Et le duel ne compte pas comme une observation utile.
    expect(r.duels).toBe(0)
  })

  it('ne bouge rien quand un grimpeur tres au-dessus reussit', () => {
    const r = jouer(7000, 'reussite', 2000)
    expect(r.grimpeur).toBe(7000)
    expect(r.bloc).toBe(5000)
    expect(r.duels).toBe(0)
  })

  it('compte au contraire les resultats surprenants', () => {
    // Le meme ecart, mais l'issue inverse : la, on apprend quelque chose.
    const exploit = jouer(3000, 'reussite', 2000)
    expect(exploit.grimpeur).toBeGreaterThan(3000)
    expect(exploit.bloc).toBeLessThan(5000)
    expect(exploit.duels).toBe(1)

    const echec = jouer(7000, 'echec', 2000)
    expect(echec.grimpeur).toBeLessThan(7000)
    expect(echec.bloc).toBeGreaterThan(5000)
  })

  it('compte tout quand la regle est desactivee', () => {
    const r = jouer(3000, 'echec', 0)
    expect(r.grimpeur).toBeLessThan(3000)
    expect(r.bloc).toBeGreaterThan(5000)
    expect(r.duels).toBe(1)
  })

  it('laisse passer ce qui reste en deca du seuil', () => {
    // 1500 points d'ecart, sous le seuil de 2000 : le resultat compte.
    const r = jouer(3500, 'echec', 2000)
    expect(r.grimpeur).toBeLessThan(3500)
    expect(r.duels).toBe(1)
  })
})

// --- La cote de depart des grimpeurs ----------------------------------------

describe('amorce des grimpeurs', () => {
  it('donne 4000 a un grimpeur qui se declare V4', () => {
    const ds = datasetMinimal({ niveauDeclare: 4 })
    const amorces = amorcesGrimpeurs(ds, [], 1000, 5000, 'niveau')
    expect(amorces.get('g1')).toBe(4000)
  })

  it('estime le niveau depuis les premiers blocs quand rien n est declare', () => {
    const ds = datasetMinimal({ niveauDeclare: null, indexBloc: 6 })
    const duels = construireDuels([ligne(1, 'g1', 'b1', 'echec')]).duels
    // Un seul bloc affronte, cote V6 : on part de 6000.
    expect(amorcesGrimpeurs(ds, duels, 1000, 5000, 'niveau').get('g1')).toBe(6000)
  })

  it('retombe sur la cote de repli sans aucune information', () => {
    const ds = datasetMinimal({ niveauDeclare: null })
    expect(amorcesGrimpeurs(ds, [], 1000, 5000, 'niveau').get('g1')).toBe(5000)
    // Et en mode uniforme, personne ne beneficie de son niveau.
    expect(amorcesGrimpeurs(ds, [], 1000, 5000, 'uniforme').get('g1')).toBe(5000)
  })
})

describe('calibrage', () => {
  it('retrouve une relation lineaire exacte', () => {
    const points = Array.from({ length: 13 }, (_, i) => ({ rating: 600 + i * 900, indexOfficiel: i }))
    const c = calibrer(points, { mode: 'auto', minMatchs: 1, cotationAncre: 'V4', ratingAncre: 1500, ptsParCran: 900 })
    expect(c.mode).toBe('auto')
    expect(1 / c.pente).toBeCloseTo(900, 5)
    expect(c.r2).toBeCloseTo(1, 6)
  })

  it('retombe sur l ancrage si les donnees ne disent rien', () => {
    const c = calibrer(
      [
        { rating: 1500, indexOfficiel: 3 },
        { rating: 1500, indexOfficiel: 6 },
        { rating: 1500, indexOfficiel: 4 },
      ],
      { mode: 'auto', minMatchs: 1, cotationAncre: 'V4', ratingAncre: 1500, ptsParCran: 900 }
    )
    expect(c.mode).toBe('ancre')
    expect(c.avertissement).toBeTruthy()
  })
})

describe('chargement des fichiers du depot', () => {
  it('lit les trois CSV sans erreur de validation', async () => {
    const ds = await dataset()
    expect(ds.rapport.anomalies.filter((a) => a.gravite === 'erreur')).toEqual([])
    expect(ds.grimpeurs.length).toBeGreaterThan(10)
    expect(ds.blocs.length).toBeGreaterThan(100)
    expect(ds.ascensions.length).toBeGreaterThan(5000)
  })

  it('rend les ascensions triees chronologiquement', async () => {
    const ds = await dataset()
    for (let i = 1; i < ds.ascensions.length; i++) {
      expect(ds.ascensions[i].t).toBeGreaterThanOrEqual(ds.ascensions[i - 1].t)
    }
  })

  it('rattache tous les blocs a une salle', async () => {
    const ds = await dataset()
    expect(ds.blocs.every((b) => b.gym.length > 0)).toBe(true)
    expect(new Set(ds.blocs.map((b) => b.gym)).size).toBeGreaterThan(0)
  })
})

describe('formules', () => {
  it('declare au moins deux formules, toutes avec un id unique', () => {
    expect(FORMULES.length).toBeGreaterThanOrEqual(2)
    expect(new Set(FORMULES.map((f) => f.id)).size).toBe(FORMULES.length)
  })

  it('travaille par defaut sur l echelle demandee', () => {
    for (const f of FORMULES) {
      expect(paramsParDefaut(f.params).echelle).toBe(ECHELLE_REFERENCE)
    }
  })

  it('part de la convention maison : cotation de l ouvreur et echelle fixe', async () => {
    const ds = await dataset()
    for (const f of FORMULES) {
      const r = executer(ds, f, paramsParDefaut(f.params), {})
      // Les formules qui estiment elles-memes partent de la cotation affichee ;
      // celles qui en combinent d'autres n'ont pas ces reglages, elles les
      // heritent de leurs composantes.
      if ('amorce' in r.params) {
        expect(r.params.amorce).toBe('cotation')
        expect(r.params.ptsParCran).toBe(1000)
      }
      expect(r.calibrage.mode).toBe('ancre')
      // La conversion par defaut est exactement cote / 1000 = cran V.
      expect(1 / r.calibrage.pente).toBeCloseTo(1000, 6)
      expect(r.calibrage.ordonnee).toBeCloseTo(0, 6)
    }
  })

  it('le melange est bien la moyenne des deux autres', async () => {
    const ds = await dataset()
    const par = (id: string) => {
      const f = FORMULES.find((x) => x.id === id)!
      return new Map(executer(ds, f, paramsParDefaut(f.params), {}).blocs.map((b) => [b.id, b.rating]))
    }
    const elo = par('elo-bloc')
    const gli = par('glicko')
    const mel = par('melange')
    let verifies = 0
    for (const [id, m] of mel) {
      const e = elo.get(id)
      const g = gli.get(id)
      if (e === undefined || g === undefined) continue
      expect(m).toBeCloseTo((e + g) / 2, 6)
      verifies += 1
    }
    expect(verifies).toBeGreaterThan(300)
  }, 60_000)

  it.each(FORMULES.map((f) => [f.id, f] as const))(
    '%s reste en accord avec l ouvreur sur la majorite des blocs',
    async (_id, formule) => {
      const ds = await dataset()
      const r = executer(ds, formule, paramsParDefaut(formule.params), {})
      expect(r.resume.blocsAudites).toBeGreaterThan(100)

      // Le desaccord doit rester l'exception, pas la regle.
      expect(r.resume.ecartMedianAbs).toBeLessThan(1)
      expect(r.resume.desaccords).toBeLessThan(r.resume.blocsAudites / 2)

      // Meilleur qu'un pile ou face.
      const brier = r.diagnostics.find((d) => d.label === 'Score de Brier')
      expect(brier?.valeur).toBeLessThan(0.25)
    },
    60_000
  )

  it(
    "retrouve les cotations d'ouvreur sans jamais les avoir vues",
    async () => {
      const ds = await dataset()
      const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
      // Amorce uniforme : la cotation affichee n'entre nulle part dans le
      // calcul, et le calibrage est ajuste par regression plutot que fixe. Si
      // les cotes retrouvent quand meme les cotations, c'est que le signal vient
      // bien des victoires et des defaites, et de rien d'autre.
      const r = executer(ds, elo, { ...paramsParDefaut(elo.params), amorce: 'uniforme' }, { mode: 'auto' })
      expect(r.calibrage.mode).toBe('auto')
      expect(r.calibrage.r2).toBeGreaterThan(0.6)
    },
    60_000
  )

  it('compte un duel par couple, pas une ligne par seance', async () => {
    const ds = await dataset()
    const couples = new Set(ds.ascensions.map((a) => a.grimpeurId + '|' + a.blocId)).size
    for (const f of FORMULES) {
      const r = executer(ds, f, paramsParDefaut(f.params), {})
      expect(r.resume.duels).toBe(couples)
      expect(r.resume.duels).toBeLessThan(r.resume.lignes)
      // Une partie d'entre eux est ecartee : issue jouee d'avance.
      expect(r.resume.duelsComptes).toBeLessThanOrEqual(r.resume.duels)
    }
  })

  it('converge : le deplacement diminue au fil des passes', async () => {
    const ds = await dataset()
    const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
    const r = executer(ds, elo, paramsParDefaut(elo.params), {})
    expect(r.convergence.length).toBeGreaterThan(1)
    expect(r.convergence[r.convergence.length - 1]).toBeLessThan(r.convergence[0])
  })

  it('produit un historique exploitable pour la courbe de progression', async () => {
    const ds = await dataset()
    for (const f of FORMULES) {
      const r = executer(ds, f, paramsParDefaut(f.params), {})
      expect(r.historique.length).toBeGreaterThan(100)
    }
  })

  it('mesure la connectivite entre les salles', async () => {
    const ds = await dataset()
    const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
    const r = executer(ds, elo, paramsParDefaut(elo.params), {})
    expect(r.resume.gyms.length).toBeGreaterThan(0)
    // Des qu'il y a plusieurs salles, il faut des grimpeurs communs : sans eux,
    // leurs echelles ne sont pas comparables. Sur une salle unique la question
    // ne se pose pas — tout le monde affronte le meme mur.
    if (r.resume.gyms.length > 1) {
      for (const g of r.resume.gyms) expect(g.ponts).toBeGreaterThan(0)
    }
  })
})

describe('ponderation du style', () => {
  it('un flash pese plus lourd qu un enchainement laborieux', async () => {
    const ds = await dataset()
    const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
    const base = paramsParDefaut(elo.params)

    // A poids egal (1 partout), le style n'a plus aucun effet : les cotes
    // doivent alors differer de celles obtenues avec la ponderation par defaut.
    const avec = executer(ds, elo, base, {})
    const sans = executer(ds, elo, { ...base, scoreEnchaine: 1 }, {})

    const parId = new Map(sans.blocs.map((b) => [b.id, b.indexCalcule]))
    const ecarts = avec.blocs
      .filter((b) => b.fiable)
      .map((b) => Math.abs(b.indexCalcule - (parId.get(b.id) ?? b.indexCalcule)))
    const moyen = ecarts.reduce((s, e) => s + e, 0) / ecarts.length
    expect(moyen).toBeGreaterThan(0)
  }, 60_000)
})

describe('cote par style', () => {
  it('la somme des mouvements par style reconstitue exactement le mouvement de la cote globale', async () => {
    const ds = await dataset()
    const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
    const params = normaliserParams(elo.params, {})
    const sortie = elo.calculer(ds, params)

    const affrontements = construireDuels(ds.ascensions)
    const amorces = amorcesGrimpeurs(
      ds,
      affrontements.duels,
      params.ptsParCran as number,
      params.ratingInitial as number,
      params.amorceGrimpeurs as string
    )

    expect(sortie.parStyle).toBeDefined()
    let grimpeursVerifies = 0
    for (const g of ds.grimpeurs) {
      const depart = amorces.get(g.id)!
      const finGlobal = sortie.grimpeurs.get(g.id)!.rating
      const parStyle = sortie.parStyle!.get(g.id)!
      expect([...parStyle.keys()].sort()).toEqual([...STYLES_BLOC].sort())
      const sommeMouvements = [...parStyle.values()].reduce((s, e) => s + (e.rating - depart), 0)
      expect(sommeMouvements).toBeCloseTo(finGlobal - depart, 6)
      grimpeursVerifies += 1
    }
    expect(grimpeursVerifies).toBe(ds.grimpeurs.length)
  }, 60_000)

  it('un style jamais affronte par un grimpeur reste exactement a son amorce', () => {
    // Dataset construit a la main (pas le jeu de demonstration) : avec
    // seulement quatre styles au vocabulaire, un grimpeur qui affronte des
    // centaines de blocs a toutes les chances de croiser chacun d'eux au
    // moins une fois, donc plus aucune garantie de trouver ce cas de figure
    // dans les donnees generees. Ici il est garanti par construction.
    const grimpeur: Grimpeur = {
      id: 'g1',
      nom: 'Grimpeur',
      sexe: 'X',
      gymPrincipal: 'Salle',
      premiereSaison: 2024,
      niveauDeclare: null,
    }
    const blocAffronte: Bloc = {
      id: 'b1',
      nom: 'BlocAffronte',
      gym: 'Salle',
      secteur: STYLES_BLOC[0],
      couleur: 'Bleu',
      cotationOfficielle: 'V5',
      indexOfficiel: 5,
      dateOuverture: '2026-01-01',
      dateRetrait: null,
    }
    const blocJamaisAffronte: Bloc = {
      id: 'b2',
      nom: 'BlocJamaisAffronte',
      gym: 'Salle',
      secteur: STYLES_BLOC[1],
      couleur: 'Bleu',
      cotationOfficielle: 'V5',
      indexOfficiel: 5,
      dateOuverture: '2026-01-01',
      dateRetrait: null,
    }
    const ds: Dataset = {
      grimpeurs: [grimpeur],
      blocs: [blocAffronte, blocJamaisAffronte],
      ascensions: [ligne(1, 'g1', 'b1', 'reussite')],
      grimpeurParId: new Map([['g1', grimpeur]]),
      blocParId: new Map([
        ['b1', blocAffronte],
        ['b2', blocJamaisAffronte],
      ]),
      fichiers: [],
      rapport: { anomalies: [], lignesLues: {}, lignesRetenues: {} },
    }

    const elo = FORMULES.find((f) => f.id === 'elo-bloc')!
    const params = normaliserParams(elo.params, {})
    const sortie = elo.calculer(ds, params)

    const affrontements = construireDuels(ds.ascensions)
    const amorces = amorcesGrimpeurs(
      ds,
      affrontements.duels,
      params.ptsParCran as number,
      params.ratingInitial as number,
      params.amorceGrimpeurs as string
    )
    const depart = amorces.get('g1')!
    const parStyle = sortie.parStyle!.get('g1')!

    expect(parStyle.get(STYLES_BLOC[0])!.matchs).toBeGreaterThan(0)
    expect(parStyle.get(STYLES_BLOC[1])!.matchs).toBe(0)
    expect(parStyle.get(STYLES_BLOC[1])!.rating).toBe(depart)
  })
})
