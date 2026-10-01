"use client"

import { useEffect, useRef } from "react"

/**
 * Retient une sortie de page tant que `active` : clic sur un lien interne
 * (coquille comprise), retour arrière du navigateur, fermeture ou rechargement
 * de l'onglet. Pour les deux premiers, `onAttempt` reçoit de quoi poursuivre
 * la sortie si l'utilisateur la confirme ; la fermeture passe par la boîte du
 * navigateur.
 */
export function useLeaveGuard(
  active: boolean,
  onAttempt: (leave: () => void) => void,
  navigate: (href: string) => void,
) {
  const attempt = useRef(onAttempt)
  const go = useRef(navigate)
  useEffect(() => {
    attempt.current = onAttempt
    go.current = navigate
  })
  // Entrée d'historique en double, posée au premier passage actif : le retour
  // arrière la consomme au lieu de quitter la page.
  const trapped = useRef(false)
  // Sortie confirmée : plus rien n'est retenu, même avant le rendu suivant.
  const released = useRef(false)

  useEffect(() => {
    if (!active) return
    released.current = false
    const confirm = (leave: () => void) =>
      attempt.current(() => {
        released.current = true
        leave()
      })

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!released.current) e.preventDefault()
    }

    // En capture sur le document : avant le gestionnaire de `<Link>`, que
    // React écoute plus bas, sur sa racine.
    const onClick = (e: MouseEvent) => {
      if (released.current || e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return
      const url = new URL(anchor.href)
      if (url.origin !== window.location.origin) return
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return
      e.preventDefault()
      e.stopPropagation()
      confirm(() => go.current(url.pathname + url.search + url.hash))
    }

    if (!trapped.current) {
      window.history.pushState(window.history.state, "", window.location.href)
      trapped.current = true
    }
    const onPopState = () => {
      if (released.current) return
      window.history.pushState(window.history.state, "", window.location.href)
      confirm(() => window.history.go(-2))
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", onPopState)
    }
  }, [active])
}
