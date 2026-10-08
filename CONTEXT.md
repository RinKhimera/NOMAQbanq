# NOMAQbanq

Plateforme de préparation à l'EACMC Partie I : une banque de questions partagée
sert à la fois l'entraînement, les examens blancs et le quiz public. Ce glossaire
fixe les termes du domaine ; l'implémentation vit dans le code.

## Language

### Banque de questions

**Question** :
Un QCM de la banque, avec ses options (distinctes deux à deux), sa clé de
réponse et sa correction. Une même question peut servir dans plusieurs examens
et dans l'entraînement.
_Avoid_ : item, QCM (le mot désigne le format, pas l'entité)

**Objectif du CMC** :
La présentation clinique qu'une question évalue (Dyspnée, Toux, Fatigue…),
choisie dans le référentiel des objectifs. Un objectif n'appartient à aucun
domaine : les objectifs d'un domaine sont ceux qu'utilise au moins une de ses
questions actives, et un même objectif sert plusieurs domaines.
_Avoid_ : objectif de domaine, objectif d'apprentissage, compétence

**Référentiel des objectifs** :
La liste des objectifs du CMC, chacun sous un libellé. Toute question porte
un objectif du référentiel. Il part des valeurs saisies librement et se
nettoie par la fusion des variantes, jusqu'à ce que chaque objectif n'ait plus
qu'un libellé. Un nouvel objectif y entre seulement s'il ne double pas un
objectif existant (même libellé aux accents, casse, ponctuation et espaces
près).
_Avoid_ : liste validée, catalogue d'objectifs

**Variante d'objectif** :
Une graphie libre d'un même objectif, héritée de la saisie libre (« Douleur
abdominale aigue », « Douleur abdominale aiguë »). La fusion remplace toutes les
variantes d'un groupe par un seul libellé du référentiel, sans toucher à rien
d'autre dans les questions.
_Avoid_ : doublon, alias

**Valeur invalide** :
Une valeur d'objectif qui n'en est pas une (« - », un énoncé collé) : elle ne
se choisit nulle part et ne se fusionne pas ; elle se corrige question par
question, puis disparaît.
_Avoid_ : objectif vide, objectif corrompu

**Clé de réponse** :
La bonne option d'une question. Elle ne quitte le serveur que par un canal de
révélation autorisé.
_Avoid_ : réponse correcte, solution

**Correction** :
Ce qu'un lecteur reçoit quand la clé est révélée : la clé, l'explication, les
références et, à la révision, les images d'explication.
_Avoid_ : feedback, explication seule

**Référence** :
Une seule source bibliographique citée par une correction, numérotée par sa
position dans la liste des références de la question. Un bloc de plusieurs
sources collées dans une même entrée n'est pas une référence, c'est un défaut
de mise en forme.
_Avoid_ : bibliographie, source (pour une entrée), bloc de références

**Appel de citation** :
La marque `[n]`, `[n-m]`, `[n,m]` ou leurs chaînes (`[n][m]`) dans le texte
d'une explication, qui renvoie à la référence de même numéro.
_Avoid_ : citation (désigne la source elle-même), renvoi, note

**Normalisation** :
La remise en forme d'un texte collé, qui touche aux espaces, aux coupures, à la
numérotation et au découpage en références, sans jamais changer un mot du
contenu. Appliquée une deuxième fois, elle ne change plus rien.
_Avoid_ : nettoyage, reformatage, correction (terme réservé à la correction
d'une question)

**Mise en forme à vérifier** :
L'état d'une question dont la normalisation ne peut pas trancher sans un
humain : découpage ambigu, numérotation trouée, contenu versé dans le mauvais
champ, texte tronqué.
_Avoid_ : question corrompue, question en erreur

**Forme-pont** :
La forme d'une question telle que la consomment les composants de quiz
partagés, quel que soit le canal qui l'a chargée (entraînement, examen, quiz
public). Elle ne porte la correction que lorsqu'elle est autorisée.
_Avoid_ : DTO, vue question

### Verrou de clé de réponse

