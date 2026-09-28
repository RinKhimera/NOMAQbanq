/**
 * Questions écrites pour la vitrine, absentes de la banque : leur clé peut
 * être publique sans jamais croiser un examen blanc ni le verrou de clé de
 * réponse. Figées ici pour qu'aucune page publique ne lise Neon. Chacune
 * repose sur une conduite classique, stable d'une recommandation à l'autre.
 */
import type { QuizQuestion } from "@/components/quiz/runner/types"
import type { MedicalDomain } from "@/constants"

/** Question du héros et de la démo du mode tuteur (correction comprise). */
export const HERO_QUESTION: QuizQuestion = {
  _id: "exemple-gynecologie-obstetrique",
  domain: "Gynécologie obstétrique",
  objectifCMC: "Troubles hypertensifs de la grossesse",
  question:
    "Une femme de 26 ans, primigeste, enceinte de 36 semaines, fait une crise convulsive tonico-clonique généralisée à la maison. À l'arrivée à l'urgence, elle est somnolente mais respire spontanément. Sa pression artérielle est de 168/112 mm Hg et l'analyse d'urine révèle une protéinurie à 3+. Elle n'a aucun antécédent d'épilepsie. Laquelle des mesures suivantes est la plus appropriée pour prévenir une récidive des convulsions ?",
  options: [
    "Administrer de la phénytoïne par voie intraveineuse.",
    "Administrer du lévétiracétam par voie orale.",
    "Administrer du sulfate de magnésium par voie intraveineuse.",
    "Instaurer une perfusion continue de diazépam.",
    "Procéder à une césarienne immédiate, sans autre traitement.",
  ],
  images: [],
  correctAnswer: "Administrer du sulfate de magnésium par voie intraveineuse.",
  explanation:
    "Une convulsion chez une femme enceinte hypertendue et protéinurique, sans antécédent d'épilepsie, signe une éclampsie. Le sulfate de magnésium intraveineux est le traitement de choix pour prévenir la récidive des convulsions : il est plus efficace que la phénytoïne et que les benzodiazépines dans cette indication. Les antiépileptiques habituels ne sont pas indiqués en première intention. L'accouchement est le traitement définitif de l'éclampsie, mais il se planifie une fois la patiente stabilisée (convulsions maîtrisées, pression artérielle contrôlée), et non à la place du sulfate de magnésium.",
  references: [],
}

/**
 * La même, clé seule : l'accueil et la page Domaines corrigent le choix sans
 * afficher d'explication (DESIGN.md §7).
 */
export const HERO_QUESTION_KEY_ONLY: QuizQuestion = {
  ...HERO_QUESTION,
  explanation: undefined,
  references: undefined,
}

/** Une question d'exemple par domaine, pour les pages domaine qui en ont une. */
export const DOMAIN_SAMPLE_QUESTIONS: Partial<
  Record<MedicalDomain, QuizQuestion>
