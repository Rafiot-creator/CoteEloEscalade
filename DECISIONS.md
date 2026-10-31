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

### Les nouveaux grimpeurs (30 octobre 2026)

**Le déclencheur.** Premier vrai compte, « Rafiot », 7 blocs au compteur : un V7 *échoué* l'a
fait passer du 22e au 9e rang. Sans niveau déclaré, sa cote de départ était la médiane des
blocs de ses douze premiers duels, réussis ou non ; ce V7 a fait passer la médiane de V5 à V6,
soit +1000 points au départ, bien plus que ce que l'échec lui coûtait. Le jeu de démonstration
ne pouvait pas le montrer : ses 55 grimpeurs ont tous des centaines de duels, leur départ est
figé depuis longtemps. Dans un vrai centre, chaque nouvel inscrit y passe.

**Ce qui a été retenu**, proposé par Raphaël :

1. **Niveau de flash demandé à l'inscription** (facultatif). Une cote du site est celle d'un
   bloc réussi une fois sur deux ; on flashe en général un cran en dessous. Flash V4 → niveau
   déclaré V5 → départ à 5000. Un niveau déclaré ne bouge plus jamais.
2. **Période d'essai de dix blocs** (`DUELS_PROVISOIRES`, `src/core/formulas/lib.ts`) : le
   pseudonyme n'apparaît dans aucun classement ; le grimpeur voit seul sa position, marquée
   provisoire. La fenêtre d'estimation du départ passe de douze duels à cette même période,
   pour que le départ soit figé au moment où le pseudonyme apparaît.
3. **K doublé pendant la période d'essai** (Elo, réglage `kNouveaux`). Glicko le fait déjà de
   lui-même : un nouveau y a une grande incertitude.
4. **Les blocs ne bougent pas pendant la période d'essai** (Elo et Glicko) : ni leur cote, ni
   leurs effectifs.

**Mesuré sur le jeu de démonstration** (réglage `periodeProvisoire` à 0 = ancien
comportement) :

| | Sans période d'essai | Avec |
|---|---|---|
| Nouveau arrivé en fin d'historique : écart à sa cote finale après 10 blocs, Elo | 0,33 cote V | **0,24** (K ×2 ; ×1 : 0,34, ×3 : 0,24) |
| Idem, Glicko | 0,29 | 0,29 |
| Faux compte, 10 flashs sur les 10 blocs les plus durs : baisse de ces blocs, Elo | 0,08 cote V | **0** |
| Idem, Glicko | **0,45** | **0** |
| Erreur médiane des blocs, mêmes 213 blocs, Elo | 0,247 | 0,259 |
| Erreur quadratique, mêmes blocs, Elo | 0,351 | 0,347 |
| Erreur médiane, mêmes 184 blocs, Glicko | 0,182 | 0,194 |
| Blocs fiables, Elo / Glicko | 226 / 197 | 213 / 185 |
| Fausses alertes sur le monde témoin (Elo) | 2,8 % | **2,0 %** |
| Précision des alertes / sous-cotés trouvés (Elo) | 98 % / 17 sur 37 | 97 % / 14 sur 34 |

**Le coût**, honnêtement : environ 550 duels sur 19 000 ne comptent plus pour les blocs, d'où
treize blocs fiables de moins et une détection un peu moins sensible. Il est grossi par le jeu
de démonstration, où les 55 grimpeurs débutent tous en même temps sur les mêmes premiers blocs ;
dans un centre en régime établi, les nouveaux arrivent au compte-gouttes. **Il sera réel au
lancement d'un vrai centre**, où tout le monde est nouveau en même temps : les dix premiers
blocs de chacun n'y compteront pas pour les blocs.

**Le gain** ne se voit pas dans les erreurs moyennes, puisque la démonstration n'a ni nouveaux
en cours de route ni tricheurs : un nouveau est juste plus vite, et dix faux envois ne
déplacent plus aucun bloc. Glicko y était bien plus vulnérable que l'Elo.

### Les échelles maison et les centres Rose Bloc (30-31 octobre 2026)

