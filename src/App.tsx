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

export function App() {
  const atelier = useAtelier()
  const accesComplet = useAccesComplet()
  const [apercuVisiteur, setApercuVisiteur] = useState(false)
  const vueComplete = accesComplet && !apercuVisiteur
  const onglets = ONGLETS.filter((o) => vueComplete || !o.reserve)
  const [onglet, setOnglet] = useState<OngletId>('blocs')
  const [theme, setTheme] = useState<'auto' | 'clair' | 'sombre'>('auto')

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
        {atelier.erreur && (
          <div className="large">
            <div className="carte" style={{ borderColor: 'var(--critique)' }}>
              <h2>Le chargement a echoue</h2>
              <p className="sous-titre">{atelier.erreur}</p>
            </div>
          </div>
        )}

        {atelier.chargement && <p className="vide">Chargement des fichiers...</p>}

        {atelier.dataset && atelier.resultat && (
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
