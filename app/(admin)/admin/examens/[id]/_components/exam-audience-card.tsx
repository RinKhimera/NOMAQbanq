"use client"

import { Pencil } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { SearchInput } from "@/components/shared/search-input"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import type { ExamAudienceUser } from "@/features/exams/dal"
import { TOUCH_HEIGHT } from "@/lib/touch-target"
import { DetailCard } from "./detail-card"

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

const EditAudience = ({ href }: { href: string }) => (
  <Button
    asChild
    size="sm"
    variant="outline"
    className={`max-sm:w-full ${TOUCH_HEIGHT}`}
  >
    <Link href={href} data-testid="btn-edit-audience">
      <Pencil aria-hidden />
      Modifier l&apos;audience
    </Link>
  </Button>
)

/** Liste restreinte en lecture seule : elle se modifie depuis le formulaire. */
export const RestrictedAudienceCard = ({
  audience,
  editHref,
}: {
  audience: ExamAudienceUser[]
  editHref: string
}) => {
  const [search, setSearch] = useState("")
  const query = fold(search.trim())
  const shown =
    query === ""
      ? audience
      : audience.filter((u) => fold(`${u.name} ${u.email}`).includes(query))
  const n = audience.length

  return (
    <DetailCard
      testId="restricted-audience-card"
      eyebrow="Audience restreinte"
      title={`${n.toLocaleString("fr-CA")} étudiant${n > 1 ? "s" : ""} sur la liste`}
      description="Seules ces personnes peuvent passer l'examen, sans abonnement. Elles le voient dans leur liste d'examens."
      action={<EditAudience href={editHref} />}
    >
      {n === 0 ? (
        <p className="text-ink-3 px-5 pb-6 text-sm md:px-6">
          Liste vide : personne ne peut passer cet examen.
        </p>
      ) : (
        <>
          <div className="px-5 pb-3 md:px-6">
            <SearchInput
              placeholder="Rechercher dans la liste…"
              aria-label="Rechercher dans la liste"
              value={search}
              onValueChange={setSearch}
              data-testid="audience-search"
            />
          </div>
          <ul className="border-line max-h-105 overflow-y-auto border-t pb-2">
            {shown.map((member) => (
              <li
                key={member.id}
                data-testid={`audience-member-${member.id}`}
                className="border-line flex items-center gap-3 border-b px-5 py-2.5 last:border-b-0 md:px-6"
              >
                <UserAvatar
                  name={member.name}
                  image={null}
                  className="size-7 shrink-0"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink text-sm">{member.name}</span>
                  <span className="text-ink-3 text-xs wrap-anywhere">
                    {member.email}
                  </span>
                </span>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="text-ink-3 px-5 py-2.5 text-sm md:px-6">
                Aucun étudiant de la liste ne correspond.
              </li>
            )}
          </ul>
        </>
      )}
    </DetailCard>
  )
}

export const SubscribersAudienceCard = ({
  eligible,
  editHref,
}: {
  eligible: number
  editHref: string
}) => (
  <DetailCard
    testId="subscribers-audience-card"
    eyebrow="Audience"
    title="Abonnés Examens"
    description={`Tous les étudiants avec un accès Examens actif au moment du démarrage : ${eligible.toLocaleString("fr-CA")} aujourd'hui.`}
    action={<EditAudience href={editHref} />}
  />
)
