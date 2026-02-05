import {
  BookOpen,
  CreditCard,
  GraduationCap,
  Shield,
  Users,
} from "lucide-react"

export interface FaqQuestion {
  q: string
  a: string
}

export interface FaqCategory {
  id: string
  icon: typeof GraduationCap
  title: string
  color: string
  questions: FaqQuestion[]
}

export const faqCategories: FaqCategory[] = [
  {
    id: "plateforme",
    icon: GraduationCap,
    title: "Plateforme et Apprentissage",
    color: "from-blue-500 to-indigo-600",
    questions: [
      {
        q: "Qu'est-ce que NOMAQbanq ?",
        a: "NOMAQbanq est la première plateforme francophone de préparation à l'EACMC (Examen d'Aptitude du Conseil Médical du Canada) Partie I. Nous offrons une banque de questions complète, des examens blancs, et des outils d'apprentissage adaptés aux médecins diplômés à l'étranger.",
      },
      {
        q: "Comment fonctionne la plateforme ?",
        a: "Notre plateforme vous permet de vous entraîner avec des milliers de questions couvrant tous les domaines médicaux. Vous pouvez créer des examens personnalisés, suivre vos progrès, identifier vos points faibles et réviser avec des explications détaillées pour chaque question.",
      },
      {
        q: "Les questions sont-elles similaires à celles de l'EACMC ?",
        a: "Oui, nos questions sont conçues pour refléter le format, le niveau de difficulté et le contenu de l'EACMC Partie I. Elles sont régulièrement mises à jour et révisées par des médecins qualifiés pour garantir leur pertinence et leur qualité.",
      },
      {
        q: "Puis-je utiliser la plateforme sur mobile ?",
        a: "Absolument ! NOMAQbanq est entièrement responsive et fonctionne parfaitement sur tous les appareils : ordinateurs, tablettes et smartphones. Vous pouvez étudier où et quand vous voulez.",
      },
    ],
  },
  {
    id: "tarifs",
    icon: CreditCard,
    title: "Abonnements et Tarifs",
    color: "from-green-500 to-emerald-600",
    questions: [
      {
        q: "Quels sont les types d'accès disponibles ?",
        a: "Nous proposons deux types d'accès : l'Accès Examens (examens simulés en mode réaliste) et l'Accès Entraînement (banque de 5000+ questions avec mode tuteur). Chaque type est disponible en formule 1 mois (50 CAD) ou 6 mois (200 CAD, soit ~33% d'économie).",
      },
      {
        q: "Y a-t-il une période d'essai gratuite ?",
        a: "Oui ! Vous pouvez créer un compte gratuitement et tester notre section d'évaluation sans engagement. Cela vous permet de découvrir la plateforme avant d'acheter un accès complet.",
      },
      {
        q: "Comment fonctionne le temps cumulable ?",
        a: "Si vous prolongez votre accès avant son expiration, le temps restant s'ajoute à votre nouvel achat. Par exemple, s'il vous reste 15 jours et que vous achetez 30 jours, vous aurez 45 jours au total.",
      },
      {
        q: "Quels modes de paiement acceptez-vous ?",
        a: "Nous acceptons les cartes de crédit et débit (Visa, Mastercard, Amex) via Stripe, notre processeur de paiement sécurisé. L'accès est activé instantanément après le paiement.",
      },
    ],
  },
  {
    id: "contenu",
    icon: BookOpen,
    title: "Contenu et Domaines",
    color: "from-purple-500 to-pink-600",
    questions: [
      {
        q: "Combien de questions sont disponibles ?",
        a: "Notre banque contient plus de 5 000 questions couvrant tous les domaines de l'EACMC Partie I : médecine interne, chirurgie, pédiatrie, obstétrique-gynécologie, psychiatrie, et bien plus encore.",
      },
      {
        q: "Les questions sont-elles mises à jour régulièrement ?",
        a: "Oui, nous ajoutons de nouvelles questions chaque mois et mettons à jour le contenu existant pour refléter les dernières recommandations médicales et les changements dans l'examen.",
      },
      {
        q: "Y a-t-il des explications détaillées pour chaque question ?",
        a: "Chaque question est accompagnée d'une explication complète qui vous aide à comprendre non seulement la bonne réponse, mais aussi pourquoi les autres options sont incorrectes. C'est essentiel pour un apprentissage efficace.",
      },
      {
        q: "Puis-je créer mes propres examens personnalisés ?",
        a: "Oui ! Vous pouvez créer des examens sur mesure en choisissant les domaines, le nombre de questions, et le niveau de difficulté. C'est idéal pour cibler vos révisions sur vos points faibles.",
      },
    ],
  },
  {
    id: "securite",
    icon: Shield,
    title: "Sécurité et Confidentialité",
    color: "from-orange-500 to-red-600",
    questions: [
      {
        q: "Mes données personnelles sont-elles en sécurité ?",
        a: "Absolument. Nous utilisons un chiffrement de niveau bancaire pour protéger toutes vos données. Nous ne vendons jamais vos informations personnelles à des tiers et respectons strictement les réglementations sur la protection des données.",
      },
      {
        q: "Qui a accès à mes résultats d'examens ?",
        a: "Seul vous avez accès à vos résultats et à votre progression. Vos données sont strictement confidentielles et ne sont jamais partagées sans votre consentement explicite.",
      },
      {
        q: "Comment utilisez-vous les cookies ?",
        a: "Nous utilisons des cookies essentiels pour le fonctionnement du site et des cookies d'analyse (avec votre consentement) pour améliorer votre expérience. Consultez notre politique de cookies pour plus de détails.",
      },
    ],
  },
  {
    id: "support",
    icon: Users,
    title: "Support et Aide",
    color: "from-indigo-500 to-blue-600",
    questions: [
      {
        q: "Comment puis-je contacter le support ?",
        a: "Vous pouvez nous contacter par email à nomaqbanq@outlook.com ou par téléphone au +1 (438) 875-0746. Notre équipe répond généralement sous 24h.",
      },
      {
        q: "Y a-t-il une communauté d'utilisateurs ?",
        a: "Oui ! Nous avons des groupes actifs sur les réseaux sociaux où vous pouvez échanger avec d'autres candidats, partager des conseils et vous encourager mutuellement.",
      },
      {
        q: "Proposez-vous des ressources d'apprentissage supplémentaires ?",
        a: "En plus de notre banque de questions, nous publions régulièrement des articles, des guides de révision et des conseils stratégiques pour maximiser vos chances de réussite à l'examen.",
      },
      {
        q: "Puis-je obtenir un remboursement ?",
        a: "Nous offrons une garantie de satisfaction de 14 jours. Si vous n'êtes pas satisfait de la plateforme, contactez-nous dans les 14 premiers jours pour un remboursement complet.",
      },
    ],
  },
]

// Flatten all FAQ questions for schema generation
export function getAllFaqQuestions(): FaqQuestion[] {
  return faqCategories.flatMap((category) => category.questions)
}
