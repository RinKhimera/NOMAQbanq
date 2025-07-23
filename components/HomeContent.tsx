"use client"

import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  Timer,
  Trophy,
  Twitter,
  Zap,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"

export default function HomeContent() {
  const { t } = useLanguage()

  // Features section data
  const features = [
    {
      icon: Play,
      title: t("features.instant.title"),
      description: t("features.instant.desc"),
    },
    {
      icon: BookOpen,
      title: t("features.summary.title"),
      description: t("features.summary.desc"),
    },
    {
      icon: Timer,
      title: t("features.modes.title"),
      description: t("features.modes.desc"),
    },
    {
      icon: Target,
      title: t("features.disciplines.title"),
      description: t("features.disciplines.desc"),
    },
    {
      icon: BarChart3,
      title: t("features.monitoring.title"),
      description: t("features.monitoring.desc"),
    },
    {
      icon: Settings,
      title: t("features.difficulty.title"),
      description: t("features.difficulty.desc"),
    },
    {
      icon: RefreshCw,
      title: t("features.update.title"),
      description: t("features.update.desc"),
    },
    {
      icon: Brain,
      title: t("features.mnemonics.title"),
      description: t("features.mnemonics.desc"),
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      {/* Top Banner - Modern and minimal */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center text-center">
            <div className="flex items-center space-x-6 text-sm font-medium">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-yellow-300" />
                <span>{t("home.banner.resources")}</span>
              </div>
              <Link
                href="/domaines"
                className="text-blue-100 underline underline-offset-2 transition-colors hover:text-white"
              >
                {t("home.banner.candidates")}
              </Link>
              <span className="text-blue-200">•</span>
              <Link
                href="/evaluation"
                className="text-blue-100 underline underline-offset-2 transition-colors hover:text-white"
              >
                {t("home.banner.students")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section - Ultra modern */}
      <section className="relative overflow-hidden pt-20 pb-32">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-float absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-600/20 blur-3xl"></div>
          <div
            className="animate-float absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-600/20 blur-3xl"
            style={{ animationDelay: "2s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-gradient-to-br from-blue-500/5 to-indigo-600/5 blur-3xl"></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid min-h-[700px] items-center gap-16 lg:grid-cols-2">
            {/* Left content */}
            <div className="animate-fade-in-up space-y-10">
              <div className="space-y-8">
                <div className="inline-flex items-center rounded-full border border-blue-200/50 bg-gradient-to-r from-blue-100 to-indigo-100 px-4 py-2 text-sm font-semibold text-blue-700 dark:border-blue-700/50 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300">
                  <Award className="mr-2 h-4 w-4" />
                  {t("home.hero.badge")}
                </div>

                <h1 className="font-display text-display-xl gradient-text leading-none">
                  {t("home.hero.title1")}
                  <span className="block">{t("home.hero.title2")}</span>
                  <span className="block">{t("home.hero.title3")}</span>
                </h1>

                <p className="text-body-lg max-w-lg leading-relaxed text-gray-600 dark:text-gray-300">
                  {t("home.hero.description")}
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/auth/sign-up">
                  <Button className="btn-modern h-auto transform cursor-pointer rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl">
                    {t("home.hero.signup")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/evaluation">
                  <Button
                    variant="outline"
                    className="glass-card h-auto cursor-pointer rounded-2xl border-2 border-blue-200 px-8 py-4 text-lg font-semibold text-blue-700 transition-all duration-300 hover:scale-105 hover:bg-blue-50 hover:shadow-lg dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                  >
                    {t("home.hero.try")}
                    <Play className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center space-x-8 pt-8">
                <div className="flex items-center space-x-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-indigo-600 dark:border-gray-800"
                      ></div>
                    ))}
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-current text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      2000+ {t("home.hero.satisfied")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right content - Modern hero image */}
            <div className="animate-slide-in-right relative justify-end lg:flex">
              <div className="relative">
                {/* Main image container */}
                <div className="glass-card relative z-10 rounded-3xl p-2 shadow-2xl">
                  <Image
                    src="https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=600"
                    alt="Professionnels médicaux"
                    className="h-[500px] w-full rounded-2xl object-cover"
                    width={300}
                    height={300}
                  />
                </div>

                {/* Floating elements */}
                <div className="glass-card animate-float absolute -top-6 -left-6 z-20 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-emerald-600">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {t("home.hero.certified")}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t("home.hero.validated")}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="glass-card animate-float absolute -right-6 -bottom-6 z-20 rounded-2xl p-4 shadow-lg"
                  style={{ animationDelay: "1s" }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600">
                      <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        85% {t("home.hero.success")}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t("home.hero.rate")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card animate-pulse-glow absolute top-1/2 -left-12 z-20 rounded-xl p-3 shadow-lg">
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 fill-current text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      4.9/5
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Ultra modern cards */}
      <section className="section-modern bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="animate-fade-in-up mb-20 text-center">
            <div className="mb-8 inline-flex items-center rounded-full border border-blue-200/50 bg-gradient-to-r from-blue-100 to-indigo-100 px-6 py-3 text-sm font-semibold text-blue-700 dark:border-blue-700/50 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300">
              <Zap className="mr-2 h-4 w-4" />
              {t("features.badge")}
            </div>
            <h2 className="font-display text-display-lg mb-6 text-gray-900 dark:text-white">
              {t("features.title")}
            </h2>
            <p className="text-body-lg mx-auto max-w-3xl text-gray-600 dark:text-gray-300">
              {t("features.description")}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="card-feature animate-fade-in-scale"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Modern and attractive */}
      <section className="section-modern bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-20 lg:grid-cols-2">
            {/* Left side - Content */}
            <div className="animate-slide-in-left space-y-8">
              <div className="inline-flex items-center rounded-full border border-green-200/50 bg-gradient-to-r from-green-100 to-emerald-100 px-6 py-3 text-sm font-semibold text-green-700 dark:border-green-700/50 dark:from-green-900/50 dark:to-emerald-900/50 dark:text-green-300">
                <BookOpen className="mr-2 h-4 w-4" />
                {t("pricing.badge")}
              </div>

              <div className="space-y-6">
                <h2 className="font-display text-display-lg leading-tight text-gray-900 dark:text-white">
                  {t("pricing.title")}
                </h2>

                <p className="text-body-lg leading-relaxed text-gray-600 dark:text-gray-300">
                  {t("pricing.description1")}
                </p>

                <p className="text-body leading-relaxed text-gray-600 dark:text-gray-300">
                  {t("pricing.description2")}
                </p>
              </div>

              <Link href="/evaluation">
                <Button className="btn-modern h-auto transform cursor-pointer rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-10 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl">
                  {t("pricing.try")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Right side - Pricing card */}
            <div
              className="animate-slide-in-right"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="relative">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-25 blur"></div>
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-2xl">
                  <div className="absolute top-0 right-0 h-32 w-32 translate-x-16 -translate-y-16 rounded-full bg-white/10"></div>
                  <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-12 translate-y-12 rounded-full bg-white/10"></div>

                  <div className="relative z-10">
                    <div className="mb-8 flex items-start justify-between">
                      <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                        {t("pricing.questions")}
                      </div>
                    </div>

                    <div className="mb-8">
                      <div className="mb-2 flex items-baseline">
                        <span className="text-6xl font-bold">
                          {t("pricing.price")}
                        </span>
                        <span className="ml-2 text-xl text-blue-100">
                          {t("pricing.period")}
                        </span>
                      </div>
                      <p className="text-blue-100">{t("pricing.access")}</p>
                    </div>

                    <div className="mb-8 space-y-4">
                      {[
                        t("pricing.feature1"),
                        t("pricing.feature2"),
                        t("pricing.feature3"),
                        t("pricing.feature4"),
                        t("pricing.feature5"),
                        t("pricing.feature6"),
                      ].map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3"
                        >
                          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-400">
                            <CheckCircle className="h-3 w-3 text-green-900" />
                          </div>
                          <span className="text-blue-50">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Link href="/auth/sign-up">
                      <Button className="btn-modern w-full cursor-pointer rounded-2xl bg-white py-4 font-semibold text-blue-600 shadow-lg transition-all duration-300 hover:bg-blue-50 hover:shadow-xl">
                        {t("pricing.signup")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Modern gradient */}
      <section className="relative overflow-hidden py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Animated background elements */}
        <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
          <div className="animate-float absolute -top-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>
          <div
            className="animate-float absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-white/10 blur-3xl"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="animate-fade-in-up">
            <h2 className="font-display text-display-lg mb-8 text-white">
              Commencez votre préparation dès aujourd&apos;hui
            </h2>
            <p className="text-body-lg mx-auto mb-12 max-w-2xl text-blue-100">
              Rejoignez les milliers de candidats qui ont réussi grâce à
              NOMAQbank
            </p>
            <div className="flex flex-col justify-center gap-6 sm:flex-row">
              <Link href="/auth/sign-up">
                <Button className="btn-modern h-auto transform rounded-2xl bg-white px-12 py-4 text-lg font-semibold text-blue-600 shadow-xl transition-all duration-300 hover:scale-105 hover:bg-blue-50 hover:shadow-2xl">
                  Inscription gratuite
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="outline"
                className="glass-card-dark h-auto rounded-2xl border-2 border-white/30 px-12 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-white/10"
              >
                Voir les tarifs
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Modern and clean */}
      <footer className="bg-gray-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
            {/* Logo and description */}
            <div className="col-span-1 md:col-span-2">
              <Link href="/" className="mb-8 flex items-center space-x-3">
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 shadow-lg">
                  <Stethoscope className="h-8 w-8 text-white" />
                </div>
                <span className="font-display text-2xl font-bold">
                  NOMAQbank
                </span>
              </Link>
              <p className="text-body mb-8 max-w-md leading-relaxed text-gray-300">
                {t("footer.description")}
              </p>
              <div className="flex space-x-4">
                {[Facebook, Twitter, Linkedin, Instagram].map((Icon, index) => (
                  <a
                    key={index}
                    href="#"
                    className="flex h-12 w-12 transform items-center justify-center rounded-2xl bg-gray-800 transition-all duration-300 hover:scale-110 hover:bg-gradient-to-br hover:from-blue-600 hover:to-indigo-600"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-display mb-8 text-lg font-semibold">
                {t("footer.links")}
              </h3>
              <ul className="space-y-4">
                {[
                  { name: t("nav.home"), href: "/" },
                  { name: t("nav.domains"), href: "/domaines" },
                  { name: "Évaluation", href: "/evaluation" },
                  { name: t("nav.about"), href: "/a-propos" },
                  { name: "Tarifs", href: "#" },
                  { name: "FAQ", href: "#" },
                ].map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-300 underline-offset-4 transition-colors duration-200 hover:text-blue-400 hover:underline"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-display mb-8 text-lg font-semibold">
                {t("footer.contact")}
              </h3>
              <ul className="space-y-6">
                <li className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-gray-300">contact@nomaqbank.ca</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                    <Phone className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-gray-300">+1 (514) 123-4567</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                    <MapPin className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-gray-300">
                    Montréal, QC
                    <br />
                    Canada
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-16 flex flex-col items-center justify-between border-t border-gray-800 pt-8 md:flex-row">
            <p className="text-sm text-gray-400">{t("footer.copyright")}</p>
            <div className="mt-4 flex space-x-8 md:mt-0">
              {[t("footer.privacy"), t("footer.terms"), t("footer.legal")].map(
                (link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-sm text-gray-400 underline-offset-4 transition-colors duration-200 hover:text-blue-400 hover:underline"
                  >
                    {link}
                  </a>
                ),
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
