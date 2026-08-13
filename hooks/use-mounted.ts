"use client"

import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * `false` pendant le rendu serveur ET pendant le rendu d'hydratation, `true`
 * ensuite. `getServerSnapshot` renvoie une constante : React l'emprunte à
 * l'hydratation, le rendu client reproduit donc exactement le HTML serveur.
 *
 * Sert à empêcher un état exclusivement client de décider du balisage pendant
 * l'hydratation. La session Better Auth en a besoin parce qu'elle se résout par
 * un aller-retour réseau déclenché au montage : sur un appareil lent elle
 * atterrit AU MILIEU de l'hydratation, et un balisage qui en dépend cesse alors
 * de correspondre au HTML servi.
 */
export const useMounted = () =>
  useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot)
