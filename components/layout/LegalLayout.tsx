"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Back button */}
        <Link
          href="/"
          className="group mb-8 inline-flex items-center space-x-2 text-gray-600 transition-colors duration-200 hover:text-blue-600"
        >
          <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
          <span>Retour à l'accueil</span>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="font-display mb-4 text-4xl font-bold text-gray-900 sm:text-5xl">
            {title}
          </h1>
          <p className="text-sm text-gray-500">
            Dernière mise à jour : {lastUpdated}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-lg prose-blue max-w-none">
          <div className="rounded-3xl bg-white p-8 shadow-xl shadow-blue-100/50 sm:p-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
