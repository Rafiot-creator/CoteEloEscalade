# Cote Elo Escalade

Un site statique qui **recalcule la difficulté des blocs de salle à partir des réussites et
des échecs**, sans jamais regarder la cotation affichée par l'ouvreur — puis compare les deux.

Chaque **couple grimpeur–bloc donne lieu à un seul affrontement**, joué en direct : dès la
première séance infructueuse le grimpeur a perdu, et s'il finit par envoyer le bloc on lui
rend ses points et la défaite devient une victoire. On fait tourner un classement Elo sur ces
duels, et la cote V du bloc tombe du calcul. Les blocs dont le résultat s'écarte franchement
de leur étiquette sont, au choix, sous-cotés ou généreux.

Tout tourne dans le navigateur. Pas de serveur, pas de base de données, pas de compte.

## Le modèle

**Un seul affrontement par couple grimpeur–bloc.** Toutes les séances passées sur un bloc se
replient en une seule partie, dont l'issue est binaire et ne dépend pas du nombre d'essais :

- le grimpeur a fini par l'envoyer → **il gagne** : sa cote monte, celle du bloc baisse ;
- il ne l'a jamais envoyé → **il perd** : l'inverse.

Le nombre d'essais ne décide donc de rien. Il sert uniquement à **pondérer la victoire** : un
flash vaut 1, un enchaînement après travail vaut 0,8 par défaut, avec une descente
progressive entre les deux. Le bloc reçoit le complément — un bloc qui a beaucoup résisté
avant de tomber ne perd pas autant de points. La défaite, elle, vaut 0 sans nuance.

Sur le jeu de démonstration, **18 879 lignes d'historique se replient en 10 372 duels**, soit
une médiane de 28 duels par bloc.

### Le classement se joue en direct

Un duel n'attend pas d'être tranché pour compter. Le classement rejoue la chronologie et
bouge les cotes **au moment où l'information arrive** :

| Ce qui se passe | Ce que fait le classement |
|---|---|
| Le bloc tombe du premier coup | Une victoire, pondérée au flash. |
| Première séance infructueuse | **Une défaite, tout de suite.** Les points du grimpeur passent au bloc. |
| Le bloc finit par tomber | On **rend exactement** les points de la défaite, puis on joue la victoire pondérée par le travail. |
| Le bloc ne tombe jamais | La défaite reste. |

Un projet en cours vous coûte donc des points jusqu'à ce que vous l'envoyiez — ce qui est la
vérité du moment : ce bloc vous résiste. Le remboursement est exact au flottant près (le
déplacement appliqué est mémorisé puis retranché), un test le vérifie : à K constant, un
projet échoué puis envoyé laisse exactement les mêmes cotes qu'un envoi direct.

Ce qui change par rapport à un modèle qui n'enregistrerait que l'issue finale, ce sont les
cotes **intermédiaires** — et donc tous les autres duels joués pendant qu'un projet était en
cours. C'est ce qui rend les courbes de progression lisibles : on y voit le creux du projet
puis le rebond de l'envoi.

Le prix, mesuré : l'erreur médiane passe de 0,20 à 0,25 cran par rapport au modèle qui
n'enregistrait que l'issue. Les états intermédiaires sont plus bruités — c'est le coût d'un
classement honnête sur le moment plutôt que rétrospectif.

Les réglages sont dans l'écran **Formules**, groupe « Poids de la victoire » : mettre
« victoire après travail » à 1 annule complètement l'effet du style, ce qui permet de voir ce
qu'il apporte.

### Il faut journaliser les échecs

Conséquence directe du modèle, et c'est la contrainte la plus importante côté données : sur
le jeu de démonstration, **54 % des duels sont gagnés** par le grimpeur (5 634 sur 10 372).
Le pouvoir discriminant vient des **4 738 duels perdus**, c'est-à-dire des blocs qu'un
grimpeur a essayés sans jamais les faire.

