import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { auth } from "@/lib/auth"

// Dédupliqué par render via React cache().
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})