**Verrou de clé de réponse** :
La règle qui retient la clé d'une question tant qu'un examen blanc qui la
contient est ouvert. Il s'applique à la révélation (aucune correction) et à la
sélection (la question n'entre dans aucun lot de révision ni tirage public).
_Avoid_ : verrou anti-triche, masquage, lock d'examen

**Lecteur** :
Celui pour qui le verrou est évalué : un utilisateur identifié par son rôle, ou
un anonyme (quiz public). Un participant est verrouillé sur ses examens ouverts,
un anonyme sur tout examen ouvert ou en préparation, un admin jamais.
_Avoid_ : viewer, utilisateur courant

**Clé retenue** :
L'état d'une question dont la clé est sous verrou pour le lecteur. Une réponse
à cette question n'est ni juste ni fausse tant que l'examen n'est pas clos.
_Avoid_ : question verrouillée, non corrigée

**Correction différée** :
Ce que voit l'étudiant à la place de la correction d'une question à clé
retenue : un état à part entière dans les résultats et en mode tuteur, distinct
de « sans réponse » et de « incorrect ».
_Avoid_ : en attente, indisponible

**Score retenu** :
L'état d'une session ou d'une participation dont au moins une réponse est en
correction différée : son score, qui compte toutes les réponses, n'est lu par
aucune surface étudiant (résultats, historique, graphiques, moyennes,
classement) tant que l'examen n'est pas clos, sinon il trahirait par
soustraction la justesse des réponses différées. Le score reste enregistré tel
quel ; il est retenu à la lecture, jamais recalculé. Un score d'examen est donc
retenu tant que son propre examen est ouvert.
_Avoid_ : score partiel, score masqué

**Choix figés** :
L'état d'une question qu'un examen ouvert et finalisé contient : sa clé et le texte de ses
options ne peuvent pas changer avant la clôture, pour que tous les
participants soient jugés sur la même clé (le verdict est fixé au moment de la
réponse). L'énoncé, l'explication, les références et le classement restent
modifiables. Distinct du verrou de clé de réponse, qui porte sur ce que voit un
lecteur, pas sur ce qu'un admin peut écrire.
_Avoid_ : question verrouillée, question gelée

### Passation

**Examen blanc** :
Une épreuve chronométrée composée d'un lot fixe de questions, ouverte entre une
date de début et une date de fin. Ses résultats ne sont visibles qu'après sa
clôture.
_Avoid_ : mock exam, test

**Examen ouvert** :
Un examen blanc dont la date de fin n'est pas passée. C'est lui qui déclenche
le verrou de clé de réponse.
_Avoid_ : examen actif (la suspension est un réglage administrateur distinct)

**Réouverture** :
Un nouvel examen blanc qui reprend le contenu d'un examen clos (questions,
réglages, audience) avec de nouvelles dates. L'examen d'origine
reste clos avec ses participations ; aucun lien entre les deux n'est conservé.
Un examen clos qui a des participations ne se rouvre jamais en repoussant sa
date de fin. La réouverture passe par la finalisation : ses questions sont les
mêmes, dans un ordre remélangé. Qui passe la réouverture voit la correction de sa participation
d'origine différée jusqu'à la clôture de la réouverture (mêmes questions).
_Avoid_ : édition, session, prolongation (qui repousse la fin d'un examen encore ouvert)

**Phase d'examen** :
Ce qu'un examen blanc affiche à un instant donné : en préparation, à venir, en
cours, suspendu ou terminé. C'est un terme d'affichage ; un examen à venir ou
en cours est « ouvert » au sens du verrou. Suspendu prime sur à venir et en
cours ; un examen clos est terminé, suspendu ou non.
_Avoid_ : statut d'examen, état, « ouvert » pour la phase en cours, « finalisé »
(c'est une action, pas une phase)

**Examen en préparation** :
Un examen blanc enregistré mais pas encore finalisé : son lot de questions peut
être incomplet, ses dates et son audience absentes ou provisoires. Il n'existe
pas pour l'étudiant et ne s'ouvre jamais, même à sa date d'ouverture : nul,
admin compris, ne peut le démarrer. Il ne compte pas dans la dernière
utilisation d'une question, et ses questions n'ont pas de choix figés.
_Avoid_ : brouillon, examen non publié

**Examen masqué** :
Un examen blanc que seuls voient les admins et ses candidats éligibles ; un
examen non masqué est vu de tous les étudiants, éligibles ou non. Pour une
audience d'abonnés, est éligible l'étudiant qui a l'accès Examens actif ou qui a
déjà une participation à cet examen : un candidat dont l'accès expire garde
l'examen dans son historique. Une audience restreinte est déjà réservée à ses
membres, que l'examen soit masqué ou non.
_Avoid_ : caché, privé, confidentiel

**Examen suspendu** :
Un examen ouvert que plus personne ne peut commencer, admin compris ; qui le
compose déjà peut terminer. Il reste visible de ceux qui le voyaient. La
suspension se lève tant que l'examen est ouvert et ne joue plus une fois
l'examen clos.
_Avoid_ : désactivé, fermé (c'est un examen clos), en pause (c'est une
participation)

**Finalisation** :
L'action d'un admin qui fait passer un examen en préparation à examen prêt à
s'ouvrir : elle vérifie tout (lot complet égal au nombre visé, dates dont la
fin n'est pas passée, audience restreinte non vide), fixe la durée sur le lot
réel et mélange l'ordre des questions. Modifier le lot ou le nombre visé d'un
examen finalisé sans participation le remet en préparation ; modifier ses
autres réglages, non.
_Avoid_ : publication, validation, clôture (qui ferme une tentative)

**Participation** :
La tentative d'un étudiant à un examen blanc, avec ses réponses et son score.
_Avoid_ : passation, session d'examen

**Session d'entraînement** :
Un lot de questions tiré pour un étudiant, en mode test (correction à la fin)
ou tuteur (correction question par question), avec ses réponses et son score.
L'étudiant la connaît sous le nom de **série** (« Nouvelle série », « Série en
cours ») ; les deux mots désignent la même chose.
_Avoid_ : quiz, practice, session (seul, ambigu avec la participation)

**Mode tuteur** :
Le mode d'entraînement où la correction se révèle dès qu'une réponse est
validée.
_Avoid_ : feedback immédiat

**Tentative** :
Une participation ou une session d'entraînement, vue par le cycle de vie
qu'elles partagent : ouverte, en pause, close ou expirée. « Passation » nomme
l'activité, « tentative » l'entité qui la porte.
_Avoid_ : attempt, passation (pour désigner une tentative précise)

**Clôture** :
L'écriture qui ferme une tentative et fixe son score de clôture, qu'elle vienne
de l'étudiant (soumission) ou de l'expiration (cron). Une tentative n'est close
qu'une fois.
_Avoid_ : finalisation (action sur un examen, pas sur une tentative),
complétion, fermeture

**Score de clôture** :
Le pourcentage de réponses justes sur le lot de la tentative — toutes ses
questions, répondues ou non —, écrit une fois à la clôture et jamais recalculé.
_Avoid_ : score sur les réponses données, note

### Horloge de tentative

**Budget de temps** :
La durée allouée à une tentative pour répondre, décomptée depuis son
démarrage, hors pause créditée.
_Avoid_ : durée de l'examen, completion time, timer

**Crédit de pause** :
Le temps passé en pause qui est rendu au budget de temps, plafonné à la durée
de pause autorisée par l'examen.
_Avoid_ : temps de pause, pause cumulée

**Grâce** :
La tolérance accordée par le serveur au-delà du budget de temps épuisé, pour
absorber la latence entre l'horloge de l'étudiant et la sienne.
_Avoid_ : marge, tolérance réseau

**Corpus de révision** :
Les questions éligibles à une session de révision ciblée d'un étudiant :
ratées, non vues ou marquées, dans son domaine et ses objectifs.
_Avoid_ : pool, sélection

### Statistiques

**Percentile d'examen** :
La part des autres participations d'un même examen blanc clos dont le score
lisible est strictement inférieur à celui du participant (« mieux que X % des
participants »). Les pairs sont les participations d'étudiants, hors comptes
admin et supprimés. Il n'existe pas en dessous d'un effectif minimal de pairs,
ni pour un examen ouvert.
_Avoid_ : rang global, percentile d'entraînement

**Classement d'examen** :
Les participations terminées d'un examen blanc clos, par score décroissant.
L'admin le consulte sur la fiche de l'examen et ouvre la copie de chaque
candidat. Un participant le consulte aussi, chaque candidat identifié par son
nom d'utilisateur et sa photo, jamais son nom complet ; il n'ouvre que sa propre
copie. Sa population est celle du percentile d'examen
(participations d'étudiants, hors comptes admin et supprimés) : rang et
percentile comptent les mêmes participants. La fiche liste aussi les copies des
comptes admin et supprimés, signalées et sans rang.
_Avoid_ : leaderboard, palmarès

**Maîtrise par domaine** :
La part de réponses justes d'un étudiant dans un domaine médical, calculée sur
sa DERNIÈRE réponse à chaque question (entraînement et examens clos). Une
question dont la clé est retenue pour l'étudiant n'y entre pas du tout, ni sa
réponse d'examen ni ses réponses d'entraînement antérieures, tant que l'examen
est ouvert : la maîtrise peut baisser au démarrage d'un examen, jamais pendant. Un
domaine jamais pratiqué n'a pas de maîtrise, pas une maîtrise de 0 %.
_Avoid_ : score par domaine, taux de réussite (réservé à la question)

**Verdict d'une réponse** :
Juste ou fausse, fixé au moment où l'étudiant répond, contre la clé de ce
moment-là, et jamais réécrit. Scores, maîtrise par domaine, percentile et
correction affichée à l'étudiant lisent ce verdict ; seul le taux de réussite
d'une question rejuge une réponse sur la clé actuelle.
_Avoid_ : justesse recalculée, is_correct

**Clé corrigée** :
Une clé de réponse remplacée par une AUTRE option de la question, parce
qu'elle était erronée. Le taux de réussite recompte alors l'historique ; le
verdict des réponses passées, et donc les scores, ne bougent pas. L'étudiant
voit la clé actuelle, son propre verdict, et la mention que la clé a été
corrigée depuis sa réponse.
_Avoid_ : clé modifiée (ambigu avec une reformulation)

**Option reformulée** :
Une option dont le texte a changé sans changer de sens (coquille, précision).
Une réponse enregistrée sur l'ancien texte porte sur une **formulation
antérieure** : elle garde son verdict partout, y compris dans le taux de
réussite, et l'étudiant voit son ancien texte tel quel. Limite assumée : si
l'option-clé est reformulée puis la clé corrigée (dans la même édition ou
plus tard), les réponses sur l'ancien texte de la clé restent justes.
_Avoid_ : option modifiée, clé reformulée (quand on parle de l'effet sur le taux)

**Taux de réussite d'une question** :
La part de réponses justes à une question, calculée sur la PREMIÈRE réponse de
chaque étudiant (entraînement et examens), hors comptes admin et supprimés.
Une réponse est jugée sur la clé actuelle si son option existe encore, sur son
verdict si elle porte sur une formulation antérieure.
Mesure la difficulté de la question, pas le niveau d'un étudiant. Non
significatif en dessous d'un nombre minimal de réponses.
_Avoid_ : difficulté, maîtrise

**Répartition des réponses** :
La part de chaque option parmi les réponses comptées dans le taux de réussite
d'une question, plus une part « formulation antérieure » qui regroupe les
réponses sur une option reformulée ; les parts couvrent toutes les réponses
comptées (100 % à l'arrondi près). Une option actuelle autre que la clé, plus
choisie que les réponses justes, signale une clé de réponse probablement
erronée ; la formulation antérieure n'entre pas dans cette comparaison.
_Avoid_ : distribution des distracteurs

**Clé à vérifier** :
L'état d'une question dont la répartition des réponses, sur un taux de
réussite significatif, désigne une option actuelle autre que la clé comme plus
choisie que les réponses justes, et qui n'a pas de clé confirmée en vigueur.
Il se lève seul quand la clé est corrigée ou l'option reformulée. Distinct de
la mise en forme à vérifier, qui porte sur le texte, et d'un signalement de
candidat, qui est humain.
_Avoid_ : à vérifier (seul), clé suspecte, question à vérifier

**Clé confirmée** :
Le constat d'un admin, après revue, que la clé d'une clé à vérifier est juste
(piège, distracteur attirant). Elle retire la question des clés à vérifier
jusqu'à ce que la question soit modifiée (énoncé, options ou clé) ou que son
nombre de réponses ait doublé depuis la confirmation ; seule la dernière
confirmation compte. Elle ne fait pas taire un signalement de candidat.
_Avoid_ : question validée, faux positif

**Dernière utilisation** :
L'examen blanc le plus récent, par date d'ouverture, dont le lot contient la
question. Un examen en préparation n'en compte pas ; un examen suspendu, si.
_Avoid_ : date d'usage, dernier tirage

**Question récente** :
Une question dont la dernière utilisation est l'un des derniers examens blancs
(les trois derniers par défaut). Elle est écartée de la complétion automatique
d'un examen, sauf si un domaine n'a plus assez d'autres questions.
_Avoid_ : question déjà utilisée, question grillée

**Date d'une réponse** :
Le moment qui ordonne les réponses d'un étudiant à une même question, pour en
trouver la première ou la dernière. Une réponse d'entraînement est datée de sa
validation ; une réponse d'examen, de la clôture de sa participation, car elle
reste modifiable jusque-là. Une session d'entraînement en cours n'a pas encore
de réponse datée : en mode test, sa justesse reste cachée jusqu'à la fin.
_Avoid_ : date de création de la réponse

### Paiements

**Port Stripe** :
La surface étroite par laquelle l'application parle à Stripe — les verbes
qu'elle lui demande, typés sur ce qu'elle lit, et rien d'autre. Un adaptateur
SDK en production, un faux en test.
_Avoid_ : client Stripe, SDK, getStripe

**Fulfillment** :
Le traitement d'un événement Stripe vérifié — octroi, échec, litige,
remboursement, signal de fraude —, décidé par le type d'événement, indépendant
du transport HTTP. Une erreur de fulfillment est rejouée par Stripe.
_Avoid_ : handler de webhook, traitement du webhook

**Acquittement** :
La réponse HTTP au webhook — 200 traité ou volontairement ignoré, 400
signature (jamais rejoué), 500 à rejouer. Propriété de la route seule.
_Avoid_ : ack, réponse du webhook

### Courriels

**Courriel unique** :
Un courriel qu'un même destinataire ne reçoit qu'une fois par événement (ou
par fenêtre de plafond), porté par un marqueur d'envoi : résultats d'examen,
rappel de fin d'accès, relance d'inactivité, bienvenue, panier abandonné.
_Avoid_ : notification, one-shot, courriel transactionnel

**Marqueur d'envoi** :
L'horodatage qui atteste qu'un courriel unique a été réclamé pour une ligne ;
posé avant l'envoi, jamais retiré sur échec, ré-armé seulement par un événement
métier (un renouvellement).
_Avoid_ : flag, sentAt, drapeau d'envoi

**Claim** :
L'écriture atomique qui pose le marqueur si et seulement s'il est libre (ou
plus vieux que le plafond) et que le destinataire est éligible ; celui qui
gagne le claim envoie, un concurrent n'obtient rien.
_Avoid_ : verrou d'envoi, réservation

**Destinataire éligible** :
Un compte ni supprimé ni suspendu. Les préférences de notification ne sont pas
l'éligibilité : un refus de préférence est un choix du destinataire, pas une
inéligibilité.
_Avoid_ : destinataire actif, compte valide
