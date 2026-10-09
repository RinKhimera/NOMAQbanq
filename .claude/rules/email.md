---
paths:
  - "email/**"
  - "features/notifications/**"
  - "app/(marketing)/desabonnement/**"
  - "app/api/desabonnement/**"
  - "lib/unsubscribe-token.ts"
---

# Courriels

- **Socle** : dans `email/` (`theme.ts` jetons + identité, `components/`, `templates/email-layout.tsx` à catégories `transactional` / `commercial`). Un courriel commercial exige `unsubscribeUrl` (Loi canadienne anti-pourriel). Les templates ne lisent jamais l'env : `email/index.tsx` passe `baseUrl` et le prénom. Pas de SVG dans un courriel (Gmail/Outlook), pas de thème sombre. Courriels commerciaux (relance d'inactivité, panier abandonné) : préférence `user.notify_marketing`, désabonnement sans connexion sur `/desabonnement?token=` (jeton HMAC `lib/unsubscribe-token.ts`, aucune écriture au rendu, bouton de confirmation puis réactivation) ; en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) pointant sur `POST /api/desabonnement`, sans quoi Gmail n'affiche pas son bouton natif. Marqueurs d'envoi unique sur `user` : `welcome_email_sent_at`, `inactivity_reminder_sent_at`, `cart_reminder_sent_at` (plafond 7 j). `lib/auth.ts` n'importe que `features/notifications/welcome.ts` (pas de cycle)
- **Tout courriel unique passe par `sendOnce`**
  (`features/notifications/one-shot.ts` ; vocabulaire dans `CONTEXT.md`,
  « Courriels »). Le claim applique l'éligibilité du destinataire
  (`deletedAt IS NULL AND banned = false`, fragment `eligibleRecipient` à
  reprendre aussi dans le select) SANS poser de marqueur — le courriel repart
  si la suspension est levée —, pose le marqueur AVANT l'envoi et le laisse
  posé sur échec. Portée de cette garantie : sur la ligne cible quand le
  marqueur vit sur `user` (prédicat ré-évalué par Postgres après attente d'un
  verrou, donc une suspension en cours de commit est vue) ; au snapshot du
  claim quand il vit ailleurs (`EXISTS` corrélé, comme le select l'était
  avant). Un nouvel expéditeur (bienvenue, relance, panier…) ne
  réécrit ni `UPDATE … SET <marqueur> … WHERE <marqueur> IS NULL` ni son
  try/catch par ligne : il déclare sa sélection (portes métier et préférences
  comprises), son claim (`guard`, `cooldownMs`) et son payload ; ses tests ne
  couvrent que ce qui lui est propre (candidats, payload, `boolean`), la règle
  est prouvée une fois dans `tests/integration/one-shot.test.ts`. Seule
  exception voulue : le courriel de confirmation d'achat (webhook, « envoi
  puis marquage », `.claude/rules/payments.md`).
- **Alerte de paiement** (`sendPaymentAlert`, `features/payments/alerts.ts`) :
  le marqueur vit sur `payment_alerts`, une ligne par (événement Stripe,
  administrateur) insérée avant `sendOnce` ; la clé unique fait d'un
  événement rejoué un no-op. Transactionnel, sans lien de désabonnement : le
  pied (`footerNote` du layout) renvoie au réglage du profil admin
  (`user.notify_payment_alerts`).
