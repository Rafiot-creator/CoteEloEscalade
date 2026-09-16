import type { Anomalie, Ascension, Bloc, Dataset, FichierBrut, Grimpeur } from '../types'
import { STYLES_BLOC, estStyleConnu } from '../stylesBloc'
import { lireCsv } from './csv'
import { schemaAscension, schemaBloc, schemaGrimpeur } from './schemas'

/** Au-dela, on resume : une console noyee sous 3 000 lignes rouges n'aide personne. */
const MAX_ANOMALIES_PAR_FICHIER = 40

const FICHIERS_ATTENDUS = ['grimpeurs.csv', 'blocs.csv', 'ascensions.csv'] as const

function trouver(fichiers: FichierBrut[], nom: string): FichierBrut | undefined {
  return fichiers.find((f) => f.nom === nom)
}

function plafonner(anomalies: Anomalie[], fichier: string): Anomalie[] {
  if (anomalies.length <= MAX_ANOMALIES_PAR_FICHIER) return anomalies
  const gardees = anomalies.slice(0, MAX_ANOMALIES_PAR_FICHIER)
  gardees.push({
    fichier,
    ligne: null,
    champ: null,
    message: `... et ${anomalies.length - MAX_ANOMALIES_PAR_FICHIER} autres anomalies non listees`,
    gravite: 'avertissement',
  })
  return gardees
}

/**
 * Assemble le Dataset a partir des fichiers bruts.
 *
 * Etapes : parse -> validation par ligne -> integrite referentielle -> tri.
 * Rien ici ne connait l'Elo ; rien ici ne connait React.
 */
export function construireDataset(fichiers: FichierBrut[]): Dataset {
  const anomalies: Anomalie[] = []
  const lignesLues: Record<string, number> = {}
  const lignesRetenues: Record<string, number> = {}

  for (const attendu of FICHIERS_ATTENDUS) {
    if (!trouver(fichiers, attendu)) {
      anomalies.push({
        fichier: `data/${attendu}`,
        ligne: null,
        champ: null,
        message: 'fichier absent',
        gravite: 'erreur',
      })
    }
  }

  const fGrimpeurs = trouver(fichiers, 'grimpeurs.csv')
  const fBlocs = trouver(fichiers, 'blocs.csv')
  const fAscensions = trouver(fichiers, 'ascensions.csv')

  let grimpeurs: Grimpeur[] = []
  if (fGrimpeurs) {
    const lu = lireCsv(fGrimpeurs, schemaGrimpeur)
    grimpeurs = lu.lignes as Grimpeur[]
    anomalies.push(...plafonner(lu.anomalies, fGrimpeurs.chemin))
    lignesLues[fGrimpeurs.chemin] = lu.lignesLues
  }

  let blocs: Bloc[] = []
  if (fBlocs) {
    const lu = lireCsv(fBlocs, schemaBloc)
    blocs = lu.lignes as Bloc[]
    anomalies.push(...plafonner(lu.anomalies, fBlocs.chemin))
    lignesLues[fBlocs.chemin] = lu.lignesLues
  }

  // Doublons d'identifiant : le dernier gagnerait silencieusement, on le dit.
  const signalerDoublons = (items: { id: string }[], chemin: string) => {
    const vus = new Set<string>()
    for (const it of items) {
      if (vus.has(it.id)) {
        anomalies.push({
          fichier: chemin,
          ligne: null,
          champ: 'id',
          message: `identifiant en double : ${it.id}`,
          gravite: 'avertissement',
        })
      }
      vus.add(it.id)
    }
  }
  if (fGrimpeurs) signalerDoublons(grimpeurs, fGrimpeurs.chemin)
  if (fBlocs) signalerDoublons(blocs, fBlocs.chemin)

  // Style hors vocabulaire controle : n'empeche pas le calcul (la cote
  // globale du bloc n'en depend pas), juste absent de la ventilation par
  // style des grimpeurs (cf. `formulas/definitions/elo-bloc.ts`).
  if (fBlocs) {
    for (const b of blocs) {
      if (b.secteur && !estStyleConnu(b.secteur)) {
        anomalies.push({
          fichier: fBlocs.chemin,
          ligne: null,
          champ: 'secteur',
          message: `style hors vocabulaire controle (${STYLES_BLOC.join(', ')}) : ${b.secteur}`,
          gravite: 'avertissement',
        })
      }
    }
  }

  const grimpeurParId = new Map(grimpeurs.map((g) => [g.id, g]))
  const blocParId = new Map(blocs.map((b) => [b.id, b]))

  let ascensions: Ascension[] = []
  if (fAscensions) {
    const lu = lireCsv(fAscensions, schemaAscension)
    const orphelines: Anomalie[] = []
    ascensions = (lu.lignes as Ascension[]).filter((a) => {
      const gOk = grimpeurParId.has(a.grimpeurId)
      const bOk = blocParId.has(a.blocId)
      if (!gOk || !bOk) {
        orphelines.push({
          fichier: fAscensions.chemin,
          ligne: null,
          champ: gOk ? 'bloc_id' : 'grimpeur_id',
          message: `reference inconnue : ${gOk ? a.blocId : a.grimpeurId} (ligne ecartee)`,
          gravite: 'erreur',
        })
        return false
      }
      return true
    })
    anomalies.push(...plafonner([...lu.anomalies, ...orphelines], fAscensions.chemin))
    lignesLues[fAscensions.chemin] = lu.lignesLues
    // Les formules parcourent l'historique dans l'ordre : on le garantit ici, une fois.
    ascensions.sort((a, b) => a.t - b.t)
  }

  if (fGrimpeurs) lignesRetenues[fGrimpeurs.chemin] = grimpeurs.length
  if (fBlocs) lignesRetenues[fBlocs.chemin] = blocs.length
  if (fAscensions) lignesRetenues[fAscensions.chemin] = ascensions.length

  return {
    grimpeurs,
    blocs,
    ascensions,
    grimpeurParId,
    blocParId,
    fichiers,
    rapport: { anomalies, lignesLues, lignesRetenues },
  }
}
