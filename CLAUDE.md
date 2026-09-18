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

Poussé sur `main` (commits `f1b7b91`, `92cd657`, `67997f0`, `f93a24f`), déploiement GitHub Pages
vérifié vert via l'API Actions après chaque push.

Retours supplémentaires de Raphael traités dans la foulée, tous poussés :

- Sur les écrans **Blocs** et **Grimpeurs**, le tableau principal passe au-dessus des cartes
  analytiques (graphiques), limité à 25 lignes par défaut au lieu de 50.
- Les pastilles de la Carte Démo (régénérée § ci-dessus) se chevauchaient. Cause a deux
  niveaux, voir le journal du 2026-09-16 dans le README pour le detail : les neuf zones de mur
  se recouvraient geometriquement aux quatre coins (corrige), et le placement purement
  aleatoire dans une zone ne garantissait aucun espacement minimal (remplace par une grille qui
  maximise l'espacement, calibree sur la taille de reference des pastilles documentee dans le
  README). Verifie programmatiquement : 36,3 unites de separation minimale mesurees sur les 50
  blocs, au-dessus du seuil de 35 requis pour ne pas se toucher a la taille de reference.
- Les blocs deja envoyes (`grayscale(0.85)` + `opacity: 0.55`) perdaient leur couleur d'origine.
  Adouci (`grayscale(0.4) saturate(0.7)` + `opacity: 0.85`). Palette (`PALETTE_COULEURS`,
  `VueCarte.tsx`) remontee vers des teintes plus vives sur demande de Raphael, tout en gardant le
  reflet lustre "metal".

Raphael a enfin teste sur son vrai telephone (prevu depuis le 2026-09-15). Deux bugs trouves,
tous les deux corriges dans la foulee — voir le journal du 2026-09-16 dans le README pour le
detail technique complet :

- L'anneau vert "envoye" avait un ecart/epaisseur fixes en pixels, penses pour `RAYON` = 20
  (bureau) : au plancher de `RAYON` (5px, telephone) ce fixe ne laissait presque plus de marge,
  la pastille semblait deborder de l'anneau. Les deux suivent desormais `RAYON`
  (`EPAISSEUR_ANNEAU`, `ECART_ANNEAU`). Verifie programmatiquement (via le DOM, pas seulement a
  l'oeil — trop petit a cette taille) : 3px d'ecart de chaque cote a `RAYON` = 5 (il etait de 0).
- Le popup au clic/survol d'un bloc etait en `position: fixed`, un piege classique du web mobile
  avec le pinch-zoom tactile (que Raphael utilise pour mieux voir les blocs) : les navigateurs ne
  redimensionnent pas les elements `fixed` avec le zoom du viewport visuel, si bien que le popup
  finissait par deborder largement de l'ecran zoome. Passe en `position: absolute`, ancre sur la
  pastille (donc sur la carte elle-meme, qui zoome avec le reste). L'ancienne raison du `fixed`
  (echapper a l'`overflow: hidden` de la zone de carte pres d'un bord) est traitee en bornant sa
  position dans les limites de la carte (bascule a gauche si la place manque a droite).

Verifie dans Chrome (bureau, et via un retrecissement programmatique du conteneur de la carte
pour simuler `RAYON` au plancher — `resize_window` n'a pas d'effet dans cet environnement).
Tests (64) et build au vert. Pousse (commit `8231abf`), deploiement verifie vert.

Raphael, en revérifiant sur PC juste après : les pastilles n'avaient plus toutes la même taille.
Le vrai bug de l'anneau (ecart reellement nul, cf. ci-dessus) etait corrige, mais en le faisant
grandir avec `RAYON` plutot que de rester un petit ecart fixe non nul — ca gonflait l'anneau
jusqu'a 30 % de plus que la pastille sur bureau (10 % avant toute cette histoire). Redevenu des
constantes fixes (1px), qui n'ont pas besoin de grandir avec `RAYON`, juste de ne jamais
retomber a zero. Verifie via le DOM : 1px d'ecart reel a `RAYON` = 5 comme a `RAYON` = 20 (contre
3px puis 4px avec la version precedente sur bureau — sensiblement moins gonfle).
Tests (64) et build au vert. Pousse (commit `fd9de44`), deploiement verifie vert.

