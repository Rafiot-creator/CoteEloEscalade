# Cote Elo Escalade

Un site statique qui **recalcule la difficulté des blocs de salle à partir des réussites et
des échecs**, sans jamais regarder la cotation affichée par l'ouvreur — puis compare les deux.

Chaque **couple grimpeur–bloc donne lieu à un seul affrontement**, joué en direct : dès la
première séance infructueuse le grimpeur a perdu, et s'il finit par envoyer le bloc on lui
rend ses points et la défaite devient une victoire. On fait tourner un classement Elo sur ces
duels, et la cote V du bloc tombe du calcul. Les blocs dont le résultat s'écarte franchement
de leur étiquette sont, au choix, sous-cotés ou généreux.

Tout tourne dans le navigateur. Pas de serveur, pas de base de données, pas de compte.

> Ce fichier décrit ce que le projet **fait**. Pour savoir **pourquoi** — les choix de modèle,
> les pistes essayées et rejetées avec leurs chiffres, les erreurs de raisonnement corrigées
> en chemin — voir [DECISIONS.md](DECISIONS.md).

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

Le prix, mesuré : l'erreur médiane passe de 0,20 à 0,25 cote par rapport au modèle qui
n'enregistrait que l'issue. Les états intermédiaires sont plus bruités — c'est le coût d'un
classement honnête sur le moment plutôt que rétrospectif.

Les réglages sont dans l'écran **Formules**, groupe « Poids de la victoire » : mettre
« victoire après travail » à 1 annule complètement l'effet du style, ce qui permet de voir ce
qu'il apporte.

### On n'apprend rien d'un résultat joué d'avance

Un grimpeur situé deux cotes sous un bloc qui échoue, ou deux cotes au-dessus qui réussit :
le modèle l'avait déjà prédit, la correction est infime. Le problème n'est pas qu'elle soit
petite, c'est qu'elle est **systématiquement dans le même sens**. Un bloc que seuls des
grimpeurs bien plus faibles touchent ne reçoit que des échecs, donc une poussée vers le haut
que rien ne compense — et il dérive indéfiniment.

Ces duels sont donc écartés au-delà de **2000 points d'écart** (paramètre « Écart au-delà
duquel un résultat attendu est ignoré »), dans les deux formules. Un exploit reste évidemment
compté : c'est l'*issue attendue* qui est ignorée, pas l'écart.

| | Sans la règle | **Avec (2000 pts)** |
|---|---|---|
| Erreur médiane | 0,253 cote | **0,243 cote** |
| Blocs sous-cotés détectés | 34 % | **57 %** |
| Précision des signalements | 100 % | 98 % |
| Blocs jugeables | 321 | 226 |

La chute du nombre de blocs jugeables n'est pas une perte, c'est le point. Un duel écarté ne
compte plus dans les « duels utiles » d'un bloc, donc un bloc dont toutes les confrontations
étaient jouées d'avance tombe sous le seuil et n'est plus jugé. Ce sont exactement les
extrêmes de l'échelle :

| Cotation | V1 | V2 | V3 | V4 | V5 | V6 | V7 | V8 | V9 | V10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Blocs jugés, sans la règle | 26 | 35 | 36 | 33 | 35 | 43 | 36 | 33 | 23 | 21 |
| Blocs jugés, avec | **0** | 27 | 35 | 33 | 35 | 43 | 34 | 19 | **0** | **0** |

Et ces 95 blocs écartés étaient précisément les plus mal estimés : **0,46 cote d'erreur
moyenne, contre 0,29 pour ceux qui restent**. Autrement dit, le site cesse d'inventer une
cotation pour les V10 que personne n'envoie et les V1 que personne ne rate ; il dit « je n'ai
pas d'information » au lieu de produire un chiffre qui n'en était pas un.

C'est une conséquence de l'ouverture uniforme de V1 à V10 face à une communauté centrée sur
V5. Une salle réelle, qui ouvre surtout dans la fourchette de ses habitués, en perdrait
beaucoup moins.

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

## L'échelle : une cote V = 1000 points = dix contre un

Deux conventions se rejoignent, et c'est ce qui rend l'échelle lisible :

1. **1000 points d'écart valent dix chances contre une de réussir** (90,9 %). C'est le
   paramètre `échelle` de la logistique Elo : avec `E = 1/(1 + 10^(−Δ/échelle))`, la cote du
   match vaut `E/(1−E) = 10^(Δ/échelle)`, donc poser `échelle = 1000` place exactement le
   rapport 10:1 à 1000 points. (La convention des échecs le place à 400.)
2. **Un bloc démarre à sa cotation × 1000** : un V1 à 1000, un V2 à 2000, un V10 à 10 000.

Mises bout à bout : **une cote V d'écart, c'est dix chances contre une**. Un grimpeur coté
5 000 (V5) envoie un V4 neuf fois sur dix, un V5 une fois sur deux, un V6 une fois sur dix.
Deux cotes valent 100 contre 1. La cote se lit donc directement : **divisez par 1000 et vous
avez la cote V**, décimales comprises.

**Les grimpeurs partent à leur niveau**, pas au milieu de l'échelle : un grimpeur V4 démarre
vers 4 000. Ce niveau vient du champ `niveau_declare` s'il est renseigné (ce que beaucoup de
salles demandent à l'inscription), sinon de la médiane des blocs affrontés lors des douze
premiers duels — on choisit spontanément des blocs proches de son niveau. À défaut de tout,
5 000.

Sur ce jeu de données, l'amorce ne change pas les cotes finales de façon mesurable (0,253
contre 0,249 cote d'erreur : c'est du bruit) — cinq mois suffisent à converger de toute
façon. Son intérêt est ailleurs : **la cote affichée d'un nouveau est juste dès sa première
séance** au lieu de partir de V5 et de dériver pendant des semaines, en distribuant au
passage des victoires imméritées aux blocs faciles qu'il affronte.

**Le calcul confirme la convention.** En basculant le calibrage en mode régression, le site
cherche lui-même combien de points sépare deux cotes dans les données : il trouve
**1005 points, avec un r² de 0,965**. Autrement dit, les 1000 points par cote ne sont pas
qu'un choix commode — ils correspondent à ce que les résultats disent. C'est un contrôle à
refaire sur vos vraies données : si la régression y trouve 600 ou 1500, c'est que les cotes de
la salle sont plus resserrées ou plus étalées que la convention ne le suppose.

Les cotes Elo brutes sont affichées dans une colonne dédiée des écrans **Blocs** et
**Grimpeurs**, à côté de leur traduction en cotation V. Sur le jeu livré elles vont de
985 à 10 006 pour les blocs et de 2 890 à 7 856 pour les grimpeurs.

