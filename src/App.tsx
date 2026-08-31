import { useEffect, useState } from 'react'
import { useAtelier } from './ui/etat'
import { VueDonnees } from './ui/views/VueDonnees'
import { VueFichiers } from './ui/views/VueFichiers'
import { VueFormules } from './ui/views/VueFormules'
import { VueGrimpeurs } from './ui/views/VueGrimpeurs'
import { VueBlocs } from './ui/views/VueBlocs'

const ONGLETS = [
  { id: 'blocs', label: 'Blocs' },
  { id: 'grimpeurs', label: 'Grimpeurs' },
  { id: 'formules', label: 'Formules' },
  { id: 'donnees', label: 'Donnees' },
  { id: 'fichiers', label: 'Fichiers' },
] as const

type OngletId = (typeof ONGLETS)[number]['id']

export function App() {
  const atelier = useAtelier()
  const [onglet, setOnglet] = useState<OngletId>('blocs')
  const [theme, setTheme] = useState<'auto' | 'clair' | 'sombre'>('auto')

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
          {ONGLETS.map((o) => (
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
            {onglet === 'blocs' && <VueBlocs resultat={atelier.resultat} />}
            {onglet === 'grimpeurs' && <VueGrimpeurs resultat={atelier.resultat} />}
            {onglet === 'formules' && <VueFormules atelier={atelier} />}
            {onglet === 'donnees' && <VueDonnees dataset={atelier.dataset} />}
            {onglet === 'fichiers' && <VueFichiers dataset={atelier.dataset} />}
          </>
        )}
      </main>
    </div>
  )
}
