export interface FaqQuestion {
  q: string
  a: string
}

export interface FaqCategory {
  id: string
  title: string
  questions: FaqQuestion[]
}

export const faqCategories: FaqCategory[] = [
  {
    id: "plateforme",
    title: "Plateforme et apprentissage",
    questions: [
      {
        q: "Qu'est-ce que NOMAQbanq ?",
        a: "NOMAQbanq est la première plateforme francophone de préparation à l'EACMC (Examen d'aptitude du Conseil médical du Canada) Partie I. Nous offrons une banque de questions complète, des examens blancs et des outils d'apprentissage adaptés aux médecins diplômés à l'étranger.",
      },
      {
        q: "Comment fonctionne la plateforme ?",
        a: "Vous vous entraînez avec des milliers de questions couvrant tous les domaines médicaux. Vous pouvez créer des examens personnalisés, suivre vos progrès, repérer vos points faibles et réviser avec des explications détaillées pour chaque question.",
      },
      {
        q: "Les questions sont-elles similaires à celles de l'EACMC ?",
        a: "Oui. Nos questions reflètent le format, le niveau de difficulté et le contenu de l'EACMC Partie I. Elles sont régulièrement mises à jour et révisées par des médecins qualifiés.",
      },
      {
        q: "Puis-je utiliser la plateforme sur mobile ?",
        a: "Oui. NOMAQbanq fonctionne sur ordinateur, tablette et téléphone.",
      },
    ],
  },
  {
    id: "tarifs",
    title: "Abonnements et tarifs",
    questions: [
      {
        q: "Quels sont les types d'accès disponibles ?",
        a: "Deux types d'accès : l'accès Examens (examens simulés en mode réaliste) et l'accès Entraînement (banque de 3000+ questions avec mode tuteur). Chacun est offert en formule 1 mois (50 $ CA) ou 6 mois (200 $ CA, soit environ 33 % d'économie).",
      },
      {
        q: "Y a-t-il une période d'essai gratuite ?",
        a: "Oui. Vous pouvez créer un compte gratuitement et essayer la section d'évaluation sans engagement, avant d'acheter un accès complet.",
      },
      {
        q: "Comment fonctionne le temps cumulable ?",
        a: "Si vous prolongez votre accès avant son expiration, le temps restant s'ajoute à votre nouvel achat. Par exemple, s'il vous reste 15 jours et que vous achetez 30 jours, vous aurez 45 jours au total.",
      },
      {
        q: "Quels modes de paiement acceptez-vous ?",
        a: "Les cartes de crédit et de débit (Visa, Mastercard, Amex) via Stripe, notre processeur de paiement sécurisé. L'accès est activé dès le paiement.",
      },
    ],
  },
  {
    id: "contenu",
    title: "Contenu et domaines",
    questions: [
      {
        q: "Combien de questions sont disponibles ?",
        a: "Notre banque contient plus de 3000 questions couvrant tous les domaines de l'EACMC Partie I : médecine interne, chirurgie, pédiatrie, obstétrique-gynécologie, psychiatrie et d'autres.",
      },
      {
        q: "Les questions sont-elles mises à jour régulièrement ?",
        a: "Oui. Nous ajoutons de nouvelles questions chaque mois et mettons à jour le contenu existant selon les dernières recommandations médicales et les changements de l'examen.",
      },
      {
        q: "Y a-t-il des explications détaillées pour chaque question ?",
        a: "Chaque question est accompagnée d'une explication complète : pourquoi la bonne réponse est correcte, et pourquoi les autres choix ne le sont pas.",
      },
      {
        q: "Puis-je créer mes propres examens personnalisés ?",
        a: "Oui. Choisissez les domaines, le nombre de questions et les objectifs du CMC pour cibler vos révisions.",
      },
    ],
  },
  {
    id: "securite",
    title: "Sécurité et confidentialité",
    questions: [
      {
        q: "Mes données personnelles sont-elles en sécurité ?",
        a: "Oui. Vos données sont chiffrées. Nous ne vendons jamais vos informations personnelles à des tiers et respectons les réglementations sur la protection des données.",
      },
      {
        q: "Qui a accès à mes résultats d'examens ?",
        a: "Vous seul. Vos résultats et votre progression sont confidentiels et ne sont jamais partagés sans votre consentement explicite.",
      },
      {
        q: "Comment utilisez-vous les cookies ?",
        a: "Nous utilisons des cookies essentiels au fonctionnement du site et, avec votre consentement, des cookies d'analyse. Consultez notre politique de cookies pour plus de détails.",
      },
    ],
  },
  {
    id: "support",
    title: "Support et aide",
    questions: [
      {
        q: "Comment puis-je contacter le support ?",
        a: "Par courriel à nomaqbanq@outlook.com ou par téléphone au +1 (438) 875-0746. Nous répondons généralement sous 24 h.",
      },
      {
        q: "Y a-t-il une communauté d'utilisateurs ?",
        a: "Oui. Des groupes actifs sur les réseaux sociaux permettent d'échanger avec d'autres candidats et de partager des conseils.",
      },
      {
        q: "Proposez-vous des ressources d'apprentissage supplémentaires ?",
        a: "Nous publions régulièrement des articles, des guides de révision et des conseils stratégiques.",
      },
      {
        q: "Puis-je obtenir un remboursement ?",
        a: "Une garantie de satisfaction de 14 jours s'applique. Contactez-nous dans les 14 premiers jours pour un remboursement complet.",
      },
    ],
  },
]

export function getAllFaqQuestions(): FaqQuestion[] {
  return faqCategories.flatMap((category) => category.questions)
}
