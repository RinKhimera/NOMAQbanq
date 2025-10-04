"use client"

import { ReactNode } from "react"
import NavBar from "@/components/NavBar"
import Footer from "@/components/layout/Footer"

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
    <>
      <NavBar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 pt-20 dark:from-gray-950 dark:via-gray-900/95 dark:to-gray-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="font-display mb-4 text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Dernière mise à jour : {lastUpdated}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg prose-blue dark:prose-invert mx-auto max-w-none">
            <div className="rounded-3xl border border-gray-200/50 bg-white/80 p-8 shadow-xl shadow-blue-100/50 backdrop-blur-sm sm:p-12 dark:border-gray-800/50 dark:bg-gray-900/80 dark:shadow-blue-900/20">
              {children}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
