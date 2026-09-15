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

## État au 2026-09-14

Détail complet dans le README, section « Journal des sessions ». En résumé :

- Accès à deux niveaux ajouté : visiteurs limités aux écrans Blocs/Grimpeurs par défaut,
  accès complet (5 écrans) déverrouillé par une URL secrète mémorisée en `localStorage`
  (`src/ui/acces.ts`), avec un bouton pour prévisualiser la vue visiteur sans se reverrouiller.
- Menu déroulant de centres d'escalade ajouté dans l'en-tête (`src/App.tsx`) : Bloc Shop
  Chabanel/Hochelaga/Mile-End, Le Mouv', Rose Bloc 1/2, en plus de la démo. Purement visuel
  pour l'instant — aucun centre autre que la démo n'a de données, un message l'indique.
- Vue visiteur simplifiée sur Blocs/Grimpeurs : une seule colonne « Cote » (mélange) au lieu
  d'une par formule.
- Accents français corrigés partout dans le site (ils manquaient depuis le début), et version
  anglaise complète ajoutée avec bascule FR/EN (`src/ui/langue.tsx`, `src/ui/format.ts`) — voir
  README § « Site bilingue ». Limite assumée : les messages de validation des données (écran
  Fichiers) restent en français uniquement.
- Corrections de vocabulaire : axe « voies » → « blocs » dans l'histogramme des écarts (reste
  du pivot escalade de voies → bloc, cf. `DECISIONS.md` § 1) ; « cran V » → « cote V » en
  français dans toute l'interface (l'anglais garde « V grade »), et dans le README aussi
  (harmonisé le même jour).
- Références au dépôt/URL de l'ami (EricPrieur) corrigées dans README et ici.

## Prochaine étape

Rien de décidé pour la prochaine session — à définir avec Raphael. Pistes en attente, au
choix : brancher de vraies données sur un des centres du menu, ou une des pistes ouvertes
listées dans `DECISIONS.md` (§ 7).