Si la salle ne journalise que les envois — ce que font la plupart des carnets de croix — il
n'y a plus aucune défaite dans les données, et **aucun classement Elo n'est calculable** :
tout le monde gagne tout, rien ne distingue un V2 d'un V8. Il faut donc que la saisie
permette d'enregistrer « essayé, pas réussi ». C'est le point à vérifier en priorité sur
votre export réel.

## L'échelle : un cran V = 1000 points = dix contre un

Deux conventions se rejoignent, et c'est ce qui rend l'échelle lisible :

1. **1000 points d'écart valent dix chances contre une de réussir** (90,9 %). C'est le
   paramètre `échelle` de la logistique Elo : avec `E = 1/(1 + 10^(−Δ/échelle))`, la cote du
   match vaut `E/(1−E) = 10^(Δ/échelle)`, donc poser `échelle = 1000` place exactement le
   rapport 10:1 à 1000 points. (La convention des échecs le place à 400.)
2. **Un bloc démarre à sa cotation × 1000** : un V1 à 1000, un V2 à 2000, un V10 à 10 000.

Mises bout à bout : **un cran V d'écart, c'est dix chances contre une**. Un grimpeur coté
5 000 (V5) envoie un V4 neuf fois sur dix, un V5 une fois sur deux, un V6 une fois sur dix.
Deux crans valent 100 contre 1. La cote se lit donc directement : **divisez par 1000 et vous
avez le cran V**, décimales comprises.

**Les grimpeurs partent à leur niveau**, pas au milieu de l'échelle : un grimpeur V4 démarre
vers 4 000. Ce niveau vient du champ `niveau_declare` s'il est renseigné (ce que beaucoup de
salles demandent à l'inscription), sinon de la médiane des blocs affrontés lors des douze
premiers duels — on choisit spontanément des blocs proches de son niveau. À défaut de tout,
5 000.

Sur ce jeu de données, l'amorce ne change pas les cotes finales de façon mesurable (0,253
contre 0,249 cran d'erreur : c'est du bruit) — cinq mois suffisent à converger de toute
façon. Son intérêt est ailleurs : **la cote affichée d'un nouveau est juste dès sa première
séance** au lieu de partir de V5 et de dériver pendant des semaines, en distribuant au
passage des victoires imméritées aux blocs faciles qu'il affronte.

**Le calcul confirme la convention.** En basculant le calibrage en mode régression, le site
cherche lui-même combien de points sépare deux crans dans les données : il trouve
**1005 points, avec un r² de 0,965**. Autrement dit, les 1000 points par cran ne sont pas
qu'un choix commode — ils correspondent à ce que les résultats disent. C'est un contrôle à
refaire sur vos vraies données : si la régression y trouve 600 ou 1500, c'est que les crans de
la salle sont plus resserrés ou plus étalés que la convention ne le suppose.

Les cotes Elo brutes sont affichées dans une colonne dédiée des écrans **Blocs** et
**Grimpeurs**, à côté de leur traduction en cotation V. Sur le jeu livré elles vont de
985 à 10 006 pour les blocs et de 2 890 à 7 856 pour les grimpeurs.

### Le prix de cette convention

Partir de la cotation de l'ouvreur, c'est en faire un a priori : le classement le corrige
mais ne l'ignore pas. L'audit devient donc **conservateur** — il signale 22 blocs en désaccord
là où un départ neutre en signalerait davantage.

Le mode **« Amorce uniforme »** (écran Formules) fait démarrer tous les blocs au même point :
le résultat est alors totalement indépendant des cotations affichées, ce qui est la seule
façon de les auditer sans biais. Le coût est réel et mesuré : l'erreur médiane passe de
0,25 à 0,82 cran, parce que les blocs situés hors du champ de la communauté — les V1 que
personne ne rate, les V10 que personne n'envoie — ne peuvent plus être placés que par
défaut. À utiliser pour vérifier une intuition, pas comme réglage permanent.

