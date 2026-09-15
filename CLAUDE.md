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

- Migration CI : `actions/checkout@v4`/`setup-node@v4` → `@v5` (runtime Node 24) dans
  `.github/workflows/deploy.yml`, avant le retrait de Node 20 des runners GitHub Actions le
  16 septembre 2026 (annonce GitHub). Tests (62) toujours au vert après la modification. Piste
  refermée dans `DECISIONS.md` § 7.

## Prochaine étape

Rien de décidé pour la prochaine session — à définir avec Raphael. Pistes en attente, au
choix : brancher de vraies données sur un des centres du menu (autre que Rose Bloc 1), ou une
des pistes ouvertes listées dans `DECISIONS.md` (§ 7) : seuil Glicko à 0,60, test
d'équivalence, Glicko-2, modèle morphologique, import utilisateur par glisser-déposer.
