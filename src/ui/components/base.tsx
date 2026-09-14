import { useState, type ReactNode } from 'react'
import type { ParamSpec, Params } from '../../core/formulas/types'
import { nombre } from '../format'
import { bilingue, useLangue } from '../langue'

export function Carte({
  titre,
  sousTitre,
  actions,
  children,
}: {
  titre?: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="carte">
      {(titre || actions) && (
        <header className="carte-entete">
          <div className="titre">
            {titre && <h2>{titre}</h2>}
            {sousTitre && <p className="sous-titre">{sousTitre}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function Tuile({
  etiquette,
  valeur,
  unite,
  note,
  heros,
}: {
  etiquette: string
  valeur: ReactNode
  unite?: string
  note?: ReactNode
  heros?: boolean
}) {
  return (
    <div className={heros ? 'tuile heros' : 'tuile'}>
      <div className="etiquette">{etiquette}</div>
      <div className="valeur">
        {valeur}
        {unite && <span className="unite">{unite}</span>}
      </div>
      {note && (
        <div className="note" title={typeof note === 'string' ? note : undefined}>
          {note}
        </div>
      )}
    </div>
  )
}

/**
 * Rendu d'un parametre a partir de sa seule declaration.
 *
 * C'est la piece qui fait que "deposer un fichier de formule" suffit : aucune
 * formule n'ecrit d'interface, elle decrit ses parametres et cette fonction
 * s'occupe du reste.
 */
export function ControleParam({
  spec,
  valeur,
  onChange,
}: {
  spec: ParamSpec
  valeur: number | boolean | string
  onChange: (v: number | boolean | string) => void
}) {
  const [aideOuverte, setAideOuverte] = useState(false)
  const { langue, t } = useLangue()
  const unite = bilingue(spec.type === 'nombre' ? spec.unite : undefined, spec.type === 'nombre' ? spec.uniteEn : undefined, langue)
  const aide = bilingue(spec.aide, spec.aideEn, langue)

  return (
    <div className="param">
      <div className="param-tete">
        <label htmlFor={`p-${spec.nom}`}>{bilingue(spec.label, spec.labelEn, langue)}</label>
        {spec.type === 'nombre' && (
          <span className="param-valeur">
            {nombre(valeur as number, (spec.pas ?? 1) < 1 ? 2 : 0)}
            {unite ? ` ${unite}` : ''}
          </span>
        )}
        {aide && (
          <button
            className="bouton discret"
            aria-expanded={aideOuverte}
            title={t('A quoi sert ce réglage', 'What this setting does')}
            onClick={() => setAideOuverte((v) => !v)}
          >
            ?
          </button>
        )}
        {spec.type === 'booleen' && (
          <input
            id={`p-${spec.nom}`}
            type="checkbox"
            checked={valeur as boolean}
            onChange={(e) => onChange(e.currentTarget.checked)}
          />
        )}
      </div>

      {spec.type === 'nombre' && (
        <input
          id={`p-${spec.nom}`}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.pas}
          value={valeur as number}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
        />
      )}

      {spec.type === 'choix' && (
        <select id={`p-${spec.nom}`} value={valeur as string} onChange={(e) => onChange(e.currentTarget.value)}>
          {spec.options.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {bilingue(o.label, o.labelEn, langue)}
            </option>
          ))}
        </select>
      )}

      {aideOuverte && aide && <p className="param-aide">{aide}</p>}
    </div>
  )
}

/** Panneau de reglages, groupe par sections declarees dans les specs. */
export function PanneauParams({
  specs,
  valeurs,
  onChange,
}: {
  specs: ParamSpec[]
  valeurs: Params
  onChange: (nom: string, v: number | boolean | string) => void
}) {
  const { langue } = useLangue()
  const groupes = new Map<string, ParamSpec[]>()
  for (const s of specs) {
    const g = s.groupe ?? ''
    if (!groupes.has(g)) groupes.set(g, [])
    groupes.get(g)!.push(s)
  }

  return (
    <>
      {[...groupes].map(([groupe, membres]) => (
        <div key={groupe}>
          {groupe && <h3 className="groupe-titre">{bilingue(groupe, membres[0].groupeEn, langue)}</h3>}
          {membres.map((s) => (
            <ControleParam key={s.nom} spec={s} valeur={valeurs[s.nom] ?? s.defaut} onChange={(v) => onChange(s.nom, v)} />
          ))}
        </div>
      ))}
    </>
  )
}
