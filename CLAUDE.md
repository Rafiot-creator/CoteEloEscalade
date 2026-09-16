# CoteEloEscalade — contexte pour Claude Code

## Le projet en une phrase

Site statique React/TypeScript qui recalcule la difficulté de blocs d'escalade (cotation V) à
partir des ascensions réussies/échouées (système type Elo/Glicko), pour comparer la cote
calculée à celle de l'ouvreur et détecter les blocs mal cotés.

**Avant toute question sur le modèle, les formules ou les choix de conception : lire
`README.md` (description fonctionnelle) et `DECISIONS.md` (le pourquoi, les pistes essayées et
rejetées). Ne pas ré-expliquer ce qui y est déjà écrit.**

## Origine et dépôt

- Projet démarré avec un ami sur une session Claude Code précédente, sur une autre machine.
- Le dépôt de travail cloné ici : `https://github.com/Rafiot-creator/CoteEloEscalade` — c'est
  la copie propre de Raphael (pas un fork Git rattaché à l'original, une copie indépendante).
- Le README pointait par erreur vers le déploiement GitHub Pages de l'ami
  (`EricPrieur/CoteEloEscalade`) ; corrigé le 2026-09-14 pour pointer vers
  `Rafiot-creator/CoteEloEscalade` / `https://rafiot-creator.github.io/CoteEloEscalade/`.
  GitHub Pages est bien activé sur ce dépôt (confirmé par Raphael le 2026-09-14) ; le
  déploiement automatique (`.github/workflows/deploy.yml`) fonctionne, vérifié via l'API
  GitHub Actions après chaque push de la session.

## Environnement (machine Windows de Raphael)

- Ni Git ni Node.js n'étaient installés au départ ; les deux ont été installés via winget le
  2026-09-13 (Git 2.55, Node 24.19 LTS, npm 11.17).
- Dépôt cloné dans `C:\Users\Raphael\Projets\CoteEloEscalade`.
- `npm install` fait, `npm test` passe (62 tests) au 2026-09-13.

## Commandes utiles

```bash
npm install
npm run dev            # http://localhost:5173
npm test                # 62 tests sur le cœur de calcul
npm run build           # site statique dans dist/
npm run data:generate   # régénère le jeu de données de démonstration
```

## État au 2026-09-14 (fin de session, après l'écran Carte)

Détail complet dans le README, section « Journal des sessions » (à jour). En résumé :

- Accès à deux niveaux ajouté : visiteurs limités par défaut, accès complet déverrouillé par
  une URL secrète mémorisée en `localStorage` (`src/ui/acces.ts`), avec un bouton pour
  prévisualiser la vue visiteur sans se reverrouiller.
- Menu déroulant de centres d'escalade dans l'en-tête (`src/App.tsx`) : Bloc Shop
  Chabanel/Hochelaga/Mile-End, Le Mouv', Rose Bloc 1/2, en plus de la démo. Purement visuel
  pour l'instant sauf Rose Bloc 1 (voir ci-dessous) — les autres centres n'ont pas de données.
- Vue visiteur simplifiée sur Blocs/Grimpeurs : une seule colonne « Cote » (mélange) au lieu
  d'une par formule.
- Accents français corrigés partout, version anglaise complète avec bascule FR/EN
  (`src/ui/langue.tsx`, `src/ui/format.ts`) — voir README § « Site bilingue ». Limite assumée :
  les messages de validation des données (écran Fichiers) restent en français uniquement.
- Corrections de vocabulaire : axe « voies » → « blocs » dans l'histogramme des écarts ;
  « cran V » → « cote V » en français partout (l'anglais garde « V grade ») ; colonne
  « Secteur » renommée « Style ».
- Nouvel écran **Carte** (visible par tous) : édition complète des blocs en accès complet,
  lecture seule avec suivi personnel des envois (par nom de grimpeur saisi) en vue visiteur —
  voir README § « La carte des blocs » pour l'architecture (`CarteProvider`, `SuiviProvider`).
  - Carte inventée pour le centre Démo (`public/cartes/demo.svg`, 369 blocs générés par
    `scripts/generer-carte-demo.mjs`, positions affinées à la main, limitée à 50 blocs affichés).
  - Carte réelle de Rose Bloc 1 ajoutée à partir d'une photo fournie par Raphaël.
  - Palette des pastilles reprise plusieurs fois (spectre plat → néon → rendu métallique) sur
    retours de Raphaël.
  - Sélecteur de nom de grimpeur avec bouton pour l'effacer ; suivi des envois par grimpeur.
  - Survol d'une pastille : nom du bloc + cote Elo exacte, à côté de la cotation affichée.
- Références au dépôt/URL de l'ami (EricPrieur) corrigées dans README et ici.

Vérifié à la reprise du 2026-09-15 : dépôt propre, à jour avec `origin/main`, aucun travail en
attente (`git status` clean).

## État au 2026-09-15

Grosse session sur l'écran **Carte**, avec beaucoup d'allers-retours après tests réels de
Raphaël (souris puis téléphone) — l'historique complet des essais abandonnés (pont invisible,
`ResizeObserver`, lien « Annuler », statut « meilleur » plutôt que « le plus récent »...) et
pourquoi ils ne suffisaient pas est dans le README, § « La carte des blocs » et journal du
2026-09-15 ; ce qui suit est l'état final, pas le chemin pour y arriver.

- Migration CI : `actions/checkout@v4`/`setup-node@v4` → `@v5` (runtime Node 24), avant le
  retrait de Node 20 des runners GitHub Actions le 16 septembre 2026. Piste refermée dans
  `DECISIONS.md` § 7.
- Trois boutons flash/réussi/échec sur la Carte, ouverts au survol (souris uniquement —
  `matchMedia('(hover: hover)')`, désactivé sur tactile où un tap simule des événements souris
  trompeurs) ou au clic (Majuscule+clic en accès complet, où le clic sert déjà à
  sélectionner/déplacer). Pour le centre Démo et un nom de grimpeur reconnu du dataset, ils
  enregistrent une vraie ascension (`src/ui/ascensionsLocales.ts`, fusionnée dans
  `useAtelier`/`etat.ts`) qui recalcule les cotes affichées ailleurs (Blocs, Grimpeurs).
  Chaque clic **remplace** l'envoi précédemment ajouté depuis la Carte pour ce bloc/grimpeur, et
  `Atelier.envoisConnus` retient le statut **le plus récent** (pas le meilleur) : Raphaël veut
  pouvoir changer d'avis dans n'importe quel sens, à tout moment, y compris redescendre un bloc
  déjà flashé. Popup : statut (Flash/Réussi/Échoué/Jamais essayé), raison visible (pas juste au
  survol) quand les boutons sont désactivés. Pastille : anneau vert plein si envoyé, liseré vert
  fin si jamais tenté (`inset: 0`, pile sur le bord — pas de débord).
- Taille des pastilles (`RAYON`, `VueCarte.tsx`) : échelle continue proportionnelle à la largeur
  réelle de la carte (`largeur × 1,8 %`, borné 5–20 px), pas un seuil fixe — un seuil gardait les
  pastilles relativement trop grosses sur un téléphone, où l'espacement entre elles rétrécit
  dans la même proportion que la carte. A aussi mis au jour un bug de layout indépendant :
  `.marque` (titre + sous-titre) avait un `white-space: nowrap` qui empêchait toute la page de
  rétrécir sous ~720 px sur petit écran, peu importe la taille des pastilles.
- Légende permanente « 1 cote V = 1000 points (V1 = 1000, V2 = 2000...) » sous les tuiles des
  écrans Blocs, Grimpeurs et Carte (`LegendeCote`, `src/ui/components/base.tsx`) — la conversion
  n'était que dans une bulle d'aide au survol, invisible sur tactile.
- Plusieurs mises au point de méthode utiles pour la suite (voir mémoires
  `feedback-browser-hover-testing` et `feedback-resizeobserver-throttling`) : un survol/clic
  testé par un saut de curseur direct ou dans l'outil d'automatisation ne reproduit pas fidèlement
  un geste tactile réel ni un `ResizeObserver` sur un onglet sans focus — plusieurs correctifs de
  cette session ont eu l'air de marcher en test avant d'échouer sur le vrai téléphone de Raphael.

Tests (62) et typecheck au vert après chaque commit. Testé manuellement dans Chrome à chaque
étape, mais **pas encore sur un vrai téléphone** au moment d'écrire ceci (prochaine étape).

## État au 2026-09-16

Ajout de la **cote par style** : les blocs ont désormais un style parmi une liste de neuf
(Dalle/pied, Dalle/force, Dalle/doigts, Coordo, Dyno, Technique/force, Technique/doigt,
Dévers/force, Dévers/doigts — `src/core/stylesBloc.ts`, remplace l'ancien vocabulaire à huit
valeurs, une géométrie de mur). Mécanisme et détail complet dans le README, § « La cote par
style » et journal du 2026-09-16. Tests (64) et build au vert.

Un premier jet (tableau à part, limité à quelques grimpeurs) a été montré à Raphael, qui a
signalé que les nouveaux styles n'apparaissaient nulle part (Blocs, Grimpeurs, Carte) et a
demandé un menu déroulant dans la colonne de cote plutôt qu'un tableau séparé. Deux choses
distinctes derrière ce retour, voir le journal pour le détail :

- **Un vrai bug sur la Carte** : `public/cartes/demo.svg` (l'image de fond) avait les huit
  anciens noms de zone dessinés en dur comme texte, jamais touchés par la mise à jour des
  données. Corrigé — `demo.svg` redessiné avec neuf bandes murales, `ZONES` de
  `scripts/generer-carte-demo.mjs` remis à jour, `data/cartes/demo.json` régénéré en entier
  (les positions affinées à la main n'ont pas pu être conservées, la nouvelle taxonomie ne
  correspond pas à l'ancienne géométrie de mur — **à raffiner de nouveau**, comme la première
  fois).
- **Blocs et Grimpeurs étaient déjà corrects** en local au moment du retour — probablement un
  test sur une version pas encore relancée, ou une confusion avec le bug de la Carte ci-dessus.
- Le tableau à part a été remplacé par un menu déroulant dans l'en-tête de la colonne de cote du
  tableau Classement (bascule entre cote globale et cote d'un style, pour tous les grimpeurs),
  comme demandé.

Retesté par Claude dans Chrome après les deux correctifs (Carte + colonne), mais **pas encore vu
par Raphael**.

## Prochaine étape

Au choix de Raphael à la prochaine session :

- **Retour sur ce deuxième jet** (colonne déroulante dans Grimpeurs, neuf zones sur la Carte
  Démo) — s'attendre à des ajustements, comme pour le reste de l'écran Carte.
- **Raffiner à la main les positions des blocs sur la Carte Démo**, perdues par la régénération
  complète (§ ci-dessus) — comme lors de la toute première mise en place de cette carte.
- **Tester l'écran Carte sur un vrai téléphone** (reporté depuis le 2026-09-15, Raphael a dit
  vouloir s'en occuper plus tard) : survol/clic sur les boutons flash/réussi/échec, taille des
  pastilles, popup. Vérifié dans Chrome (bureau) et via des simulations de largeur étroite, mais
  plusieurs bugs mobiles précédents n'avaient été repérés qu'à l'usage réel du téléphone de
  Raphael.

Autres pistes en attente si rien de ce qui précède ne ressort : brancher de vraies données sur un
des centres du menu (autre que Rose Bloc 1), ou une des pistes ouvertes listées dans
`DECISIONS.md` (§ 7) : seuil Glicko à 0,60, test d'équivalence, Glicko-2, modèle morphologique,
import utilisateur par glisser-déposer.