Raphael a efface le cache et reteste sur **deux telephones differents** : le probleme
persistait, plus un troisieme signale (menu deroulant de style ecrase et illisible sur mobile,
ecran Grimpeurs). Raphael a envoye une **capture d'ecran reelle** (`Cell site escalade
debug.jpg`, dans ses Downloads) — utile : mon environnement de test (Chrome bureau, meme en
retrecissant la fenetre) ne reproduit pas fidelement le rendu mobile reel, deux tentatives de
suite n'avaient pas suffi a corriger pour de vrai. La capture a permis de diagnostiquer le vrai
probleme plutot que de deviner une troisieme fois :

- Le menu deroulant avait un `maxWidth: 140` artificiel (aucune autre colonne du tableau n'en a,
  le tableau defile horizontalement au besoin) — trop juste pour un nom de style avec le style
  natif d'un `<select>` sur mobile. Retire.
- Le popup debordait massivement de l'ecran apres un pinch-zoom tactile (visible sur la
  capture). Mon correctif precedent (`position: absolute`, ancre sur la pastille) faisait bien
  zoomer le popup *avec* la carte pour la position, mais ca le fait aussi grossir physiquement a
  l'ecran avec le zoom — jusqu'a depasser l'ecran visible. Corrige en lisant
  `window.visualViewport.scale` et en compensant par `transform: scale(1/echelle)` sur le popup
  (`echelleZoom`, `VueCarte.tsx`), avec un `transform-origin` sur le coin ancre a la pastille.
  Sans zoom (bureau), `transform` n'est meme pas pose : verifie dans Chrome, comportement
  inchange.
- **Le debordement de l'anneau vert n'a pas pu etre confirme ou infirme** sur cette capture : le
  popup, grand ouvert, cachait la plupart des pastilles. Pas retouche dans ce lot — a revoir au
  prochain retour de Raphael.

Tests (64) et build au vert. Pousse (commit `af36292`), deploiement verifie vert.

Raphael a confirme le popup corrige, et envoye une **seconde capture** (`Cell site escalade
debug 2.jpg`) pour l'anneau : du gris debordait bien autour du cercle vert. Diagnostic : pas un
bug de l'anneau en soi — **chaque pastille a deja son propre halo de 2px**
(`boxShadow: '0 0 0 2px var(--bord-fort)'`, deja present avant toute cette histoire, pour donner
un contour a la pastille). L'anneau vert le recouvrait entierement quand l'ecart etait nul (le
tout premier bug) ; le corriger a laisse ce halo, jusque-la invisible, apparaitre dans l'espace.
`ECART_ANNEAU` passe de 1 a 2 pour correspondre exactement a ce halo au lieu d'etre un ecart
arbitraire : l'anneau prend le relais pile ou le halo s'arrete. Verifie via le DOM (ecart reel de
l'anneau = 2px pile) et visuellement dans Chrome (zoom sur une pastille "envoyee").

Raphael a aussi demande que recliquer sur un bloc referme son popup plutot que de devoir cliquer
ailleurs sur la carte. `ouvrirPopup` (`VueCarte.tsx`) ouvrait toujours sans jamais basculer, pour
une raison precise documentee dans le code : a la souris, le clic suit en pratique un survol qui
a deja ouvert le popup, basculer le refermerait aussitot. Ce risque n'existe que quand le survol
existe vraiment (`survolPossible`) ; sur tactile, rien ne l'a ouvert avant le tap. Le bascule ne
s'applique donc que si `!survolPossible`.

Tests (64) et build au vert. Pousse (commit `fde6f73`), deploiement verifie vert.

Raphael a envoye une **troisieme capture** (`Cell site escalade debug 3.jpg`), bien plus
rapprochee : le halo gris debordait toujours a l'exterieur du cercle vert, et le cercle vert
empietait par endroits sur le chiffre. Le correctif precedent (`ECART_ANNEAU` = 2, cense faire
correspondre l'anneau au halo existant) supposait un ordre d'empilement precis entre le
`boxShadow` de la pastille et le `<span>` de l'anneau pose par-dessus — peu fiable en pratique
sur mobile. Plutot que d'ajuster encore les pixels, **l'anneau separe est retire** : le
`boxShadow` de contour que chaque pastille a deja (2px, gris par defaut, fonce si selectionnee)
devient simplement vert quand le bloc est envoye, au lieu d'empiler un second element par-dessus.
Un seul contour, jamais deux elements qui se disputent le meme espace — ni halo gris visible, ni
empietement sur le chiffre possible (`box-shadow` ne peut pas deborder a l'interieur de
l'element). `EPAISSEUR_ANNEAU`/`ECART_ANNEAU` et le `<span>` associe sont retires entierement.
Verifie via le DOM (0 `<span>` enfant sur une pastille envoyee, `boxShadow` bien vert) et
visuellement dans Chrome.

Tests (64) et build au vert. Pousse (commit `d2ec96c`), deploiement verifie vert.

Raphael, en retestant : « visuellement identique » — inattendu, le mecanisme avait pourtant
change. Deux precisions cle de Raphael ont permis de trouver la vraie cause, chacune une fois
demandee explicitement (pas trouvee seul) :

- Le contour gris est visible sur **toutes** les pastilles, meme sur PC (juste plus fin) — rien
  a voir avec les correctifs precedents. C'est le contour (`boxShadow`) que chaque pastille a
  toujours eu, jamais retouche jusque-la : fixe a 2px, comme l'etait l'ancien anneau "envoye"
  avant sa toute premiere correction, alors que la pastille elle-meme retrecit avec `RAYON` —
  memes 2px, proportionnellement bien plus epais sur telephone que sur bureau. Constante
  `EPAISSEUR_CONTOUR` (`Math.max(1, Math.round(RAYON * 0.1))`) : 2px a `RAYON` = 20 (inchange),
  1px a `RAYON` = 5.
- Le cercle vert qui "empiete sur le chiffre" n'etait **pas** l'anneau "envoye" (`fait`, corrige
  a repetition ci-dessus, jamais fautif) mais **l'autre** liseré : celui des blocs jamais
  essayes (`nonEssaye`), pose volontairement a l'interieur du bord (`inset: 0`). Sa bordure de
  2px, elle aussi jamais rendue proportionnelle, mangeait jusqu'a 40 % du rayon d'une petite
  pastille de telephone — le vrai bug derriere chaque capture depuis le debut, sur une piste que
  les quatre correctifs precedents n'avaient jamais empruntee (ils portaient tous sur `fait`).
  Passee a `EPAISSEUR_CONTOUR` elle aussi.

Verifie via le DOM aux deux extremes de `RAYON` (5 et 20) et visuellement dans Chrome.
Tests (64) et build au vert. Pousse (commit `6a02347`), deploiement verifie vert.

Toujours pas resolu apres ce cinquieme correctif sur le sujet. Raphael a tranche : **retirer les
deux plutot que continuer a ajuster**. Le contour gris par defaut (visible sur toute pastille,
present depuis l'origine du projet, jamais lie a aucun statut) est retire purement et
simplement. Le liseré "jamais essaye" (`nonEssaye`) est retire entierement lui aussi — ces blocs
n'ont plus aucune marque sur la pastille, seul le popup dit encore leur statut. Le contour de
l'anneau "envoye" (vert) reste : seul indicateur visuel qui subsiste sur la carte en dehors du
popup, confirme correct par Raphael des la toute premiere capture d'ecran de cette serie de
correctifs.

Tests (64) et build au vert. Pousse (commit `621eed5`), deploiement verifie vert.

Raphael a confirme la Carte reglee (« ça fonctionne ! »), et signale un probleme du meme ordre
sur un **autre** ecran : le menu deroulant de style de Grimpeurs se compresse et devient
illisible sur telephone, malgre le retrait du `maxWidth: 140` artificiel quelques correctifs
plus tot. Cause differente cette fois : `table.donnees` (`styles.css`) a `width: 100%`, qui
empeche le tableau de depasser son conteneur meme quand son contenu l'exige — sur ecran etroit,
le moteur de mise en page en tableau comprime chaque colonne (dont le `<select>`) pour tout
faire tenir, au lieu de laisser le tableau deborder et defiler horizontalement
(`.table-enveloppe { overflow-x: auto }`, deja en place mais jamais reellement declenche pour ce
tableau). Un `min-width: 160` sur le `<select>` force sa colonne a refuser de retrecir sous ce
seuil : la somme des largeurs minimales des colonnes depasse alors les 100 % declares, et la
table deborde plutot que de continuer a comprimer — le defilement horizontal prend le relais,
sans toucher aux autres colonnes ni aux autres tableaux du site. Verifie via le DOM (conteneur
retreci a 360px programmatiquement) : le tableau deborde bien et le `<select>` garde ses 160px
pleins.

Tests (64) et build au vert. Pousse (commit `9b780e5`), deploiement verifie vert.

Raphael a confirme : « ça fonctionne sur téléphone ». Puis remarque de fond (pas un bug) : la
colonne "Cote par style" montrait toujours Elo brut, meme pour l'option "Cote globale", alors
que Melange est la cote de reference affichee partout ailleurs sur cet ecran. Rebati sur Melange
plutot que sur Elo, entierement cote UI (`VueGrimpeurs.tsx`), rien touche au coeur de calcul :

- Option "Cote globale" : montre desormais la cote Melange du grimpeur (au lieu d'Elo).
- Un style choisi : `cote_melange_globale + (cote_style_elo - cote_globale_elo)` — le calcul par
  style reste base sur Elo (seule formule qui l'a, Glicko n'ayant pas de trajectoire par duel a
  observer), mais recale sur Melange pour rester coherent avec le reste de l'ecran plutot que de
  montrer une echelle differente. Explicitement documente comme une approximation (pas une vraie
  cote Melange par style), discute et valide avec Raphael avant de coder.

Verifie visuellement (l'option "globale" correspond pile a la colonne Melange) et par le calcul
(Victor Bergeron, Dalle/pied : Elo 7570 → 6421 soit -1149 ; Melange 7851 → 6702, le meme -1149).
Tests (64) et build au vert. Pousse (commit `b9db770`), deploiement verifie vert.

**Fin de session du 2026-09-16.** Tout le lot du jour confirme fonctionnel sur telephone par
Raphael. Une seule demande notee pour la suite, pas codee aujourd'hui : voir ci-dessous.

## État au 2026-09-17

Raphaël a demandé de simplifier le vocabulaire des styles de bloc, de neuf valeurs à quatre :
**Dalle, Coordo, Dévers, Joker** (`STYLES_BLOC`, `src/core/stylesBloc.ts`), et d'en propager le
changement partout — Blocs, Grimpeurs, Carte, données — plus la demande laissée en suspens la
veille : que choisir un style dans le menu déroulant de la colonne "Cote par style" (écran
Grimpeurs) retrie aussi le tableau. Détail dans le README, § « La cote par style » et
§ « Cartes disponibles aujourd'hui ».

- `STYLES_BLOC` et le générateur de données (`scripts/generate-data.mjs`, `SECTEURS`) réduits aux
  quatre valeurs ; `data/blocs.csv` régénéré (`npm run data:generate`) — mêmes 369 blocs/55
  grimpeurs/18 879 lignes (RNG scellé, seules les étiquettes changent), répartition quasi égale
  entre les quatre styles (~91-99 blocs chacun).
- Carte Démo (`public/cartes/demo.svg`, `scripts/generer-carte-demo.mjs`) redessinée à quatre
  bandes murales (une par style, une par mur) au lieu de neuf ; `data/cartes/demo.json`
  régénéré. Avec deux fois plus de blocs par zone qu'avant (quatre zones au lieu de neuf pour les
  mêmes 50 blocs affichés), les bandes latérales (Coordo, Dévers) ne pouvaient plus garantir
  `SEPARATION_MIN` en une seule colonne de pastilles — élargies de 80 à 95 unités pour permettre
  deux colonnes ; vérifié programmatiquement (36,5 unités de séparation minimale mesurée sur les
  50 blocs, au-dessus du seuil de 36). Étiquettes des quatre zones repositionnées dans la marge
  de 25 unités entre le bord extérieur et la zone de placement des pastilles (jamais recouvertes,
  contrairement à un premier essai centré dans la bande elle-même, vérifié dans Chrome) — la
  disposition elle-même reste générée, pas affinée à la main.
- `core.test.ts`, test « un style jamais affronté par un grimpeur reste exactement à son amorce »
  : dépendait de trouver ce cas par chance dans le jeu de données généré, ce qui devenait trop
  improbable avec seulement quatre styles pour des grimpeurs à des centaines de duels chacun (le
  test échouait après le changement de vocabulaire). Réécrit sur un petit dataset construit à la
  main (un grimpeur, deux blocs de styles différents, un seul affronté) : garanti par
  construction plutôt que par chance, et découplé du nombre de styles.
- **Tri du tableau Classement piloté depuis l'écran** : `Tableau.tsx` accepte désormais des props
  optionnelles `tri`/`onTri` qui, si fournies, remplacent l'état de tri interne comme source de
  vérité (un clic sur un en-tête continue de fonctionner, via `onTri`) — les autres usages de
  `Tableau` (Blocs, Données, Progression) ne les passent pas et gardent leur comportement
  inchangé. `VueGrimpeurs.tsx` s'en sert pour que choisir un style dans le menu déroulant
  déclenche aussi `{ cle: 'cote-style', sens: -1 }`, comme un clic sur l'en-tête.

Vérifié dans Chrome (accès complet) : les trois onglets affichent bien Dalle/Coordo/Dévers/Joker,
la Carte Démo n'a aucun chevauchement ni étiquette masquée, et sélectionner un style dans
Grimpeurs retrie immédiatement le tableau sur cette colonne (un clic sur "Elo" ensuite retrie
bien sur Elo, sans casser le mécanisme). Tests (64) et build au vert.

Raphael a ensuite demandé ce qu'il faudrait pour que le site (statique, sans serveur ni compte)
supporte plusieurs utilisateurs en temps réel — discuté, rien codé. Recommandation donnée : il
faut une base *et* un serveur (ou un service qui fournit les deux, type Supabase/Firebase/
PocketBase), une base seule exposée au navigateur ne pouvant appliquer aucune règle d'accès ; les
interfaces déjà en place (`SourceProvider`, `CarteProvider`, `AscensionLocaleProvider`) donnent
un bon point d'accroche pour une future implémentation réseau sans toucher au calcul ni à
l'interface. Raphael a choisi d'attendre plutôt que de commencer maintenant — voir README,
§ « Piste envisagée, pas commencée : le multi-utilisateur en temps réel », et `DECISIONS.md` § 7
pour le détail. **Ne pas relancer ce chantier de soi-même sans que Raphael le redemande.**

Raphael a ensuite demandé de simplifier la présentation de l'écran **Blocs** :
- Le titre/description devant le tableau (« Tous les blocs exploitables » + un paragraphe
  d'explication) remplacé par un simple titre « Blocs », sans sous-titre.
- Les quatre tuiles de statistiques (« Blocs en désaccord », Sous-cotés, Sur-cotés, Écart
  médian), auparavant tout en haut de la page, déplacées sous le tableau des blocs.
- Les boutons « Désaccords seulement » et « Exporter en CSV » masqués en vue visiteur
  (`simplifie`) — visibles seulement en accès complet.
`VueBlocs.tsx` seul touché ; simple réordonnancement de JSX et deux `{!simplifie && ...}`, rien
dans le cœur de calcul. Vérifié dans Chrome (accès complet *et* aperçu visiteur) : les deux
boutons disparaissent bien en vue visiteur, le titre est sobre, les tuiles apparaissent
maintenant après le tableau et avant les deux graphiques. Tests (64) et build au vert.

Puis demandé de retirer, en vue visiteur seulement, les bulles d'aide au survol des en-têtes du
tableau Blocs. `colonnes` passe par `colonnes.map(({ aide, ...c }) => c)` avant `Tableau` quand
`simplifie` est vrai (seulement pour le tableau principal de cet écran, pas pour le tableau
secondaire de la carte "Cotation calculée contre affichée") — `Tableau.tsx` n'affiche la bulle
que si `c.aide` est défini, donc rien à y changer. Le clic pour trier continue de fonctionner
(indépendant de `aide`). Vérifié dans Chrome : plus de bulle au survol en vue visiteur, toujours
présente en accès complet. Tests (64) et build au vert.

Puis demandé de retirer, toujours en vue visiteur et sur le même tableau, les colonnes Écart et
Duels utiles (`cle: 'ecart'`/`'matchs'`) — des mesures d'audit sans intérêt pour un visiteur qui
ne compare pas les formules. `colonnes.filter(...)` ajouté avant le `.map` qui retire `aide`. Le
tri initial de la table, réglé sur Écart décroissant, n'a plus de sens une fois la colonne
masquée (`Tableau` retombe silencieusement sur l'ordre naturel des lignes si la colonne triée
n'existe pas) : passé au nom du bloc croissant en vue visiteur uniquement, l'accès complet garde
le tri par écart. Vérifié dans Chrome (accès complet et visiteur). Tests (64) et build au vert.

Enfin demandé, sur tous les écrans qui listent des blocs par leur nom (Blocs, Données,
Formules), de rendre ce nom cliquable pour rejoindre le bloc sur la Carte. Nouvel état dans
`App.tsx` : `blocCible` (id du bloc visé) et `voirBlocSurCarte(blocId)` qui bascule l'onglet sur
`carte` et pose `blocCible` ; passés en prop à `VueBlocs`/`VueDonnees`/`VueFormules` (colonne
`nom` d'un `<Tableau>`, ou cellule brute pour le tableau natif de `VueFormules`) et à `VueCarte`.
`VueCarte` consomme `blocCible` dans un effet (`setSurvole` pour ouvrir le popup comme un survol
l'aurait fait, `zoneRef.current?.scrollIntoView` pour ramener la carte à l'écran) — sans risque
de ne pas se redeclencher sur un second clic vers le même bloc : ce composant n'est monté que
sur l'onglet Carte (`{onglet === 'carte' && <VueCarte .../>}` dans `App.tsx`), donc chaque
arrivée depuis un autre onglet est un montage frais, pas de jeton de dédoublonnage nécessaire.
Comme la Carte n'affiche jamais qu'un échantillon des blocs (50 sur 369 pour la Démo), un bloc
absent de la carte bascule quand même l'onglet mais n'ouvre aucun popup — pas de plantage, juste
rien à montrer. Nouvelle classe CSS `.lien-bloc` (`styles.css`) pour un texte cliquable discret
dans une cellule (pas `.bouton`, trop lourd visuellement pour du texte en ligne). Vérifié dans
Chrome (accès complet et vue visiteur, bloc présent et bloc absent de la carte). Tests (64) et
build au vert.

Demande suivante, en deux parties : retirer la colonne Duels utiles du tableau Classement
(écran Grimpeurs) en vue visiteur, et faire suivre le style choisi dans le menu déroulant par
les colonnes a droite de la cote (Plus dur envoye, Duels utiles, Duels gagnes), dans toutes les
vues.

- Duels utiles retiree en vue visiteur : meme traitement que sur l'ecran Blocs plus haut
  (colonne entiere enveloppee dans `...(simplifie ? [] : [...])`).
- Duels utiles et Duels gagnes suivent le style choisi via `stylesGrimpeur[style]` (deja calcule
  par Elo bloc pour la colonne de cote elle-meme) : `matchs`/`reussites` du style au lieu des
  totaux tous styles confondus. Tiret sur Duels gagnes si le grimpeur n'a jamais affronte ce
  style (division par zero sinon) ; Duels utiles montre 0 (un compte, pas une cote — un zero y
  est deja parlant).
- Plus dur envoye n'avait pas d'equivalent par style nulle part dans le calcul (`stylesGrimpeur`
  ne retient que rating/matchs/reussites, aucune cotation V). Ajoute au niveau du pipeline plutot
  que dans l'ecran : `LigneGrimpeur.meilleureCotationParStyle` (`src/core/pipeline.ts`), calcule
  dans la meme boucle sur les ascensions brutes que `meilleureCotation` (deja existant), juste
  filtre par le style du bloc en plus du resultat. Independant de toute formule (comme
  `meilleureCotation`), donc disponible quelle que soit la formule active — pas besoin qu'Elo
  bloc soit la formule affichee pour que la colonne fonctionne.
- Les trois en-tetes se completent du nom du style choisi (ex. "Duels gagnes (Dalle)") pour que
  le changement de sens des colonnes ne passe pas inaperçu — sans ca, une colonne "Duels gagnes"
  qui se met a montrer un chiffre different sans rien signaler aurait ete trompeur.
- Sans style choisi ("Cote globale"), les trois colonnes retombent sur leurs totaux habituels :
  aucun changement de comportement pour qui n'utilise pas le menu deroulant.

Verifie dans Chrome (accès complet et vue visiteur) : choisir "Dalle" met a jour les trois
colonnes et leurs titres pour tous les grimpeurs affiches, revenir a "Cote globale" restaure les
totaux (confirme sur Victor Bergeron : 57 % de duels gagnes tous styles, 92 % en Dalle
specifiquement). Tests (64) et build au vert.

**Fin de session : palette des pastilles precisee couleur par couleur.** Raphael a fourni un hex
exact pour chaque couleur existante de `PALETTE_COULEURS` (`VueCarte.tsx`), un message par
couleur, plutot que de choisir une teinte au jugé : rouge `#FF0800`, jaune `#FFEF00`, vert
`#55DD33`, bleu `#0000FF`, orange `#FF5800`, noir `#100C08`, blanc `#FEFEFA`. Mauve laisse tel
quel sur demande explicite ("On garde le mauve"). Puis deux couleurs ajoutees, toujours en hex
exact : rose `#FE28A2` (nouvelle entree apres rouge) et turquoise `#7FFFD4` (nouvelle entree
entre bleu et vert) — dix couleurs en tout desormais.