## Démarrer

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 51 tests sur le cœur de calcul
npm run build          # site statique dans dist/
npm run data:generate  # régénère le jeu de données de démonstration
```

## Les données

Les fichiers de `data/` sont **importés à la compilation** : leur contenu fait partie du
bundle JavaScript. Ils sont versionnés avec le code, ce qui fait de Git l'historique des
données — diff, revert et revue de modification gratuits.

| Fichier | Colonnes |
|---|---|
| `data/grimpeurs.csv` | `id, nom, sexe, gym_principal, premiere_saison, niveau_declare` |
| `data/blocs.csv` | `id, nom, gym, secteur, couleur, cotation_officielle, date_ouverture, date_retrait` |
| `data/ascensions.csv` | `date, grimpeur_id, bloc_id, resultat, essais` |

`cotation_officielle` est sur l'échelle V (`V0` à `V12`, la salle simulée ouvrant de V1 à
V10) ; le numéro nu (`5`) est accepté, beaucoup d'exports de salle sortent ça. `resultat` vaut `reussite` ou `echec`. `date_retrait`
peut être vide pour un bloc encore en place. `essais` et `niveau_declare` sont facultatifs —
`niveau_declare` est le niveau annoncé à l'inscription (`V4`), qui sert de cote de départ.

Le jeu livré est **factice mais réaliste** : **une seule salle**, 55 grimpeurs, 369 blocs,
18 879 lignes sur cinq mois, tirés d'un niveau latent connu par `scripts/generate-data.mjs`
(RNG graine, donc reproductible). Il modélise cinq choses qui comptent pour la suite :

- **une seule salle, pas de grimpeur nomade** — tout le monde affronte le même mur, donc
  toutes les cotes sont reliées entre elles. C'est le cas le plus favorable au classement ;
- **autant de blocs par cran, de V1 à V10** — environ 36 de chacun. C'est une consigne
  d'ouverture, pas une conséquence : une salle réelle ouvre surtout du facile ;
- **les ouvertures tournent** — 50 blocs neufs par mois, chacun en place une dizaine de
  semaines. Un bloc récent a donc peu de duels et n'est pas encore jugeable : 48 des 369
  blocs sont dans ce cas ;
- **les grimpeurs ont une ténacité variable** — chacun consacre un nombre de séances limité
  à un projet avant de l'abandonner. C'est ce qui produit les défaites, seule information
  vraiment discriminante ;
- **le nombre d'essais suit la marge** — un bloc largement dans les cordes tombe au premier
  essai, un bloc à la limite en demande une dizaine. C'est ce qui donne du sens à la
  pondération du style ;
- **trois grimpeurs sur quatre déclarent un niveau à l'inscription**, à un cran près. Le
  quatrième ne dit rien, et son niveau de départ est estimé depuis ses premiers blocs.

### La conséquence d'une ouverture uniforme

La communauté est centrée sur V5 avec un cran d'écart-type ; les blocs, eux, s'étalent de V1
à V10. Les extrêmes sortent donc du champ de la salle, et ça se voit dans le nombre de duels :

| Cotation | V1 | V2 | V3 | V4 | V5 | V6 | V7 | V8 | V9 | V10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Duels par bloc | 11 | 23 | 37 | 45 | 42 | 40 | 32 | 22 | 13 | 10 |

Les V1 (que personne ne rate) et les V9–V10 (que presque personne n'envoie) sont **bornés
plutôt que mesurés** : le classement sait qu'ils sont faciles ou durs, pas exactement à quel
point. C'est là que la colonne « Incertitude » de la formule Glicko prend tout son sens.

Le nom de la salle est celui que vous avez cité ; les blocs, les grimpeurs et les résultats
sont entièrement inventés.

La vérité terrain est écrite dans `scripts/verite.json`, **hors de `data/`** : le site n'y a
pas accès, seuls les tests s'en servent pour vérifier que les formules retrouvent bien ce
qu'elles sont censées estimer.

## Quand vous ajouterez une deuxième salle

Le code gère déjà plusieurs salles — la colonne `gym` existe, et l'interface fait apparaître
d'elle-même un filtre par salle dès qu'il y en a plus d'une. Mais il y a un piège à connaître
avant d'y aller.

Les cotes n'ont de sens **les unes par rapport aux autres** que si les données les relient.
Deux salles sans aucun grimpeur commun sont deux systèmes indépendants : leurs échelles
peuvent flotter l'une par rapport à l'autre de plusieurs crans sans que le calcul puisse s'en
apercevoir. Comparer un V5 de l'une à un V5 de l'autre n'aurait alors aucun sens — il faut des
grimpeurs qui fréquentent les deux.

Le pipeline compte donc, pour chaque salle, ces « ponts », et l'écran **Blocs** affiche un
avertissement pour toute salle qui n'en a aucun. Avec une seule salle la question ne se pose
pas, et rien de tout cela ne s'affiche.

## Architecture

```
data/                     fichiers sources versionnés
scripts/                  générateur de données + vérité terrain (tests)
src/core/                 tout le calcul — ne connaît pas React
  cotations.ts            échelle V ↔ index numérique continu
  types.ts                le vocabulaire du domaine
  sources/                d'où viennent les octets
  loaders/                CSV → validation (zod) → Dataset typé
  formulas/
    types.ts              le contrat d'une formule
    lib.ts                repliement en duels, événements, moteur Elo, évaluation
    registry.ts           découverte automatique
    definitions/          une formule = un fichier
  calibrage.ts            cote Elo (unité interne) → cotation V
  pipeline.ts             fichiers → dataset → formule → résultat affichable