**Le calcul ne connaît que la cote V, et c'est voulu.** Les salles Rose Bloc cotent de 1 à 15 ;
leur Comp Wall (RB2) numérote ses 24 blocs de 1 à 24. Plutôt que d'apprendre ces échelles au
modèle, la base garde toujours une cote V (à deux décimales au plus) et l'échelle maison n'est
qu'une traduction à l'affichage et à la saisie (`src/core/echelles.ts`). Le modèle travaille de
toute façon sur un index continu (1 cote V = 1000 points) : une cote fractionnaire comme V5,31
ne lui coûte rien, et un seul jeu de formules sert tous les centres. Raphaël a confirmé que les
écrans d'analyse restent en V ; seules la Carte et la colonne « Affichée » de Blocs montrent la
cote du centre, plus la colonne « Calculée » en « 1-15 / V ».

**Les conversions sont des choix de Raphaël, pas des mesures.**
- Rose Bloc : 1 = V0, puis le facteur à deux décimales qui met 10 au plus près de V8, soit
  V = (cote − 1) ÷ 1,13. Deux premières propositions écartées en route : un simple décalage
  (+2) et un facteur 1,2, incompatible avec 1 = V0 et 10 = V8 à la fois.
- Comp Wall : 1 = cote 1 du gym, 24 = cote 15, en progression régulière, puis la conversion
  Rose Bloc (14 → V7, 24 → V12,39). Risques signalés et acceptés : si le 24 est en réalité bien
  plus facile qu'un 15, ou si les écarts entre numéros ne sont pas réguliers, l'amorce est
  fausse. Ce n'est qu'une amorce : la cote calculée s'en écarte avec les ascensions.

**Un bloc du Comp Wall se reconnaît à sa couleur, choisie par l'ouvreur, pas à sa position.**
Un même chiffre vaut près de 4 cotes V d'écart selon le système (★12 = V5,92, 12 du gym =
V9,73) : une bascule involontaire d'un bloc posé en bordure du mur coûterait cher, pour un gain
nul (24 blocs, un clic chacun). La couleur spéciale `comp-wall` évite une colonne de plus ; elle
n'a pas d'autre usage pour ces blocs. Pastille en étoile pour qu'on ne puisse pas la confondre
avec une pastille ronde. Un numéro en double avertit sans refuser : pendant un remontage,
l'ancien et le nouveau bloc coexistent.

**RB1 et RB2 partagent une seule cote** (un « groupe de calcul », `GROUPES_CALCUL`) : mêmes
grimpeurs, même échelle, mêmes ouvreurs, et deux fois plus de duels pour chaque cote. La période
d'essai de 10 blocs se compte par groupe. **Pour les centres suivants, Raphaël ne veut pas
empiler des groupes** mais appliquer les pistes du 18 septembre (§ 7, « Uniformiser les cotes
entre centres »).

**Une seule liste de styles pour tous les centres** (Physique, Technique, Coordo depuis le 31
octobre 2026, troisième vocabulaire après huit puis neuf puis quatre valeurs). Contrairement à
l'échelle, le style n'est pas traduit par centre : la cote par style compare des grimpeurs entre
eux sur une même liste. Une liste par centre ne serait à faire que si un centre en demandait une.

**Corriger les données passe par des fonctions réservées à l'admin général**, comme toute
écriture depuis l'étape 2 : l'écran Administration ne touche jamais les tables directement, et
chaque fonction revérifie le droit (`verifier_admin`). Né d'un cas réel : un bloc test démonté
gardait son flash dans la fiche de Raphaël, et « Démonter » garde volontairement l'historique
d'un bloc grimpé.

**Les blocs spéciaux de RB1 n'ont pas de cote d'ouvreur** : amorce à 8000 (choix de Raphaël)
et aucun effet sur les grimpeurs tant que 20 grimpeurs ne les ont pas essayés. Sans ce gel,
un bloc parti de 8000 mais valant V3 ferait gagner beaucoup de points à ses premiers
envoyeurs. Vingt *grimpeurs différents* (des duels) plutôt que vingt essais : vingt essais d'une
seule personne n'apprennent presque rien sur le bloc. Les grimpeurs en période d'essai ne
comptent pas, puisque leurs duels ne déplacent pas les blocs. **Rétroactif** (choix de Raphaël,
sur recommandation) : le seuil est compté sur tout l'historique, donc une fois atteint, les
duels des premiers comptent aussi, contre la cote stabilisée ; non rétroactif, les premiers à
oser le bloc n'en auraient jamais tiré de points. Prix : la cote de ces premiers bouge un peu
le jour où le bloc passe le seuil. Le V8 étant fictif, le bloc est écarté de tout ce qui prend
la cotation affichée pour une référence (étalonnage, verdicts, « plus dur envoyé », niveau de
départ estimé). Marqué par un drapeau à part et non par la couleur (comme le Comp Wall), parce
que ces blocs ont une vraie couleur de prises.

