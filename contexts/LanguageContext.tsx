"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

type Language = "fr" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
)

// Translations object
const translations = {
  fr: {
    // Navigation
    "nav.home": "Accueil",
    "nav.domains": "Domaines",
    "nav.about": "À propos",
    "nav.login": "Connexion",
    "nav.signup": "Inscription",
    "nav.profile": "Profil",
    "nav.logout": "Déconnexion",
    "nav.theme.light": "Clair",
    "nav.theme.dark": "Sombre",
    "nav.theme.system": "Système",

    // Home page
    "home.banner.resources": "Ressources d'apprentissage gratuites",
    "home.banner.candidates": "Pour les candidats EACMC",
    "home.banner.students": "Pour les étudiants",
    "home.hero.badge": "Plateforme #1 pour l'EACMC",
    "home.hero.title1": "PRÉPAREZ-VOUS",
    "home.hero.title2": "SANS",
    "home.hero.title3": "LIMITES",
    "home.hero.description":
      "Développez vos compétences médicales grâce à des QCM, des simulations et des évaluations en ligne proposés par les meilleurs professionnels francophones au Canada.",
    "home.hero.signup": "Inscrivez-vous gratuitement",
    "home.hero.try": "Essayez NOMAQbank",
    "home.hero.satisfied": "candidats satisfaits",
    "home.hero.certified": "Certifié EACMC",
    "home.hero.validated": "Contenu validé",
    "home.hero.success": "de réussite",
    "home.hero.rate": "Taux de succès",
    "home.search.placeholder": "Que souhaitez-vous apprendre ?",

    // Features
    "features.badge": "Fonctionnalités",
    "features.title":
      "Tout ce dont vous avez besoin pour améliorer vos performances en un seul endroit",
    "features.description":
      "Une suite complète d'outils conçus pour maximiser votre réussite à l'EACMC",
    "features.instant.title": "Démarrage instantané",
    "features.instant.desc":
      "Après avoir créé des questions sur un sujet de votre choix, vous pouvez commencer immédiatement en mode tuteur ou chronométré",
    "features.summary.title": "Points de synthèse",
    "features.summary.desc":
      "À la fin de chaque cas clinique présenté, les caractéristiques clés et les concepts cliniques importants sont résumés pour un rappel rapide",
    "features.modes.title": "Modes chronométré / tuteur",
    "features.modes.desc":
      "Selon votre emploi du temps et votre objectif ultime de préparation à l'examen EACMC partie 1, vous pouvez choisir entre le mode chronométré ou le mode tuteur",
    "features.disciplines.title": "Disciplines",
    "features.disciplines.desc":
      "Les disciplines (matières cliniques) sont placées dans un ordre systématique pour vous permettre de tester vos connaissances dans un domaine spécifique ou de réviser un sujet particulier",
    "features.monitoring.title": "Suivi des performances",
    "features.monitoring.desc":
      "Quel que soit le mode chronométré ou tuteur lors de l'utilisation de la banque de questions, une série de commentaires sont fournis pour améliorer les performances de l'utilisateur",
    "features.difficulty.title": "Niveaux de difficulté",
    "features.difficulty.desc":
      "Il y a une combinaison de questions de niveau facile à avancé et des questions piège sont mélangées pour une meilleure préparation à l'examen EACMC partie 1",
    "features.update.title": "Mise à jour",
    "features.update.desc":
      "Les questions, points de synthèse et algorithmes sont tous sous révision continue pour fournir une source fiable pour les préparations EACMC partie 1",
    "features.mnemonics.title": "Moyens mnémotechniques",
    "features.mnemonics.desc":
      "De nombreux moyens mnémotechniques présents pour résumer les points cliniques à haut rendement en un seul mot et faciliter leur rappel pendant l'examen",

    // Pricing
    "pricing.badge": "BANQUE DE QUESTIONS",
    "pricing.title": "Inscrivez-vous pour les questions NOMAQbank",
    "pricing.description1":
      "Lors de la préparation à l'examen EACMC partie 1, il est essentiel de réviser les objectifs du Conseil médical du Canada (CMC). Les objectifs décrivent les qualités requises des diplômés en médecine et des diplômés médicaux internationaux (DMI) qui cherchent à entrer en résidence au Canada.",
    "pricing.description2":
      "En vous familiarisant minutieusement avec les objectifs du CMC, vous pouvez vous assurer d'être adéquatement préparé à répondre aux attentes de la profession médicale. NOMAQbank contient plus de 2800+ questions basées sur les objectifs du CMC, fournissant un contenu à haut rendement pour vous aider à réussir vos examens.",
    "pricing.try": "ESSAYEZ GRATUITEMENT",
    "pricing.questions": "PLUS DE 2800+ QUESTIONS",
    "pricing.price": "339$",
    "pricing.period": "/3 Mois",
    "pricing.access": "Accès complet à la plateforme",
    "pricing.feature1": "Banque de questions pour 3 mois",
    "pricing.feature2": "Basé sur les objectifs CMC",
    "pricing.feature3": "Explications simples",
    "pricing.feature4": "Moyens mnémotechniques mémorables",
    "pricing.feature5": "Tableaux de synthèse et algorithmes",
    "pricing.feature6": "Apprentissage à rythme personnalisé",
    "pricing.signup": "S'inscrire maintenant",

    // Footer
    "footer.description":
      "La première plateforme francophone de préparation à l'EACMC Partie I. Votre succès commence ici.",
    "footer.links": "Liens rapides",
    "footer.contact": "Contact",
    "footer.copyright": "© 2024 NOMAQbank. Tous droits réservés.",
    "footer.privacy": "Politique de confidentialité",
    "footer.terms": "Conditions d'utilisation",
    "footer.legal": "Mentions légales",

    // About page
    "about.badge": "À propos de nous",
    "about.title": "À propos de NOMAQbank",
    "about.description":
      "La première plateforme francophone dédiée à la préparation de l'EACMC Partie I, conçue par et pour les candidats francophones du Canada et d'ailleurs.",
    "about.story.badge": "Notre histoire",
    "about.story.title": "Une vision née de l'expérience",
    "about.values.badge": "Nos valeurs",
    "about.values.title": "Ce qui nous guide au quotidien",
    "about.testimonials.badge": "Témoignages",
    "about.testimonials.title": "Ce que disent nos candidats",
    "about.cta.badge": "Rejoignez-nous",
    "about.cta.title": "Commencez votre réussite aujourd'hui",
    "about.cta.description":
      "Découvrez pourquoi des milliers de candidats francophones nous font confiance pour leur préparation à l'EACMC.",
    "about.cta.start": "Commencer gratuitement",
    "about.cta.contact": "Nous contacter",
  },
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.domains": "Domains",
    "nav.about": "About",
    "nav.login": "Login",
    "nav.signup": "Sign Up",
    "nav.profile": "Profile",
    "nav.logout": "Logout",
    "nav.theme.light": "Light",
    "nav.theme.dark": "Dark",
    "nav.theme.system": "System",

    // Home page
    "home.banner.resources": "Free learning resources",
    "home.banner.candidates": "For MCCQE candidates",
    "home.banner.students": "For students",
    "home.hero.badge": "#1 Platform for MCCQE",
    "home.hero.title1": "PREPARE",
    "home.hero.title2": "WITHOUT",
    "home.hero.title3": "LIMITS",
    "home.hero.description":
      "Develop your medical skills through MCQs, simulations and online assessments offered by the best francophone professionals in Canada.",
    "home.hero.signup": "Sign up for free",
    "home.hero.try": "Try NOMAQbank",
    "home.hero.satisfied": "satisfied candidates",
    "home.hero.certified": "MCCQE Certified",
    "home.hero.validated": "Validated content",
    "home.hero.success": "success rate",
    "home.hero.rate": "Success rate",
    "home.search.placeholder": "What would you like to learn?",

    // Features
    "features.badge": "Features",
    "features.title":
      "Everything you need to boost your performance all in one place",
    "features.description":
      "A complete suite of tools designed to maximize your MCCQE success",
    "features.instant.title": "Instant start",
    "features.instant.desc":
      "After you have created questions from a preferable topic you can start right away in either tutor or timed mode",
    "features.summary.title": "Summary points",
    "features.summary.desc":
      "At the end of each presented clinical case, the key features and important clinical concepts are summarized for rapid recalls",
    "features.modes.title": "Timed / Tutor modes",
    "features.modes.desc":
      "Based on your schedule and your ultimate goal in preparation for the MCCQE part 1 exam, you can choose from either time mode or tutor mode",
    "features.disciplines.title": "Discipline",
    "features.disciplines.desc":
      "The disciplines (clinical subjects) are placed in a systematic order for you to test your knowledge of a specific area, or to review a particular topic",
    "features.monitoring.title": "Performance Monitoring",
    "features.monitoring.desc":
      "Regardless of time or tutor mode during usage of qbank series of feedbacks are provided to enhance user performance",
    "features.difficulty.title": "Difficulty Levels",
    "features.difficulty.desc":
      "There is a combination of easy to advance level questions and tricky questions are into the mix for better preparation for the MCCQE part 1 exam",
    "features.update.title": "Update",
    "features.update.desc":
      "Questions, summary points, and algorithms all are under continuous revision to provide a reliable source for the MCCQE part 1 preparations",
    "features.mnemonics.title": "Mnemonics",
    "features.mnemonics.desc":
      "Many mnemonics present to summarize the high yield clinical points in a single word and make recalling to them much easier during the exam",

    // Pricing
    "pricing.badge": "QUESTION BANK",
    "pricing.title": "Sign Up for NOMAQbank Questions",
    "pricing.description1":
      "When preparing for the MCCQE part 1 exam, it is essential to review the Medical Council of Canada's (MCC) objectives. The objectives outline the qualities required of both medical graduates and international medical graduates (IMGs) who are looking to enter residency in Canada.",
    "pricing.description2":
      "By thoroughly familiarizing yourself with the MCC objectives, you can ensure that you are adequately prepared to meet the expectations of the medical profession. NOMAQbank contains over 2800+ questions based on MCC objectives, providing high-yield content to help Ace your exams.",
    "pricing.try": "TRY FOR FREE",
    "pricing.questions": "OVER 2800+ QUESTIONS",
    "pricing.price": "$339",
    "pricing.period": "/3 Months",
    "pricing.access": "Full platform access",
    "pricing.feature1": "Qbank for 3 months",
    "pricing.feature2": "Based on MCC Objectives",
    "pricing.feature3": "Simple explanations",
    "pricing.feature4": "Memorable mnemonics",
    "pricing.feature5": "Summary tables & algorithms",
    "pricing.feature6": "Custom pace learning",
    "pricing.signup": "Sign Up Now",

    // Footer
    "footer.description":
      "The first francophone platform for MCCQE Part I preparation. Your success starts here.",
    "footer.links": "Quick Links",
    "footer.contact": "Contact",
    "footer.copyright": "© 2024 NOMAQbank. All rights reserved.",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Use",
    "footer.legal": "Legal Notice",

    // About page
    "about.badge": "About us",
    "about.title": "About NOMAQbank",
    "about.description":
      "The first francophone platform dedicated to MCCQE Part I preparation, designed by and for francophone candidates from Canada and elsewhere.",
    "about.story.badge": "Our story",
    "about.story.title": "A vision born from experience",
    "about.values.badge": "Our values",
    "about.values.title": "What guides us daily",
    "about.testimonials.badge": "Testimonials",
    "about.testimonials.title": "What our candidates say",
    "about.cta.badge": "Join us",
    "about.cta.title": "Start your success today",
    "about.cta.description":
      "Discover why thousands of francophone candidates trust us for their MCCQE preparation.",
    "about.cta.start": "Start for free",
    "about.cta.contact": "Contact us",
  },
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("fr")

  // Load saved language from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language
    if (savedLanguage && (savedLanguage === "fr" || savedLanguage === "en")) {
      setLanguage(savedLanguage)
    }
  }, [])

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("language", language)
  }, [language])

  const t = (key: string): string => {
    return (
      translations[language][
        key as keyof (typeof translations)[typeof language]
      ] || key
    )
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
