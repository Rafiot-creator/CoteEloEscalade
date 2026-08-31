import { z } from 'zod'
import { indexDeCotation } from '../cotations'

/**
 * Schemas de ligne. Ils font trois choses a la fois :
 *  - valider (une cotation inconnue est une erreur, pas un NaN silencieux),
 *  - convertir (tout arrive en `string` depuis un CSV),
 *  - renommer vers le vocabulaire du domaine (`gym_principal` -> `gymPrincipal`).
 *
 * Consequence : apres cette couche, plus personne ne manipule de `string`
 * douteuse. Le reste du code peut faire confiance a ses types.
 */

const texte = z.string().trim().min(1, 'valeur vide')
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format AAAA-MM-JJ')

export const schemaGrimpeur = z
  .object({
    id: texte,
    nom: texte,
    sexe: z.enum(['F', 'M', 'X'], { errorMap: () => ({ message: 'sexe attendu : F, M ou X' }) }),
    gym_principal: z.string().trim().default(''),
    premiere_saison: z.coerce.number().int().min(1900).max(2100),
    // Facultatif : beaucoup de salles ne demandent rien a l'inscription.
    niveau_declare: z.union([z.string().trim(), z.number()]).optional().default(''),
  })
  .transform((r) => ({
    id: r.id,
    nom: r.nom,
    sexe: r.sexe,
    gymPrincipal: r.gym_principal,
    premiereSaison: r.premiere_saison,
    niveauDeclare: r.niveau_declare === '' ? null : indexDeCotation(String(r.niveau_declare)),
  }))

export const schemaBloc = z
  .object({
    id: texte,
    nom: texte,
    gym: texte,
    secteur: z.string().trim().default(''),
    couleur: z.string().trim().default(''),
    cotation_officielle: texte.refine((c) => indexDeCotation(c) !== null, {
      message: 'cotation hors echelle V (V0 a V12)',
    }),
    date_ouverture: dateIso.optional().default('1970-01-01'),
    // Un bloc encore en place n'a pas de date de retrait.
    date_retrait: z.union([dateIso, z.literal('')]).optional().default(''),
  })
  .transform((r) => ({
    id: r.id,
    nom: r.nom,
    gym: r.gym,
    secteur: r.secteur,
    couleur: r.couleur,
    cotationOfficielle: r.cotation_officielle,
    indexOfficiel: indexDeCotation(r.cotation_officielle) as number,
    dateOuverture: r.date_ouverture,
    dateRetrait: r.date_retrait === '' ? null : r.date_retrait,
  }))

export const schemaAscension = z
  .object({
    date: dateIso,
    grimpeur_id: texte,
    bloc_id: texte,
    resultat: z.enum(['reussite', 'echec'], {
      errorMap: () => ({ message: 'resultat attendu : reussite ou echec' }),
    }),
    // Note par les salles, ignore par les formules (cf. types.ts).
    essais: z.coerce.number().int().min(1).max(999).optional().default(1),
  })
  .transform((r) => ({
    date: r.date,
    t: Date.parse(r.date + 'T12:00:00Z'),
    grimpeurId: r.grimpeur_id,
    blocId: r.bloc_id,
    resultat: r.resultat,
    essais: r.essais,
  }))
