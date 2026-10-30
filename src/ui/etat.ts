import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PARAMS_CALIBRAGE } from '../core/calibrage'
import { FORMULES, FORMULE_PAR_DEFAUT, formuleParId } from '../core/formulas/registry'
import { paramsParDefaut, type Formule, type Params } from '../core/formulas/types'
import { construireDataset } from '../core/loaders/dataset'
import { executerMemo, type Resultat } from '../core/pipeline'
import { chargerToutesLesSources } from '../core/sources'
import { supabase } from '../core/supabase'
import type { Ascension, Dataset } from '../core/types'
import { ascensionsLocales } from './ascensionsLocales'
import type { Echelle } from '../core/echelles'

/** Les trois facons d'enregistrer un envoi depuis la Carte. */
export type TypeEnvoi = 'flash' | 'reussi' | 'echec'

/** Pourquoi un envoi n'a pas pu etre enregistre comme une vraie ascension. */
export type EchecEnregistrement = 'grimpeur-inconnu' | 'bloc-inconnu'

/** L'etat d'un bloc pour un grimpeur donne, d'apres ses ascensions connues. */
export type StatutEnvoi = 'flash' | 'reussi' | 'echec'

/** Une ligne de la table `ascensions`, telle que la diffuse le temps reel. */
interface LigneAscension {
  date: string
  grimpeur_id: string
  bloc_id: string
  resultat: 'reussite' | 'echec'
  essais: number
}

/**
 * L'etat de l'atelier : un dataset, une formule, ses reglages, un resultat.
 *
 * Le calcul est synchrone et memoise (cf. pipeline). Sur ce volume de donnees
 * il tient dans les quelques dizaines de millisecondes, donc bouger un curseur
 * recalcule tout sans etage d'asynchrone a maintenir. Si le jeu de donnees
 * grossissait d'un ordre de grandeur, c'est ici — et ici seulement — qu'il
 * faudrait passer par un Web Worker.
 */
export interface Atelier {
  dataset: Dataset | null
  /** Echelle affichee par le centre (src/core/echelles.ts) ; le calcul reste en V. */
  echelle: Echelle
  chargement: boolean
  erreur: string | null
  /** Relit toute la base (apres la creation d'un pseudonyme, par exemple). */
  recharger: () => void
  /**
   * Dernier envoi refuse par la base pour le compte connecte (connexion
   * perdue, frein anti-rafale...). L'envoi a deja ete retire de l'ecran.
   */
  erreurEnvoi: string | null

  /**
   * Enregistre un envoi (flash / reussi / echec) depuis la Carte comme une
   * vraie ascension du dataset, pour un grimpeur designe par son nom. Renvoie
   * `'ok'` si la ligne a ete ajoutee, ou pourquoi ce n'etait pas possible
   * (nom qui ne correspond a aucun grimpeur connu, bloc qui ne correspond a
   * aucun bloc du dataset — la Carte d'un centre sans jeu de donnees connecte,
   * par exemple).
   *
   * Pour le grimpeur du compte connecte, l'envoi est enregistre dans la base
   * (`enregistrer_envoi`) et remplace a l'ecran ses ascensions precedentes
   * sur ce bloc, comme la base vient de le faire. Pour tout autre nom, il
   * reste propre a ce navigateur (`ascensionsLocales`), comme avant les
   * comptes : le jeu de demonstration reste explorable sans compte.
   */
  enregistrerAscension: (blocId: string, grimpeurNom: string, type: TypeEnvoi) => 'ok' | EchecEnregistrement
  /**
   * Statut de chaque bloc deja tente par un grimpeur nomme, fichier + Carte
   * confondus : `'flash'` ou `'reussi'` (essais === 1 ou non sur l'ascension
   * retenue, cf. `core/types.ts`), `'echec'`, ou absent si le bloc n'a
   * jamais ete tente. C'est l'ascension la plus RECENTE qui l'emporte, pas
   * la meilleure : un nouvel envoi tape sur la Carte est toujours plus
   * recent que l'historique du fichier, donc change toujours le statut
   * affiche, y compris pour le degrader (flash -> echec compris) — corriger
   * un mauvais clic ou changer d'avis doit marcher a tout moment, dans
   * n'importe quel sens.
   */
  envoisConnus: (grimpeurNom: string) => Map<string, StatutEnvoi>

