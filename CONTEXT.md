# NOMAQbanq

Plateforme de préparation à l'EACMC Partie I : une banque de questions partagée
sert à la fois l'entraînement, les examens blancs et le quiz public. Ce glossaire
fixe les termes du domaine ; l'implémentation vit dans le code.

## Language

### Banque de questions

**Question** :
Un QCM de la banque, avec ses options, sa clé de réponse et sa correction. Une
même question peut servir dans plusieurs examens et dans l'entraînement.
_Avoid_ : item, QCM (le mot désigne le format, pas l'entité)

**Clé de réponse** :
La bonne option d'une question. Elle ne quitte le serveur que par un canal de
révélation autorisé.
_Avoid_ : réponse correcte, solution

**Correction** :
Ce qu'un lecteur reçoit quand la clé est révélée : la clé, l'explication, les
références et, à la révision, les images d'explication.
_Avoid_ : feedback, explication seule

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
un anonyme sur tout examen ouvert, un admin jamais.
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

### Passation

**Examen blanc** :
Une épreuve chronométrée composée d'un lot fixe de questions, ouverte entre une
date de début et une date de fin. Ses résultats ne sont visibles qu'après sa
clôture.
_Avoid_ : mock exam, test

**Examen ouvert** :
Un examen blanc dont la date de fin n'est pas passée. C'est lui qui déclenche
le verrou de clé de réponse.
_Avoid_ : examen actif (l'activation est un réglage administrateur distinct)

**Phase d'examen** :
Ce qu'un examen blanc affiche à un instant donné : à venir, en cours, terminé
ou désactivé. C'est un terme d'affichage ; un examen à venir ou en cours est
« ouvert » au sens du verrou.
_Avoid_ : statut d'examen, état

**Participation** :
La tentative d'un étudiant à un examen blanc, avec ses réponses et son score.
_Avoid_ : passation, session d'examen

**Session d'entraînement** :
Un lot de questions tiré pour un étudiant, en mode test (correction à la fin)
ou tuteur (correction question par question), avec ses réponses et son score.
_Avoid_ : quiz, practice

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
_Avoid_ : finalisation, complétion, fermeture

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

**Maîtrise par domaine** :
La part de réponses justes d'un étudiant dans un domaine médical, calculée sur
sa DERNIÈRE réponse à chaque question (entraînement et examens clos). Une
réponse en correction différée n'y entre pas tant que l'examen est ouvert. Un
domaine jamais pratiqué n'a pas de maîtrise, pas une maîtrise de 0 %.
_Avoid_ : score par domaine, taux de réussite (réservé à la question)

**Taux de réussite d'une question** :
La part de réponses justes à une question, calculée sur la PREMIÈRE réponse de
chaque étudiant (entraînement et examens), hors comptes admin et supprimés.
Mesure la difficulté de la question, pas le niveau d'un étudiant. Non
significatif en dessous d'un nombre minimal de réponses.
_Avoid_ : difficulté, maîtrise

**Répartition des réponses** :
La part de chaque option parmi les réponses comptées dans le taux de réussite
d'une question. Une option autre que la clé plus choisie que la clé signale
une clé de réponse probablement erronée.
_Avoid_ : distribution des distracteurs

**Date d'une réponse** :
Le moment qui ordonne les réponses d'un étudiant à une même question, pour en
trouver la première ou la dernière. Une réponse d'entraînement est datée de sa
validation ; une réponse d'examen, de la clôture de sa participation, car elle
reste modifiable jusque-là.
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