La conversion (« divisez par 1000 ») était jusque-là seulement dans la bulle d'aide au survol
de l'en-tête de colonne — invisible sur tactile, où le survol n'existe pas. `LegendeCote`
(`src/ui/components/base.tsx`) affiche donc en permanence, sous les tuiles de chiffres des
écrans **Blocs**, **Grimpeurs** et **Carte** (cette dernière seulement quand le centre a un
jeu de données connecté, sinon il n'y a aucune cote à convertir), le même rappel en texte
visible : « 1 cote V = 1000 points (V1 = 1000, V2 = 2000, V3 = 3000…) ».

### Le prix de cette convention

Partir de la cotation de l'ouvreur, c'est en faire un a priori : le classement le corrige
mais ne l'ignore pas. L'audit devient donc **conservateur** — il signale 22 blocs en désaccord
là où un départ neutre en signalerait davantage.

Le mode **« Amorce uniforme »** (écran Formules) fait démarrer tous les blocs au même point :
le résultat est alors totalement indépendant des cotations affichées, ce qui est la seule
façon de les auditer sans biais. Le coût est réel et mesuré : l'erreur médiane passe de
0,25 à 0,82 cote, parce que les blocs situés hors du champ de la communauté — les V1 que
personne ne rate, les V10 que personne n'envoie — ne peuvent plus être placés que par
défaut. À utiliser pour vérifier une intuition, pas comme réglage permanent.

## Démarrer

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 62 tests sur le cœur de calcul
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
- **autant de blocs par cote, de V1 à V10** — environ 36 de chacun. C'est une consigne
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
- **trois grimpeurs sur quatre déclarent un niveau à l'inscription**, à une cote près. Le
  quatrième ne dit rien, et son niveau de départ est estimé depuis ses premiers blocs.

### La conséquence d'une ouverture uniforme

La communauté est centrée sur V5 avec une cote d'écart-type ; les blocs, eux, s'étalent de V1
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
peuvent flotter l'une par rapport à l'autre de plusieurs cotes sans que le calcul puisse s'en
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
  cartes/                 positions des blocs sur le plan d'un centre (indépendant du calcul)
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
| **Mélange Elo + Glicko** | La moyenne des deux autres. Elles ne se trompant pas de la même façon, leur moyenne fait moins de grosses erreurs que chacune prise seule. |
| **Glicko (cote + fiabilité)** | Mêmes duels, sans pondération du style, mais chaque cote porte son incertitude — un bloc ouvert la semaine dernière et fait par trois personnes ne se fait plus passer pour une mesure. Sert aussi de point de comparaison propre : si elle donne les mêmes cotes, c'est que la pondération ne change pas grand-chose. |

## Ce que valent ces formules

Le jeu de démonstration ayant une vérité terrain, on peut mesurer plutôt que d'affirmer
(amorce uniforme — les cotations de l'ouvreur n'entrent jamais dans le calcul) :

| Formule | Erreur médiane | Corrélation avec la difficulté réelle | Brier | Temps |
|---|---|---|---|---|
| Elo bloc | 0,24 cote V | **0,985** | 0,062 | 22 ms |
| **Glicko** | **0,19 cote V** | 0,979 | 0,058 | 119 ms |

Autrement dit : sur les 321 blocs jugeables, la cote calculée tombe à un quart de cote de la
difficulté réelle.

**Glicko est passé devant.** Écarter les résultats joués d'avance l'a transformé : son erreur
médiane tombe de 0,295 à 0,188 cote, et son taux de fausses alertes de 26 % à 4 %. La raison
est nette — sa méthode pousse chaque bloc à son point fixe, y compris quand ce point fixe est
à l'infini faute de contre-exemple. C'est cette séparation que le lissage des scores à 2 %
tentait de rattraper ; écarter les résultats joués d'avance en supprime la cause.

À taux de fausses alertes égal, la comparaison est sans appel :

| | Fausses alertes | Précision | Sandbags détectés |
|---|---|---|---|
| Elo, seuil 0,75 | 2,8 % | 98 % | 57 % |
| **Glicko, seuil 1,00** | **2,5 %** | 97 % | **78 %** |
| Glicko, seuil 0,75 | 4,0 % | 92 % | 89 % |

Glicko trouve donc nettement plus de blocs mal cotés pour moins de fausses alertes. **Pour un
audit d'ouverture ciblé, basculer sur Glicko dans l'écran Formules reste le bon réflexe.**

(Cette conclusion contredit ce que ce README affirmait avant l'ajout de la règle des résultats
joués d'avance : Glicko y était donné pour trop bavard. C'était vrai à l'époque, et faux
depuis.)

La formule **livrée par défaut est le mélange** — voir plus bas. Elle ne cherche pas à
maximiser la détection mais à se tromper le moins gravement possible, et elle ne se prononce
que là où les deux composantes ont un avis.

**Ce qui fait la précision, par ordre d'importance :**

1. *Partir de la cotation de l'ouvreur* — sans cet a priori, l'erreur passe de 0,25 à
   0,82 cote (voir plus haut le prix de ce choix) ;
2. *Concentrer sur une seule salle* — le même code sur quatre salles donnait 0,42 cote ;
3. *Écarter les résultats joués d'avance* — gain modeste sur l'erreur médiane, mais c'est le
   levier décisif pour la détection des blocs sous-cotés : 34 % → 57 % ;
4. *Pondérer le style* — modeste mais réel, et un test le vérifie ;
5. *L'amorce des grimpeurs* — sans effet mesurable sur les cotes finales ; elle sert à ce que
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
| Blocs signalés | 45 sur 226 | **6 sur 226** (2,7 %) |
| Écart médian | 0,18 cote | 0,10 cote |

Trois vérifications confirment que ces désaccords sont réels :

- **Précision 98 %** — les blocs signalés sont presque tous réellement à plus d'une demi-cote
  de leur étiquette ;
- **Sens correct dans plus de 90 % des cas** — le hasard en donnerait la moitié ;
- **Corrélation 0,73** entre l'écart calculé et la vraie erreur de l'ouvreur, avec une pente
  de 1,01 : l'écart affiché n'est ni tassé ni exagéré.

Et un indice qui vaut à lui seul démonstration : **les désaccords se concentrent là où les
données abondent** — 15 % des blocs à 40 duels et plus, contre 0 % en dessous de 10. Un
artefact de bruit ferait exactement l'inverse, puisque c'est sur les blocs peu répétés que
l'estimation est la plus incertaine.

### Le choix du seuil

`SEUIL_DESACCORD` (dans `pipeline.ts`) vaut **0,75 cote**, et ce n'est pas une intuition : le
protocole du témoin permet de tracer la courbe complète.

| Seuil | Signalés | Précision | Faux positifs (témoin) | Sandbags détectés |
|---|---|---|---|---|
| 0,50 | 67 | 79 % | 6,5 % | 56 % |
| **0,75** | **43** | **100 %** | **1,2 %** | **34 %** |
| 1,00 | 22 | 100 % | 0,0 % | 13 % |
| 1,25 | 12 | 100 % | 0,0 % | 6 % |

0,75 double la récolte par rapport à 1,00 sans perdre en précision, et surtout fait passer la
détection des blocs sous-cotés de 13 % à 34 %. Le prix est visible et assumé : quatre faux
positifs sur 321 dans le monde témoin, au lieu d'aucun. À 0,50 la précision s'effondre à
79 %, ce qui abîmerait la confiance dans la liste.

**Le test reste conservateur** : 66 blocs réellement mal cotés passent encore au travers. Le
site montre les fautes certaines, pas toutes les fautes.

### Un biais à connaître : les blocs sous-cotés passent plus souvent au travers

En séparant les erreurs par sens, la détection n'est pas symétrique :

| Vraie erreur de l'ouvreur | Blocs | Détectés | Déplacement moyen |
|---|---|---|---|
| Bloc **plus dur** que son étiquette (sandbag) | 32 | 4 (13 %) | 0,54 cote |
| Bloc **plus facile** que son étiquette | 24 | 10 (42 %) | 0,77 cote |

Ce n'est pas un effet de volume : les deux groupes ont 34 duels en moyenne. C'est une
sous-convergence. Un bloc plus dur que son étiquette ne produit que des échecs — or l'échec
d'un grimpeur contre un bloc déjà coté au-dessus de lui est *attendu*, donc il ne corrige
presque rien. À l'inverse, un bloc plus facile qu'annoncé produit des réussites *surprenantes*,
qui le font chuter vite. La logistique sature d'un côté et pas de l'autre.

C'est ennuyeux, parce que le sandbag est justement ce qu'une salle veut repérer. Les leviers,
mesurés :

| Réglage (au seuil de 1 cote, sans écart négligé) | Sous-cotés détectés | Sur-cotés détectés |
|---|---|---|
| Défaut de l'époque | 13 % | 42 % |
| 40 passes | 25 % | 58 % |
| K = 100 | 25 % | 54 % |
| Amorce uniforme | 53 % | 63 % |
| Glicko | 66 % | 58 % |

Deux leviers ont été retenus, et ils se cumulent : abaisser le seuil de signalement à 0,75
cote (13 % → 34 %) puis écarter les résultats joués d'avance (34 % → **57 %**). Aucun des deux
ne touche aux réglages du modèle lui-même.

**Attention au piège de comparaison** : ce tableau met toutes les variantes au même seuil, ce
qui n'a pas de sens — chacune se place où elle veut sur la courbe précision/rappel. Deux
formules ne se comparent qu'à **taux de fausses alertes égal**, mesuré sur le monde témoin.
C'est ainsi qu'est établi le classement Elo / Glicko donné plus haut.

**Limite honnête de cette démonstration** : le témoin réutilise les mêmes ascensions, il
mesure donc le bruit de l'estimateur, pas celui de toute la chaîne. Il prouve que la méthode
ne fabrique pas de désaccords à partir de hasard — pas que tout désaccord réel soit une erreur
de cotation. Un bloc morpho, facile pour les grands et dur pour les petits, n'est pas mal coté
et ressortirait pourtant.

## Les deux formules sont affichées ensemble

Les écrans **Blocs** et **Grimpeurs** montrent une colonne de cote **par formule**, en
permanence, celle de la formule active étant en gras. Toutes les formules déclarées sont
calculées à chaque fois — ça reste peu coûteux, la mémoïsation ne recalcule que celle dont on
vient de bouger un réglage.

L'intérêt n'est pas décoratif : **quand les deux formules s'écartent nettement sur un bloc,
c'est que ce bloc est mal connu.** Sur le jeu livré, le bloc AR-0096 — que personne n'a envoyé —
est coté 7 529 par l'Elo et 9 000 par Glicko, une cote et demie d'écart. Les deux disent « c'est
dur », aucune ne sait dire à quel point. À l'inverse, un bloc sur lequel les deux tombent à
50 points près est une mesure solide.

La colonne **Incertitude** puise désormais dans la formule qui en produit une, quelle que soit
la formule active : elle est donc toujours renseignée.

### Deux avis valent mieux qu'un

Puisque les deux formules sont calculées de toute façon, l'écran **Blocs** les fait voter. Un
bloc est signalé dès qu'**une** formule le conteste, et marqué **confirmé** quand les **deux**
le font. Chacune ayant son propre bruit, elle a son propre seuil, déclaré dans sa définition
(`seuilDesaccord`) : 0,75 cote pour l'Elo, 1,00 pour Glicko, choisis pour un taux de fausses
alertes comparable sur le monde témoin.

### Détecter et coter sont deux métiers différents

La **cote affichée** vient du mélange : c'est la formule qui se trompe le moins gravement.
La **détection** des blocs mal cotés, elle, est confiée au jury Elo + Glicko, réglé pour la
sensibilité — deux objectifs distincts, deux réglages distincts.

Glicko y joue le rôle de la voix sensible : son seuil est descendu à 0,75 alors que sa seule
précision commanderait 1,00. Son rôle est de rattraper les blocs sous-cotés, que l'Elo laisse
passer parce qu'un échec attendu ne le fait presque pas bouger.

Mesuré sur l'ensemble des 369 blocs, dont 33 sont réellement sous-cotés d'une cote ou plus :

| Méthode | Fausses alertes | Précision | Sandbags trouvés |
|---|---|---|---|
| Elo seul (0,75) | 1,6 % | 98 % | 39 % |
| Glicko seul (1,00) | 1,4 % | 97 % | 42 % |
| Mélange seul (0,75) | 1,4 % | 98 % | 42 % |
| Union, Glicko à 1,00 | 2,4 % | 96 % | 52 % |
| **Union, Glicko à 0,75** | **3,0 %** | **92 %** | **58 %** |
| Union, Glicko à 0,60 | 5,1 % | 90 % | 61 % |
| Les deux (« confirmé ») | 0,8 % | **100 %** | 30 % |

Dix-neuf points de détection en plus que l'Elo seul, pour 1,4 point de fausses alertes. On
s'arrête à 0,75 : descendre Glicko à 0,60 coûterait 70 % de fausses alertes en plus pour trois
points de détection. Et le niveau « confirmé » donne une liste sur laquelle agir sans
vérifier : **précision 100 %**.

(Les chiffres de sensibilité cités plus haut dans ce fichier avant cette section utilisaient
un dénominateur restreint aux blocs jugés par la formule concernée, ce qui les flattait. Ceux
de ce tableau portent sur l'ensemble des blocs — c'est la mesure honnête de « quelle part des
vrais sandbags le site trouve-t-il ».)

**L'union produit plus de fausses alertes que l'Elo seul. Est-ce le prix de l'union ?** Non :
c'est le prix de la sensibilité. En réglant chaque formule seule pour produire exactement les
mêmes 3,0 % de fausses alertes que l'union, elle reste devant sur les deux axes :

| Méthode, réglée à 3,0 % de fausses alertes | Précision | Sandbags |
|---|---|---|
| Elo seul, seuil 0,61 | 89 % | 55 % |
| Glicko seul, seuil 0,68 | 92 % | 48 % |
| Mélange seul, seuil 0,55 | 88 % | 52 % |
| **Union Elo 0,75 + Glicko 0,75** | **92 %** | **58 %** |

Aucune formule seule n'atteint 58 % de détection sous 3 % de fausses alertes. Le choix du
point de fonctionnement — 3 % plutôt que 2,4 % — est une décision de produit, séparée de celle
de la structure ; la structure, elle, est démontrée meilleure.

**Ce que coûte et rapporte concrètement ce point de fonctionnement.** Le jeu livré contient
33 blocs réellement sous-cotés. Passer Glicko de 1,00 à 0,75 en fait trouver **deux de plus**
(17 → 19) et ajoute **deux fausses alertes** (9 → 11) sur 369 blocs. À cette échelle, le débat
porte donc sur une poignée de blocs — il ne faut pas le surestimer.

Ce qui a emporté la décision est ailleurs : la liste **« confirmé »**, celle sur laquelle on
agit sans revérifier, passe de **28 à 35 blocs en conservant 100 % de précision**. Sept blocs
mal cotés de plus, certifiés, pour un coût nul sur la fiabilité de cette liste.

**Et si la précision comptait plus que la détection**, remonter le `seuilDesaccord` de Glicko
à 1,00 dans sa définition ramène l'union à 2,4 % de fausses alertes et 96 % de précision, pour
52 % de détection. Une ligne.

### Lire la colonne « Verdict »

- **accord** — aucune formule ne conteste l'ouvreur. Ce n'est *pas* une absence de données :
  un bloc n'apparaît dans ce tableau que s'il est jugeable par toutes les formules, donc
  aucune ne s'abstient. C'est un vrai verdict d'accord.
- **à vérifier** — une seule formule conteste.
- **confirmé** — toutes le contestent. C'est la liste à 100 % de précision.

Deux pistes ont été essayées et écartées, chiffres à l'appui :

- **Moyenner les deux écarts** au lieu de les faire voter : détecte autant, mais avec une
  précision inférieure (92 % contre 96 %). Le vote conserve mieux l'information.
- **Un test binomial direct** — comparer le nombre d'envois observé à celui attendu sous
  l'hypothèse « l'étiquette est juste » — s'annonçait comme le plus rigoureux et s'est révélé
  le pire : 16 % de fausses alertes, 54 % de précision. La raison est instructive : l'étiquette
  est un entier alors que la difficulté réelle est continue, si bien que l'hypothèse nulle
  « la difficulté vaut exactement l'étiquette × 1000 » est fausse pour presque tous les blocs.
  Le test détecte donc « l'étiquette n'est pas exacte », ce qui est vrai partout, au lieu de
  « l'étiquette est franchement fausse ». Il faudrait une hypothèse nulle d'intervalle
  (± une demi-cote), donc un test d'équivalence, pas un test de point.
- **Un troisième juré** (l'Elo sans a priori, dont les erreurs sont indépendantes de
  l'étiquette) : trop bruyant seul — 42 % de fausses alertes — il dégrade le jury.

### La troisième formule : le mélange

`melange.ts` moyenne les cotes des deux autres. C'est mesurable et c'est vrai : sur les
189 blocs que les deux jugent, l'erreur **quadratique** tombe à 0,296 contre 0,318 pour l'Elo
et 0,350 pour Glicko. Autrement dit, le mélange fait moins de grosses erreurs que l'un *et*
l'autre — l'Elo est prudent mais souvent imprécis, Glicko plus juste sur le bloc courant mais
plus aventureux sur les cas limites.

| Poids Glicko | Erreur médiane | Erreur quadratique |
|---|---|---|
| 0,0 (Elo seul) | 0,243 | 0,318 |
| 0,4 (optimum) | 0,197 | **0,294** |
| **0,5 (par défaut)** | 0,203 | 0,296 |
| 1,0 (Glicko seul) | 0,182 | 0,350 |

C'est la formule montrée par défaut. Elle ne détecte pas le plus (Glicko fait mieux sur ce
terrain) : elle **se trompe le moins gravement**, et elle est plus prudente — n'étant jugeable
que là où les deux composantes le sont, elle ne se prononce que sur 189 blocs au lieu de 226
pour l'Elo seul. L'écran Blocs affiche donc un peu moins de blocs, mais chacun repose sur deux
estimations concordantes.

Le poids par défaut est **la moitié**, volontairement, alors que l'optimum mesuré est vers 0,4.
Cet optimum est estimé sur une vérité terrain simulée : le retenir serait du surajustement,
alors que la moyenne simple en capte déjà l'essentiel — 0,296 contre 0,294 — sans aucun
paramètre à justifier.

**Le gain reste modeste, et il faut savoir pourquoi** : la corrélation entre les erreurs des
deux formules est de **0,73**. Elles partagent les mêmes données, le même repliement en duels,
le même a priori et le même filtre — elles se trompent largement ensemble. Un vrai gain
d'ensemble demanderait un point de vue réellement différent, pas une variante de la même
mécanique.

**Le mélange ne vote pas au jury.** Une moyenne ne peut franchir un seuil que si l'une de ses
composantes le franchit : sa voix serait purement redondante, et la mesure le confirme — sur
le jeu livré, elle ne signale **aucun** bloc que les deux autres ne signalent déjà. Elle est
donc déclarée `avisIndependant: false` et garde sa colonne sans sa voix. Un test le vérifie.

Deux limites assumées : le mélange fait tourner les deux formules avec **leurs valeurs par
défaut**, donc régler l'Elo ne le change pas (en échange, il reste une référence stable) ; et
sa courbe de progression est celle de la formule qui pèse le plus lourd, les deux trajectoires
n'étant pas alignables — l'Elo produit un point par événement, Glicko un par période. Elle est
en revanche **recalée** pour finir sur la cote mélangée, faute de quoi la courbe d'un grimpeur
s'achèverait sur une valeur différente de celle affichée dans le classement. Le décalage étant
constant par grimpeur, la forme de la trajectoire — la seule information qu'elle porte — n'est
pas touchée.

## Faut-il passer à Glicko-2 ?

**Non, pas sur ces données.** Ce que Glicko-2 ajoute à Glicko, c'est une **volatilité** σ par
joueur : une mesure de l'irrégularité de ses performances, qui élargit son incertitude quand
il est imprévisible. C'est utile, mais deux choses l'empêchent de servir ici.

**Il n'y a pas assez de périodes de classement.** La volatilité s'estime en comparant les
performances observées aux performances attendues *d'une période à l'autre*. Avec les réglages
livrés (périodes de 120 jours sur cinq mois de données), Glicko en compte **deux**. Même en
descendant à 30 jours on n'en a que six, avec 1 000 duels chacune. σ serait dominé par son
a priori τ : on ajouterait un paramètre libre et un solveur itératif imbriqué pour n'estimer
que du bruit.

**Et la moitié des entités n'ont pas de volatilité.** Un bloc ne change pas de difficulté avec
le temps — c'est l'hypothèse explicitement encodée dans la phase B, où toute l'histoire d'un
bloc forme une seule période. Modéliser la volatilité d'un bloc reviendrait à estimer une
grandeur qui n'existe pas.

S'ajoute une friction : Glicko-2 travaille sur une échelle transformée bâtie autour de la
convention des 400 points (μ = (r − 1500) / 173,7178, où 173,7178 = 400 / ln 10). L'adapter à
la convention des 1000 points est faisable, mais ce serait un endroit de plus où une
incohérence d'échelle peut se glisser sans bruit — le projet en a déjà fait les frais.

**Ce qui limite la précision aujourd'hui, ce n'est pas la règle de mise à jour** : c'est le
volume de données par bloc (28 duels médians) et le fait de partir de la cotation de
l'ouvreur. Glicko-2 ne touche ni à l'un ni à l'autre.

La question se reposera utilement le jour où il y aura **deux ou trois ans d'historique**,
donc une vingtaine de périodes : la volatilité des grimpeurs deviendrait alors estimable, et
elle dirait quelque chose de vrai — qui progresse, qui stagne, qui est irrégulier. À ce
moment-là, l'appliquer aux grimpeurs seulement, en laissant les blocs sur Glicko-1.

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
| **Carte** | Plan du centre choisi, blocs positionnés en pastilles colorées. Ajouter, déplacer, modifier ou supprimer un bloc et exporter la carte sont réservés à l'accès complet. Survoler un bloc propose trois boutons — flash, réussi, échec — pour enregistrer un envoi ; quand le centre a un jeu de données connecté (aujourd'hui, Démo) et que le nom saisi correspond à un grimpeur connu, c'est une vraie ascension qui s'ajoute au calcul, pas un simple repère visuel. Détails plus bas, « La carte des blocs ». |
| **Formules** *(accès complet)* | Choix de la formule, réglage des paramètres, diagnostics, convergence, comparaison A/B de deux réglages. |
| **Données** *(accès complet)* | Les tables après validation, filtrables, exportables — y compris toutes les lignes repliées dans les duels. |
| **Fichiers** *(accès complet)* | Ce que le site sait de ses propres fichiers — et ce qu'il a refusé d'y lire. |

