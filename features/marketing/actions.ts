"use server"

import { type MarketingStats, getMarketingStats } from "./dal"

/** [Public] Stats marketing pour le hook client `useMarketingStats`. */
export const loadMarketingStats = async (): Promise<MarketingStats> =>
  getMarketingStats()