**Glisser un bloc au doigt : un appui long d'une seconde** (proposé par Raphaël), plutôt qu'un
glisser immédiat comme à la souris. Au doigt, le même geste sert déjà à faire défiler et
zoomer la carte, ce dont Raphaël se sert en salle ; le délai sépare les deux sans rien retirer
au tap (sélection). Rien n'est bloqué avant le déblocage : annuler un mouvement ferait
abandonner à Chrome le défilement de tout le geste.

**Les commentaires sont ouverts à tous, même sans compte**, parce qu'un problème de connexion
fait justement partie de ce qu'on veut pouvoir signaler ; contre le spam, une limite de débit
(par compte, et globale pour les visiteurs sans compte, que rien d'autre ne distingue côté
base). Lus dans l'écran Administration, **sans courriel d'avertissement** (choix de Raphaël) :
il faudrait une fonction côté serveur et le mot de passe d'application du Gmail du site. À
reconsidérer si des messages restent sans réponse.

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
- **Le multi-utilisateur en temps réel**, discuté le 17 septembre 2026, **commencé le 28 octobre
  2026** avec Supabase (voir README, § « Base de données et multi-utilisateur (en cours) »). Il
  faut une base *et* un serveur (ou un service qui fournit les deux) — une base seule, exposée
  au navigateur, ne peut appliquer aucune règle d'accès. Étapes 1 (lecture) et 2 (comptes,
  pseudonymes, envois), 3 (outils de l'ouvreur) et 4 (temps réel) faites les 29 et 30 octobre ;
  reste l'essai dans un vrai centre (étape 5).
- **Uniformiser les cotes entre centres** une fois qu'il y en aura plusieurs avec de vraies
  données, discuté le 18 septembre 2026. Deux pistes complémentaires, aucune codée. **Raphaël
  veut les appliquer aux prochains centres** (30 octobre 2026), plutôt que d'ajouter des
  groupes de calcul comme RB1 + RB2 (§ 2, « Les échelles maison ») :
  - *Grimpeurs-ponts avec cote figée à l'exterieur* : un grimpeur qui visite un centre autre que
    le sien voit ses duels là-bas influencer les blocs visités, sans que ses propres duels
    ailleurs ne fassent bouger sa cote d'origine (evite qu'un petit echantillon hors de son
    centre habituel la deregle) — analogue au « common-person equating » en psychometrie, ou la
    capacite de la personne-pont est traitee comme connue et fixe pendant la liaison. Piste
    ecartee : une liste de priorite manuelle entre centres (centre A calibre B, jamais
    l'inverse) — jette du signal reel plutot que de le ponderer, et une liste figee vieillit mal
    a mesure que les centres murissent. Preferee : ponderer l'effet d'un grimpeur-pont par
    l'incertitude (RD Glicko) deja presente sur sa cote d'origine au moment de la visite, plutot
    qu'imposer un ordre — un pont peu etabli chez lui influence peu le centre visite, un pont
    tres etabli influence plus, et ca s'ajuste seul avec le temps.
  - *Comparaison des distributions de grimpeurs entre centres* (equipercentile equating) :
    complementaire, pas un remplacement — ne distingue pas « meme population, echelle mal
    calibree » de « populations reellement differentes » (une salle plus technique ou plus
    orientee entrainement peut reellement attirer un profil different, ce qui imiterait un
    decalage de cotation dans les donnees). Les grimpeurs-ponts ont leur propre biais inverse
    (probablement plus motives/forts que la moyenne, pas un echantillon representatif). Usage
    envisage : comparer les deux estimations de decalage (ponts vs distributions) comme
    validation croisee plutot que de se fier a une seule ; les comparer sur les medianes/quantiles
    plutot que la moyenne, la distribution des grimpeurs etant probablement asymetrique.