Chaque graphique a son équivalent en tableau : rien n'est accessible uniquement par la
couleur ou par le survol.

**Les en-têtes de colonne se survolent.** Toute colonne dont le titre ne se suffit pas à
lui-même porte une description — ce qu'elle mesure, comment la lire, ce qu'elle ne dit pas.
Elle s'affiche au survol de l'en-tête, signalé par un soulignement pointillé. C'est le champ
`aide` du type `Colonne`, à renseigner pour toute nouvelle colonne un tant soit peu
technique : « Écart », « Duels utiles » ou « Verdict » ne veulent rien dire sans explication.

## Deux niveaux d'accès : visiteur et complet

Le site n'a ni serveur ni compte, donc pas de vraie authentification. Par défaut, un visiteur
ne voit que les écrans **Blocs**, **Grimpeurs** et **Carte** — les trois autres, plus
techniques, sont masqués. Visiter une fois une URL contenant un paramètre secret débloque
l'« accès complet » sur ce navigateur (mémorisé en `localStorage`, `src/ui/acces.ts`) ; les six
écrans apparaissent alors, et un bouton dans l'en-tête permet de basculer à volonté entre « Vue
complète » et « Vue visiteur » sans perdre le déverrouillage.

**Exception** : l'écran **Carte** est visible dans les deux vues, mais son édition (ajouter,
déplacer, modifier, supprimer un bloc, exporter la carte) est réservée à l'accès complet ; la
vue visiteur n'y a que de la lecture et le suivi personnel des envois. Voir « La carte des
blocs » ci-dessous.

**Ce n'est qu'un masquage d'interface, pas une protection réelle** : le site étant statique,
le paramètre secret est visible dans le code source par quiconque le cherche. Suffisant tant
que les données restent factices ; le jour où de vraies données personnelles entrent en jeu,
il faudra un vrai compte côté serveur (voir « Quand vous ajouterez une deuxième salle » et la
note sur les données personnelles plus haut).

## La carte des blocs

L'écran **Carte** montre le plan du centre choisi dans le menu déroulant, avec les blocs
positionnés dessus sous forme de pastilles. C'est le seul écran où les deux niveaux d'accès
coexistent dans la même vue plutôt que de se masquer entièrement : en accès complet on édite,
en vue visiteur on ne fait que consulter et cocher ses propres envois.

### Modèle de données et architecture

`src/core/cartes/types.ts` déclare `BlocCarte` (position relative `x`/`y` de 0 à 1, cotation,
couleur, style, nom optionnel de l'étiquette) et une interface `CarteProvider` — calquée sur
`SourceProvider` (les CSV). La seule implémentation aujourd'hui (`src/core/cartes/sources.ts`)
lit `data/cartes/<centreId>.json`, **versionné avec le code** comme le reste de `data/` : Git
sert d'historique des positions. Ce choix anticipe explicitement un futur serveur — le jour où
des ouvreurs modifieront la carte en direct, seule cette source change, `VueCarte.tsx` ne
connaît que `chargerCarte(centreId)`.

Le suivi « j'ai envoyé ce bloc » (`src/ui/suivi.ts`) suit le même principe : une interface
`SuiviProvider`, aujourd'hui posée sur `localStorage`, indexée par couple **(centre,
grimpeur)** — un même appareil peut donc suivre plusieurs grimpeurs, utile sur une tablette
partagée en salle. Le nom choisi est mémorisé par centre pour ne pas le retaper à chaque
visite, avec un bouton pour l'effacer. C'est un repère purement visuel, qui n'entre dans aucun
calcul — voir plus bas pourquoi ça ne suffisait plus.

### Pastilles, survol et popup

Les blocs sont des pastilles rondes à fond métallique (dégradé + reflet), la cotation V
affichée au centre. La couleur de fond suit la couleur réelle des prises (bleu, vert, jaune,
orange, rouge, noir, blanc, mauve — `PALETTE_COULEURS` dans `VueCarte.tsx`), avec un texte
clair ou foncé choisi pour rester lisible sur chaque fond.

