import Papa from 'papaparse'
import { z } from 'zod'
import type { Anomalie, FichierBrut } from '../types'

export interface LectureCsv<T> {
  lignes: T[]
  anomalies: Anomalie[]
  lignesLues: number
  /** En-tetes reellement presentes dans le fichier, dans l'ordre. */
  colonnes: string[]
}

/**
 * Lit un CSV et valide chaque ligne contre un schema zod.
 *
 * Contrat : une ligne invalide n'interrompt jamais le chargement. Elle est
 * ecartee et signalee dans `anomalies` — l'ecran Fichiers les affiche.
 * Un jeu de donnees a moitie sale doit rester exploitable.
 */
export function lireCsv<S extends z.ZodType>(fichier: FichierBrut, schema: S): LectureCsv<z.infer<S>> {
  const anomalies: Anomalie[] = []
  const resultat = Papa.parse<Record<string, string>>(fichier.contenu, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  for (const err of resultat.errors) {
    anomalies.push({
      fichier: fichier.chemin,
      ligne: typeof err.row === 'number' ? err.row + 2 : null,
      champ: null,
      message: `CSV mal forme : ${err.message}`,
      gravite: 'erreur',
    })
  }

  const lignes: z.infer<S>[] = []
  resultat.data.forEach((brut, i) => {
    const parsed = schema.safeParse(brut)
    if (parsed.success) {
      lignes.push(parsed.data)
      return
    }
    for (const issue of parsed.error.issues) {
      anomalies.push({
        fichier: fichier.chemin,
        ligne: i + 2, // +1 pour l'en-tete, +1 pour passer en base 1
        champ: issue.path.join('.') || null,
        message: issue.message,
        gravite: 'erreur',
      })
    }
  })

  return {
    lignes,
    anomalies,
    lignesLues: resultat.data.length,
    colonnes: resultat.meta.fields ?? [],
  }
}

/** Parse un CSV sans validation — pour l'apercu brut de l'ecran Fichiers. */
export function apercuCsv(fichier: FichierBrut, maxLignes = 200): { colonnes: string[]; lignes: string[][] } {
  const r = Papa.parse<string[]>(fichier.contenu, { skipEmptyLines: 'greedy', preview: maxLignes + 1 })
  const [entete, ...reste] = r.data
  return { colonnes: entete ?? [], lignes: reste }
}

/** Serialise des objets en CSV (export depuis l'interface). */
export function versCsv(lignes: Record<string, unknown>[]): string {
  return Papa.unparse(lignes, { newline: '\n' })
}
