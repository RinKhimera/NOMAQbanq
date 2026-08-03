import type Stripe from "stripe"

/**
 * Version d'API Stripe, source unique pour l'app et les scripts (ces derniers
 * ne peuvent pas importer `lib/stripe.ts`, qui est `server-only`).
 *
 * L'annotation `Stripe.LatestApiVersion` n'est pas décorative : ce type vaut
 * `typeof ApiVersion`, c'est-à-dire le littéral figé à la compilation du SDK
 * installé. Aucune autre valeur ne compile — l'épinglage ne peut donc pas
 * diverger du paquet, et une montée de `stripe` casse ici, volontairement :
 * c'est le seul signal qui force à lire les entrées ⚠️ du changelog avant de
 * changer la version d'API sous des paiements en production.
 *
 * Stripe n'expose aucun moyen officiel de synchroniser cette valeur
 * automatiquement (stripe-node#2273, ouverte).
 */
export const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-06-24.dahlia"
