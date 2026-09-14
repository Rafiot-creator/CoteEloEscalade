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
  labelEn: 'Elo (boulder)',
  labelCourt: 'Elo',
  description:
    "Un affrontement par couple grimpeur-bloc : envoyé = gagné, jamais envoyé = perdu, quel que soit le nombre d'essais. Le style ne change que le poids de la victoire.",
  descriptionEn:
    "One matchup per climber-boulder pair: sent = won, never sent = lost, regardless of the number of attempts. Style only changes how much a win is worth.",
  params: [
    {
      nom: 'echelle',
      label: 'Échelle',
      labelEn: 'Scale',
      type: 'nombre',
      defaut: ECHELLE_REFERENCE,
      min: 200,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'Base',
      aide: "Écart de cote qui vaut dix chances contre une de réussir. À 1000, un grimpeur coté 1000 points au-dessus d'un bloc l'envoie neuf fois sur dix. C'est la définition de l'unité : la changer redimensionne toute l'échelle.",
      aideEn: "Rating gap worth ten-to-one odds of success. At 1000, a climber rated 1000 points above a boulder sends it nine times out of ten. This is the definition of the unit: changing it rescales the whole scale.",
    },
    {
      nom: 'ratingInitial',
      label: 'Cote de repli',
      labelEn: 'Fallback rating',
      type: 'nombre',
      defaut: 5000,
      min: 0,
      max: 12000,
      pas: 250,
      unite: 'pts',
      groupe: 'Base',
      aide: "Cote donnée à un grimpeur dont on ne sait rien du tout : ni niveau annoncé, ni premiers blocs. 5000 = V5, le milieu de l'échelle.",
      aideEn: "Rating given to a climber about whom nothing at all is known: no declared level, no first boulders. 5000 = V5, the middle of the scale.",
    },
    {
      nom: 'k',
      label: 'Facteur K',
      labelEn: 'K factor',
      type: 'nombre',
      defaut: 30,
      min: 10,
      max: 600,
      pas: 10,
      groupe: 'Base',
      aide: "Amplitude de la correction après un duel. Il se lit dans l'unité de l'échelle : à K = 30, une victoire totalement inattendue déplace la cote de 30 points, soit trois centièmes de cote V. Trop haut, les cotes sautent ; trop bas, elles n'apprennent rien.",
      aideEn: "Size of the correction after a duel, in the scale's own unit: at K = 30, a completely unexpected win shifts the rating by 30 points, i.e. three hundredths of a V grade. Too high and ratings jump around; too low and they learn nothing.",
    },
    {
      nom: 'scoreFlash',
      label: 'Victoire au flash',
      labelEn: 'Flash win',
      type: 'nombre',
      defaut: 1,
      min: 0.5,
      max: 1,
      pas: 0.05,
      groupe: 'Poids de la victoire',
      groupeEn: 'Weight of a win',
      aide: "Score du grimpeur quand le bloc tombe du premier essai. Domination nette : le bloc ne reçoit rien.",
      aideEn: "The climber's score when the boulder falls on the first try. A clean win: the boulder receives nothing.",
    },
    {
      nom: 'scoreEnchaine',
      label: 'Victoire après travail',
      labelEn: 'Win after working it',
      type: 'nombre',
      defaut: 0.8,
      min: 0.3,
      max: 1,
      pas: 0.05,
      groupe: 'Poids de la victoire',
      groupeEn: 'Weight of a win',
      aide: "Score d'un envoi qui a demandé du travail. En dessous de 1, le bloc reçoit le complément : il a résisté, sa cote ne baisse pas autant. À 1, le style n'a plus aucun effet.",
      aideEn: "Score of a send that took work. Below 1, the boulder receives the remainder: it resisted, so its rating doesn't drop as much. At 1, style has no effect at all.",
    },
    {
      nom: 'essaisPourMinimum',
      label: 'Essais pour le poids minimum',
      labelEn: 'Attempts for the minimum weight',
      type: 'nombre',
      defaut: 6,
      min: 2,
      max: 40,
      pas: 1,
      unite: 'essais',
      uniteEn: 'attempts',
      groupe: 'Poids de la victoire',
      groupeEn: 'Weight of a win',
      aide: "Nombre d'essais cumulés à partir duquel la victoire ne vaut plus que le poids 'après travail'. Entre 1 essai et ce seuil, le score descend progressivement.",
      aideEn: "Cumulative number of attempts beyond which a win is worth only the 'after working it' weight. Between 1 attempt and this threshold, the score decreases gradually.",
    },
    {
      nom: 'ecartNeglige',
      label: 'Écart au-delà duquel un résultat attendu est ignoré',
      labelEn: 'Gap beyond which an expected result is ignored',
      type: 'nombre',
      defaut: 2000,
      min: 0,
      max: 5000,
      pas: 250,
      unite: 'pts',
      groupe: 'Règle de comptage',
      groupeEn: 'Counting rule',
      aide: "Un grimpeur situé très au-dessous d'un bloc qui échoue, ou très au-dessus qui réussit, ne nous apprend rien — le modèle le prédisait déjà. Pire, ces résultats poussent la cote toujours dans le même sens : un bloc que seuls des grimpeurs bien plus faibles tentent ne reçoit que des échecs et dérive vers le haut sans contrepartie. À 2000 points, soit deux cotes V, on les écarte. 0 = tout compte.",
      aideEn: "A climber far below a boulder who fails, or far above one who succeeds, teaches us nothing — the model already predicted it. Worse, these results always push the rating the same way: a boulder only much weaker climbers attempt receives only failures and drifts upward with nothing to balance it. At 2000 points, i.e. two V grades, they are excluded. 0 = everything counts.",
    },
    {
      nom: 'kMin',
      label: 'K minimum',
      labelEn: 'Minimum K',
      type: 'nombre',
      defaut: 8,
      min: 0,
      max: 200,
      pas: 5,
      groupe: 'Convergence',
      aide: "Plancher du facteur K : en dessous, un grimpeur confirmé ne bougerait plus jamais.",
      aideEn: "Floor for the K factor: below it, an established climber would never move again.",
    },
    {
      nom: 'kDemiVie',
      label: 'Demi-vie de K',
      labelEn: 'K half-life',
      type: 'nombre',
      defaut: 200,
      min: 1,
      max: 400,
      pas: 5,
      unite: 'duels',
      uniteEn: 'duels',
      groupe: 'Convergence',
      aide: 'Nombre de duels au bout duquel K est divisé par deux. Fait atterrir les nouveaux vite et stabilise les habitués.',
      aideEn: 'Number of duels after which K is halved. Brings newcomers in fast and stabilizes regulars.',
    },
    {
      nom: 'passes',
      label: 'Passes',
      labelEn: 'Passes',
      type: 'nombre',
      defaut: 12,
      min: 1,
      max: 60,
      pas: 1,
      groupe: 'Convergence',
      aide: "Nombre de relectures de l'historique. La 1re passe fait le gros du chemin, les suivantes affinent. Surveiller la courbe de convergence.",
      aideEn: "Number of replays of the history. The 1st pass does most of the work, later ones refine it. Watch the convergence curve.",
    },
    {
      nom: 'amorceGrimpeurs',
      label: 'Amorce des grimpeurs',
      labelEn: 'Climber seeding',
      type: 'choix',
      defaut: 'niveau',
      groupe: 'A priori',
      groupeEn: 'Prior',
      options: [
        { valeur: 'niveau', label: 'Depuis leur niveau (V4 = 4000)', labelEn: 'From their level (V4 = 4000)' },
        { valeur: 'uniforme', label: 'Tous à la cote de repli', labelEn: 'Everyone at the fallback rating' },
      ],
      aide: "Niveau : on part du niveau annoncé à l'inscription, ou à défaut de la médiane des blocs affrontés lors des douze premiers duels. Un grimpeur V4 démarre donc vers 4000. Uniforme : tout le monde part du milieu de l'échelle, et passe ses premières semaines à rejoindre son niveau réel.",
      aideEn: "Level: starts from the level declared at sign-up, or failing that the median of the boulders faced in the first twelve duels. A V4 climber thus starts around 4000. Uniform: everyone starts at the middle of the scale and spends their first weeks catching up to their real level.",
    },
    {
      nom: 'amorce',
      label: 'Amorce des blocs',
      labelEn: 'Boulder seeding',
      type: 'choix',
      defaut: 'cotation',
      groupe: 'A priori',
      groupeEn: 'Prior',
      options: [
        { valeur: 'cotation', label: "Depuis la cotation affichée (V1 = 1000, V2 = 2000...)", labelEn: 'From the displayed grade (V1 = 1000, V2 = 2000...)' },
        { valeur: 'uniforme', label: "Uniforme (ignore la cotation de l'ouvreur)", labelEn: "Uniform (ignores the setter's grade)" },
      ],
      aide: "Cotation : chaque bloc démarre à sa cotation x 1000, le classement ne fait que corriger l'ouvreur. Uniforme : tous les blocs partent au même point, le résultat est alors totalement indépendant des cotations affichées — c'est la seule façon de les auditer sans biais, mais la convergence est plus lente.",
      aideEn: "Grade: each boulder starts at its grade x 1000, the ranking only corrects the setter. Uniform: all boulders start at the same point, so the result is then totally independent of displayed grades — the only unbiased way to audit them, but convergence is slower.",
    },
    {
      nom: 'ptsParCran',
      label: 'Points par cote V',
      labelEn: 'Points per V grade',
      type: 'nombre',
      defaut: 1000,
      min: 100,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'A priori',
      groupeEn: 'Prior',
      aide: "Valeur d'une cote V sur l'échelle. À 1000, un V1 démarre à 1000 et un V7 à 7000 — et comme l'échelle vaut aussi 1000, une cote d'écart vaut exactement dix chances contre une. Sans effet si l'amorce est uniforme.",
      aideEn: "Value of one V grade on the scale. At 1000, a V1 starts at 1000 and a V7 at 7000 — and since the scale is also 1000, one grade of gap is worth exactly ten-to-one odds. No effect if seeding is uniform.",
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
