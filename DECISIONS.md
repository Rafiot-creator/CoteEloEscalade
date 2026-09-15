# Journal des décisions

Ce fichier garde la trace du **pourquoi**. Le `README` décrit ce que le projet fait
aujourd'hui ; celui-ci raconte comment on y est arrivé, ce qu'on a essayé sans le garder, et
les erreurs de raisonnement qu'on a corrigées en chemin. Son but est d'éviter de re-débattre
d'une question tranchée, et de re-tenter une piste déjà mesurée comme mauvaise.

Toutes les mesures citées viennent du jeu de démonstration, qui est tiré d'un niveau latent
connu (`scripts/verite.json`, jamais exposé au site). C'est ce qui permet de mesurer au lieu
d'affirmer — et c'est la seule raison pour laquelle ce fichier contient des chiffres plutôt
que des opinions.

---

## 1. La trajectoire du projet

Le projet a changé de sujet deux fois. Rien de tout cela n'est visible dans le code final,
mais ça explique certaines formes.

**Escalade de voies → bloc en salle.** Le premier jet visait des voies extérieures cotées à
l'échelle française (6a, 7b+), avec un style d'ascension (à vue, après travail) et un nombre
d'essais. Le passage au bloc a supprimé la notion de style et changé l'échelle. Il en reste
un module `cotations.ts` volontairement générique : l'échelle est un simple tableau
d'étiquettes, remplaçable sans toucher au reste.

**Quatre salles → une seule.** Le jeu de données couvrait quatre salles avec des grimpeurs
itinérants. Le ramener à une salle unique a fait **passer l'erreur médiane de 0,42 à
0,24 cran, avec moins de données au total** — 27 duels par bloc au lieu de 14. La leçon vaut
pour la suite : mieux vaut une salle bien documentée que trois à moitié.

Le code multi-salles est resté. Le filtre par salle et l'avertissement de connectivité
réapparaissent d'eux-mêmes dès que les données contiennent plus d'une salle.

---

## 2. Le modèle, décision par décision

### Un affrontement par couple grimpeur-bloc

Toutes les séances d'un même couple se replient en une seule partie : envoyé un jour = gagné,
jamais envoyé = perdu, quel que soit le nombre d'essais.

C'est un choix de modélisation, et il a un coût mesuré. Un modèle qui comptait chaque séance
séparément atteignait 0,32 cran d'erreur contre 0,42 pour celui-ci à l'époque de la mesure :
replier divise par deux le nombre d'observations. Trois échecs successifs y comptent comme un
seul, alors qu'ils portaient trois fois l'information. Le modèle a été retenu quand même
parce qu'il correspond à la question qu'on veut poser : « ce grimpeur a-t-il fini par faire ce
bloc ? »

### Le classement se joue en direct

Dès la première séance infructueuse, le grimpeur a perdu et ses points passent au bloc. S'il
finit par l'envoyer, on lui **rend exactement** ces points et la défaite devient une victoire
pondérée par le travail.

Le remboursement est exact au flottant près : le déplacement appliqué est mémorisé puis
retranché. Un test le vérifie de la façon la plus directe — à K constant, un projet échoué
puis envoyé laisse exactement les mêmes cotes qu'un envoi direct.

Coût mesuré : l'erreur médiane passe de 0,20 à 0,25 cran. Les états intermédiaires sont plus
bruités. C'est le prix d'un classement honnête sur le moment plutôt que rétrospectif.

### L'échelle : un cran V = 1000 points = dix contre un

Deux conventions se rejoignent, et c'est ce qui rend l'échelle lisible. La cote se lit sans
conversion : divisez par 1000 et vous avez le cran V.

**Le calcul confirme la convention.** En basculant le calibrage en mode régression, le site
cherche lui-même l'espacement entre crans dans les données : il trouve **1005 points, r² de
0,965**. Les 1000 points par cran ne sont pas qu'un choix commode. C'est le contrôle à refaire
en premier sur de vraies données : si la régression y trouve 600 ou 1500, les crans de la
salle sont plus resserrés ou plus étalés que la convention ne le suppose.

### Écarter les résultats joués d'avance

Un grimpeur deux crans sous un bloc qui échoue, ou deux crans au-dessus qui réussit, n'apprend
rien au modèle. Le problème n'est pas que la correction soit petite, c'est qu'elle va
**toujours dans le même sens** : un bloc que seuls des grimpeurs bien plus faibles affrontent
ne reçoit que des échecs, donc une poussée vers le haut que rien ne compense, et il dérive.

C'est l'amélioration la plus rentable de tout le projet, et elle vient d'une suggestion de
l'équipe, pas d'un balayage de paramètres :

| | Sans | Avec (2000 pts) |
|---|---|---|
| Erreur médiane | 0,253 | **0,243** |
| Blocs sous-cotés détectés | 34 % | **57 %** |
| Blocs jugeables | 321 | 226 |

