import type { Dataset } from '../../types'
import { ECHELLE_REFERENCE, Evaluateur, construireDuels, esperance } from '../lib'
import { paramsParDefaut, type EtatRating, type Formule, type SortieFormule } from '../types'
import eloBloc from './elo-bloc'
import glicko from './glicko'

/**
 * La moyenne des deux autres formules.
 *
 * Elles ne se trompent pas tout a fait de la meme facon : l'Elo est prudent et
 * fait peu de grosses erreurs, Glicko est plus juste sur le bloc courant mais
 * s'egare davantage sur les cas limites. Les moyenner reduit l'erreur
 * quadratique sous celle des deux — 0,296 contre 0,318 pour l'Elo et 0,350 pour
 * Glicko sur le jeu livre.
 *
 * Le gain reste modeste, et pour une raison qu'il vaut mieux connaitre : la
 * correlation entre leurs erreurs est de 0,73. Elles partagent les memes
 * donnees, le meme repliement en duels, le meme a priori et le meme filtre. Un
 * vrai gain d'ensemble demanderait un point de vue reellement different, pas une
 * variante de la meme mecanique.
 *
 * Le poids par defaut est **la moitie**, volontairement. L'optimum mesure est
 * proche de 0,4, mais il est estime sur une verite terrain simulee : le retenir
 * serait du surajustement, alors que la moyenne simple en capte deja
 * l'essentiel (0,296 contre 0,294) sans aucun parametre a justifier.
 */

/**
 * Les deux formules sous-jacentes tournent avec **leurs valeurs par defaut**.
 * Regler l'une d'elles dans l'ecran Formules ne change donc pas le melange :
 * pour explorer les reglages, il faut passer sur la formule concernee. En
 * echange, le melange reste une reference stable a laquelle se comparer.
 */
const cache = new WeakMap<Dataset, { elo: SortieFormule; glicko: SortieFormule }>()

function sousFormules(dataset: Dataset) {
  const connu = cache.get(dataset)
  if (connu) return connu
  const calcule = {
    elo: eloBloc.calculer(dataset, paramsParDefaut(eloBloc.params)),
    glicko: glicko.calculer(dataset, paramsParDefaut(glicko.params)),
  }
  cache.set(dataset, calcule)
  return calcule
}

/**
 * Moyenne pondérée de deux etats.
 *
 * Les effectifs prennent le *minimum* des deux : le melange n'a de sens que la
 * ou les deux formules ont un avis, donc un bloc que l'une juge trop peu
 * documente ne devient pas jugeable parce que l'autre est plus laxiste.
 * L'incertitude vient de Glicko, seul a en produire une.
 */
function melanger(a: Map<string, EtatRating>, b: Map<string, EtatRating>, poids: number): Map<string, EtatRating> {
  const out = new Map<string, EtatRating>()
  for (const [id, ea] of a) {
    const eb = b.get(id)
    if (!eb) {
      out.set(id, { ...ea })
      continue
    }
    out.set(id, {
      rating: (1 - poids) * ea.rating + poids * eb.rating,
      incertitude: eb.incertitude ?? ea.incertitude,
      matchs: Math.min(ea.matchs, eb.matchs),
      reussites: Math.min(ea.reussites, eb.reussites),
    })
  }
  return out
}

const formule: Formule = {
  id: 'melange',
  label: 'Melange Elo + Glicko',
  labelCourt: 'Melange',
  // Calibre comme les autres sur le monde temoin, a taux de fausses alertes
  // comparable (cf. desaccords.test.ts).
  seuilDesaccord: 0.75,
  // Derive des deux autres : sa voix au jury serait redondante. Mesure sur le
  // jeu livre, elle ne signale aucun bloc qu'elles ne signalent deja.
  avisIndependant: false,
  description:
    "La moyenne des deux autres. Elles ne se trompant pas de la meme facon, leur moyenne fait moins de grosses erreurs que chacune prise seule. Les deux tournent avec leurs reglages par defaut.",
  params: [
    {
      nom: 'poidsGlicko',
      label: 'Poids de Glicko',
      type: 'nombre',
      defaut: 0.5,
      min: 0,
      max: 1,
      pas: 0.05,
      groupe: 'Melange',
      aide: "A 0 on retrouve l'Elo, a 1 Glicko. La moitie est le choix par defaut : l'optimum mesure est vers 0,4, mais il est estime sur une verite terrain simulee et le retenir serait du surajustement — la moyenne simple en capte deja l'essentiel.",
    },
    {
      nom: 'echelle',
      label: 'Echelle',
      type: 'nombre',
      defaut: ECHELLE_REFERENCE,
      min: 200,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'Melange',
      aide: "Sert uniquement a evaluer la qualite predictive du melange ; les cotes, elles, viennent des deux formules sous-jacentes.",
    },
  ],

  calculer(dataset: Dataset, p): SortieFormule {
    const poids = Math.min(1, Math.max(0, p.poidsGlicko as number))
    const echelle = p.echelle as number
    const { elo, glicko: gli } = sousFormules(dataset)

    const grimpeurs = melanger(elo.grimpeurs, gli.grimpeurs, poids)
    const blocs = melanger(elo.blocs, gli.blocs, poids)

    // Le melange merite sa propre mesure de qualite predictive : on rejoue les
    // duels contre les cotes melangees plutot que d'emprunter celle d'une des
    // deux formules.
    const evaluateur = new Evaluateur()
    for (const d of construireDuels(dataset.ascensions).duels) {
      const eg = grimpeurs.get(d.grimpeurId)
      const eb = blocs.get(d.blocId)
      if (!eg || !eb) continue
      evaluateur.ajouter(esperance(eg.rating, eb.rating, echelle), d.gagne)
    }

    // La trajectoire vient de la formule qui pese le plus lourd : les deux ne
    // sont pas alignables (l'Elo produit un point par evenement, Glicko un par
    // periode), et une moyenne de deux courbes decalees ne voudrait rien dire.
    //
    // Elle est en revanche *recalee* pour finir sur la cote melangee : sans ca,
    // la courbe d'un grimpeur s'acheverait sur une valeur differente de celle
    // affichee dans le classement, ce qui se verrait. Le decalage est constant
    // par grimpeur, donc la forme de la trajectoire — la seule information
    // qu'elle porte — n'est pas touchee.
    const dominante = poids > 0.5 ? gli : elo
    const recalage = new Map<string, number>()
    for (const [id, e] of grimpeurs) {
      const source = dominante.grimpeurs.get(id)
      if (source) recalage.set(id, e.rating - source.rating)
    }
    const historique = dominante.historique.map((p) => ({
      ...p,
      rating: p.rating + (recalage.get(p.grimpeurId) ?? 0),
    }))

    return {
      grimpeurs,
      blocs,
      historique,
      convergence: dominante.convergence,
      diagnostics: [
        ...evaluateur.diagnostics(),
        {
          label: 'Ecart entre les deux formules',
          valeur: ecartMoyen(elo.blocs, gli.blocs),
          unite: 'pts',
          basMieux: true,
          aide:
            "Distance moyenne entre la cote Elo et la cote Glicko d'un meme bloc. Elle mesure ce que le melange peut apporter : deux formules d'accord partout n'auraient rien a se dire.",
        },
      ],
    }
  },
}

function ecartMoyen(a: Map<string, EtatRating>, b: Map<string, EtatRating>): number {
  let somme = 0
  let n = 0
  for (const [id, ea] of a) {
    const eb = b.get(id)
    if (!eb) continue
    somme += Math.abs(ea.rating - eb.rating)
    n += 1
  }
  return n ? somme / n : 0
}

export default formule
