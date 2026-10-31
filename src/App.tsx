import { useEffect, useState } from 'react'
import { useAccesComplet } from './ui/acces'
import { useCompte } from './ui/compte'
import { PanneauCompte, libelleCompte } from './ui/components/compte'
import { useAtelier } from './ui/etat'
import { LangueProvider, useLangue } from './ui/langue'
import { VueCarte } from './ui/views/VueCarte'
import { VueDonnees } from './ui/views/VueDonnees'
import { VueFichiers } from './ui/views/VueFichiers'
import { VueFormules } from './ui/views/VueFormules'
import { VueGrimpeurs } from './ui/views/VueGrimpeurs'
import { VueAdministration } from './ui/views/VueAdministration'
import { VueCommentaires } from './ui/views/VueCommentaires'
import { VueBlocs } from './ui/views/VueBlocs'

const ONGLETS = [
  { id: 'blocs', fr: 'Blocs', en: 'Boulders', reserve: false },
  { id: 'grimpeurs', fr: 'Grimpeurs', en: 'Climbers', reserve: false },
  { id: 'carte', fr: 'Carte', en: 'Map', reserve: false },
  { id: 'formules', fr: 'Formules', en: 'Formulas', reserve: true },
  { id: 'donnees', fr: 'Données', en: 'Data', reserve: true },
  { id: 'fichiers', fr: 'Fichiers', en: 'Files', reserve: true },
  { id: 'commentaires', fr: 'Commentaires', en: 'Feedback', reserve: false },
  // Compte admin general seulement (`compte.estAdmin`), independant de l'acces complet.
  { id: 'administration', fr: 'Administration', en: 'Admin', reserve: 'admin' },
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
// Centres dont les blocs et les envois sont branches sur le calcul (Blocs,
// Grimpeurs, envois depuis la Carte), par groupe calcule ensemble : un grimpeur
// a une cote par groupe. Rose Bloc 1 et 2 partagent la leur (choix de Raphael,
// 2026-10-30) ; pour relier de futurs centres entre eux, voir les pistes du
// README, « uniformiser les cotes entre centres ». Les autres centres n'ont que
// leur carte.
const GROUPES_CALCUL: CentreId[][] = [['demo'], ['rose-bloc-1', 'rose-bloc-2']]

export function App() {
  return (
    <LangueProvider>
      <Contenu />
    </LangueProvider>
  )
}

function Contenu() {
  const compte = useCompte()
  const [centreId, setCentreId] = useState<CentreId>('demo')
  const groupeCalcul = GROUPES_CALCUL.find((g) => g.includes(centreId))
  const donneesBranchees = !!groupeCalcul
  const atelier = useAtelier(compte.grimpeur, groupeCalcul ?? [centreId])
  const [panneauCompte, setPanneauCompte] = useState(false)
  // Retour du lien du courriel, premiere connexion : il manque le pseudonyme.
  // Ou retour du lien « mot de passe oublie » : il manque le nouveau mot de passe.
  const sansPseudo = compte.pret && !!compte.courriel && !compte.grimpeur
  useEffect(() => {
    if (sansPseudo || compte.recuperation) setPanneauCompte(true)
  }, [sansPseudo, compte.recuperation])
  const accesComplet = useAccesComplet()
  const { langue, definir, t } = useLangue()
  const [apercuVisiteur, setApercuVisiteur] = useState(false)
  const vueComplete = accesComplet && !apercuVisiteur
  const ongletVisible = (o: (typeof ONGLETS)[number]) =>
    o.reserve === 'admin' ? compte.estAdmin && !apercuVisiteur : vueComplete || !o.reserve
  const onglets = ONGLETS.filter(ongletVisible)
  const [onglet, setOnglet] = useState<OngletId>('blocs')
  // Onglets qui ne montrent pas le calcul du centre choisi.
  const horsCalcul = onglet === 'carte' || onglet === 'administration' || onglet === 'commentaires'
  const [theme, setTheme] = useState<'auto' | 'clair' | 'sombre'>('auto')
  const centre = CENTRES.find((c) => c.id === centreId) ?? CENTRES[0]
  const [blocCible, setBlocCible] = useState<string | null>(null)
  const voirBlocSurCarte = (blocId: string) => {
    setOnglet('carte')
    setBlocCible(blocId)
  }

  useEffect(() => {
    const courant = ONGLETS.find((o) => o.id === onglet)
    if (courant && !ongletVisible(courant)) setOnglet('blocs')
  }, [vueComplete, onglet, compte.estAdmin, apercuVisiteur])

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
          {compte.pret && (
            <button
              title={t('Compte et connexion', 'Account and sign-in')}
              className={compte.grimpeur ? undefined : 'appel-compte'}
              onClick={() => setPanneauCompte((v) => !v)}
            >
              {libelleCompte(compte, t)}
            </button>
          )}
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
        {panneauCompte && (
          <PanneauCompte
            compte={compte}
            apresProfil={() => {
              atelier.recharger()
              setPanneauCompte(false)
            }}
          />
        )}

        {onglet === 'administration' && <VueAdministration apresModification={atelier.recharger} />}

        {onglet === 'commentaires' && <VueCommentaires centre={centre.fr} pseudo={compte.grimpeur?.nom ?? null} />}

        {onglet === 'carte' && (
          <VueCarte
            centreId={centreId}
            accesComplet={vueComplete}
            // L'apercu visiteur montre aussi la carte sans les outils d'ouvreur.
            ouvreur={compte.peutOuvrir(centreId) && !apercuVisiteur}
            apresModification={donneesBranchees ? atelier.recharger : undefined}
            resultatMelange={atelier.resultats.get('melange')}
            // Sans les grimpeurs en periode d'essai : leur pseudonyme reste cache
            // tant que leur cote n'est pas stable (cf. `LigneGrimpeur.provisoire`).
            grimpeurs={
              donneesBranchees
                ? atelier.resultats.get('melange')?.grimpeurs.filter((g) => !g.provisoire).map((g) => g.nom)
                : undefined
            }
            enregistrerAscension={donneesBranchees ? atelier.enregistrerAscension : undefined}
            envoisConnus={donneesBranchees ? atelier.envoisConnus : undefined}
            blocCible={blocCible}
            grimpeurConnecte={donneesBranchees ? compte.grimpeur?.nom : undefined}
            erreurEnvoi={atelier.erreurEnvoi}
          />
        )}

        {!horsCalcul && !donneesBranchees && (
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

        {!horsCalcul && donneesBranchees && atelier.erreur && (
          <div className="large">
            <div className="carte" style={{ borderColor: 'var(--critique)' }}>
              <h2>{t('Le chargement a échoué', 'Loading failed')}</h2>
              <p className="sous-titre">{atelier.erreur}</p>
            </div>
          </div>
        )}

        {!horsCalcul && donneesBranchees && atelier.chargement && (
          <p className="vide">{t('Chargement des fichiers…', 'Loading files…')}</p>
        )}

        {!horsCalcul && donneesBranchees && atelier.dataset && atelier.resultat && (
          <>
            {onglet === 'blocs' && (
              <VueBlocs
                resultat={atelier.resultat}
                resultats={atelier.resultats}
                simplifie={!vueComplete}
                onVoirBlocSurCarte={voirBlocSurCarte}
                echelle={atelier.echelle}
                salleParDefaut={centre.fr}
                key={centreId}
              />
            )}
            {onglet === 'grimpeurs' && (
              <VueGrimpeurs
                resultat={atelier.resultat}
                resultats={atelier.resultats}
                simplifie={!vueComplete}
                moi={compte.grimpeur?.id}
              />
            )}
            {onglet === 'formules' && <VueFormules atelier={atelier} onVoirBlocSurCarte={voirBlocSurCarte} />}
            {onglet === 'donnees' && <VueDonnees dataset={atelier.dataset} onVoirBlocSurCarte={voirBlocSurCarte} />}
            {onglet === 'fichiers' && <VueFichiers dataset={atelier.dataset} />}
          </>
        )}
      </main>
    </div>
  )
}
