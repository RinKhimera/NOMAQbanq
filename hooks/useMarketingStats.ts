import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

export function useMarketingStats() {
  const stats = useQuery(api.marketing.getMarketingStats)
  return { stats, isLoading: stats === undefined }
}