Seul ajustement fait de ma propre initiative (pas demande explicitement, mais necessaire pour
rester lisible) : le vert `#55DD33` est nettement plus clair que l'ancien `#16a34a`, le texte
blanc du chiffre y perdait tout contraste — bascule au texte fonce (`#111`), comme le
jaune/l'orange/le blanc/le rose/le turquoise (meme logique de contraste appliquee a chaque
nouvelle couleur claire). Chaque changement verifie dans Chrome (panneau "Modifier le bloc" en
accès complet, une pastille testee a chaque fois) avant de commit/push — ce fichier ne touchant
a aucun calcul, tests (64) et build systematiquement au vert. Dix commits distincts au total
(un par couleur), tous pousses et deployes avec succes.

## État au 2026-09-18

- Tentative de remplacer la photo brute de Rose Bloc 1 par une carte vectorielle tracee sur ses
  contours de murs (style Carte Demo) — faite, verifiee par superposition en fondu avec la photo
  dans Chrome, mais **rejetee par Raphael** (« c'est moins bien qu'avant ») et **revert immediat**
  (commit `ec63706`). Rose Bloc 1 affiche de nouveau la photo. Ne pas relancer ce chantier sans
  que Raphael le redemande explicitement — s'il revient dessus, demander ce qui n'allait pas avant
  de retenter, plutot que de redeviner a l'aveugle.
