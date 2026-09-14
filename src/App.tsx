import { useEffect, useState } from 'react'
import { useAccesComplet } from './ui/acces'
import { useAtelier } from './ui/etat'
import { VueDonnees } from './ui/views/VueDonnees'
import { VueFichiers } from './ui/views/VueFichiers'
import { VueFormules } from './ui/views/VueFormules'
import { VueGrimpeurs } from './ui/views/VueGrimpeurs'
import { VueBlocs } from './ui/views/VueBlocs'

const ONGLETS = [
  { id: 'blocs', label: 'Blocs', reserve: false },
  { id: 'grimpeurs', label: 'Grimpeurs', reserve: false },
  { id: 'formules', label: 'Formules', reserve: true },
  { id: 'donnees', label: 'Donnees', reserve: true },
  { id: 'fichiers', label: 'Fichiers', reserve: true },
] as const

type OngletId = (typeof ONGLETS)[number]['id']

// En ordre alphabetique par nom de centre ; le jeu de demonstration est a part.
const CENTRES = [
  { id: 'demo', label: 'Demo (jeu de test)' },
  { id: 'bloc-shop-chabanel', label: 'Bloc Shop Chabanel' },
  { id: 'bloc-shop-hochelaga', label: 'Bloc Shop Hochelaga' },
  { id: 'bloc-shop-mile-end', label: 'Bloc Shop Mile-End' },
  { id: 'le-mouv', label: "Le Mouv'" },
  { id: 'rose-bloc-1', label: 'Rose Bloc 1' },
  { id: 'rose-bloc-2', label: 'Rose Bloc 2' },
] as const

type CentreId = (typeof CENTRES)[number]['id']

export function App() {
  const atelier = useAtelier()
  const accesComplet = useAccesComplet()
  const [apercuVisiteur, setApercuVisiteur] = useState(false)
  const vueComplete = accesComplet && !apercuVisiteur
  const onglets = ONGLETS.filter((o) => vueComplete || !o.reserve)
  const [onglet, setOnglet] = useState<OngletId>('blocs')
  const [theme, setTheme] = useState<'auto' | 'clair' | 'sombre'>('auto')
  const [centreId, setCentreId] = useState<CentreId>('demo')
  const centre = CENTRES.find((c) => c.id === centreId) ?? CENTRES[0]

  useEffect(() => {
    const courant = ONGLETS.find((o) => o.id === onglet)
    if (courant?.reserve && !vueComplete) setOnglet('blocs')
  }, [vueComplete, onglet])

  useEffect(() => {
    const racine = document.documentElement
    if (theme === 'auto') racine.removeAttribute('data-theme')
    else racine.setAttribute('data-theme', theme === 'clair' ? 'light' : 'dark')
  }, [theme])

  return (
    <div className="appli">
      <header className="entete">
        <div className="marque">
          <h1>Cote Elo Escalade</h1>
          <small>cotation des blocs calculee a partir des reussites et des echecs</small>
        </div>
        <nav className="nav">
          <select
            value={centreId}
            onChange={(e) => setCentreId(e.currentTarget.value as CentreId)}
            title="Centre d'escalade"
            style={{ width: 190 }}
          >
            {CENTRES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {onglets.map((o) => (
            <button
              key={o.id}
              aria-current={onglet === o.id ? 'page' : undefined}
              onClick={() => setOnglet(o.id)}
            >
              {o.label}
            </button>
          ))}
          <button
            title="Theme clair, sombre ou celui du systeme"
            onClick={() => setTheme((t) => (t === 'auto' ? 'clair' : t === 'clair' ? 'sombre' : 'auto'))}
          >
            {theme === 'auto' ? 'Auto' : theme === 'clair' ? 'Clair' : 'Sombre'}
          </button>
          {accesComplet && (
            <button
              title="Voir l'interface telle qu'un visiteur sans acces complet la voit, sans perdre ton deverrouillage"
              onClick={() => setApercuVisiteur((v) => !v)}
            >
              {apercuVisiteur ? 'Vue visiteur' : 'Vue complete'}
            </button>
          )}
        </nav>
      </header>

      <main className="contenu">
        {centre.id !== 'demo' && (
          <div className="large">
            <div className="carte">
              <h2>Pas encore de donnees pour {centre.label}</h2>
              <p className="sous-titre">
                Ce centre n'a pas encore de jeu de donnees connecte. Choisissez « Demo (jeu de
                test) » dans le menu pour voir le site fonctionner sur le jeu de demonstration.
              </p>
            </div>
          </div>
        )}

        {centre.id === 'demo' && atelier.erreur && (
          <div className="large">
            <div className="carte" style={{ borderColor: 'var(--critique)' }}>
              <h2>Le chargement a echoue</h2>
              <p className="sous-titre">{atelier.erreur}</p>
            </div>
          </div>
        )}

        {centre.id === 'demo' && atelier.chargement && <p className="vide">Chargement des fichiers...</p>}

        {centre.id === 'demo' && atelier.dataset && atelier.resultat && (
          <>
            {onglet === 'blocs' && <VueBlocs resultat={atelier.resultat} resultats={atelier.resultats} />}
            {onglet === 'grimpeurs' && <VueGrimpeurs resultat={atelier.resultat} resultats={atelier.resultats} />}
            {onglet === 'formules' && <VueFormules atelier={atelier} />}
            {onglet === 'donnees' && <VueDonnees dataset={atelier.dataset} />}
            {onglet === 'fichiers' && <VueFichiers dataset={atelier.dataset} />}
          </>
        )}
      </main>
    </div>
  )
}
