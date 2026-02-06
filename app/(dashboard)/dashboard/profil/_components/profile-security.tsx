"use client"

import { useClerk } from "@clerk/nextjs"
import { IconExternalLink, IconKey, IconShield } from "@tabler/icons-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const ProfileSecurity = () => {
  const { openUserProfile } = useClerk()
  const prefersReducedMotion = useReducedMotion()

  const handleSecurityClick = () => {
    openUserProfile()
  }

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.5,
          delay: 0.2,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      }

  return (
    <motion.div {...motionProps}>
      <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
        <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
              <IconShield className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-semibold text-gray-900 dark:text-white">
              Sécurité
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          <div className="rounded-xl bg-linear-to-br from-orange-50 to-amber-50/50 p-5 dark:from-orange-950/30 dark:to-amber-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40">
                <IconKey className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Mot de passe
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Votre mot de passe est géré de manière sécurisée par notre
                  système d{"'"}authentification. Cliquez ci-dessous pour
                  modifier vos paramètres de sécurité.
                </p>
                <Button
                  onClick={handleSecurityClick}
                  variant="outline"
                  className="mt-4 rounded-xl border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/40"
                >
                  <IconKey className="mr-2 h-4 w-4" />
                  Gérer la sécurité
                  <IconExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
