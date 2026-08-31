import type { Dataset } from '../../types'
import {
  ECHELLE_REFERENCE,
  amorcesGrimpeurs,
  construireDuels,
  diagnosticDuels,
  moteurElo,
  type Duel,
} from '../lib'
import type { Formule } from '../types'

/**
 * La formule de la maison.
 *
 * Le modele : **un seul affrontement par couple grimpeur-bloc**. Toutes les
 * seances passees sur un bloc se replient en une seule partie, dont l'issue est
 * binaire et ne depend pas du nombre d'essais :
 *
 *  - le grimpeur a fini par l'envoyer -> il gagne la partie, sa cote monte,
 *    celle du bloc baisse ;
 *  - il ne l'a jamais envoye -> il perd, l'inverse se produit.
 *
 * Le nombre d'essais ne decide donc de rien. Il sert seulement a *ponderer* la
 * victoire : un flash est une domination nette, un enchainement au vingtieme
 * essai une victoire aux points. Le bloc recoit le complement du score, si bien
 * qu'un bloc qui a beaucoup resiste avant de tomber remonte un peu.
 *
 * L'echelle est fixee par definition : 1000 points d'ecart = dix chances contre
 * une de reussir. C'est ce qui donne un sens absolu aux points.
 */
const formule: Formule = {
  id: 'elo-bloc',
  label: 'Elo bloc',
  labelCourt: 'Elo',
  description:
    "Un affrontement par couple grimpeur-bloc : envoye = gagne, jamais envoye = perdu, quel que soit le nombre d'essais. Le style ne change que le poids de la victoire.",
  params: [
    {
      nom: 'echelle',
      label: 'Echelle',
      type: 'nombre',
      defaut: ECHELLE_REFERENCE,
      min: 200,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'Base',
      aide: "Ecart de cote qui vaut dix chances contre une de reussir. A 1000, un grimpeur cote 1000 points au-dessus d'un bloc l'envoie neuf fois sur dix. C'est la definition de l'unite : la changer redimensionne toute l'echelle.",
    },
    {
      nom: 'ratingInitial',
      label: 'Cote de repli',
      type: 'nombre',
      defaut: 5000,
      min: 0,
      max: 12000,
      pas: 250,
      unite: 'pts',
      groupe: 'Base',
      aide: "Cote donnee a un grimpeur dont on ne sait rien du tout : ni niveau annonce, ni premiers blocs. 5000 = V5, le milieu de l'echelle.",
    },
    {
      nom: 'k',
      label: 'Facteur K',
      type: 'nombre',
      defaut: 30,
      min: 10,
      max: 600,
      pas: 10,
      groupe: 'Base',
      aide: "Amplitude de la correction apres un duel. Il se lit dans l'unite de l'echelle : a K = 30, une victoire totalement inattendue deplace la cote de 30 points, soit trois centiemes de cran V. Trop haut, les cotes sautent ; trop bas, elles n'apprennent rien.",
    },
    {
      nom: 'scoreFlash',
      label: 'Victoire au flash',
      type: 'nombre',
      defaut: 1,
      min: 0.5,
      max: 1,
      pas: 0.05,
      groupe: 'Poids de la victoire',
      aide: "Score du grimpeur quand le bloc tombe du premier essai. Domination nette : le bloc ne recoit rien.",
    },
    {
      nom: 'scoreEnchaine',
      label: 'Victoire apres travail',
      type: 'nombre',
      defaut: 0.8,
      min: 0.3,
      max: 1,
      pas: 0.05,
      groupe: 'Poids de la victoire',
      aide: "Score d'un envoi qui a demande du travail. En dessous de 1, le bloc recoit le complement : il a resiste, sa cote ne baisse pas autant. A 1, le style n'a plus aucun effet.",
    },
    {
      nom: 'essaisPourMinimum',
      label: 'Essais pour le poids minimum',
      type: 'nombre',
      defaut: 6,
      min: 2,
      max: 40,
      pas: 1,
      unite: 'essais',
      groupe: 'Poids de la victoire',
      aide: "Nombre d'essais cumules a partir duquel la victoire ne vaut plus que le poids 'apres travail'. Entre 1 essai et ce seuil, le score descend progressivement.",
    },
    {
      nom: 'ecartNeglige',
      label: 'Ecart au-dela duquel un resultat attendu est ignore',
      type: 'nombre',
      defaut: 2000,
      min: 0,
      max: 5000,
      pas: 250,
      unite: 'pts',
      groupe: 'Regle de comptage',
      aide: "Un grimpeur situe tres au-dessous d'un bloc qui echoue, ou tres au-dessus qui reussit, ne nous apprend rien — le modele le predisait deja. Pire, ces resultats poussent la cote toujours dans le meme sens : un bloc que seuls des grimpeurs bien plus faibles tentent ne recoit que des echecs et derive vers le haut sans contrepartie. A 2000 points, soit deux crans V, on les ecarte. 0 = tout compte.",
    },
    {
      nom: 'kMin',
      label: 'K minimum',
      type: 'nombre',
      defaut: 8,
      min: 0,
      max: 200,
      pas: 5,
      groupe: 'Convergence',
      aide: "Plancher du facteur K : en dessous, un grimpeur confirme ne bougerait plus jamais.",
    },
    {
      nom: 'kDemiVie',
      label: 'Demi-vie de K',
      type: 'nombre',
      defaut: 200,
      min: 1,
      max: 400,
      pas: 5,
      unite: 'duels',
      groupe: 'Convergence',
      aide: 'Nombre de duels au bout duquel K est divise par deux. Fait atterrir les nouveaux vite et stabilise les habitues.',
    },
    {
      nom: 'passes',
      label: 'Passes',
      type: 'nombre',
      defaut: 12,
      min: 1,
      max: 60,
      pas: 1,
      groupe: 'Convergence',
      aide: "Nombre de relectures de l'historique. La 1re passe fait le gros du chemin, les suivantes affinent. Surveiller la courbe de convergence.",
    },
    {
      nom: 'amorceGrimpeurs',
      label: 'Amorce des grimpeurs',
      type: 'choix',
      defaut: 'niveau',
      groupe: 'A priori',
      options: [
        { valeur: 'niveau', label: 'Depuis leur niveau (V4 = 4000)' },
        { valeur: 'uniforme', label: 'Tous a la cote de repli' },
      ],
      aide: "Niveau : on part du niveau annonce a l'inscription, ou a defaut de la mediane des blocs affrontes lors des douze premiers duels. Un grimpeur V4 demarre donc vers 4000. Uniforme : tout le monde part du milieu de l'echelle, et passe ses premieres semaines a rejoindre son niveau reel.",
    },
    {
      nom: 'amorce',
      label: 'Amorce des blocs',
      type: 'choix',
      defaut: 'cotation',
      groupe: 'A priori',
      options: [
        { valeur: 'cotation', label: "Depuis la cotation affichee (V1 = 1000, V2 = 2000...)" },
        { valeur: 'uniforme', label: "Uniforme (ignore la cotation de l'ouvreur)" },
      ],
      aide: "Cotation : chaque bloc demarre a sa cotation x 1000, le classement ne fait que corriger l'ouvreur. Uniforme : tous les blocs partent au meme point, le resultat est alors totalement independant des cotations affichees — c'est la seule facon de les auditer sans biais, mais la convergence est plus lente.",
    },
    {
      nom: 'ptsParCran',
      label: 'Points par cran V',
      type: 'nombre',
      defaut: 1000,
      min: 100,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'A priori',
      aide: "Valeur d'un cran V sur l'echelle. A 1000, un V1 demarre a 1000 et un V7 a 7000 — et comme l'echelle vaut aussi 1000, un cran d'ecart vaut exactement dix chances contre une. Sans effet si l'amorce est uniforme.",
    },
  ],

  calculer(dataset: Dataset, p) {
    const scoreFlash = p.scoreFlash as number
    const scoreEnchaine = p.scoreEnchaine as number
    const essaisPourMinimum = Math.max(2, p.essaisPourMinimum as number)

    /**
     * Poids de la victoire : plein au flash, decroissant jusqu'au palier
     * "apres travail". La defaite vaut 0, sans nuance — le grimpeur n'a pas
     * envoye le bloc, le nombre de tentatives n'y change rien.
     */
    const score = (d: Duel) => {
      if (!d.gagne) return 0
      const avancement = Math.min(1, (d.essais - 1) / (essaisPourMinimum - 1))
      return scoreFlash + (scoreEnchaine - scoreFlash) * avancement
    }

    const affrontements = construireDuels(dataset.ascensions)
    const sortie = moteurElo(dataset, {
      duels: affrontements.duels,
      ecartNeglige: p.ecartNeglige as number,
      amorcesGrimpeurs: amorcesGrimpeurs(
        dataset,
        affrontements.duels,
        p.ptsParCran as number,
        p.ratingInitial as number,
        p.amorceGrimpeurs as string
      ),
      ratingInitial: p.ratingInitial as number,
      k: p.k as number,
      kMin: p.kMin as number,
      kDemiVie: p.kDemiVie as number,
      echelle: p.echelle as number,
      passes: p.passes as number,
      amorce: p.amorce as string,
      ptsParCran: p.ptsParCran as number,
      score,
    })

    sortie.diagnostics.push(diagnosticDuels(affrontements))
    return sortie
  },
}

export default formule