La chute du nombre de blocs jugeables **est le point, pas un effet secondaire**. Un duel
écarté ne compte plus dans les duels utiles, donc un bloc dont toutes les confrontations
étaient jouées d'avance n'est plus jugé du tout — les V1 que personne ne rate, les V9-V10 que
personne n'envoie. Ces 95 blocs étaient les plus mal estimés : 0,46 cran d'erreur contre 0,29
pour ceux qui restent. Le site cesse d'inventer une cotation là où il n'a pas d'information.

La même règle appliquée à Glicko l'a transformé : erreur de 0,295 à 0,188, fausses alertes de
26 % à 4 %. Sa méthode pousse chaque bloc à son point fixe, y compris quand celui-ci est à
l'infini faute de contre-exemple ; écarter les résultats joués d'avance supprime la séparation
elle-même, que le lissage des scores à 2 % ne faisait que rattraper.

### La cote de départ des grimpeurs

Un grimpeur V4 démarre vers 4000, depuis son niveau déclaré à l'inscription ou, à défaut, la
médiane des blocs de ses douze premiers duels.

**Mesure honnête : ça ne change pas les cotes finales** — 0,253 contre 0,249 cran, du bruit.
Cinq mois de données suffisent à converger de toute façon. L'intérêt est ailleurs : la cote
affichée d'un nouveau est juste dès sa première séance au lieu de partir de V5 et de dériver,
en distribuant au passage des victoires imméritées aux blocs faciles qu'il affronte. C'est une
question d'équité d'affichage, pas de précision.

---

## 3. Détecter les blocs mal cotés

### Le protocole du témoin

La question « ces désaccords sont-ils réels ou l'estimation les fabrique-t-elle ? » se tranche
par une **expérience témoin** : rejouer tout le pipeline sur un monde où l'étiquette de chaque
bloc est sa vraie difficulté. Tout désaccord qui subsiste là-bas est du bruit pur, et sa
fréquence donne le taux de fausses alertes.

C'est ce protocole qui a servi à choisir tous les seuils. Il vit dans `desaccords.test.ts` et
sert de garde-fou : si une évolution future se met à fabriquer des désaccords, la CI le voit.

### Le jury à deux voix

Un bloc est signalé dès qu'**une** formule le conteste, **confirmé** quand les deux le font.
Le vote porte sur le verdict binaire, jamais sur les cotes. Chaque formule porte son propre
seuil, calibré pour un taux de fausses alertes comparable — c'est le **niveau d'exigence**
qu'on égalise, pas les écarts bruts.

| Méthode | Fausses alertes | Précision | Sandbags trouvés |
|---|---|---|---|
| Elo seul (0,75) | 1,6 % | 98 % | 39 % |
| Glicko seul (1,00) | 1,4 % | 97 % | 42 % |
| **Union, Glicko à 0,75** | **3,0 %** | **92 %** | **58 %** |
| Les deux (« confirmé ») | 0,8 % | **100 %** | 30 % |

**L'union produit plus de fausses alertes : est-ce le prix de l'union ?** Non, c'est le prix de
la sensibilité. En réglant chaque formule seule pour produire exactement 3,0 % de fausses
alertes, aucune n'atteint 58 % de détection — Elo 55 %, Mélange 52 %, Glicko 48 %. L'union est
sur un meilleur point de la courbe, pas simplement plus bavarde.

**L'ordre de grandeur, à ne pas surestimer.** Le jeu contient 33 blocs réellement sous-cotés.
Passer Glicko de 1,00 à 0,75 en fait trouver deux de plus et ajoute deux fausses alertes sur
369 blocs. Ce qui a emporté la décision est ailleurs : la liste « confirmé », celle sur
laquelle on agit sans revérifier, passe de 28 à 35 blocs **en conservant 100 % de précision**.

### Le biais qui a motivé tout ça

À volume de duels égal, un bloc **plus dur** que son étiquette n'était détecté que dans 13 %
des cas contre 42 % pour un bloc plus facile. La cause : un bloc sous-coté ne produit que des
échecs, or l'échec d'un grimpeur contre un bloc déjà coté au-dessus de lui est *attendu*, donc
il ne corrige presque rien. Une réussite surprenante, à l'inverse, fait chuter le bloc vite.
La logistique sature d'un côté et pas de l'autre.

C'est gênant parce que le sandbag est justement ce qu'une salle veut repérer. Les trois
leviers cumulés — seuil à 0,75, écart négligé, jury — l'ont porté de 13 % à 58 %.

---

## 4. Ce qu'on a essayé et rejeté

