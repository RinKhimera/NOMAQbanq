/**
 * Complétion d'un jeu de questions (« Compléter les N restantes » du
 * compositeur). Module pur : la DAL fournit l'offre de la banque par domaine,
 * cette règle décide combien tirer de chacun, la DAL tire au hasard.
 */

/** Offre d'un domaine : questions hors du jeu, non supprimées. */
export type DomainSupply = {
  domain: string
  /** Toutes, base de la répartition « comme la banque ». */
  available: number
  /** Ni récentes ni clés à vérifier : tirées d'abord. */
  clean: number
  /** Récentes mais pas clés à vérifier : repli, signalé à l'admin. */
  recent: number
}

/** Ce qu'il faut tirer d'un domaine : anciennes d'abord, récentes en repli. */
export type DomainDraw = { domain: string; clean: number; fallback: number }

const byName = (a: string, b: string) => a.localeCompare(b, "fr")

/**
 * Places de chaque domaine au prorata de ses questions disponibles (plus forts
 * restes pour un total exact), remplies par des questions anciennes puis, à
 * défaut, récentes du même domaine. Ce qu'un domaine ne peut pas fournir du
 * tout se reporte sur les autres, anciennes d'abord. Une clé à vérifier n'est
 * jamais tirée.
 */
export const planCompletion = (
  supply: DomainSupply[],
  need: number,
): DomainDraw[] => {
  const total = supply.reduce((n, s) => n + s.available, 0)
  if (need <= 0 || total === 0) return []

  const quotas = supply.map((s) => {
    const raw = (s.available / total) * need
    return { s, seats: Math.floor(raw), rest: raw - Math.floor(raw) }
  })
  let left = need - quotas.reduce((n, q) => n + q.seats, 0)
  for (const q of [...quotas].sort(
    (a, b) => b.rest - a.rest || byName(a.s.domain, b.s.domain),
  )) {
    if (left === 0) break
    q.seats++
    left--
  }

  const draws = new Map(
    quotas.map(({ s, seats }) => {
      const clean = Math.min(seats, s.clean)
      const fallback = Math.min(seats - clean, s.recent)
      return [s.domain, { s, clean, fallback }]
    }),
  )

  let deficit =
    need - [...draws.values()].reduce((n, d) => n + d.clean + d.fallback, 0)
  const spread = (
    spare: (d: { s: DomainSupply; clean: number; fallback: number }) => number,
    take: (d: { clean: number; fallback: number }) => void,
  ) => {
    while (deficit > 0) {
      const best = [...draws.values()]
        .filter((d) => spare(d) > 0)
        .sort(
          (a, b) => spare(b) - spare(a) || byName(a.s.domain, b.s.domain),
        )[0]
      if (!best) return
      take(best)
      deficit--
    }
  }
  spread(
    (d) => d.s.clean - d.clean,
    (d) => d.clean++,
  )
  spread(
    (d) => d.s.recent - d.fallback,
    (d) => d.fallback++,
  )

  return [...draws.values()]
    .filter((d) => d.clean + d.fallback > 0)
    .map(({ s, clean, fallback }) => ({ domain: s.domain, clean, fallback }))
}
