/**
 * Questions réelles de la banque (relevé du 2026-09-27) montrées sur la
 * vitrine, figées ici pour qu'aucune page publique ne lise Neon. Leur clé est
 * donc publique : ne pas les placer dans un examen blanc. Les questions dont
 * l'énoncé renvoie à une image n'y figurent pas.
 */
import type { QuizQuestion } from "@/components/quiz/runner/types"
import type { MedicalDomain } from "@/constants"

/** Question du héros et de la démo du mode tuteur (correction comprise). */
export const HERO_QUESTION: QuizQuestion = {
  _id: "exemple-gynecologie-obstetrique",
  domain: "Gynécologie obstétrique",
  objectifCMC: "Soins intrapartum et post-partum",
  question:
    "Une femme de 30 ans, gravida 1, para 0, aborta 0 est emmenée à l’urgence après avoir eu des convulsions. Elle est enceinte de 34 semaines. Avant sa grossesse, elle avait une hypertension artérielle essentielle bien maîtrisée. Elle est consciente pendant toute la durée de l’examen physique. Sa pression artérielle est de 160/105 mm Hg, et sa fréquence cardiaque est de 120/min. Laquelle des mesures suivantes est la plus appropriée à ce stade-ci ?",
  options: [
    "Administrer du diazépam par voie intraveineuse.",
    "Donner du lorazépam par voie intrarectale.",
    "Administrer du sulfate de magnésium par voie intraveineuse.",
    "Fournir un bolus de phénytoïne par voie intraveineuse.",
    "Administrer une perfusion d’hydralazine.",
  ],
  images: [],
  correctAnswer: "Administrer du sulfate de magnésium par voie intraveineuse.",
  explanation:
    "La principale préoccupation dans ce cas est la prise en charge d’un épisode de convulsions chez une femme enceinte, ce qui laisse soupçonner une éclampsie, une affection caractérisée par la survenue de convulsions dans le contexte de la prééclampsie. La mesure la plus appropriée à ce stade-ci consiste à administrer du sulfate de magnésium par voie intraveineuse, car c’est le traitement de choix pour prévenir d’autres crises convulsives et gérer les épisodes éclamptiques. Le diazépam intraveineux et le lorazépam intrarectal ne sont pas des traitements de première intention contre l’éclampsie et sont habituellement utilisés pour d’autres types de convulsions. La phénytoïne n’est pas efficace contre les crises d’éclampsie et n’est pas recommandée. La perfusion d’hydralazine est utilisée pour traiter l’hypertension artérielle, mais ne répond pas au besoin immédiat de maîtriser les convulsions associées à l’éclampsie.",
  references: [
    "Magee LA, Smith GN, Bloch C, et coll. Directive clinique n° 426 : Troubles hypertensifs de la grossesse : Diagnostic, prédiction, prévention et prise en charge.",
    "Girard P, Quirion A, Bureau Y-A, Sauvé N. Magnesium sulfate for eclampsia prevention: Quality of care evaluation in a tertiary centre in Québec, Canada. Obstetric Medicine. 2014;7(2):71–76.",
  ],
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

/** Une question d'exemple par domaine, quand la banque en fournit une sans image. */
export const DOMAIN_SAMPLE_QUESTIONS: Partial<
  Record<MedicalDomain, QuizQuestion>
> = {
  "Gynécologie obstétrique": HERO_QUESTION,
  Endocrinologie: {
    _id: "exemple-endocrinologie",
    domain: "Endocrinologie",
    objectifCMC: "Masse cervicale, goitre, maladie thyroïdienne",
    question:
      "Une femme de 30 ans se présente avec des plaintes d'intolérance à la chaleur, d'insomnie, de nervosité et de perte de poids malgré un excellent appétit. Quels sont les changements de TSH et de T4 libre que vous vous attendez le plus à observer ?",
    options: [
      "Diminution de la TSH, T4 libre normal",
      "TSH normale, T4 libre augmentée",
      "Augmentation de la TSH, diminution de la T4 libre",
      "Diminution de la TSH, augmentation de la T4 libre",
      "Augmentation de la TSH, augmentation de la T4 libre",
    ],
    images: [],
    correctAnswer: "Diminution de la TSH, augmentation de la T4 libre",
  },
  "Gastro-entérologie": {
    _id: "exemple-gastro-enterologie",
    domain: "Gastro-entérologie",
    objectifCMC: "Douleur abdominale aiguë",
    question:
      "Un homme de 67 ans se présente à votre cabinet avec de fortes douleurs abdominales périombilicales, des vomissements et une diarrhée qui ont commencé soudainement il y a plusieurs heures. Sa température est de 37,0°C, sa tension artérielle est de 110/76 mm Hg et sa fréquence respiratoire est de 28/min. Son abdomen est légèrement distendu, mou et sensible de façon diffuse ; les bruits intestinaux sont normaux. Les autres observations comprennent des poumons clairs, un rythme cardiaque rapide et irrégulier, ainsi qu’un avant-bras et une main gauches pâles sans pouls brachial gauche palpable. Les pouls du bras droit et des membres inférieurs sont normaux. Les analyses chimiques des urines et des selles révèlent la présence de sang. Son taux d’hémoglobine est de 16,4 g/dL (normale 130-180 g/L) et sa numération leucocytaire est de 25 300/mm³ (normale 4 300-10 800). La procédure d’imagerie diagnostique la plus susceptible de produire un diagnostic spécifique de sa douleur abdominale est :",
    options: [
      "Pyélographie intraveineuse",
      "Échographie de l’aorte abdominale",
      "Lavement baryté",
      "Artériographie cœliaque et mésentérique",
      "Phlébographie par contraste",
    ],
    images: [],
    correctAnswer: "Artériographie cœliaque et mésentérique",
  },
  Neurologie: {
    _id: "exemple-neurologie",
    domain: "Neurologie",
    objectifCMC: "Céphalées",
    question:
      "Un homme de 25 ans se présente avec des céphalées sévères, des douleurs cervicales, une photophobie et de la fièvre. Après plusieurs tests négatifs, vous décidez de procéder à une ponction lombaire, qui révèle une méningite virale.\n\nL'analyse du LCR ne montre pas lequel des éléments suivants ?",
    options: [
      "Nombre de cellules < 300",
      "Protéines élevées",
      "Pression normale",
      "Chlorure élevé",
      "Sucre normal",
    ],
    images: [],
    correctAnswer: "Chlorure élevé",
  },
  Psychiatrie: {
    _id: "exemple-psychiatrie",
    domain: "Psychiatrie",
    objectifCMC: "Psychose",
    question:
      "Un homme de 36 ans se présente à votre clinique environ 6 mois après avoir reçu un diagnostic de trouble schizoaffectif. Dans l’intervalle, il a commencé à prendre un antipsychotique atypique et a pris 15 kg. Laquelle des mesures suivantes est la plus appropriée à ce stade-ci ?",
    options: [
      "Prescrire un régime riche en protéines et faible en glucides",
      "Changer d’antipsychotique atypique",
      "Conseiller au patient de tolérer cet effet indésirable",
      "Orienter le patient vers une chirurgie bariatrique.",
    ],
    images: [],
    correctAnswer: "Changer d’antipsychotique atypique",
  },
  "Santé publique et médecine préventive": {
    _id: "exemple-sante-publique-et-medecine-preventive",
    domain: "Santé publique et médecine préventive",
    objectifCMC:
      "Évaluation et mesure de l'état de santé à l'échelle de la population",
    question:
      "Un pédiatre souhaitait déterminer la relation entre l'otite moyenne chronique chez les jeunes enfants et les antécédents parentaux de telles infections. À partir des dossiers d'un grand cabinet de pédiatrie, il a identifié 50 enfants âgés de un à trois ans qui avaient eu au moins trois infections de l'oreille moyenne au cours de l'année précédente. Cinquante enfants de la même tranche d'âge, traités par le même cabinet pour d'autres maladies, ont également été identifiés. Le pédiatre a interrogé les parents des sujets des deux groupes pour connaître leurs antécédents d'otite moyenne chronique lorsqu'ils étaient jeunes. Parmi les enfants souffrant d'otites à répétition, 30 avaient des antécédents familiaux d'otite moyenne chronique, contre 20 pour les enfants traités pour d'autres maladies. Il s'agit d'un exemple de quel type d'étude parmi les suivants ?",
    options: [
      "Essai clinique randomisé",
      "Essai contrôlé",
      "Étude cas-témoins",
      "Étude de cohorte",
      "Étude transversale",
    ],
    images: [],
    correctAnswer: "Étude cas-témoins",
  },
}