> = {
  "Gynécologie obstétrique": HERO_QUESTION,
  Endocrinologie: {
    _id: "exemple-endocrinologie",
    domain: "Endocrinologie",
    objectifCMC: "Diabète",
    question:
      "Un homme de 19 ans atteint de diabète de type 1 se présente à l'urgence pour des vomissements et des douleurs abdominales depuis 24 heures. Il est déshydraté et respire rapidement et profondément. La glycémie est de 28 mmol/L, le pH artériel de 7,12, les bicarbonates de 9 mmol/L et la cétonémie est élevée. La kaliémie est de 4,6 mmol/L. Laquelle des mesures suivantes est la plus appropriée en premier lieu ?",
    options: [
      "Administrer du bicarbonate de sodium par voie intraveineuse.",
      "Administrer de l'insuline à action rapide par voie sous-cutanée et donner congé.",
      "Commencer une réhydratation intraveineuse par une solution saline isotonique.",
      "Administrer un bolus de potassium par voie intraveineuse.",
      "Prescrire un jeûne strict et reprendre la glycémie dans 4 heures.",
    ],
    images: [],
    correctAnswer:
      "Commencer une réhydratation intraveineuse par une solution saline isotonique.",
  },
  "Gastro-entérologie": {
    _id: "exemple-gastro-enterologie",
    domain: "Gastro-entérologie",
    objectifCMC: "Hémorragie digestive haute",
    question:
      "Un homme de 58 ans qui prend de l'ibuprofène tous les jours pour de l'arthrose se présente à l'urgence après deux épisodes d'hématémèse. Il est pâle et en sueur. Sa pression artérielle est de 86/54 mm Hg et sa fréquence cardiaque de 124/min. Laquelle des mesures suivantes est la plus appropriée en premier lieu ?",
    options: [
      "Réaliser une endoscopie digestive haute avant toute autre intervention.",
      "Installer deux voies veineuses de gros calibre et commencer la réanimation liquidienne.",
      "Demander une tomodensitométrie abdominale avec contraste.",
      "Administrer un inhibiteur de la pompe à protons par voie orale et observer.",
      "Poser une sonde nasogastrique et attendre les résultats de laboratoire.",
    ],
    images: [],
    correctAnswer:
      "Installer deux voies veineuses de gros calibre et commencer la réanimation liquidienne.",
  },
  Neurologie: {
    _id: "exemple-neurologie",
    domain: "Neurologie",
    objectifCMC: "Céphalées",
    question:
      "Une femme de 45 ans se présente à l'urgence pour une céphalée d'apparition brutale, maximale en quelques secondes, survenue pendant un effort. Elle la décrit comme « la pire de sa vie ». Elle a vomi une fois et présente une raideur de la nuque. L'examen neurologique ne montre aucun déficit focal. Lequel des examens suivants est le plus approprié en premier lieu ?",
    options: [
      "Une tomodensitométrie cérébrale sans contraste.",
      "Un électroencéphalogramme.",
      "Une radiographie du rachis cervical.",
      "Une imagerie par résonance magnétique des sinus.",
      "Un traitement d'épreuve par un triptan, puis une réévaluation.",
    ],
    images: [],
    correctAnswer: "Une tomodensitométrie cérébrale sans contraste.",
  },
  Psychiatrie: {
    _id: "exemple-psychiatrie",
    domain: "Psychiatrie",
    objectifCMC: "Sevrage à une substance",
    question:
      "Un homme de 52 ans, hospitalisé depuis deux jours pour une fracture de la cheville, devient agité, tremblant et en sueur. Sa fréquence cardiaque est de 118/min et sa pression artérielle de 158/96 mm Hg. Sa conjointe rapporte qu'il boit environ une douzaine de consommations d'alcool par jour depuis plusieurs années. Lequel des traitements suivants est le plus approprié ?",
    options: [
      "Un antipsychotique par voie intramusculaire.",
      "Une benzodiazépine.",
      "Un bêtabloquant seul.",
      "Une contention physique sans médication.",
      "De la naltrexone par voie orale.",
    ],
    images: [],
    correctAnswer: "Une benzodiazépine.",
  },
  "Santé publique et médecine préventive": {
    _id: "exemple-sante-publique-et-medecine-preventive",
    domain: "Santé publique et médecine préventive",
    objectifCMC:
      "Évaluation et mesure de l'état de santé à l'échelle de la population",
    question:
      "Un nouveau test de dépistage est évalué chez 1 000 personnes, dont 200 sont atteintes de la maladie selon l'examen de référence. Parmi ces 200 personnes malades, le test est positif chez 180. Laquelle des mesures suivantes correspond à 180 / 200, soit 90 % ?",
    options: [
      "La spécificité du test.",
      "La valeur prédictive positive du test.",
      "La prévalence de la maladie.",
      "La sensibilité du test.",
      "La valeur prédictive négative du test.",
    ],
    images: [],
    correctAnswer: "La sensibilité du test.",
  },
}
