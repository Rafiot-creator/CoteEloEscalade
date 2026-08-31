import { useCallback, useEffect, useMemo, useState } from 'react'
import { PARAMS_CALIBRAGE } from '../core/calibrage'
import { FORMULES, FORMULE_PAR_DEFAUT, formuleParId } from '../core/formulas/registry'
import { paramsParDefaut, type Formule, type Params } from '../core/formulas/types'
import { construireDataset } from '../core/loaders/dataset'
import { executerMemo, type Resultat } from '../core/pipeline'
import { chargerToutesLesSources } from '../core/sources'
import type { Dataset } from '../core/types'

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
  chargement: boolean
  erreur: string | null

  formules: Formule[]
  formule: Formule
  choisirFormule: (id: string) => void

  params: Params
  setParam: (nom: string, v: number | boolean | string) => void
  paramsCalibrage: Params
  setParamCalibrage: (nom: string, v: number | boolean | string) => void
  reinitialiser: () => void

  resultat: Resultat | null

  /** Resultat mis de cote pour comparer deux reglages. */
  reference: { resultat: Resultat; etiquette: string } | null
  memoriser: () => void
  oublier: () => void
}

export function useAtelier(): Atelier {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const [formuleId, setFormuleId] = useState(FORMULE_PAR_DEFAUT.id)
  const [parFormule, setParFormule] = useState<Record<string, Params>>(() =>
    Object.fromEntries(FORMULES.map((f) => [f.id, paramsParDefaut(f.params)]))
  )
  const [paramsCalibrage, setParamsCalibrage] = useState<Params>(() => paramsParDefaut(PARAMS_CALIBRAGE))
  const [reference, setReference] = useState<{ resultat: Resultat; etiquette: string } | null>(null)

  useEffect(() => {
    let vivant = true
    chargerToutesLesSources()
      .then((fichiers) => {
        if (vivant) setDataset(construireDataset(fichiers))
      })
      .catch((e: unknown) => {
        if (vivant) setErreur(e instanceof Error ? e.message : String(e))
      })
    return () => {
      vivant = false
    }
  }, [])

  const formule = formuleParId(formuleId) ?? FORMULE_PAR_DEFAUT
  const params = parFormule[formule.id] ?? paramsParDefaut(formule.params)

  const resultat = useMemo(() => {
    if (!dataset) return null
    try {
      return executerMemo(dataset, formule, params, paramsCalibrage)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [dataset, formule, params, paramsCalibrage])

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
    formules: FORMULES,
    formule,
    choisirFormule: setFormuleId,
    params,
    setParam,
    paramsCalibrage,
    setParamCalibrage,
    reinitialiser,
    resultat,
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
