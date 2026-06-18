import { adminClient, inferAdditionalFields } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { auth } from "@/lib/auth"

// `inferAdditionalFields<typeof auth>()` expose username/bio (champs hors-cœur) sur la
// session côté client ; `adminClient()` expose `role`. `import type` → aucun code serveur
// dans le bundle client.
export const authClient = createAuthClient({
  plugins: [adminClient(), inferAdditionalFields<typeof auth>()],
})

export const { signIn, signOut, signUp, useSession } = authClient
