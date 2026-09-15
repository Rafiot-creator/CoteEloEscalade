import { useEffect, useState } from 'react'
import { useAccesComplet } from './ui/acces'
import { useAtelier } from './ui/etat'
import { LangueProvider, useLangue } from './ui/langue'
import { VueCarte } from './ui/views/VueCarte'
import { VueDonnees } from './ui/views/VueDonnees'
import { VueFichiers } from './ui/views/VueFichiers'
import { VueFormules } from './ui/views/VueFormules'
import { VueGrimpeurs } from './ui/views/VueGrimpeurs'
import { VueBlocs } from './ui/views/VueBlocs'

const ONGLETS = [
  { id: 'blocs', fr: 'Blocs', en: 'Boulders', reserve: false },
  { id: 'grimpeurs', fr: 'Grimpeurs', en: 'Climbers', reserve: false },
  { id: 'carte', fr: 'Carte', en: 'Map', reserve: false },
  { id: 'formules', fr: 'Formules', en: 'Formulas', reserve: true },
  { id: 'donnees', fr: 'Données', en: 'Data', reserve: true },
  { id: 'fichiers', fr: 'Fichiers', en: 'Files', reserve: true },
] as const

type OngletId = (typeof ONGLETS)[number]['id']

// En ordre alphabetique par nom de centre ; le jeu de demonstration est a part.
const CENTRES = [
  { id: 'demo', fr: 'Démo (jeu de test)', en: 'Demo (test dataset)' },
  { id: 'bloc-shop-chabanel', fr: 'Bloc Shop Chabanel', en: 'Bloc Shop Chabanel' },
  { id: 'bloc-shop-hochelaga', fr: 'Bloc Shop Hochelaga', en: 'Bloc Shop Hochelaga' },
  { id: 'bloc-shop-mile-end', fr: 'Bloc Shop Mile-End', en: 'Bloc Shop Mile-End' },
  { id: 'le-mouv', fr: "Le Mouv'", en: "Le Mouv'" },
  { id: 'rose-bloc-1', fr: 'Rose Bloc 1', en: 'Rose Bloc 1' },
  { id: 'rose-bloc-2', fr: 'Rose Bloc 2', en: 'Rose Bloc 2' },
] as const

type CentreId = (typeof CENTRES)[number]['id']

export function App() {
  return (
    <LangueProvider>
      <Contenu />
    </LangueProvider>
  )
}

function Contenu() {
  const atelier = useAtelier()
  const accesComplet = useAccesComplet()
  const { langue, definir, t } = useLangue()
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

  useEffect(() => {
    document.documentElement.lang = langue
  }, [langue])

  return (
    <div className="appli">
      <header className="entete">
        <div className="marque">
          <h1>Cote Elo Escalade</h1>
          <small>{t('cotation des blocs calculée à partir des réussites et des échecs', 'boulder grades calculated from sends and failed attempts')}</small>
        </div>
        <nav className="nav">
          <select
            value={centreId}
            onChange={(e) => setCentreId(e.currentTarget.value as CentreId)}
            title={t("Centre d'escalade", 'Climbing gym')}
            style={{ width: 190 }}
          >
            {CENTRES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.fr, c.en)}
              </option>
            ))}
          </select>
          {onglets.map((o) => (
            <button
              key={o.id}
              aria-current={onglet === o.id ? 'page' : undefined}
              onClick={() => setOnglet(o.id)}
            >
              {t(o.fr, o.en)}
            </button>
          ))}
          <button
            title={t('Thème clair, sombre ou celui du système', 'Light theme, dark, or match system')}
            onClick={() => setTheme((th) => (th === 'auto' ? 'clair' : th === 'clair' ? 'sombre' : 'auto'))}
          >
            {theme === 'auto' ? 'Auto' : t(theme === 'clair' ? 'Clair' : 'Sombre', theme === 'clair' ? 'Light' : 'Dark')}
          </button>
          <button
            title={t('Passer la langue du site en anglais', 'Switch the site language to French')}
            onClick={() => definir(langue === 'fr' ? 'en' : 'fr')}
          >
            {langue === 'fr' ? 'EN' : 'FR'}
          </button>
          {accesComplet && (
            <button
              title={t(
                "Voir l'interface telle qu'un visiteur sans accès complet la voit, sans perdre ton déverrouillage",
                'Preview the interface as a visitor without full access sees it, without losing your unlock'
              )}
              onClick={() => setApercuVisiteur((v) => !v)}
            >
              {apercuVisiteur ? t('Vue visiteur', 'Visitor view') : t('Vue complète', 'Full view')}
            </button>
          )}
        </nav>
      </header>

      <main className="contenu">
        {onglet === 'carte' && (
          <VueCarte
            centreId={centreId}
            accesComplet={vueComplete}
            resultatMelange={atelier.resultats.get('melange')}
            grimpeurs={centreId === 'demo' ? atelier.dataset?.grimpeurs.map((g) => g.nom) : undefined}
            enregistrerAscension={centreId === 'demo' ? atelier.enregistrerAscension : undefined}
            envoisConnus={centreId === 'demo' ? atelier.envoisConnus : undefined}
          />
        )}

        {onglet !== 'carte' && centre.id !== 'demo' && (
          <div className="large">
            <div className="carte">
              <h2>{t(`Pas encore de données pour ${centre.fr}`, `No data yet for ${centre.en}`)}</h2>
              <p className="sous-titre">
                {t(
                  'Ce centre n\'a pas encore de jeu de données connecté. Choisissez « Démo (jeu de test) » dans le menu pour voir le site fonctionner sur le jeu de démonstration.',
                  'This gym doesn\'t have a connected dataset yet. Choose "Demo (test dataset)" from the menu to see the site working on the demo data.'
                )}
              </p>
            </div>
          </div>
        )}

        {onglet !== 'carte' && centre.id === 'demo' && atelier.erreur && (
          <div className="large">
            <div className="carte" style={{ borderColor: 'var(--critique)' }}>
              <h2>{t('Le chargement a échoué', 'Loading failed')}</h2>
              <p className="sous-titre">{atelier.erreur}</p>
            </div>
          </div>
        )}

        {onglet !== 'carte' && centre.id === 'demo' && atelier.chargement && (
          <p className="vide">{t('Chargement des fichiers…', 'Loading files…')}</p>
        )}

        {onglet !== 'carte' && centre.id === 'demo' && atelier.dataset && atelier.resultat && (
          <>
            {onglet === 'blocs' && (
              <VueBlocs resultat={atelier.resultat} resultats={atelier.resultats} simplifie={!vueComplete} />
            )}
            {onglet === 'grimpeurs' && (
              <VueGrimpeurs resultat={atelier.resultat} resultats={atelier.resultats} simplifie={!vueComplete} />
            )}
            {onglet === 'formules' && <VueFormules atelier={atelier} />}
            {onglet === 'donnees' && <VueDonnees dataset={atelier.dataset} />}
            {onglet === 'fichiers' && <VueFichiers dataset={atelier.dataset} />}
          </>
        )}
      </main>
    </div>
  )
}