| Piste | Mesure | Verdict |
|---|---|---|
| **Test binomial direct** contre l'étiquette | 16 % de fausses alertes, 54 % de précision | Rejeté. L'hypothèse nulle « la difficulté vaut exactement l'étiquette × 1000 » est fausse pour presque tous les blocs, puisque l'étiquette est un entier et la difficulté continue. Il détecte « l'étiquette n'est pas exacte », vrai partout. Il faudrait un test d'équivalence, pas un test de point. |
| **Moyenner les écarts** au lieu de voter | Même détection, 92 % de précision contre 96 % | Rejeté. Le vote conserve mieux l'information. |
| **Troisième juré** : l'Elo sans a priori | 42 % de fausses alertes seul | Rejeté. Ses erreurs sont indépendantes de l'étiquette, ce qui était l'idée, mais il est trop bruyant et dégrade le jury. |
| **Faire voter le mélange** | Signale 0 bloc que les deux autres ne signalent déjà | Rejeté. Une moyenne ne peut franchir un seuil que si une composante le franchit. D'où le champ `avisIndependant` : colonne oui, voix non. |
| **Poids ajusté du mélange (0,4)** | 0,294 contre 0,296 pour la moyenne simple | Rejeté. L'optimum est estimé sur une vérité terrain simulée ; le figer serait du surajustement pour 0,002 cran. |
| **Glicko à 0,60** | 61 % de sandbags contre 58 %, mais 5,1 % de fausses alertes contre 3,0 % | Rejeté. 70 % de fausses alertes en plus pour trois points de détection. |
| **Glicko-2** | 2 périodes de classement avec les réglages livrés, 6 au mieux | Rejeté pour l'instant. Sa volatilité s'estime *entre* périodes : il n'y a rien à estimer. Et un bloc n'a pas de volatilité, sa difficulté ne varie pas. À revoir avec deux ou trois ans d'historique, pour les grimpeurs seulement. |

---

## 5. Erreurs de raisonnement commises en chemin

Elles sont ici parce qu'elles sont faciles à refaire.

**Comparer deux formules à seuil égal.** Fait deux fois. Deux formules ne se comparent qu'à
**taux de fausses alertes égal**, mesuré sur le monde témoin — chacune se place où elle veut
sur sa propre courbe précision/rappel. Comparer à seuil égal a d'abord fait conclure que
Glicko était trop bavard, puis qu'il dominait largement. Les deux conclusions étaient fausses.

**Citer une sensibilité avec un dénominateur restreint.** « Glicko trouve 78 % des sandbags »
était calculé sur les seuls blocs que Glicko jugeait, ce qui le flattait. Sur l'ensemble des
blocs — la seule mesure qui réponde à « quelle part des vrais sandbags le site trouve-t-il » —
c'était 42 %.

**Remettre les cotes à leur amorce à chaque passe.** Les passes suivantes rejouaient alors la
première avec un K plus petit, donc convergeaient moins bien. Les cotes de départ ne sont
posées qu'une fois.

**Régler l'échelle par convention plutôt que par mesure.** L'échelle Elo usuelle (400) donnait
1,36 cran d'erreur : les cotes n'avaient pas le budget de correction pour s'écarter autant. Un
paramètre repris d'un autre domaine mérite d'être mesuré avant d'être adopté.

---

## 6. Ce qu'il faudra vérifier sur de vraies données

**Il faut journaliser les échecs.** C'est la contrainte la plus lourde du modèle. 54 % des
duels sont gagnés ; tout le pouvoir discriminant vient des 46 % perdus, c'est-à-dire des blocs
qu'un grimpeur a essayés sans jamais les faire. Si la salle ne journalise que les envois — ce
que font la plupart des carnets de croix — il n'y a plus aucune défaite et **aucun classement
n'est calculable**.

**Le contrôle d'échelle.** Passer le calibrage en mode régression et vérifier qu'il trouve
bien de l'ordre de 1000 points par cran.

**Ce que la méthode ne saura jamais distinguer.** Un bloc morpho, facile pour les grands et
dur pour les petits, n'est pas mal coté et ressortira pourtant comme un désaccord. Le témoin
prouve que la méthode ne fabrique pas de désaccords à partir de hasard ; il ne prouve pas que
tout désaccord réel soit une erreur de cotation.

**Les données personnelles.** Le dépôt est public, donc `data/` l'est aussi. Aujourd'hui ce
sont des données factices. Le jour où ce fichier contiendra de vraies fréquentations
nominatives, ce sera de la donnée personnelle — et l'historique git garde ce qu'on y a mis
même après suppression.

**Le plafond de volume.** La taille du bundle arrive avant le temps de calcul : les CSV étant
compilés dans le JavaScript, vers 100 000 lignes il faudra les charger à l'exécution, ce qui
est un changement dans `src/core/sources/` et nulle part ailleurs.

---

## 7. Ce qui reste ouvert

- **Baisser le seuil de Glicko à 0,60** si la détection compte plus que la tranquillité :
  61 % de sandbags pour 5,1 % de fausses alertes. Une ligne.
- **Un test d'équivalence** (± un demi-cran) à la place du test binomial ponctuel, qui pourrait
  battre le jury. Non essayé.
- **Glicko-2**, à revisiter avec deux ou trois ans d'historique.
- **Un modèle morphologique**, seul moyen de distinguer un bloc morpho d'une erreur de
  cotation. C'est un autre modèle, pas un raffinement de celui-ci.
- **L'import utilisateur** par glisser-déposer : un second `SourceProvider`, sans toucher aux
  parseurs, aux formules ni à l'interface.