src/ui/                   React : n'a aucune connaissance du calcul
```

Le flux est linéaire et chaque étage est pur :

```
Fichiers → Parseur → Dataset validé → Repliement en duels → Événements datés
        → Formule(paramètres) → Calibrage → Résultats
```

## Ajouter une formule

Déposer un fichier dans `src/core/formulas/definitions/` qui exporte par défaut un objet
`Formule`. C'est tout : le registre le découvre à la compilation et l'interface **génère ses
réglages toute seule** à partir des paramètres déclarés.

```ts
const formule: Formule = {
  id: 'ma-formule',
  label: 'Ma formule',
  description: "Ce qu'elle suppose, et pour qui.",
  params: [
    { nom: 'k', label: 'Facteur K', type: 'nombre',
      defaut: 40, min: 2, max: 100, pas: 1, groupe: 'Base',
      aide: "Texte affiché derrière le point d'interrogation." },
  ],
  calculer(dataset, p) { /* → cotes des grimpeurs et des blocs */ },
}
export default formule
```

Une formule ne produit que des **cotes Elo**. La conversion en cotations V, les taux de
réussite, les écarts, le résumé et la connectivité entre salles sont faits une fois pour
toutes dans `pipeline.ts` : toute nouvelle formule en hérite gratuitement.

Deux formules sont livrées :

| Formule | Idée |
|---|---|
| **Elo bloc** | Le modèle de la maison, tel que décrit plus haut, avec la pondération du style. |
| **Glicko (cote + fiabilité)** | Mêmes duels, sans pondération du style, mais chaque cote porte son incertitude — un bloc ouvert la semaine dernière et fait par trois personnes ne se fait plus passer pour une mesure. Sert aussi de point de comparaison propre : si elle donne les mêmes cotes, c'est que la pondération ne change pas grand-chose. |

## Ce que valent ces formules

Le jeu de démonstration ayant une vérité terrain, on peut mesurer plutôt que d'affirmer
(amorce uniforme — les cotations de l'ouvreur n'entrent jamais dans le calcul) :

| Formule | Erreur médiane | Corrélation avec la difficulté réelle | Brier | Temps |
|---|---|---|---|---|
| Elo bloc | **0,25 cran V** | **0,987** | 0,062 | 53 ms |
| Glicko | 0,30 cran V | 0,984 | 0,058 | 119 ms |

Autrement dit : sur les 321 blocs jugeables, la cote calculée tombe à un quart de cran de la
difficulté réelle.

Glicko est ici moins précis, pour une raison identifiée : son atténuation par l'incertitude
(le facteur `g(RD)` du papier de Glickman) élargit mécaniquement l'échelle, si bien que ses
cotes ne tombent pas exactement sur la convention des 1000 points par cran. Passer le
calibrage en mode régression les remet à l'échelle. Sa valeur reste ailleurs : la colonne
d'incertitude, indispensable sur les blocs récents et sur les extrêmes de l'échelle.

**Ce qui fait la précision, par ordre d'importance :**

1. *Partir de la cotation de l'ouvreur* — sans cet a priori, l'erreur passe de 0,25 à
   0,82 cran (voir plus haut le prix de ce choix) ;
2. *Concentrer sur une seule salle* — le même code sur quatre salles donnait 0,42 cran ;
3. *Pondérer le style* — modeste mais réel, et un test le vérifie ;
4. *L'amorce des grimpeurs* — sans effet mesurable sur les cotes finales ; elle sert à ce que
   les cotes soient justes tout de suite, pas à ce qu'elles finissent mieux.

Le paramétrage par défaut vient d'un balayage : K 30, demi-vie 200, 12 passes. Les écueils
rencontrés, tous commentés dans le code :

- **Glicko divergeait** quand on augmentait les passes (l'incertitude des blocs s'accumulait
  et les figeait à tort) ;
- **le pas de Newton partait à l'infini** sur les blocs mal placés, l'espérance saturant et la
  courbure s'effondrant — d'où un pas plafonné ;
- **un bloc jamais raté a un optimum à l'infini** — cas très fréquent en salle sur les blocs
  faciles. Le lissage des scores à 2 % (le correctif standard contre la séparation) le rend
  fini. L'Elo, lui, n'en a pas besoin : son pas borné s'auto-limite.

## Les désaccords signalés sont-ils réels ?

La question mérite d'être posée sérieusement : les blocs démarrent à la cotation de l'ouvreur,
l'estimation est bruitée, et un bruit suffit à faire franchir un seuil. `desaccords.test.ts`
y répond par une **expérience témoin** plutôt que par un raisonnement — on rejoue tout le
pipeline sur un monde où l'ouvreur ne se trompe jamais, l'étiquette de chaque bloc étant sa
vraie difficulté. Tout désaccord qui subsiste là-bas est du bruit pur.

| | Monde réel | Témoin (ouvreur infaillible) |
|---|---|---|
| Blocs signalés | 22 sur 321 | **0 sur 321** |
| Écart médian | 0,18 cran | 0,10 cran |

Le taux de faux positifs est nul. Trois vérifications le confirment :

- **Précision 100 %** — les 22 blocs signalés sont tous réellement à plus d'un demi-cran de
  leur étiquette ;
- **Sens correct 22 fois sur 22** — le hasard en donnerait la moitié ;
- **Corrélation 0,73** entre l'écart calculé et la vraie erreur de l'ouvreur, avec une pente
  de 1,01 : l'écart affiché n'est ni tassé ni exagéré.

Et un indice qui vaut à lui seul démonstration : **les désaccords se concentrent là où les
données abondent** — 15 % des blocs à 40 duels et plus, contre 0 % en dessous de 10. Un
artefact de bruit ferait exactement l'inverse, puisque c'est sur les blocs peu répétés que
l'estimation est la plus incertaine.

**La contrepartie : le test est très conservateur.** Il ne se trompe pas sur ce qu'il signale,
mais il signale peu — 87 blocs réellement mal cotés passent au travers. Un bloc doit cumuler
une grosse erreur *et* beaucoup de duels pour franchir le seuil d'un cran contre l'a priori de
l'ouvreur.

| Seuil de signalement | Blocs signalés | Précision |
|---|---|---|
| 1,00 cran (actuel) | 22 | 100 % |
| 0,75 cran | 43 | 100 % |
| 0,50 cran | 67 | 79 % |

Descendre le seuil à 0,75 cran doublerait la récolte sans rien perdre en fiabilité — c'est la
constante `SEUIL_DESACCORD` dans `pipeline.ts`.

### Un biais à connaître : les blocs sous-cotés passent plus souvent au travers

En séparant les erreurs par sens, la détection n'est pas symétrique :

| Vraie erreur de l'ouvreur | Blocs | Détectés | Déplacement moyen |
|---|---|---|---|
| Bloc **plus dur** que son étiquette (sandbag) | 32 | 4 (13 %) | 0,54 cran |
| Bloc **plus facile** que son étiquette | 24 | 10 (42 %) | 0,77 cran |

Ce n'est pas un effet de volume : les deux groupes ont 34 duels en moyenne. C'est une
sous-convergence. Un bloc plus dur que son étiquette ne produit que des échecs — or l'échec
d'un grimpeur contre un bloc déjà coté au-dessus de lui est *attendu*, donc il ne corrige
presque rien. À l'inverse, un bloc plus facile qu'annoncé produit des réussites *surprenantes*,
qui le font chuter vite. La logistique sature d'un côté et pas de l'autre.

C'est ennuyeux, parce que le sandbag est justement ce qu'une salle veut repérer. Les leviers,
mesurés :

| Réglage | Sous-cotés détectés | Sur-cotés détectés |
|---|---|---|
| Défaut (amorce cotation, 12 passes) | 13 % | 42 % |
| 40 passes | 25 % | 58 % |
| K = 100 | 25 % | 54 % |
| Amorce uniforme | 53 % | 63 % |
| **Glicko** | **66 %** | 58 % |

Glicko est de loin le meilleur détecteur, et le seul à peu près symétrique : il amène chaque
bloc à son point fixe au lieu de l'y faire ramper. Pour chasser les blocs mal cotés, c'est la
formule à utiliser ; pour le classement au quotidien, Elo reste plus précis en médiane.

**Limite honnête de cette démonstration** : le témoin réutilise les mêmes ascensions, il
mesure donc le bruit de l'estimateur, pas celui de toute la chaîne. Il prouve que la méthode
ne fabrique pas de désaccords à partir de hasard — pas que tout désaccord réel soit une erreur
de cotation. Un bloc morpho, facile pour les grands et dur pour les petits, n'est pas mal coté
et ressortirait pourtant.

## Volume de données et temps de calcul

Le moteur relit tout l'historique à chaque passe : le coût est **linéaire en lignes × passes**.
Mesuré sur cette machine :

| Lignes | Duels | Elo bloc | Glicko |
|---|---|---|---|
| 19 000 | 10 500 | 22 ms | 93 ms |
| 75 000 | 42 000 | ~90 ms | ~350 ms |
| 300 000 | 168 000 | ~360 ms | ~1 400 ms |

Le repliement en duels joue en votre faveur ici : c'est le nombre de *duels*, pas de lignes,
qui pilote le coût du calcul. Une salle qui journalise chaque séance produit beaucoup de
lignes mais un nombre de duels borné par « nombre de grimpeurs × nombre de blocs réellement
tentés ».

À quoi s'ajoute la lecture + validation des CSV, environ **6 µs par ligne**, une seule fois au
chargement de la page (environ 120 ms pour les 19 000 lignes livrées).

En pratique il y a deux plafonds distincts, et le premier arrive avant le second :

- **La taille du bundle.** Les CSV étant compilés dans le JavaScript, 19 000 lignes pèsent
  déjà 580 ko. Vers 100 000 lignes ça devient déraisonnable à embarquer. Le remède est local : faire charger les fichiers à l'exécution
  plutôt qu'à la compilation, ce qui est un changement dans `src/core/sources/` et nulle part
  ailleurs.
- **Le confort des curseurs.** Bouger un réglage relance le calcul complet. En dessous de
  100 ms c'est imperceptible ; au-delà de ~150 000 lignes ça devient sensible. Le remède
  habituel est de déplacer le calcul dans un Web Worker — le code est déjà isolé pour ça,
  `src/core/` ne touche pas au DOM.

Ordre de grandeur pour vous : une salle qui journalise chaque séance produit facilement
40 000 à 100 000 lignes par an. C'est donc une question qui se posera, mais pas avant que le
site soit utile.

## Les écrans

| Écran | Ce qu'on y fait |
|---|---|
| **Blocs** | Le verdict : combien de blocs contredisent leur étiquette, lesquels, de combien. Cote Elo, nuage calculé/affiché, distribution des écarts, tableau exportable. Un filtre par salle apparaît s'il y en a plusieurs. |
| **Grimpeurs** | Classement avec cote Elo, niveau calculé (la cotation V envoyée une fois sur deux), courbes de progression. |
| **Formules** | Choix de la formule, réglage des paramètres, diagnostics, convergence, comparaison A/B de deux réglages. |
| **Données** | Les tables après validation, filtrables, exportables — y compris toutes les lignes repliées dans les duels. |
| **Fichiers** | Ce que le site sait de ses propres fichiers — et ce qu'il a refusé d'y lire. |

Chaque graphique a son équivalent en tableau : rien n'est accessible uniquement par la
couleur ou par le survol.

## Prochaine étape prévue : l'import utilisateur

L'architecture l'anticipe sans le coder. `src/core/sources/` définit un `SourceProvider` ;
aujourd'hui il n'y en a qu'un, les fichiers du dépôt. Brancher le glisser-déposer revient à
ajouter un second provider (lecture d'un `File`, persistance IndexedDB) et à le concaténer
dans `chargerToutesLesSources()`. Ni les parseurs, ni les formules, ni l'interface ne bougent.

## Changer d'échelle de cotation

L'échelle V est déclarée dans `src/core/cotations.ts` sous forme d'un simple tableau
d'étiquettes. Passer à l'échelle française, à Fontainebleau ou à une échelle maison, c'est
remplacer ce tableau : rien d'autre dans le projet ne connaît les étiquettes, tout le calcul
travaille sur un index numérique continu.

## Déploiement sur GitHub Pages

Le site est entièrement statique : il n'a besoin d'aucun serveur, seulement d'un hébergeur de
fichiers. GitHub Pages suffit, et le dépôt contient déjà tout ce qu'il faut.

**Ce qui est en place :**

- `.github/workflows/deploy.yml` — à chaque poussée sur `main`, GitHub vérifie les types,
  lance les 51 tests, construit le site et le publie. Un site qui ne compile pas, ou dont le
  cœur de calcul est cassé, n'est jamais mis en ligne.
- `base: './'` dans `vite.config.ts` — les chemins d'assets sont relatifs, donc le site
  fonctionne quel que soit le nom du dépôt, sans configuration à ajuster.
- `public/.nojekyll` — empêche GitHub de faire passer les fichiers par Jekyll, qui ignorerait
  les dossiers commençant par un souligné.
- `dist/` reste ignoré par git : c'est l'action qui le fabrique, on ne commite pas de build.

**Les trois étapes à faire une seule fois :**

Le dépôt est déjà branché sur <https://github.com/EricPrieur/CoteEloEscalade>. Il ne reste
qu'une chose à faire une seule fois, dans l'interface GitHub : **Settings → Pages → Source :
GitHub Actions**. Rien d'autre à régler.

Chaque poussée sur `main` déclenche alors le déploiement ; l'avancement se suit dans l'onglet
**Actions**, et le site est servi sur
<https://ericprieur.github.io/CoteEloEscalade/>.

Ensuite, publier une correction ou de nouvelles données revient à `git push` : le site se
reconstruit tout seul.

### Ce à quoi penser avant de rendre public

- **Le dépôt public expose les données.** Ici ce sont des données factices, aucun problème.
  Le jour où `data/` contiendra de vraies fréquentations nominatives, ce sera de la donnée
  personnelle : dépôt privé, ou pseudonymisation des grimpeurs avant commit.
- **Un dépôt privé peut quand même publier sur Pages**, mais seulement avec un compte payant.
  Sur un compte gratuit, Pages n'est disponible que pour les dépôts publics.
- **Le bundle pèse 907 ko** (173 ko compressé) parce que les CSV y sont compilés. C'est
  confortable pour Pages ; voir plus haut le seuil à partir duquel il faudra charger les
  fichiers à l'exécution plutôt qu'à la compilation.

## Palette

Les couleurs de données viennent d'une palette validée : bande de clarté, plancher de chroma,
séparation sous daltonisme, contraste sur les deux surfaces. Elles sont déclarées en jetons
CSS dans `src/styles.css`. Ne pas les remplacer à l'œil — toute nouvelle teinte doit repasser
la validation.