**Taille des pastilles.** Leur rayon (`RAYON` dans `VueCarte.tsx`) suit la largeur réelle de la
carte selon une échelle continue plutôt qu'un seuil fixe : `RAYON = largeur × 1,8 %`, borné
entre 5 et 20 px (le plancher était à 8 avant un deuxième retour de Raphaël sur téléphone —
8 px annulait justement l'échelle proportionnelle sur les cartes les plus étroites, la où elle
compte le plus ; le seul repère fiable reste l'essai réel sur l'appareil, pas une valeur choisie
au jugé). La police de la cotation affichée garde son propre plancher (7 px), indépendant de
`RAYON`, pour rester lisible même à 5. La raison de l'échelle continue plutôt qu'un simple
« plus petit sous X px » :
les positions des blocs (`x`/`y`, des fractions 0–1 de la largeur de la carte) rétrécissent
avec la carte, donc l'espacement entre pastilles rétrécit dans la même proportion — un rayon
qui ne baisse pas dans cette même proportion reste relativement trop gros (et donc chevauche
ses voisins) même s'il a diminué en valeur absolue. Le ratio (1,8 %) reprend le rapport
observé sur bureau (20 px pour une carte d'environ 1150 px). Mesurée via un `useLayoutEffect`
qui lit `getBoundingClientRect().width` au montage et à chaque `resize` de la fenêtre — pas un
`ResizeObserver` : les navigateurs limitent ou retardent ses callbacks sur un onglet sans le
focus, ce qui a fait échouer la première version pendant les tests (l'observer ne se déclenchait
jamais dans l'outil d'automatisation utilisé pour vérifier ce correctif, un détail qui aurait pu
tout aussi bien se produire sur un vrai téléphone en veille).

Cette taille dépendait d'une correction de layout plus large : `.marque` (titre + sous-titre de
l'en-tête) avait un `white-space: nowrap` qui l'empêchait de rétrécir sous ~470 px même dans
`@media (max-width: 620px)`, ce qui forçait toute la page — carte comprise — à rester aussi
large que ce sous-titre. Sans ce correctif (`.marque { white-space: normal }` dans cette même
media query, `styles.css`), la carte n'aurait jamais atteint le seuil de 420 px sur un vrai
téléphone, peu importe le seuil choisi pour `RAYON`.

Survoler un bloc (ou cliquer dessus — voir plus bas) ouvre un popup : nom du bloc, son statut
pour le grimpeur choisi (« Flash ⚡ » ou « Réussi ✓ » en vert, « Échoué » en rouge, ou « Jamais
essayé » en gris), sa cotation affichée suivie de sa cote Elo exacte entre parenthèses (celle
de la formule mélange, quand ce bloc existe aussi dans le jeu de données d'ascensions), son
style, et les trois boutons flash (⚡, vert), réussi (✓, jaune), échec (✕, rouge). Ce popup est
en `position: absolute`, ancré sur la pastille (donc sur la carte elle-même) plutôt qu'en
`position: fixed` (relatif à la fenêtre) : un popup fixe ignore le pinch-zoom tactile sur mobile
— sa taille en pixels CSS ne change pas avec le zoom, alors que la fenêtre visible, elle,
rétrécit d'autant, si bien qu'il finit par déborder largement de l'écran. Sa position est bornée
dans les limites de la carte (bascule à gauche de la pastille si la place manque à droite) pour
ne pas se faire couper près d'un bord, sans avoir besoin d'échapper à l'`overflow: hidden` de la
zone de carte comme le ferait un `position: fixed`. Sa taille à l'écran, elle, reste constante
même en zoomant : compensée par un `transform: scale(1 / échelle)` à partir de
`window.visualViewport.scale` (l'échelle du pinch-zoom courant), pour rester lisible plutôt que
de grossir avec le contenu qu'il annote.

Un bloc déjà envoyé (flash ou réussi, pas simplement tenté) par le grimpeur choisi se
reconnaît aussi sans survoler : sa pastille passe en gris (opacité réduite + désaturation
modérée) avec un contour vert (`var(--bon)`), dans les deux niveaux d'accès. Ce contour est le
même que celui, gris, que chaque pastille aurait par défaut pour se détacher du fond de carte —
il devient simplement vert pour ce statut, au lieu d'être un anneau séparé posé par-dessus.
Deux versions successives d'un anneau séparé (un `<span>` à part, positionné autour de la
pastille) se sont révélées peu fiables sur téléphone — débordement, halo visible entre les deux
éléments, empiètement sur le chiffre selon le navigateur — avant que Raphaël ne fasse remarquer
que ce contour par défaut (gris, présent sur toute pastille non envoyée, même sur PC) n'avait
lui-même aucune utilité et devait simplement disparaître : retiré. Un bloc jamais tenté ou raté
n'a donc plus aucune marque distinctive sur la carte — seul le popup au survol/clic dit encore
« Jamais essayé » ou « Échoué ».

**Ouvrir le popup au clic plutôt qu'au survol.** Le survol seul exclut les appareils sans
souris (une tablette en salle, justement l'usage visé). En vue visiteur, cliquer un bloc ouvre
le popup — s'il n'y a pas de jeu de données connecté (`enregistrerAscension` absent, cf. plus
bas), le clic retombe sur l'ancien bascule `suivi.ts`, pour ne pas retirer la seule
interaction disponible sur un centre non connecté. En accès complet, le clic sert déjà à
sélectionner/déplacer un bloc : **Majuscule (shift) + clic** ouvre le popup sans déclencher ni
la sélection ni le glisser (`debuterGlisse` ignore l'événement quand `e.shiftKey` est vrai).
Cliquer le fond de la carte (pas un bloc) referme le popup ouvert, dans les deux niveaux
d'accès.

Le popup s'ouvre (`setSurvole(id)`), il ne bascule pas : un clic suit presque toujours un
survol qui a déjà ouvert le même popup, un bascule le refermerait aussitôt.

**Le popup se ferme en quittant la pastille _et_ le popup, pas avant.** La pastille (un
cercle) et le popup portent chacun un `onMouseEnter`/`onMouseLeave` qui pilote `survole` ; le
popup doit donc rester un survol continu de l'un des deux pour ne pas se fermer. Le piège :
si le popup est décalé de quelques pixels de la pastille pour ne pas la recouvrir, la bande de
fond de carte entre les deux n'appartient ni à l'un ni à l'autre, et la traverser (même en
ligne droite, pire en diagonale vers des boutons plus bas que la pastille) fait perdre le
survol un instant — assez pour fermer le popup avant d'avoir pu cliquer. Fix : le popup est
collé contre la pastille, sans écart (`left: ancreX + RAYON - 2`, un chevauchement de 2 px
plutôt qu'un écart, contre les arrondis de sous-pixel) et partage le même point haut
(`ancreY - RAYON`) — dès que le curseur dépasse le bord de la pastille, il est dans le popup,
quel que soit `y` tant qu'il reste dans sa hauteur, donc jamais dans un angle mort en diagonale.

Ce dernier point a fait l'objet d'un aller-retour : un premier correctif avait simplement
retiré `onMouseLeave` (le popup ne se refermait alors plus jamais tout seul), ce qui cachait le
vrai problème (l'écart) sans le résoudre, et créait le défaut inverse signalé ensuite par
Raphaël — un popup qui reste ouvert indéfiniment tant qu'on ne clique pas ailleurs. Un « pont »
invisible entre pastille et popup a aussi été essayé et abandonné : limité à la hauteur de la
pastille, il laissait un angle mort en diagonale vers les boutons (plus bas), et sur une carte
dense il pouvait chevaucher une pastille voisine et lui voler le survol. Coller les deux
directement règle les deux problèmes sans configuration supplémentaire.

**Sur écran tactile, pas de survol du tout.** `onMouseEnter`/`onMouseLeave` ne sont attachés
que si `window.matchMedia('(hover: hover)').matches` (vrai pour une souris, faux pour un doigt
sur écran tactile) — calculé une fois au montage (`survolPossible` dans `VueCarte.tsx`). Un tap
génère des événements souris simulés (y compris `mouseenter`/`mouseout`) sans survol continu
réel derrière, et selon le navigateur ça pouvait rouvrir/refermer le popup tout seul juste après
l'avoir ouvert au tap — les boutons flash/réussi/échec semblaient alors ne réagir à aucun tap.
Sur tactile, seul le clic (ouvre/change de bloc) et le clic sur le fond (ferme) pilotent
l'affichage, comme décrit plus haut. Les boutons du popup et la pastille ont aussi
`touch-action: manipulation` (`styles.css`), pour écarter le délai/double-tap de zoom que
certains navigateurs mobiles imposent par défaut sur un élément cliquable.

### Enregistrer un envoi comme une vraie ascension

Les trois boutons du popup appellent `Atelier.enregistrerAscension(blocId, grimpeurNom, type)`
(`src/ui/etat.ts`), qui ne fait rien de plus qu'ajouter une ligne au dataset — mêmes champs
que `data/ascensions.csv` (`essais: 1` pour flash et échec, `2` pour réussi ; cette valeur
n'entre dans aucun calcul, cf. `core/types.ts`, elle ne fait que refléter honnêtement l'écart
entre les trois). Deux conditions doivent être réunies pour que ça marche :

- le centre a un jeu de données connecté (`enregistrerAscension` est passé à `VueCarte` par
  `App.tsx` seulement si `centreId === 'demo'` — le seul cas aujourd'hui) ;
- le nom saisi dans « Carte de : » correspond exactement à un grimpeur du dataset (comparaison
  insensible à la casse et aux espaces).

Si l'une des deux manque, les trois boutons restent visibles mais désactivés (grisés), avec un
titre expliquant pourquoi — et, depuis le retour de Raphaël comme quoi ça semblait ne « rien
faire » au tap, la même explication redite en texte visible sous les boutons
(`.carte-popup-raison`) : un `title` ne s'affiche jamais au toucher (pas de survol sur tactile),
un bouton grisé qu'on ne remarque pas comme tel semble alors juste ignorer le tap. C'est
délibéré : on ne veut pas qu'un envoi tapé sous un nom inventé se retrouve silencieusement
associé à personne, ni qu'un centre sans données se mette à halluciner un classement.

Ces ascensions ajoutées sont persistées dans `localStorage` (`src/ui/ascensionsLocales.ts`,
même principe que `suiviLocal` — une interface `AscensionLocaleProvider` en vue d'un futur
serveur) puis fusionnées avec celles de `data/ascensions.csv` dans `useAtelier` avant tout
calcul : le pipeline ne voit qu'un seul dataset cohérent, trié chronologiquement. Un envoi
tapé sur la Carte recalcule donc immédiatement les cotes affichées ailleurs (onglets Blocs,
Grimpeurs), exactement comme une ligne du CSV le ferait.

**Changer d'avis.** Cliquer un nouveau bouton pour un bloc déjà enregistré *depuis la Carte*
remplace l'envoi précédent pour ce couple bloc/grimpeur au lieu de s'y ajouter — flash, puis
échec par erreur, puis réussi : le dernier clic gagne, sans étape d'annulation séparée. Ça ne
touche jamais aux ascensions du fichier CSV, immuables ; seul l'unique envoi ajouté depuis la
Carte pour ce bloc est remplacé. Une première version ajoutait chaque clic comme une ligne
séparée (pour ne perdre aucune tentative réelle sur plusieurs séances) avec un lien « Annuler »
à part pour rattraper un mauvais clic — Raphaël a trouvé ça lourd pour un geste aussi courant :
remplacer directement au clic suivant est plus simple, au prix de ne garder que le dernier
envoi tapé sur la Carte pour un bloc donné (l'historique réel du fichier CSV, lui, n'est pas
concerné).

Le statut affiché dans le popup et l'anneau « envoyé » sur une pastille reposent tous les deux
sur `Atelier.envoisConnus(grimpeurNom)`, qui parcourt l'ensemble des ascensions du grimpeur
(fichier + le seul envoi Carte par bloc), triées chronologiquement, et retient, par bloc, la
**plus récente** — pas la meilleure. Un grimpeur qui a déjà réellement envoyé ou raté un bloc
(d'après le fichier) le voit donc annoté dès l'arrivée sur la Carte ; et comme un envoi tapé sur
la Carte est toujours plus récent que l'historique du fichier, cliquer un bouton change toujours
le statut affiché, y compris pour le faire redescendre (flash → échec compris). C'est voulu :
Raphaël a été explicite là-dessus après une première version qui ne laissait « gagner » que la
meilleure ascension (voir le journal du 2026-09-15) — se corriger ou changer d'avis doit marcher
à tout moment, dans n'importe quel sens, pas seulement pour améliorer le statut. L'ancien suivi
`localStorage` (`suivi.ts`) reste utilisé en complément uniquement pour les cas non connectés
(nom non reconnu, centre sans dataset) — un repère purement visuel, comme avant, qui ne
distingue pas flash/réussi/échec.

### Rejoindre un bloc depuis un tableau

Sur tous les écrans qui listent des blocs par leur nom (Blocs, Données, Formules), ce nom est
cliquable et bascule sur l'onglet Carte en ouvrant le popup de ce bloc précis, comme un clic ou
un survol l'aurait fait — utile pour situer sur le plan un bloc repéré dans un tableau. `App.tsx`
porte l'état `blocCible` (l'id du bloc visé) et la fonction `voirBlocSurCarte` qui bascule
l'onglet et le pose ; `VueCarte` le consomme dans un effet qui ouvre le popup (`setSurvole`) et
ramène la carte à l'écran (`scrollIntoView`). Comme cette carte n'affiche jamais qu'un
échantillon des blocs du jeu de données (50 sur 369 pour la Démo), cliquer le nom d'un bloc qui
n'y figure pas bascule quand même sur l'onglet — cohérent, ça montre le plan — mais n'ouvre
aucun popup, il n'y a rien à y montrer. Ça marche identiquement en accès complet et en vue
visiteur.

### Cartes disponibles aujourd'hui

- **Démo** — un plan inventé (`public/cartes/demo.svg`), quatre bandes murales reprenant les
  quatre styles du jeu de données (`src/core/stylesBloc.ts` — Dalle, Coordo, Dévers, Joker ;
  neuf bandes plus fines du 16 au 17 septembre 2026, huit avant ça). 50 blocs y sont placés, un
  échantillon proportionnel par style (méthode du plus grand reste,
  `scripts/generer-carte-demo.mjs`) tiré des 369 du jeu de démonstration pour rester lisible ; les
  positions sont générées, pas affinées à la main (chaque changement de taxonomie du style a
  jusqu'ici invalidé tout affinage précédent — les zones ne se correspondent pas d'une
  taxonomie à l'autre).
- **Rose Bloc 1** — une vraie photo du plan de la salle (`public/cartes/rose-bloc-1.jpg`),
  fournie par Raphaël et nettoyée des dates griffonnées au crayon (masquage colorimétrique +
  interpolation), sans bloc positionné pour l'instant.
- Les autres centres du menu n'ont pas encore de carte : l'écran affiche un canevas vierge,
  cliquable en accès complet pour commencer à y placer des blocs.

## La cote par style

Un bloc a un **style** (`secteur` dans les données, colonne « Style » à l'affichage) : un
vocabulaire contrôlé déclaré dans `src/core/stylesBloc.ts` — Dalle, Coordo, Dévers, Joker depuis
le 17 septembre 2026 (neuf valeurs plus fines du 16 au 17 septembre, huit avant ça — voir
DECISIONS.md pour l'historique si besoin). Une valeur hors de cette liste n'est pas rejetée au
chargement, juste signalée en avertissement (écran **Fichiers**) : elle continue de compter dans
la cote globale, mais n'apparaît dans aucune ventilation par style.

L'écran **Grimpeurs** affiche cette cote **par style** en plus de la cote globale : un menu
déroulant en haut de la colonne dédiée du tableau **Classement**, à côté d'« Elo »/« Glicko »/
« Mélange », propose « Cote globale (Mélange) » ou l'un des styles — la colonne bascule alors
pour montrer, pour chaque grimpeur du classement, sa cote *pour ce style précis* (tiret s'il ne
l'a jamais affronté). Choisir une valeur dans ce menu retrie aussitôt le tableau sur cette
colonne (descendant), comme si on avait cliqué son en-tête — demande de Raphaël du 17 septembre
2026, pour voir directement qui domine un style sans devoir cliquer une deuxième fois. Le tri du
tableau **Classement** est piloté depuis `VueGrimpeurs.tsx` (`triClassement`/`setTriClassement`,
passés à `Tableau` via ses props optionnelles `tri`/`onTri`) plutôt que laissé à l'état interne
par défaut de `Tableau` : un clic sur un autre en-tête continue de fonctionner normalement,
puisqu'il passe par le même callback.

Les trois colonnes à droite de « Cote par style » — **Plus dur envoyé**, **Duels utiles**,
**Duels gagnés** — suivent elles aussi le style choisi dans le menu déroulant (leur titre se
complète alors du nom du style, ex. « Duels gagnés (Dalle) »), plutôt que de continuer à montrer
des totaux tous styles confondus à côté d'une colonne de cote qui, elle, ne parle que d'un seul
style — demande de Raphaël du 17 septembre 2026, pour que la ligne entière reste cohérente une
fois un style choisi. « Duels utiles » et « Duels gagnés » viennent de la même ventilation
qu'Elo bloc pour la cote elle-même (`stylesGrimpeur[style].matchs`/`.reussites`, cf. plus bas) —
tiret si le grimpeur n'a jamais affronté ce style, comme pour la cote. « Plus dur envoyé » vient
en revanche d'un calcul différent, indépendant de toute formule
(`LigneGrimpeur.meilleureCotationParStyle`, `src/core/pipeline.ts`) : une pure agrégation sur les
ascensions brutes filtrées par style du bloc, sur le même principe que `meilleureCotation`
(la version tous styles confondus, déjà existante) — nécessaire parce qu'aucune formule ne
retient la cotation V la plus dure envoyée, seulement des cotes numériques. Sans style choisi,
les trois colonnes retombent sur leurs totaux habituels.

**Duels utiles** est en outre absente de la vue visiteur (même logique que le retrait des
colonnes Écart et Duels utiles de l'écran Blocs, journal du 17 septembre 2026) : une mesure
d'audit, pas d'intérêt pour un visiteur qui ne cherche pas à juger la fiabilité statistique d'un
chiffre.

Le calcul par style lui-même n'existe que pour Elo bloc (voir plus bas), mais l'affichage est
calé sur **Mélange** — la cote de référence utilisée partout ailleurs sur cet écran — plutôt que
d'afficher Elo brut : « Cote globale » montre la cote Mélange habituelle du grimpeur, et chaque
style affiché est cette même cote Mélange, **décalée du même écart relatif qu'Elo a mesuré pour
ce style** (`cote_mélange + (cote_style_elo − cote_globale_elo)`). Ce n'est pas une cote Mélange
par style indépendante — Glicko ne contribue à aucun des deux termes du décalage — mais elle
reste cohérente avec le nombre affiché ailleurs sur l'écran, plutôt que de faire cohabiter deux
échelles différentes dans le même tableau. Demande de Raphaël : la première version affichait
Elo brut pour les deux, ce qui faisait deux fois la même comparaison qu'avec la colonne « Elo »
juste à côté, sans jamais toucher à Mélange.

Le principe du calcul lui-même, choisi pour une garantie précise — **aucun effet sur les cotes
globales des blocs ni des grimpeurs, d'aucune formule** :

- Chaque style démarre au même point que la cote globale Elo du grimpeur (l'amorce).
- Chaque fois que la cote globale Elo du grimpeur bouge suite à un duel, exactement le même
  mouvement est appliqué à la cote du style du bloc affronté — sans jamais influencer la cote
  globale en retour, ni celle du bloc, ni aucune autre formule.
- Un style jamais affronté reste exactement à l'amorce.

Concrètement, `moteurElo` (`src/core/formulas/lib.ts`) expose un callback optionnel
(`observateurGrimpeur`) appelé aux deux endroits où il fait bouger la cote d'un grimpeur ; sans
lui, le calcul est strictement identique à avant (aucune autre formule ne le fournit). Seul
`elo-bloc.ts` le branche, pour construire cette ventilation en parallèle du calcul normal. Le
recalage sur Mélange (formule ci-dessus) se fait entièrement dans l'écran — `VueGrimpeurs.tsx`
lit `resultats.get('elo-bloc')` pour le décalage et `resultats.get('melange')` pour la base,
tous deux déjà calculés — sans toucher au cœur de calcul.

Conséquence vérifiable sur le calcul Elo lui-même : la somme des mouvements de tous les styles
d'un grimpeur reconstitue exactement le mouvement de sa cote globale. `core.test.ts`, describe
« cote par style », vérifie cette identité plutôt que de la supposer.

La colonne n'affiche que la cote (pas d'écart calculé ni de badge) : une première version
montrait un badge coloré avec l'écart à la cote globale à côté de la cotation V du style, mais
ça n'avait de sens que pour un petit nombre de grimpeurs choisis à la main — mauvais compromis
une fois que la colonne s'applique à tout le classement trié. Comparer visuellement à la colonne
« Mélange » d'à côté suffit, sur le même principe que les colonnes Elo/Glicko/Mélange déjà côte
à côte.

**Le champ `style` de l'écran Carte est un système différent et non lié.** `BlocCarte.style`
(`src/core/cartes/types.ts`) reste un texte libre, décoratif, sans effet sur aucun calcul, mais
la valeur affichée pour le jeu de données Démo suit désormais le même vocabulaire que le calcul
(voir « Cartes disponibles aujourd'hui » ci-dessus) — rien n'empêche d'y taper un nom fantaisiste
(« Bat Cave ») comme avant, le champ reste libre.

## Site bilingue (français / anglais)

Un bouton **FR/EN** dans l'en-tête bascule toute l'interface — titres, boutons, en-têtes de
colonnes, jusqu'aux bulles d'aide détaillées de l'écran Formules — ainsi que le format des
nombres et des dates (virgule française contre point anglais, « cote V » contre « V grade »).
Comme le thème clair/sombre, ce choix n'est pas mémorisé : le site repart en français à
chaque chargement.

**Limite assumée** : les messages de contrôle de qualité des données (CSV mal formé,
identifiant en double...), affichés dans l'écran Fichiers, restent en français uniquement.
Ils sont générés loin dans le chargement des fichiers et n'apparaissent jamais sur le jeu de
démonstration actuel (zéro anomalie) ; les traduire aurait demandé de faire transiter la
langue jusque dans le cœur de calcul, pour un bénéfice nul aujourd'hui.

L'implémentation vit dans `src/ui/langue.tsx` (contexte + hook `useLangue`, un simple
`t(fr, en)` colocalisé avec chaque texte plutôt qu'un fichier de traductions centralisé) et
`src/ui/format.ts` (nombres, pourcentages, dates sensibles à la langue courante). Les
formules et le calibrage (`src/core/`) portent un champ optionnel `*En` à côté de chaque
label ou aide français, lu par le petit helper `bilingue()`.


## Plusieurs centres d'escalade (à venir)

L'en-tête propose un menu déroulant pour choisir un centre — en plus du jeu de démonstration,
six centres réels sont listés (Bloc Shop Chabanel, Bloc Shop Hochelaga, Bloc Shop Mile-End, Le
Mouv', Rose Bloc 1, Rose Bloc 2). Aucun n'a encore de données connectées : les choisir affiche
un message d'attente plutôt que le jeu de démo. C'est un premier pas visuel vers l'idée
décrite plus haut (« Quand vous ajouterez une deuxième salle ») — brancher de vraies données
par centre reste à faire.

## Prochaine étape prévue : l'import utilisateur

L'architecture l'anticipe sans le coder. `src/core/sources/` définit un `SourceProvider` ;
aujourd'hui il n'y en a qu'un, les fichiers du dépôt. Brancher le glisser-déposer revient à
ajouter un second provider (lecture d'un `File`, persistance IndexedDB) et à le concaténer
dans `chargerToutesLesSources()`. Ni les parseurs, ni les formules, ni l'interface ne bougent.

## Piste envisagée, pas commencée : le multi-utilisateur en temps réel

Aujourd'hui, le site est statique (GitHub Pages, aucun compte — voir « Accès à deux niveaux »
plus haut) et rien n'est partagé entre utilisateurs : les envois tapés sur la Carte sont
persistés en `localStorage`, par appareil (`AscensionLocaleProvider`, § « La carte des blocs »).
Discuté avec Raphaël le 17 septembre 2026 : pour que plusieurs personnes voient les mêmes
données en temps réel, il faut à la fois une base *et* un serveur (ou un équivalent) — une base
exposée directement au navigateur ne peut appliquer aucune règle d'accès. Piste recommandée mais
non explorée : un service backend-as-a-service (Supabase, Firebase, PocketBase...), qui fournit
déjà la base et la couche API/auth, plutôt qu'un serveur écrit à la main. Ça s'accrocherait aux
mêmes seams que l'import utilisateur ci-dessus : une seconde implémentation de `SourceProvider`,
`CarteProvider` et `AscensionLocaleProvider` qui parle au service au lieu des CSV/`localStorage`,
sans toucher au calcul ni à l'interface. Raphaël a choisi d'attendre plutôt que de commencer
maintenant — ne pas relancer ce chantier sans qu'il le redemande.

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
  lance les 62 tests, construit le site et le publie. Un site qui ne compile pas, ou dont le
  cœur de calcul est cassé, n'est jamais mis en ligne.
- `base: './'` dans `vite.config.ts` — les chemins d'assets sont relatifs, donc le site
  fonctionne quel que soit le nom du dépôt, sans configuration à ajuster.
- `public/.nojekyll` — empêche GitHub de faire passer les fichiers par Jekyll, qui ignorerait
  les dossiers commençant par un souligné.
- `dist/` reste ignoré par git : c'est l'action qui le fabrique, on ne commite pas de build.

**Les trois étapes à faire une seule fois :**

Ce dépôt est <https://github.com/Rafiot-creator/CoteEloEscalade>. Il ne reste qu'une chose à
faire une seule fois, dans l'interface GitHub : **Settings → Pages → Source : GitHub Actions**.
Rien d'autre à régler.

Chaque poussée sur `main` déclenche alors le déploiement ; l'avancement se suit dans l'onglet
**Actions**, et le site est servi sur
<https://rafiot-creator.github.io/CoteEloEscalade/>.

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

## Journal des sessions

Courtes entrées datées sur ce qui a été fait, pour reprendre le fil d'une session à l'autre.
Le pourquoi des choix de fond reste dans [DECISIONS.md](DECISIONS.md) ; ceci ne trace que le
fait accompli.

### 2026-09-14

- Reprise du projet en solo par Raphaël sur sa machine (environnement Windows remis en place :
  Git, Node, `npm install`, `npm test`).
- Correction de références oubliées vers le dépôt et l'URL GitHub Pages de l'ami
  (`EricPrieur/CoteEloEscalade`) au lieu de la copie propre `Rafiot-creator/CoteEloEscalade`.
- Ajout de l'accès à deux niveaux (visiteur / complet) décrit plus haut, avec un bouton pour
  prévisualiser la vue visiteur sans perdre son déverrouillage.
- Ajout du menu déroulant de centres d'escalade décrit plus haut (visuel seulement pour
  l'instant, aucun centre autre que la démo n'a de données).
- Simplification de la vue visiteur : une seule colonne « Cote » (celle du mélange) au lieu
  d'une colonne par formule, sur les écrans Blocs et Grimpeurs.
- Correction des accents français dans toute l'interface (ils manquaient partout), et ajout
  d'une version anglaise complète du site avec bascule FR/EN — voir « Site bilingue » plus
  haut.
- Correction de l'axe « voies » de l'histogramme des écarts, qui aurait dû dire « blocs »
  depuis le pivot escalade de voies → bloc en salle (voir DECISIONS.md § 1).
- Renommage du terme français « cran V » en « cote V » dans toute l'interface et les
  définitions de formules (la version anglaise garde « V grade »).
- Harmonisation de ce README avec le même vocabulaire : toutes les occurrences de « cran »
  (au sens du modèle) sont devenues « cote ».
- Renommage de la colonne « Secteur » en « Style » sur les écrans Blocs et Données (français et
  anglais).
- Ajout de l'écran **Carte**, visible par tous : édition complète des blocs en accès complet,
  lecture seule avec suivi personnel des envois (par nom saisi) en vue visiteur — voir « La
  carte des blocs » plus haut pour l'architecture (`CarteProvider`, `SuiviProvider`).
- Carte inventée pour le centre Démo (`public/cartes/demo.svg`), 50 blocs répartis par style le
  long des murs (`scripts/generer-carte-demo.mjs`), positions ensuite affinées à la main.
- Carte réelle de Rose Bloc 1 ajoutée à partir d'une photo fournie par Raphaël, nettoyée des
  dates manuscrites qui s'y trouvaient.
- Palette des pastilles reprise trois fois sur retour de Raphaël : spectre plat → néon →
  métallique (dégradé + reflet), en vérifiant à chaque fois le contraste du texte sur chaque
  fond.
- Sélecteur de nom de grimpeur ajouté à l'écran Carte, avec bouton pour l'effacer ; le suivi
  des envois est désormais par grimpeur plutôt que global à l'appareil.
- Survol d'une pastille : ajout du nom du bloc et de sa cote Elo exacte entre parenthèses,
  à côté de la cotation affichée.

### 2026-09-15

- Mise à jour de `actions/checkout` et `actions/setup-node` vers leur version 5 (runtime
  Node 24) dans `.github/workflows/deploy.yml` : Node 20 est retiré des runners GitHub Actions
  le 16 septembre 2026, ces actions y tournaient encore. Piste refermée dans `DECISIONS.md`.
- Ajout de trois boutons au survol d'un bloc sur la Carte — flash, réussi, échec — voir « La
  carte des blocs » plus haut, § « Enregistrer un envoi comme une vraie ascension ». Pour le
  centre Démo et un nom de grimpeur reconnu, ils ajoutent une vraie ligne d'ascension au
  calcul (`src/ui/ascensionsLocales.ts`, fusionnée dans `useAtelier`) au lieu du simple suivi
  visuel d'avant : les cotes recalculées se répercutent immédiatement sur les onglets Blocs et
  Grimpeurs, et l'anneau « envoyé » de la Carte reflète désormais l'historique réel du
  grimpeur plutôt qu'un drapeau local indépendant.
- Retour de Raphaël : le grisé des blocs déjà envoyés était invisible en vue complète (accès
  complet), et le statut « envoyé » n'apparaissait nulle part au survol. Corrigé : le grisé
  (opacité + désaturation) s'applique maintenant dans les deux vues, et le popup au survol
  affiche une ligne « Statut » (Envoyé ✓ / Pas encore envoyé).
- Nouveau retour de Raphaël : ce statut ne distinguait pas flash et réussi en plusieurs
  essais. Le statut affiché est maintenant « Flash ⚡ » ou « Réussi ✓ », déterminé depuis
  `essais === 1` sur l'ascension retenue (`Atelier.envoisConnus`, § « Enregistrer un envoi
  comme une vraie ascension ») — un flash l'emporte dès qu'il y en a un pour ce bloc.
- Encore un retour : le statut devait aussi dire si un bloc avait été tenté sans succès
  (`'echec'`, distinct de l'absence totale de tentative), et les boutons flash/réussi/échec
  devaient être accessibles au clic — pas seulement au survol, qui exclut les appareils sans
  souris. `envoisConnus` renvoie maintenant aussi `'echec'` (une réussite l'emporte toujours
  dessus). Cliquer un bloc ouvre le popup en vue visiteur (retombe sur l'ancien suivi local si
  le centre n'a pas de dataset connecté) ; en accès complet, où le clic sert déjà à
  sélectionner/déplacer, c'est Majuscule (shift) + clic. Voir « Pastilles, survol et popup ».
- Dernier retour de Raphaël sur la Carte : en vue visiteur, cliquer un bloc ne semblait rien
  faire, et les boutons disparaissaient dès que la souris quittait la pastille. Cause réelle :
  le popup se fermait au survol (`onMouseLeave`) dès que le curseur quittait la pastille pour
  rejoindre les boutons, dans la bande de fond de carte entre les deux qui n'appartient à
  aucun des deux éléments — testé avec des sauts de curseur directs plus tôt dans la session,
  jamais avec un déplacement continu, donc jamais repéré. Retiré `onMouseLeave` : le popup
  reste ouvert jusqu'à survoler un autre bloc ou cliquer le fond de la carte. Revérifié cette
  fois avec un déplacement de souris en plusieurs étapes, dans les deux vues.
- Correction du correctif précédent, sur retour de Raphaël : retirer `onMouseLeave` empêchait
  le popup de se fermer même en quittant complètement pastille et popup. Cause racine enfin
  réglée : l'écart entre pastille et popup, pas `onMouseLeave` lui-même. Le popup est
  maintenant collé contre la pastille (`onMouseLeave` restauré) — voir « Pastilles, survol et
  popup » pour le detail et les deux approches essayées avant (pont invisible, suppression du
  `onMouseLeave`) et pourquoi elles ne suffisaient pas. Testé avec un déplacement en diagonale
  vers les boutons (le cas qui avait fait échouer le tout premier correctif) : le popup reste
  ouvert jusqu'aux boutons, et se ferme bien en s'éloignant complètement.
- Ajout d'un lien « Annuler mon dernier envoi » sous les boutons flash/réussi/échec, visible
  dès qu'il y a un envoi ajouté depuis la Carte pour ce bloc/grimpeur
  (`Atelier.envoiLocalActuel` / `annulerDernierEnvoi`, § « Enregistrer un envoi comme une vraie
  ascension », sous-section « Corriger un clic ») : corrige un clic malencontreux sans toucher
  aux ascensions du fichier CSV. Un vrai changement de statut dans le temps (échec puis flash)
  n'a pas besoin de cette annulation, `envoisConnus` retenant déjà le meilleur statut connu.
- Raphaël a trouvé ce lien « Annuler » laborieux pour un geste courant (se corriger, ou changer
  d'avis) : remplacé par un comportement plus direct — cliquer un nouveau bouton remplace
  l'unique envoi ajouté depuis la Carte pour ce bloc/grimpeur, sans étape séparée. Retiré
  `envoiLocalActuel`/`annulerDernierEnvoi` et le lien du popup ; `enregistrerAscension` fait le
  remplacement lui-même. Voir « Changer d'avis » dans « Enregistrer un envoi comme une vraie
  ascension » pour le compromis assumé (une seule entrée Carte par bloc, pas un historique de
  chaque clic).

- Raphaël a testé sur son téléphone : les pastilles, à taille fixe, se chevauchaient sur un
  centre dense comme Démo. `RAYON` suit maintenant la largeur réelle de la carte (40 px de
  diamètre au-dessus de 420 px, 24 px en dessous) — voir « Pastilles, survol et popup »,
  § « Taille des pastilles ». Cette étape a mis au jour un vrai bug de layout au passage :
  `.marque` (titre + sous-titre) avait un `white-space: nowrap` qui l'empêchait de rétrécir
  même dans la media query dédiée aux petits écrans, forçant toute la page à rester large
  d'environ 720 px sur n'importe quel appareil — la carte n'aurait donc jamais pu descendre
  sous 420 px sans ce correctif, peu importe la taille des pastilles. Repéré uniquement en
  vérifiant la largeur réelle de la carte via JavaScript (les captures d'écran de l'outil
  d'automatisation utilisé pour tester ne le laissaient pas voir, la fenêtre de test restant
  à sa pleine largeur de bureau). Une première implémentation avec `ResizeObserver` ne se
  déclenchait jamais dans cet outil de test (probablement parce que Chrome limite ses
  callbacks sur un onglet sans le focus) ; remplacée par un `useLayoutEffect` qui mesure au
  montage et au `resize` de la fenêtre, plus simple et vérifiable.
- Raphaël a retesté sur son téléphone : encore trop gros, et aucun effet en tapant du doigt
  les boutons flash/réussi/échec. Deux causes distinctes :
  - le seuil unique (420 px → 24 px) gardait les pastilles *proportionnellement* plus grosses
    que sur bureau, puisque l'espacement entre elles (des fractions 0–1 de la largeur de la
    carte) rétrécit dans la même proportion que la carte. Remplacé par une échelle continue
    (`largeur × 1,8 %`, reprenant le ratio observé sur bureau, bornée entre 8 et 20 px) — voir
    « Taille des pastilles ».
  - `onMouseEnter`/`onMouseLeave` (nécessaires pour le correctif précédent sur la fermeture du
    popup) sont piégeux sur tactile : un tap simule aussi `mouseenter`/`mouseout` sans survol
    réel derrière, ce qui pouvait rouvrir/refermer le popup tout seul et rendre les boutons
    inertes au doigt. Ces deux gestionnaires ne sont désormais attachés que si
    `matchMedia('(hover: hover)')` est vrai ; sur tactile, seul le clic pilote l'affichage. Ajout
    de `touch-action: manipulation` sur la pastille et les boutons du popup en prévention d'un
    délai/double-tap de zoom. Voir « Sur écran tactile, pas de survol du tout ».
- Troisième retour de Raphaël, toujours sur téléphone : encore trop gros, et les boutons
  répondent visuellement (l'appui se voit) mais sans effet sur le statut affiché. Deux
  correctifs distincts :
  - le plancher de `RAYON` (8 px) était plus haut que ce que l'échelle proportionnelle demandait
    déjà sur une carte de téléphone (~5–6 px), donc c'est le plancher — pas le ratio — qui
    gardait les pastilles trop grosses là où ça comptait. Abaissé à 5. Voir « Taille des
    pastilles ».
  - pour l'absence d'effet : `title` (l'explication d'un bouton désactivé) ne s'affiche jamais
    au toucher, donc un bouton grisé qu'on ne remarque pas comme tel semblait simplement ignorer
    le tap. Ajouté le même texte en visible sous les boutons quand ils sont désactivés — voir
    « Enregistrer un envoi comme une vraie ascension ».
- Raphaël a précisé le fond du problème : il veut pouvoir changer le statut d'un bloc « en tout
  temps et en tout sens » (flash ↔ réussi ↔ échec), erreur de clic ou vrai changement d'avis.
  `envoisConnus` retenait jusque-là le *meilleur* statut sur l'ensemble des ascensions
  (fichier + Carte), ce qui empêchait justement de redescendre un bloc déjà flashé ou réussi au
  fichier — exactement le blocage que le test précédent avait pris pour un bug de clic sans
  effet. Changé pour retenir la *plus récente* plutôt que la meilleure : comme un envoi tapé sur
  la Carte est toujours plus récent que l'historique du fichier, cliquer un bouton change
  désormais toujours le statut affiché, peu importe le sens. Voir « Enregistrer un envoi comme
  une vraie ascension ».
- Ajout d'un liseré vert fin et clair (1 px, semi-transparent) autour des pastilles jamais
  tentées par le grimpeur choisi dans le menu déroulant, pour les repérer d'un coup d'œil sans
  survoler — distinct du liseré épais qui marque un envoi. Voir « Pastilles, survol et popup ».
- Retour de Raphaël : ce liseré passait inaperçu, trop fin. Épaissi à 2 px et repositionné pour
  empiéter sur la pastille (`inset` positif) plutôt que déborder autour comme demandé
  explicitement — plus visible sans agrandir l'empreinte de la pastille sur la carte.
- Nouveau retour : avec `inset: 2`, un mince anneau de la couleur de la pastille restait
  visible entre son bord et le cercle vert — « la pastille déborde encore du cercle ». Corrigé
  en mettant `inset` à `0` pile (le contour exact de la pastille) plutôt qu'une valeur positive :
  le cercle vert forme maintenant le bord visible complet, sans aucun débord de la pastille.
- Ajout d'une légende permanente (« 1 cote V = 1000 points... ») sous les tuiles de chiffres des
  écrans Blocs, Grimpeurs et Carte, demandée par Raphaël pour rendre la conversion cote/cote V
  claire pour les utilisateurs — jusque-là elle n'était que dans la bulle d'aide au survol d'un
  en-tête de colonne, invisible sur tactile. `LegendeCote`, § « L'échelle : une cote V = 1000
  points = dix contre un ».

### 2026-09-16

- Ajout de la **cote par style** — voir « La cote par style » plus haut pour le mécanisme et la
  garantie d'absence d'effet sur les cotes globales, discutée avec Raphaël avant de coder (c'est
  lui qui a proposé le principe de la ventilation par mouvement observé, plus simple et plus
  exact que la première idée — un second calcul à blocs gelés).
- Remplacement du vocabulaire à huit valeurs du champ `secteur` (Cave, Dalle, Devers,
  Competition, Traverse, Arete, Prow, Toit — une géométrie de mur) par les neuf nouveaux styles
  de Raphaël (`src/core/stylesBloc.ts`). `data/blocs.csv` régénéré ; vérifié dans le diff que
  seules les colonnes `nom`/`secteur` changent, `ascensions.csv`, `grimpeurs.csv` et
  `scripts/verite.json` sont identiques bit à bit (le style n'influence aucun tirage aléatoire).
- Premier passage d'affichage dans l'écran Grimpeurs : un tableau à part, limité aux quelques
  grimpeurs suivis pour la courbe de progression, cote V muette avec un badge coloré pour
  l'écart à la cote globale.
- Retour de Raphaël : ni les blocs, ni les grimpeurs, ni la carte ne semblaient montrer les
  nouveaux styles. Deux réalités différentes derrière ce retour unique :
  - **Un vrai bug, sur la Carte** — `data/cartes/demo.json` avait bien été resynchronisé (le
    champ `style` de chaque bloc, utilisé dans le popup et le panneau d'édition), mais les
    **noms des huit zones étaient dessinés en dur comme texte dans `public/cartes/demo.svg`**
    (« DALLE », « TOIT », « DEVERS »...), une image de fond jamais touchée par la migration des
    données. Le popup d'un bloc pouvait donc afficher un style correct pendant que le mur
    dessiné juste à côté annonçait encore l'ancienne géométrie. Corrigé en redessinant
    `demo.svg` avec neuf bandes murales (3 sur le mur du haut pour la famille Dalle, 2 à droite
    pour Dévers, 2 en bas pour Technique, 2 à gauche pour Coordo/Dyno) et en remettant à jour
    `ZONES` dans `scripts/generer-carte-demo.mjs` en conséquence — le script était devenu
    inutilisable entre-temps (`Style sans zone sur le plan`). Les positions affinées à la main
    n'ont pas pu être conservées : l'ancienne et la nouvelle taxonomie ne se recouvrent pas
    (un bloc « Toit » de l'ancien système n'a aucune raison de devenir un « Coordo » ou un
    « Dévers/force » du nouveau), donc les faire correspondre aurait affiché des pastilles à
    côté d'un mur qui ne les décrit pas. `data/cartes/demo.json` régénéré en entier — à raffiner
    de nouveau, comme la première fois.
  - **Les blocs et les grimpeurs étaient déjà corrects** en local au moment du retour (vérifié
    dans le navigateur avant de coder quoi que ce soit d'autre) — probablement un test sur une
    version pas encore relancée, ou une confusion avec le vrai bug de la Carte ci-dessus. Rien à
    corriger de ce côté.
- Sur suggestion de Raphaël, remplacement du tableau à part (ci-dessus) par un menu déroulant
  directement dans l'en-tête de la colonne de cote du tableau **Classement**, à côté d'Elo/
  Glicko/Mélange : bascule la colonne entre la cote globale et celle d'un style choisi, pour
  *tous* les grimpeurs classés plutôt qu'une poignée choisie à la main — strictement plus
  utile, donc le premier tableau a été retiré plutôt que gardé en double. Ajout d'un
  `titreRendu` optionnel à `Colonne` (`src/ui/components/Tableau.tsx`) pour permettre un en-tête
  de colonne interactif ; les autres colonnes de tout le site en gardent un simple, inchangées.
  Le badge d'écart coloré de la première version a été abandonné avec le tableau à part : la
  colonne affiche la cote brute, à comparer visuellement à la colonne Elo d'à côté, comme les
  formules le font déjà entre elles.
- Sur demande de Raphaël, le tableau principal des écrans **Blocs** et **Grimpeurs** (tous les
  blocs / le classement) passe au-dessus des cartes analytiques (nuage de points, histogramme,
  courbe de progression), et se limite à 25 lignes par défaut (bouton « Afficher plus » pour le
  reste) au lieu de 50.
- Retour de Raphaël sur la régénération complète de la Carte Démo (ci-dessus) : les pastilles se
  chevauchaient. Cause réelle, à deux niveaux :
  - les neuf zones de mur (`ZONES`, `scripts/generer-carte-demo.mjs`) se **recouvraient
    géométriquement aux quatre coins** — une zone du mur du haut (ex. Dalle/pied) et une zone du
    mur latéral (ex. Coordo) réclamaient toutes les deux le même carré de coin, un défaut déjà
    présent dans le tout premier découpage à huit zones mais jamais repéré faute d'avoir mesuré
    les distances entre pastilles. Corrigé en réservant les coins aux bandes du haut et du bas
    (pleine largeur) et en cantonnant les bandes latérales à la portion strictement entre les
    deux.
  - le placement, purement aléatoire dans le rectangle de la zone, ne garantissait aucun
    espacement minimal. Remplacé par une grille qui épouse les proportions de chaque zone — en
    essayant systématiquement tous les découpages en colonnes possibles et en gardant celui qui
    maximise la plus petite dimension de cellule, plutôt qu'une formule basée sur le seul ratio
    largeur/hauteur qui choisissait parfois une grille étroite là où une seule rangée large
    aurait laissé bien plus de place — avec un léger jitter déterministe par bloc, plafonné pour
    ne jamais faire descendre la séparation sous un seuil calibré sur la taille de référence
    documentée dans le README (§ « Pastilles, survol et popup ») : à ~1150 px de large et un
    rayon de pastille de 20 px, il faut ~35 unités du viewBox entre deux centres pour qu'elles ne
    se touchent pas ; réglé à 36. Vérifié après coup : distance minimale mesurée entre deux
    pastilles quelconques sur les 50 de la Démo, 36,3 unités.
- Retour de Raphaël sur les couleurs des pastilles : les blocs déjà envoyés (`grayscale(0.85)` +
  `opacity: 0.55`) perdaient complètement leur couleur d'origine, réduits à un gris quasi
  uniforme. Adouci à `grayscale(0.4) saturate(0.7)` + `opacity: 0.85` — la teinte d'origine reste
  reconnaissable, l'anneau vert autour de la pastille (déjà présent, indépendant du filtre)
  continuant de porter seul le sens « envoyé ». Raphaël a aussi demandé des couleurs « plus
  belles, plus flash » : la palette (`PALETTE_COULEURS`, `VueCarte.tsx`) — des tons « métal »
  sourds (améthyste, acier, émeraude...) choisis lors d'une itération précédente — est remontée
  vers des teintes plus vives (ex. jaune `#b8860b` → `#f2c200`, rouge `#8c1c24` → `#e11d2e`),
  tout en gardant le reflet lustré (`BRILLANT`) qui donnait l'effet « métal » : c'est la
  désaturation des blocs envoyés qui rendait ces tons déjà sourds difficiles à distinguer, pas le
  reflet en lui-même.
- Raphaël a enfin testé sur son vrai téléphone (voir « Prochaine étape » des sessions
  précédentes). Deux retours :
  - **Les pastilles débordaient encore de l'anneau vert « envoyé »**, surtout visible sur
    téléphone. Cause : l'anneau utilisait un écart et une épaisseur fixes en pixels (2px), pensés
    pour `RAYON` = 20 (bureau) — au plancher de `RAYON` (5px sur les cartes les plus étroites),
    ce même écart fixe ne laissait presque plus de marge relative. Les deux suivent désormais
    `RAYON` (`EPAISSEUR_ANNEAU`, `ECART_ANNEAU`, `VueCarte.tsx`). Vérifié programmatiquement (pas
    seulement à l'œil, difficile à cette taille) : à `RAYON` = 5, l'écart mesuré entre le bord de
    la pastille et l'anneau est maintenant de 3px de chaque côté (il était de 0).
  - **Le popup au clic apparaissait bien trop grand et débordait de l'écran** après un pinch-zoom
    tactile (zoomer avec les doigts pour mieux voir les blocs, cf. « La carte des blocs »). Cause :
    le popup était en `position: fixed`, positionné et dimensionné en pixels CSS *de la fenêtre
    sans zoom* — un piège connu du web mobile, les navigateurs ne redimensionnent pas les éléments
    `fixed` avec le pinch-zoom (qui n'agit que sur le viewport visuel), si bien qu'un popup pensé
    pour occuper une petite portion de l'écran fini par excéder toute la zone visible une fois
    zoomée. Passé en `position: absolute`, ancré sur la pastille elle-même (donc sur la carte) :
    il zoome avec le reste du contenu comme prévu. La raison du `fixed` d'origine — échapper à
    l'`overflow: hidden` de la zone de carte près d'un bord — est maintenant traitée en bornant sa
    position dans les limites de la carte (bascule à gauche de la pastille si la place manque à
    droite, ajustement vertical similaire) plutôt qu'en sortant du flux normal.
- Raphaël, en revérifiant sur PC après ce dernier lot de correctifs : les pastilles n'avaient
  plus toutes la même taille. Le correctif de l'anneau « envoyé » ci-dessus corrigeait bien le
  vrai bug (l'écart réel était nul, `border-box` faisant manger la bordure sur l'`inset`), mais
  en le faisant grandir avec `RAYON` — alors que le bug n'exigeait qu'un écart *non nul*, pas un
  écart *proportionnel*. Sur bureau (`RAYON` = 20), ça gonflait l'anneau jusqu'à 30 % de plus que
  la pastille, contre 10 % avant toute cette histoire — d'où des pastilles « envoyées » qui
  paraissaient nettement plus grosses que les autres. `EPAISSEUR_ANNEAU`/`ECART_ANNEAU` sont
  redevenus des constantes fixes (1px chacune, contre 2px avant qui donnaient un écart nul) :
  l'ajout total à la taille de la pastille retombe à 4px à toute taille, comme à l'origine, tout
  en gardant un écart réel (non nul) au plancher de `RAYON` sur téléphone. Vérifié dans les deux
  cas via le DOM : 1px d'écart réel à `RAYON` = 5 comme à `RAYON` = 20.
- Raphaël a effacé le cache et retesté sur deux téléphones différents : le débordement de
  l'anneau et du popup persistait. Deux choses distinctes se sont révélées derrière ce retour :
  - **Le menu déroulant de style (écran Grimpeurs) était écrasé et illisible sur mobile.** Il
    avait un `maxWidth: 140` artificiel — aucune autre colonne du tableau n'a de contrainte de
    largeur, le tableau défile horizontalement au besoin (`.table-enveloppe`) comme n'importe
    quel autre tableau du site. Sur mobile, le style natif d'un `<select>` (flèche, padding du
    système) rendait 140px trop juste pour un nom de style comme « Technique/force ». Contrainte
    retirée.
  - **Le popup débordait massivement de l'écran après un pinch-zoom tactile** — visible sur une
    capture d'écran envoyée par Raphaël (`Cell site escalade debug.jpg`), qui a permis de
    diagnostiquer le vrai problème plutôt que de deviner une troisième fois : mon correctif
    précédent (`position: absolute`, ancré sur la pastille) faisait bien zoomer le popup *avec*
    la carte comme prévu pour la position — mais ça veut aussi dire qu'il grossit physiquement à
    l'écran en même temps que les blocs quand on pince pour zoomer dessus, jusqu'à dépasser
    largement l'écran visible. Un popup devrait rester à taille lisible constante, pas suivre le
    zoom du contenu qu'il annote. Corrigé en lisant `window.visualViewport.scale` (l'échelle du
    pinch-zoom tactile courant, mise à jour sur son évènement `resize` — `echelleZoom`,
    `VueCarte.tsx`) et en compensant par un `transform: scale(1 / échelle)` sur le popup, avec un
    `transform-origin` sur le coin qui touche la pastille (en haut à gauche par défaut, à droite
    si le popup a basculé à gauche faute de place) pour que ce coin reste ancré au bon endroit
    pendant que le reste du popup se réduit autour de lui. Sans zoom (`echelle` = 1, le cas du
    bureau), `transform` n'est même pas posé : comportement inchangé, vérifié dans Chrome.
  - **Le débordement de l'anneau vert n'a pas pu être confirmé ou infirmé** sur cette capture
    d'écran : le popup, grand ouvert, cachait la plupart des pastilles. À revérifier après ce
    correctif — l'anneau lui-même n'a pas été retouché dans ce lot, sa correction précédente
    reste en place (voir plus haut).
- Raphaël a confirmé le popup corrigé, et envoyé une seconde capture (`Cell site escalade debug
  2.jpg`) pour l'anneau : du gris débordait bien autour du cercle vert. Pas le bug de l'anneau
  lui-même — **chaque pastille a son propre halo de 2px** (`boxShadow: '0 0 0 2px
  var(--bord-fort)'`, dans `VueCarte.tsx`, pour lui donner un contour, sélectionnée ou non).
  Avant les correctifs de cette carte, l'anneau vert le recouvrait entièrement en le touchant
  pile (écart nul, le tout premier bug) ; l'écart introduit pour corriger ce bug laissait ce
  halo — qui a toujours existé, invisible jusque-là — apparaître dans l'espace resté vide.
  `ECART_ANNEAU` passe de 1 à 2 pour correspondre exactement à ce halo : l'anneau prend le relais
  pile où le halo gris s'arrête, ni vide ni chevauchement. Vérifié via le DOM : écart réel de
  l'anneau à la pastille = 2px pile, correspondant au `boxShadow`.
- Raphaël a aussi demandé que recliquer sur un bloc déjà survolé referme son popup, plutôt que de
  devoir cliquer ailleurs sur la carte à chaque fois. `ouvrirPopup` (`VueCarte.tsx`) ouvrait
  toujours, jamais ne basculait, pour une raison précise : sur un appareil avec une souris, le
  clic suit en pratique un survol qui a déjà ouvert le popup (`onMouseEnter`) — basculer le
  refermerait aussitôt. Ce risque n'existe que quand le survol existe vraiment
  (`survolPossible`, `matchMedia('(hover: hover)')`) ; sur tactile, rien ne l'a ouvert avant le
  tap. Le bascule ne s'applique donc que si `!survolPossible` : retaper le même bloc le referme
  sur tactile, le comportement « toujours ouvre » reste inchangé à la souris.
- Raphaël a envoyé une troisième capture (`Cell site escalade debug 3.jpg`), bien plus
  rapprochée : le halo gris débordait toujours à l'extérieur du cercle vert, et le cercle vert
  empiétait par endroits sur le chiffre. Le correctif précédent (`ECART_ANNEAU` = 2 pour faire
  correspondre l'anneau au halo existant) supposait un ordre d'empilement précis entre le
  `boxShadow` de la pastille et le `<span>` de l'anneau, posé par-dessus — un ordre qui s'est
  révélé peu fiable en pratique sur mobile. Plutôt que d'ajuster encore les pixels, le anneau
  séparé est retiré : le `boxShadow` de contour que **chaque** pastille a déjà (2px, gris par
  défaut, foncé si sélectionnée) devient simplement **vert** quand le bloc est envoyé, au lieu
  d'empiler un second élément par-dessus. Un seul contour, jamais deux éléments qui se disputent
  le même espace — ni halo gris visible, ni empiètement sur le chiffre possible, puisque ce
  contour a toujours été strictement à l'extérieur de la pastille (`box-shadow` ne peut pas
  déborder à l'intérieur). Vérifié via le DOM (l'anneau séparé n'existe plus, 0 `<span>` enfant
  sur une pastille envoyée) et visuellement dans Chrome.
- Raphaël, en retestant, a signalé « visuellement identique » — inattendu, puisque le mécanisme
  avait changé. Deux précisions ont permis de trouver la vraie cause :
  - Le contour gris est visible sur **toutes** les pastilles, même sur PC (juste plus fin) :
    rien à voir avec les correctifs précédents, c'est le contour (`boxShadow`) que chaque
    pastille a toujours eu. Sa vraie particularité, jamais corrigée jusque-là : il était fixe à
    2px, comme l'était l'ancien anneau « envoyé » avant sa toute première correction, alors que
    la pastille elle-même rétrécit avec `RAYON`. Mêmes 2px, proportionnellement bien plus épais
    sur une petite pastille de téléphone que sur une grosse pastille de bureau — exactement le
    même piège que `RAYON` et la taille de police suivent déjà en se calculant depuis la largeur
    de la carte. Une constante `EPAISSEUR_CONTOUR` (`Math.max(1, Math.round(RAYON * 0.1))`)
    remplace le 2px fixe : 2px à `RAYON` = 20 (bureau, inchangé), 1px à `RAYON` = 5 (téléphone).
  - Le cercle vert qui « empiète sur le chiffre » n'était pas l'anneau « envoyé » (`fait`,
    corrigé à plusieurs reprises ci-dessus, jamais fautif) mais **l'autre** liseré : celui des
    blocs jamais essayés (`nonEssaye`), volontairement posé à l'intérieur du bord de la pastille
    (`inset: 0`, § « Pastilles, survol et popup »). Sa bordure de 2px, elle aussi jamais rendue
    proportionnelle, mangeait une grande partie du rayon d'une petite pastille de téléphone — le
    vrai bug derrière chaque capture d'écran de Raphaël depuis le début, sur une piste que les
    quatre correctifs précédents n'avaient jamais empruntée. Passée à `EPAISSEUR_CONTOUR`
    elle aussi. Vérifié via le DOM : 1px à `RAYON` = 5 (contre 2px avant, sur un rayon de 5px —
    c'était 40 % du rayon mangé par la seule bordure), 2px à `RAYON` = 20 (bureau, inchangé).
- Toujours pas résolu après ce cinquième correctif. Raphaël a tranché : retirer les deux plutôt
  que continuer à ajuster. Le contour gris par défaut (visible sur toute pastille, présent
  depuis l'origine du projet, jamais lié à aucun statut) est retiré purement et simplement — il
  n'apportait rien d'utile, seulement un risque de mauvais dosage selon l'appareil. Le liseré
  « jamais essayé » (`nonEssaye`) est retiré entièrement lui aussi : ces blocs n'ont plus aucune
  marque sur la pastille (seul le popup dit encore leur statut). Le contour de l'anneau
  « envoyé » (vert) reste, lui, seul indicateur visuel qui subsiste sur la carte en dehors du
  popup — confirmé correct par Raphaël dès la première capture d'écran. Voir « Pastilles, survol
  et popup » pour l'état final.
- Raphaël a confirmé la Carte réglée, et signalé un problème du même ordre mais sur un autre
  écran : le menu déroulant de style de l'écran **Grimpeurs** (§ « La cote par style ») se
  compresse et devient illisible sur téléphone, malgré le retrait du `maxWidth: 140` artificiel
  quelques correctifs plus tôt (§ ci-dessus, 2026-09-16). Cause réelle, différente cette fois :
  `table.donnees` (`styles.css`) a `width: 100%`, ce qui empêche le tableau de dépasser son
  conteneur même quand son contenu l'exige — sur un écran étroit, le moteur de mise en page en
  tableau comprime alors chaque colonne (dont le `<select>`) pour toutes les faire tenir dans
  cette largeur fixe, au lieu de laisser le tableau déborder et défiler horizontalement
  (`.table-enveloppe { overflow-x: auto }`, déjà en place mais jamais réellement déclenché pour
  ce tableau). Un `min-width: 160` sur le `<select>` force sa colonne à refuser de rétrécir
  sous ce seuil : la somme des largeurs minimales des colonnes dépasse alors les 100 % déclarés,
  et la spécification CSS impose au tableau de déborder plutôt que de continuer à comprimer — le
  défilement horizontal prend enfin le relais, sans toucher au comportement des autres colonnes
  ni des autres tableaux du site. Vérifié via le DOM (conteneur rétréci à 360px
  programmatiquement) : le tableau déborde bien (`scrollWidth` 848 > `clientWidth` 360) et le
  `<select>` garde ses 160px pleins plutôt que d'être écrasé.
- Raphaël a confirmé le menu déroulant réglé sur téléphone, et fait remarquer que la colonne
  « Cote par style » montrait toujours Elo brut, y compris pour l'option « Cote globale »,
  alors que Mélange est la cote de référence affichée partout ailleurs sur cet écran. Rebâti sur
  Mélange plutôt que sur Elo — voir « La cote par style » pour le détail (le calcul reste basé
  sur Elo, Glicko n'ayant pas de trajectoire par duel à observer ; seul l'affichage se recale
  sur Mélange, sans toucher au cœur de calcul). Vérifié : l'option « Cote globale » correspond
  maintenant exactement à la colonne Mélange, et un style choisi reproduit le même écart que
  celui déjà vérifié sur Elo, simplement reporté sur la base Mélange (ex. Victor Bergeron,
  Dalle/pied : Elo 7570 → 6421, soit −1149 ; Mélange 7851 → 6702, soit le même −1149).
- Fin de session : Raphaël a confirmé tout le lot du jour fonctionnel sur téléphone. Demande
  notée pour la prochaine session (pas codée aujourd'hui) : pouvoir classer les grimpeurs par
  force selon le style choisi dans le menu déroulant — aujourd'hui, choisir un style change les
  valeurs affichées mais ne retrie pas le tableau, et la colonne n'est pas cliquable pour trier
  (le `<select>` dans son en-tête intercepte le clic exprès, pour ne pas déclencher un tri au
  lieu d'ouvrir le menu). Voir `CLAUDE.md`, § « Prochaine étape », pour les pistes envisagées.

### 2026-09-17

- Raphaël a demandé de simplifier le vocabulaire des neuf styles de bloc (introduit la veille) à
  quatre : **Dalle, Coordo, Dévers, Joker**. `STYLES_BLOC` (`src/core/stylesBloc.ts`) et le
  générateur de données (`scripts/generate-data.mjs`, tableau `SECTEURS`) mis à jour ;
  `data/blocs.csv` régénéré — mêmes 369 blocs, 55 grimpeurs et 18 879 lignes qu'avant (le RNG est
  scellé sur une graine fixe, seules les étiquettes de style changent), répartis presque
  également entre les quatre styles (91 à 99 blocs chacun, contre une quarantaine par style avec
  l'ancien vocabulaire à neuf).
- Carte Démo (`public/cartes/demo.svg`, `scripts/generer-carte-demo.mjs`) redessinée à quatre
  bandes murales — une par style, une par mur — au lieu de neuf, et `data/cartes/demo.json`
  régénéré. Un effet de bord géométrique inattendu : avec seulement quatre zones pour les mêmes
  50 blocs affichés, chacune en reçoit environ deux fois plus qu'avant (une douzaine plutôt
  qu'une demi-douzaine), et les deux bandes latérales (Coordo, Dévers — 80 unités de large,
  contre environ 950 pour les bandes du haut et du bas) ne pouvaient plus aligner cette douzaine de
  pastilles en une seule colonne sans passer sous `SEPARATION_MIN` (36 unités) : 33,5 mesurées
  après une première régénération. Élargies de 80 à 95 unités (`ZONES` dans
  `generer-carte-demo.mjs`), ce qui suffit à faire basculer la grille automatique sur deux
  colonnes au lieu d'une : 36,5 unités de séparation minimale mesurée après coup sur les 50
  blocs, au-dessus du seuil. Les étiquettes des quatre zones (« DALLE », « JOKER »...), posées au
  centre de chaque bande dans un premier essai, se sont révélées partiellement recouvertes par
  des pastilles une fois affichées dans Chrome — déplacées dans la marge de 25 unités entre le
  bord extérieur du plan et la zone de placement des pastilles, où aucune pastille ne peut
  jamais atterrir ; revérifié dans Chrome, plus aucun chevauchement.
- `core.test.ts`, test « un style jamais affronté par un grimpeur reste exactement à son amorce »
  (ajouté le 16 septembre) : échouait après ce changement — il cherchait ce cas de figure par
  hasard dans le jeu de données généré, ce qui devient trop improbable quand il n'y a plus que
  quatre styles pour des grimpeurs qui affrontent chacun des centaines de blocs (chacun finit
  presque toujours par croiser les quatre). Réécrit sur un petit dataset construit à la main (un
  grimpeur, deux blocs de styles différents, un seul réellement affronté) : le cas est garanti
  par construction plutôt que par chance, et le test ne dépend plus du nombre de styles déclarés.
- Raphaël a aussi demandé que choisir un style dans le menu déroulant de la colonne « Cote par
  style » (demande laissée en suspens le 16 septembre, voir ci-dessus) retrie aussitôt le tableau
  **Classement** sur cette colonne, sans avoir à cliquer une deuxième fois sur son en-tête.
  `Tableau.tsx` gérait jusqu'ici son tri entièrement en interne (`useState`, jamais piloté de
  l'extérieur) : ajout de deux props optionnelles, `tri` et `onTri`, qui quand elles sont fournies
  remplacent l'état interne comme source de vérité — un clic sur un en-tête continue de
  fonctionner normalement, en passant par `onTri` plutôt que par le `setState` interne. Les
  autres usages de `Tableau` (Blocs, Données, la vue tabulaire de Progression) ne passent pas ces
  props et gardent leur comportement inchangé. `VueGrimpeurs.tsx` lève l'état de tri
  (`triClassement`/`setTriClassement`) et le passe à `Tableau`, et le gestionnaire `onChange` du
  menu déroulant de style pousse désormais `{ cle: 'cote-style', sens: -1 }` en plus de mettre à
  jour le style choisi.
- Vérifié dans Chrome (accès complet) : Blocs/Grimpeurs/Carte affichent bien Dalle/Coordo/Dévers/
  Joker, la Carte Démo n'a ni chevauchement ni étiquette masquée, et choisir un style dans
  Grimpeurs retrie immédiatement le tableau sur la bonne colonne (cliquer ensuite sur l'en-tête
  « Elo » retrie bien sur Elo, sans que le mécanisme de tri piloté ne s'en trouve cassé). Tests
  (64) et build au vert.
- Raphaël a demandé ce qu'il faudrait pour que le site supporte plusieurs utilisateurs en temps
  réel — discuté, pas codé. Voir « Piste envisagée, pas commencée : le multi-utilisateur en temps
  réel » plus haut pour la recommandation (base + service backend-as-a-service plutôt qu'un
  serveur écrit à la main) et les seams déjà en place pour l'accrocher. Raphaël a choisi
  d'attendre plutôt que de commencer maintenant.
- Simplification de la présentation de l'écran **Blocs** (`VueBlocs.tsx` seul touché) : le titre
  et le paragraphe d'explication devant le tableau (« Tous les blocs exploitables » + description)
  remplacés par un simple « Blocs » sans sous-titre ; les quatre tuiles de statistiques
  déplacées sous le tableau (elles étaient tout en haut de la page) ; les boutons « Désaccords
  seulement » et « Exporter en CSV » masqués en vue visiteur, visibles seulement en accès
  complet. Vérifié dans Chrome (accès complet et aperçu visiteur).
- Retrait des bulles d'aide au survol des en-têtes du tableau **Blocs** en vue visiteur (`aide`
  retiré des colonnes passées à `Tableau` quand `simplifie` est vrai, seulement pour ce tableau) :
  ce texte s'adresse à quelqu'un qui explore le modèle de calcul, pas à la vue simplifiée. Le clic
  pour trier fonctionne toujours, seule la bulle au survol disparaît. Vérifié dans Chrome que le
  survol d'un en-tête ne montre plus rien en vue visiteur, et montre toujours l'aide en accès
  complet.
- Retrait des colonnes **Écart** et **Duels utiles** du même tableau, en vue visiteur seulement —
  des mesures d'audit, pas d'intérêt pour un visiteur qui ne compare pas les formules entre elles.
  Le tri par défaut de la table passe de l'écart (décroissant, pour mettre en avant les blocs mal
  cotés — toujours le cas en accès complet) au nom du bloc (croissant) en vue visiteur, puisque la
  colonne qui servait de tri par défaut n'est plus affichée. Vérifié dans Chrome.
- Ajout du **nom de bloc cliquable** dans tous les tableaux qui en listent (Blocs, Données,
  Formules) : bascule sur l'onglet Carte et ouvre le popup du bloc visé — voir § « Rejoindre un
  bloc depuis un tableau » plus haut pour le mécanisme (`blocCible`/`voirBlocSurCarte` dans
  `App.tsx`, consommés par un effet dans `VueCarte`). Classe CSS `.lien-bloc` ajoutée
  (`styles.css`) pour un texte cliquable discret dans une cellule de tableau, plutôt que
  `.bouton` (bordure/fond, pensé pour une barre d'outils). Vérifié dans Chrome, accès complet et
  vue visiteur : un bloc présent sur la carte ouvre son popup et y amène l'écran ; un bloc qui
  n'y figure pas (la carte n'affiche qu'un échantillon) bascule quand même sur l'onglet, sans
  popup ni erreur.
- Retrait de la colonne **Duels utiles** du tableau Classement (écran Grimpeurs) en vue visiteur
  — même logique que pour l'écran Blocs plus haut, une mesure d'audit sans intérêt pour un
  visiteur.
- Les trois colonnes à droite de « Cote par style » (**Plus dur envoyé**, **Duels utiles**,
  **Duels gagnés**) suivent désormais le style choisi dans le menu déroulant plutôt que de
  montrer des totaux tous styles confondus à côté d'une cote qui, elle, ne parle que d'un seul
  style — voir § « La cote par style » plus haut pour le détail (nouveau champ
  `LigneGrimpeur.meilleureCotationParStyle` dans `src/core/pipeline.ts` pour « Plus dur envoyé »,
  une pure agrégation sur les ascensions brutes indépendante de toute formule ; « Duels utiles »
  et « Duels gagnés » réutilisent la ventilation par style déjà calculée par Elo bloc). Vérifié
  dans Chrome (accès complet et vue visiteur) : sélectionner un style met à jour les trois
  colonnes et leur titre (ex. « Duels gagnés (Dalle) ») ; revenir à « Cote globale » restaure les
  totaux habituels. Tests (64) et build au vert.