- Longue discussion (rien code) sur l'uniformisation des cotes entre centres une fois qu'il y en
  aura plusieurs avec de vraies donnees — deux pistes retenues, une ecartee en cours de route.
  Voir README § « Piste envisagee, pas commencee : uniformiser les cotes entre centres » et
  `DECISIONS.md` § 7 pour le detail. Ne pas coder sans que Raphael relance le sujet, meme logique
  que le multi-utilisateur temps reel.
- Ajout d'un histogramme **Distribution des grimpeurs** sous le tableau Classement (ecran
  Grimpeurs), en reutilisant le composant `Histogramme` de l'ecran Blocs plutot que d'en ecrire un
  second. A rendu son etiquette d'axe Y configurable (`uniteY`) et corrige son positionnement dans
  `src/ui/charts/base.tsx`, qui tronquait un mot plus long que « blocs » (le defaut). Verifie que
  l'ecran Blocs n'a pas change visuellement. Tests (64) et build au vert. Pousse (commit
  `b69a094`), deploiement GitHub Pages verifie vert.

## Prochaine étape

Au choix de Raphael à la prochaine session :

- **Retester sur le téléphone** le vocabulaire de style (Blocs/Grimpeurs/Carte) et le tri
  automatique sur sélection, introduits le 17 septembre — vérifié dans Chrome bureau seulement à
  ce stade, pas encore sur un vrai téléphone (cf. les pièges de simulation desktop documentés
  plus haut dans ce fichier).
- **Retour sur le nouveau placement des pastilles** de la Carte Démo (quatre zones depuis le 17
  septembre) — l'algorithme garantit l'absence de chevauchement, mais la disposition reste
  générée, pas affinée à l'œil. Raphael peut vouloir la retoucher à la main, ou la laisser telle
  quelle.
- **Rose Bloc 1** reste sur sa photo brute comme fond de carte — pas une tâche en attente (essayé
  et refusé le 18 septembre), seulement à reconsidérer si Raphael relance le sujet lui-même, avec
  plus de précision sur ce qui n'allait pas cette fois.

Autres pistes en attente si rien de ce qui précède ne ressort : brancher de vraies données sur un
des centres du menu (autre que Rose Bloc 1), ou une des pistes ouvertes listées dans
`DECISIONS.md` (§ 7) : seuil Glicko à 0,60, test d'équivalence, Glicko-2, modèle morphologique,
import utilisateur par glisser-déposer, multi-utilisateur en temps réel, uniformisation des cotes
entre centres (ces deux dernières en attente explicite — ne pas les proposer spontanément).
