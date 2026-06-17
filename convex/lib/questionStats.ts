import type { MutationCtx } from "../_generated/server"
import { Errors } from "./errors"

export const TOTAL_DOMAIN_KEY = "__total__"
export const GLOBAL_OBJECTIF_KEY = "__all__"

export const normalizeObjectifCMC = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export const validateDomain = (domain: string) => {
  if (domain === TOTAL_DOMAIN_KEY) {
    throw Errors.invalidInput(`Le domaine "${TOTAL_DOMAIN_KEY}" est réservé`)
  }
}

export const incrementDomainCount = async (
  ctx: MutationCtx,
  domain: string,
) => {
  validateDomain(domain)

  const domainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .unique()

  if (domainStat) {
    await ctx.db.patch(domainStat._id, { count: domainStat.count + 1 })
  } else {
    await ctx.db.insert("questionStats", { domain, count: 1 })
  }

  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat) {
    await ctx.db.patch(totalStat._id, { count: totalStat.count + 1 })
  } else {
    await ctx.db.insert("questionStats", { domain: TOTAL_DOMAIN_KEY, count: 1 })
  }
}

export const decrementDomainCount = async (
  ctx: MutationCtx,
  domain: string,
) => {
  validateDomain(domain)

  const domainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .unique()

  if (domainStat) {
    if (domainStat.count <= 1) {
      await ctx.db.delete(domainStat._id)
    } else {
      await ctx.db.patch(domainStat._id, { count: domainStat.count - 1 })
    }
  } else {
    console.warn(
      `[questionStats] Domaine "${domain}" introuvable lors du décrement`,
    )
  }

  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat && totalStat.count > 0) {
    await ctx.db.patch(totalStat._id, { count: totalStat.count - 1 })
  }
}

export const transferDomainCount = async (
  ctx: MutationCtx,
  oldDomain: string,
  newDomain: string,
) => {
  validateDomain(oldDomain)
  validateDomain(newDomain)

  const oldDomainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", oldDomain))
    .unique()

  if (oldDomainStat) {
    if (oldDomainStat.count <= 1) {
      await ctx.db.delete(oldDomainStat._id)
    } else {
      await ctx.db.patch(oldDomainStat._id, { count: oldDomainStat.count - 1 })
    }
  } else {
    console.warn(
      `[questionStats] Ancien domaine "${oldDomain}" introuvable lors du transfert`,
    )
  }

  const newDomainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", newDomain))
    .unique()

  if (newDomainStat) {
    await ctx.db.patch(newDomainStat._id, { count: newDomainStat.count + 1 })
  } else {
    await ctx.db.insert("questionStats", { domain: newDomain, count: 1 })
  }
}

export const incrementObjectifCMCCount = async (
  ctx: MutationCtx,
  objectifCMC: string,
  domain: string,
) => {
  const normalized = normalizeObjectifCMC(objectifCMC)
  if (!normalized) return

  const domainStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", domain),
    )
    .unique()

  if (domainStat) {
    await ctx.db.patch(domainStat._id, { count: domainStat.count + 1 })
  } else {
    await ctx.db.insert("objectifCMCStats", {
      objectifCMC: normalized,
      domain,
      count: 1,
    })
  }

  const globalStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", GLOBAL_OBJECTIF_KEY),
    )
    .unique()

  if (globalStat) {
    await ctx.db.patch(globalStat._id, { count: globalStat.count + 1 })
  } else {
    await ctx.db.insert("objectifCMCStats", {
      objectifCMC: normalized,
      domain: GLOBAL_OBJECTIF_KEY,
      count: 1,
    })
  }
}

export const decrementObjectifCMCCount = async (
  ctx: MutationCtx,
  objectifCMC: string,
  domain: string,
) => {
  const normalized = normalizeObjectifCMC(objectifCMC)
  if (!normalized) return

  const domainStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", domain),
    )
    .unique()

  if (domainStat) {
    if (domainStat.count <= 1) {
      await ctx.db.delete(domainStat._id)
    } else {
      await ctx.db.patch(domainStat._id, { count: domainStat.count - 1 })
    }
  } else {
    console.warn(
      `[objectifCMCStats] Stat "${normalized}" / "${domain}" introuvable lors du décrement`,
    )
  }

  const globalStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", GLOBAL_OBJECTIF_KEY),
    )
    .unique()

  if (globalStat) {
    if (globalStat.count <= 1) {
      await ctx.db.delete(globalStat._id)
    } else {
      await ctx.db.patch(globalStat._id, { count: globalStat.count - 1 })
    }
  }
}

export const transferObjectifCMCCount = async (
  ctx: MutationCtx,
  oldObjectif: string,
  newObjectif: string,
  oldDomain: string,
  newDomain: string,
) => {
  const oldNorm = normalizeObjectifCMC(oldObjectif)
  const newNorm = normalizeObjectifCMC(newObjectif)

  if (oldNorm === newNorm && oldDomain === newDomain) return

  if (oldNorm) {
    await decrementObjectifCMCCount(ctx, oldNorm, oldDomain)
  }
  if (newNorm) {
    await incrementObjectifCMCCount(ctx, newNorm, newDomain)
  }
}

export const incrementWithImagesCount = async (ctx: MutationCtx) => {
  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat) {
    await ctx.db.patch(totalStat._id, {
      withImagesCount: (totalStat.withImagesCount ?? 0) + 1,
    })
  }
}

export const decrementWithImagesCount = async (ctx: MutationCtx) => {
  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat && (totalStat.withImagesCount ?? 0) > 0) {
    await ctx.db.patch(totalStat._id, {
      withImagesCount: (totalStat.withImagesCount ?? 0) - 1,
    })
  }
}