  formules: Formule[]
  formule: Formule
  choisirFormule: (id: string) => void

  params: Params
  setParam: (nom: string, v: number | boolean | string) => void
  paramsCalibrage: Params
  setParamCalibrage: (nom: string, v: number | boolean | string) => void
  reinitialiser: () => void

  resultat: Resultat | null
  /**
   * Le resultat de *chaque* formule, pour pouvoir les afficher cote a cote.
   * Elles sont memoisees separement : bouger un reglage de l'une ne recalcule
   * pas les autres.
   */
  resultats: Map<string, Resultat>

  /** Resultat mis de cote pour comparer deux reglages. */
  reference: { resultat: Resultat; etiquette: string } | null
  memoriser: () => void
  oublier: () => void
}

/**
 * `centres` : le groupe de centres calcules ensemble (un seul, ou Rose Bloc 1 et 2 :
 * `GROUPES_CALCUL`, src/App.tsx) ; leurs blocs et leurs ascensions sont lus et calcules
 * (les grimpeurs sont communs a tous). Changer de groupe relit tout ; passer de Rose Bloc 1 a 2, non.
 */
export function useAtelier(grimpeurConnecte: { id: string; nom: string } | null = null, centres: string[] = ['demo']): Atelier {
  // Cle stable pour les dependances des effets (un nouveau tableau a chaque rendu sinon).
  const groupe = centres.join(',')
  const [datasetBase, setDatasetBase] = useState<Dataset | null>(null)
  const [generation, setGeneration] = useState(0)
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null)
  const [ascensionsAjoutees, setAscensionsAjoutees] = useState<Ascension[]>(() => ascensionsLocales.lire())
  const [erreur, setErreur] = useState<string | null>(null)
  const [echelle, setEchelle] = useState<Echelle>('v')

  const [formuleId, setFormuleId] = useState(FORMULE_PAR_DEFAUT.id)
  const [parFormule, setParFormule] = useState<Record<string, Params>>(() =>
    Object.fromEntries(FORMULES.map((f) => [f.id, paramsParDefaut(f.params)]))
  )
  const [paramsCalibrage, setParamsCalibrage] = useState<Params>(() => paramsParDefaut(PARAMS_CALIBRAGE))
  const [reference, setReference] = useState<{ resultat: Resultat; etiquette: string } | null>(null)

  // Un autre centre : rien de l'ancien ne doit rester affiche pendant le chargement.
  useEffect(() => {
    setDatasetBase(null)
    setErreur(null)
    setReference(null)
  }, [groupe])

  useEffect(() => {
    let vivant = true
    chargerToutesLesSources(groupe.split(','))
      .then((fichiers) => {
        if (vivant) setDatasetBase(construireDataset(fichiers))
      })
      .catch((e: unknown) => {
        if (vivant) setErreur(e instanceof Error ? e.message : String(e))
      })
    void supabase
      .from('centres')
      .select('echelle')
      .eq('id', groupe.split(',')[0])
      .maybeSingle<{ echelle: Echelle }>()
      .then(({ data }) => {
        if (vivant) setEchelle(data?.echelle ?? 'v')
      })
    return () => {
      vivant = false
    }
  }, [generation, groupe])

  const recharger = useCallback(() => setGeneration((g) => g + 1), [])

  // Temps reel : les envois des autres arrivent ici des qu'ils sont
  // enregistres (publication `supabase_realtime`, cf. supabase/migrations/).
  // Un envoi dont le grimpeur et le bloc sont connus s'applique tel quel, avec
  // la meme regle de remplacement que `enregistrer_envoi` ; c'est le cas
  // courant, et il evite de relire toute la base (une vingtaine de requetes)
  // pour chaque envoi de chaque grimpeur. Le reste (nouveau grimpeur, bloc
  // place ou modifie par un ouvreur, reconnexion apres une coupure pendant
  // laquelle des changements ont pu manquer) relit tout, regroupe en une
  // seule relecture si plusieurs changements arrivent coup sur coup.
  // Les suppressions d'ascensions sont ignorees : `enregistrer_envoi` les
  // fait toujours suivre de l'insertion qui les remplace, et la suppression
  // d'un compte (rare, a la main) se verra au prochain chargement.
  const relectureDiffere = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const relire = () => {
      if (relectureDiffere.current) clearTimeout(relectureDiffere.current)
      relectureDiffere.current = setTimeout(recharger, 1500)
    }
    let dejaAbonne = false
    const canal = supabase
      .channel(`atelier-${groupe}`)
      .on<LigneAscension>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ascensions' }, ({ new: l }) => {
        setDatasetBase((d) => {
          if (!d) return d
          // Bloc inconnu : envoi dans un autre centre, sans effet ici. Un bloc
          // tout juste place dans ce centre arrive par l'abonnement `blocs`
          // ci-dessous, dont la relecture reprend aussi ses ascensions.
          if (!d.blocParId.has(l.bloc_id)) return d
          if (!d.grimpeurParId.has(l.grimpeur_id)) {
            relire()
            return d
          }
          const ascension: Ascension = {
            date: l.date,
            // Comme un envoi fait sur cet ecran (`enregistrerAscension`) :
            // le plus recent passe apres tout l'historique deja charge.
            t: Date.now(),
            grimpeurId: l.grimpeur_id,
            blocId: l.bloc_id,
            resultat: l.resultat,
            essais: l.essais,
          }
          return {
            ...d,
            ascensions: [
              ...d.ascensions.filter((a) => !(a.grimpeurId === l.grimpeur_id && a.blocId === l.bloc_id)),
              ascension,
            ],
          }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocs', filter: `centre_id=in.(${groupe})` }, relire)
      .subscribe((statut) => {
        if (statut !== 'SUBSCRIBED') return
        // Le premier abonnement suit le chargement initial ; un suivant est
        // une reconnexion (telephone en veille, reseau coupe...).
        if (dejaAbonne) relire()
        dejaAbonne = true
      })
    return () => {
      if (relectureDiffere.current) clearTimeout(relectureDiffere.current)
      void supabase.removeChannel(canal)
    }
  }, [recharger, groupe])

  // Les ascensions ajoutees depuis la Carte s'ajoutent a celles du fichier :
  // le pipeline ne voit qu'un seul dataset, coherent, trie chronologiquement.
  // Elles sont gardees pour tous les centres a la fois : seules celles sur un
  // bloc du centre affiche entrent dans son calcul.
  const dataset = useMemo<Dataset | null>(() => {
    if (!datasetBase) return null
    const ici = ascensionsAjoutees.filter((a) => datasetBase.blocParId.has(a.blocId))
    if (!ici.length) return datasetBase
    return {
      ...datasetBase,
      ascensions: [...datasetBase.ascensions, ...ici].sort((a, b) => a.t - b.t),
    }
  }, [datasetBase, ascensionsAjoutees])

  const enregistrerAscension = useCallback(
    (blocId: string, grimpeurNom: string, type: TypeEnvoi): 'ok' | EchecEnregistrement => {
      const nom = grimpeurNom.trim().toLowerCase()
      const grimpeur = datasetBase?.grimpeurs.find((g) => g.nom.trim().toLowerCase() === nom)
      if (!nom || !grimpeur) return 'grimpeur-inconnu'
      if (!datasetBase?.blocParId.has(blocId)) return 'bloc-inconnu'
      const maintenant = new Date()
      const ascension: Ascension = {
        date: maintenant.toISOString().slice(0, 10),
        t: maintenant.getTime(),
        grimpeurId: grimpeur.id,
        blocId,
        resultat: type === 'echec' ? 'echec' : 'reussite',
        // Le nombre d'essais n'entre dans aucun calcul (cf. core/types.ts) :
        // ces valeurs ne font que refleter honnetement flash / plusieurs essais.
        essais: type === 'flash' ? 1 : type === 'reussi' ? 2 : 1,
      }
      if (grimpeurConnecte && grimpeur.id === grimpeurConnecte.id) {
        // Affiche tout de suite (meme remplacement que la base va faire),
        // puis relit la base si elle refuse, pour ne pas montrer un envoi
        // qui n'existe pas.
        setErreurEnvoi(null)
        const remplacer = (d: Dataset): Dataset => ({
          ...d,
          ascensions: [
            ...d.ascensions.filter((a) => !(a.grimpeurId === grimpeur.id && a.blocId === blocId)),
            ascension,
          ].sort((a, b) => a.t - b.t),
        })
        setDatasetBase((d) => (d ? remplacer(d) : d))
        void supabase.rpc('enregistrer_envoi', { bloc: blocId, type }).then(({ error }) => {
          if (error) {
            setErreurEnvoi(error.message)
            recharger()
          }
        })
        return 'ok'
      }
      setAscensionsAjoutees((actuel) => {
        // Un nouveau clic sur ce bloc pour ce grimpeur remplace le precedent
        // (pas les ascensions du fichier, immuables) : se corriger ou changer
        // d'avis se fait en cliquant simplement le bon bouton, sans etape
        // d'annulation separee.
        const idx = actuel.findIndex((a) => a.grimpeurId === grimpeur.id && a.blocId === blocId)
        const suivant =
          idx === -1 ? [...actuel, ascension] : [...actuel.slice(0, idx), ascension, ...actuel.slice(idx + 1)]
        ascensionsLocales.ecrire(suivant)
        return suivant
      })
      return 'ok'
    },
    [datasetBase, grimpeurConnecte, recharger]
  )

  const envoisConnus = useCallback(
    (grimpeurNom: string): Map<string, StatutEnvoi> => {
      const nom = grimpeurNom.trim().toLowerCase()
      const carte = new Map<string, StatutEnvoi>()
      const grimpeur = nom ? dataset?.grimpeurs.find((g) => g.nom.trim().toLowerCase() === nom) : undefined
      if (!grimpeur || !dataset) return carte
      // Le plus recent l'emporte (pas le "meilleur") : `dataset.ascensions`
      // est trie chronologiquement, donc ecrire par-dessus a chaque passage
      // suffit. Un nouvel envoi tape sur la Carte est toujours plus recent
      // que l'historique du fichier, donc change toujours le statut affiche
      // — dans n'importe quel sens (flash -> echec compris) : une correction
      // ou un vrai changement d'avis doit pouvoir se faire a tout moment,
      // pas seulement pour ameliorer le statut.
      for (const a of dataset.ascensions) {
        if (a.grimpeurId !== grimpeur.id) continue
        carte.set(a.blocId, a.resultat === 'echec' ? 'echec' : a.essais === 1 ? 'flash' : 'reussi')
      }
      return carte
    },
    [dataset]
  )

  const formule = formuleParId(formuleId) ?? FORMULE_PAR_DEFAUT
  const params = parFormule[formule.id] ?? paramsParDefaut(formule.params)

  const resultats = useMemo(() => {
    const parId = new Map<string, Resultat>()
    if (!dataset) return parId
    try {
      for (const f of FORMULES) {
        parId.set(f.id, executerMemo(dataset, f, parFormule[f.id] ?? paramsParDefaut(f.params), paramsCalibrage))
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    }
    return parId
  }, [dataset, parFormule, paramsCalibrage])

  const resultat = resultats.get(formule.id) ?? null

  const setParam = useCallback(
    (nom: string, v: number | boolean | string) => {
      setParFormule((etat) => ({ ...etat, [formule.id]: { ...etat[formule.id], [nom]: v } }))
    },
    [formule.id]
  )

  const setParamCalibrage = useCallback((nom: string, v: number | boolean | string) => {
    setParamsCalibrage((p) => ({ ...p, [nom]: v }))
  }, [])

  const reinitialiser = useCallback(() => {
    setParFormule((etat) => ({ ...etat, [formule.id]: paramsParDefaut(formule.params) }))
    setParamsCalibrage(paramsParDefaut(PARAMS_CALIBRAGE))
  }, [formule])

  const memoriser = useCallback(() => {
    if (resultat) setReference({ resultat, etiquette: resultat.formuleLabel })
  }, [resultat])

  return {
    dataset,
    chargement: !dataset && !erreur,
    erreur,
    echelle,
    recharger,
    erreurEnvoi,
    enregistrerAscension,
    envoisConnus,
    formules: FORMULES,
    formule,
    choisirFormule: setFormuleId,
    params,
    setParam,
    paramsCalibrage,
    setParamCalibrage,
    reinitialiser,
    resultat,
    resultats,
    reference,
    memoriser,
    oublier: () => setReference(null),
  }
}

/** Reduit une serie a `max` points en conservant le premier et le dernier. */
export function echantillonner<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  const pas = (points.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => points[Math.round(i * pas)])
}
