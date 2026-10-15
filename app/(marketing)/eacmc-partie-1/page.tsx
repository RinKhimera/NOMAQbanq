import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { CtaBand } from "@/components/marketing/cta-band"
import {
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { JsonLd } from "@/components/seo/json-ld"
import { SectionNav } from "@/components/shared/section-nav"
import { MARKETING_PATHS } from "@/constants"
import { NBSP, formatIsoDay } from "@/lib/format"
import { articleJsonLd, pageMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"
import {
  GUIDE_DESCRIPTION,
  GUIDE_PUBLISHED_ON,
  GUIDE_REVIEWED_ON,
  GUIDE_SECTIONS,
  GUIDE_TITLE,
  type GuideSectionId,
  SOURCES,
} from "./_data/guide"

export const metadata: Metadata = pageMetadata(MARKETING_PATHS.eacmc, {
  title: GUIDE_TITLE,
  description: GUIDE_DESCRIPTION,
  ogDescription:
    "Format, notation, inscription et préparation de l'EACMC, expliqués en français et sourcés au Conseil médical du Canada.",
  ogImage: false,
})

const TEXT = "text-ink-2 text-base leading-[1.7] text-pretty"
const LINK =
  "focus-ring text-accent-ink rounded-sm underline underline-offset-2 hover:no-underline"

const P = ({ children }: { children: ReactNode }) => (
  <p className={TEXT}>{children}</p>
)

/** Première phrase d'une section : la réponse directe à la question du titre. */
const Answer = ({ children }: { children: ReactNode }) => (
  <p className="text-ink text-lg leading-[1.6] text-pretty">{children}</p>
)

const List = ({
  items,
  ordered = false,
}: {
  items: ReactNode[]
  ordered?: boolean
}) => {
  const Tag = ordered ? "ol" : "ul"
  return (
    <Tag
      className={cn(
        TEXT,
        "flex flex-col gap-1.5 pl-5",
        ordered ? "list-decimal" : "list-disc",
      )}
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  )
}

const Source = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className={LINK}>
    {children}
  </a>
)

const Internal = ({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) => (
  <Link href={href} className={LINK}>
    {children}
  </Link>
)

const CONTENT: Record<GuideSectionId, ReactNode> = {
  definition: (
    <>
      <Answer>
        L&apos;EACMC (Examen d&apos;aptitude du Conseil médical du Canada) est
        l&apos;examen informatisé qui évalue les connaissances médicales
        essentielles et la prise de décisions cliniques attendues d&apos;un
        diplômé en médecine au Canada. Il s&apos;appelait auparavant « EACMC,
        partie I » : c&apos;est le même examen, sous un nouveau nom.
      </Answer>
      <P>
        Le Conseil médical du Canada (CMC) l&apos;exige des diplômés
        internationaux en médecine qui postulent à un programme de résidence au
        Canada. Certains programmes d&apos;évaluation de la capacité à exercer
        l&apos;utilisent aussi comme critère d&apos;admissibilité (
        <Source href={SOURCES.eacmc}>CMC, l&apos;EACMC</Source>).
      </P>
      <P>
        Sa réussite est une condition du titre de Licencié du Conseil médical du
        Canada (LCMC), une composante importante des exigences des ordres des
        médecins pour le permis d&apos;exercice (
        <Source href={SOURCES.lcmc}>CMC, le LCMC</Source>).
      </P>
      <P>
        Beaucoup de ressources, de forums et de candidats parlent encore de la «
        partie 1 » ou de l&apos;« EACMC 1 » : ces noms désignent tous cet
        examen.
      </P>
    </>
  ),
  deroulement: (
    <>
      <Answer>
        L&apos;EACMC se passe en une journée, sur ordinateur, dans un centre
        Prometric au Canada ou dans plus de 70 pays. Il compte 230 questions à
        choix multiple, réparties en deux sections de 115 questions, avec au
        plus 2 h 40 par section.
      </Answer>
      <List
        items={[
          "Chaque question propose de trois à cinq choix, dont une seule meilleure réponse.",
          "Dans une section, vous pouvez naviguer librement entre les questions et en marquer pour y revenir. Une section soumise ne se rouvre plus.",
          "Une pause facultative de 45 minutes sépare les deux sections.",
          "Le rendez-vous dure 6,5 heures au total : accueil, tutoriel, les deux sections, la pause et un sondage facultatif.",
          "Chaque section contient des questions pilotes, aussi appelées questions d'essai préliminaire.",
          <>
            La surveillance à distance n&apos;est plus offerte : l&apos;examen
            se passe en personne (
            <Source href={SOURCES.planification}>CMC, planification</Source>
            ).
          </>,
        ]}
      />
      <P>
        Le contenu suit les Objectifs d&apos;examen du CMC, organisés selon les
        rôles CanMEDS. Le plan directeur de l&apos;examen croise deux
        catégories, les dimensions des soins et les activités du médecin, de
        quatre domaines chacune (
        <Source href={SOURCES.eacmc}>CMC, l&apos;EACMC</Source>). Le format est
        détaillé par le CMC dans{" "}
        <Source href={SOURCES.qcm}>les questions à choix multiple</Source> et{" "}
        <Source href={SOURCES.jourExamen}>le jour de l&apos;examen</Source>.
      </P>
      <P>
        L&apos;examen est offert en français et en anglais : vous choisissez la
        langue de votre rendez-vous en le réservant (
        <Source href={SOURCES.prometric}>
          CMC, réserver auprès de Prometric
        </Source>
        ).
      </P>
    </>
  ),
  notation: (
    <>
      <Answer>
        Le résultat de l&apos;EACMC est une réussite ou un échec, fixé par une
        note globale sur une échelle de 300 à 600. La note de passage est 439,
        et votre résultat ne dépend pas du rendement des autres candidats.
      </Answer>
      <List
        items={[
          "Une bonne réponse vaut 1 point, une mauvaise 0 : aucune pénalité, il vaut donc mieux répondre à toutes les questions.",
          "La note globale tient compte de la difficulté des questions : ce n'est pas une simple addition de points.",
          "L'échelle a une moyenne de 450 et un écart-type de 30, établis à partir de la session d'avril 2025.",
          "Vous recevez un relevé de résultats (résultat, note globale, note de passage) et un rapport d'information supplémentaire (notes partielles et données comparatives), dans votre compte inscriptionmed.ca.",
          "Les résultats paraissent environ 4 semaines après la fin d'une session (5 semaines pour celle d'avril).",
        ]}
      />
      <P>
        Un pourcentage de bonnes réponses dans une banque de questions ne se
        convertit pas en note de l&apos;EACMC : il sert à repérer vos domaines
        faibles, pas à prédire votre note. Le détail de la notation est sur la
        page <Source href={SOURCES.resultats}>Résultats du CMC</Source>.
      </P>
    </>
  ),
  inscription: (
    <>
      <Answer>
        Vous présentez votre demande dans votre compte inscriptionmed.ca, puis,
        une fois la demande acceptée, vous réservez votre place chez Prometric.
        Comptez jusqu&apos;à 4 semaines de traitement avant de pouvoir réserver.
      </Answer>
      <P>
        L&apos;examen s&apos;adresse aux diplômés et aux étudiants en médecine
        d&apos;une faculté acceptée par le CMC. Un étudiant peut présenter sa
        demande jusqu&apos;à 15 mois avant la date prévue de son diplôme. Un
        diplômé international doit d&apos;abord soumettre et payer la
        vérification à la source de son diplôme de médecine.
      </P>
      <List
        ordered
        items={[
          "Préparez une copie certifiée d'une pièce d'identité acceptée.",
          <>
            Dans votre compte{" "}
            <Source href={SOURCES.inscriptionmed}>inscriptionmed.ca</Source>,
            ouvrez Examens, puis Admission à un examen.
          </>,
          "Remplissez le formulaire et téléversez vos documents.",
          <>
            Payez les droits d&apos;inscription (
            <Source href={SOURCES.frais}>frais en vigueur</Source>).
          </>,
          "Une fois la demande acceptée, réservez votre rendez-vous chez Prometric.",
        ]}
      />
      <P>
        Le CMC offre plusieurs sessions par année, quatre en temps normal. Les
        rendez-vous ouvrent jusqu&apos;à cinq mois avant le début d&apos;une
        session, selon le principe du premier arrivé, premier servi : réservez
        tôt. Les dates changent d&apos;une année à l&apos;autre ; consultez le{" "}
        <Source href={SOURCES.planification}>calendrier officiel</Source>.
      </P>
      <P>
        Vous pouvez passer l&apos;EACMC au plus quatre fois (les tentatives
        antérieures à 2018 ne comptent pas). Avant la quatrième, il faut
        attendre un an après le résultat de la troisième (
        <Source href={SOURCES.admissibilite}>
          CMC, admissibilité et demande
        </Source>
        ).
      </P>
    </>
  ),
  "diplomes-etranger": (
    <>
      <Answer>
        Pour un diplômé à l&apos;étranger, l&apos;EACMC est l&apos;une des
        premières étapes vers la résidence au Canada : son résultat est exigé
        pour postuler au jumelage en résidence (CaRMS), avec celui de
        l&apos;examen de la Collaboration nationale en matière d&apos;évaluation
        (CNE).
      </Answer>
      <P>
        Les grandes étapes, chacune détaillée par l&apos;organisme concerné :
      </P>
      <List
        ordered
        items={[
          <>
            Faire vérifier votre diplôme de médecine à la source par le CMC (
            <Source href={SOURCES.verification}>
              vérification des titres de compétence
            </Source>
            ).
          </>,
          "Réussir l'EACMC.",
          <>
            Passer l&apos;examen de la CNE, avant ou après l&apos;EACMC : vous
            choisissez l&apos;ordre (
            <Source href={SOURCES.carms}>CMC, CaRMS et les examens</Source>).
          </>,
          "Postuler au jumelage en résidence par CaRMS, avec les résultats des deux examens.",
          <>
            Remplir les exigences de votre province. Le Québec, la
            Colombie-Britannique et l&apos;Alberta ont leurs propres conditions
            (au Québec, le{" "}
            <Source href={SOURCES.cmq}>Collège des médecins du Québec</Source>
            ).
          </>,
        ]}
      />
      <P>
        Un diplômé à l&apos;étranger doit fournir les résultats des deux examens
        pour le jumelage, quelle que soit la date de son diplôme. Pour
        qu&apos;un résultat compte dans un cycle de jumelage, il doit arriver
        avant l&apos;examen des dossiers : le CMC publie chaque année les
        sessions qui conviennent. Planifiez votre date d&apos;examen à partir de
        ce calendrier.
      </P>
    </>
  ),
  preparation: (
    <>
      <Answer>
        Préparez l&apos;EACMC en partant des Objectifs d&apos;examen du CMC :
        faites un diagnostic, révisez domaine par domaine avec des questions
        corrigées, puis validez votre préparation en conditions réelles. Tout
        peut se faire en français.
      </Answer>
      <List
        ordered
        items={[
          <>
            <strong className="text-ink font-semibold">
              Faites un diagnostic.
            </strong>{" "}
            Une première série chronométrée montre vos domaines forts et
            faibles. L&apos;
            <Internal href={MARKETING_PATHS.evaluation}>
              évaluation gratuite de NOMAQbanq
            </Internal>{" "}
            se fait sans inscription ; le CMC publie aussi des{" "}
            <Source href={SOURCES.ressourcesGratuites}>
              questions de pratique gratuites
            </Source>
            .
          </>,
          <>
            <strong className="text-ink font-semibold">
              Planifiez par objectifs.
            </strong>{" "}
            Les{" "}
            <Source href={SOURCES.objectifs}>
              Objectifs d&apos;examen du CMC
            </Source>{" "}
            décrivent ce que l&apos;examen attend. Commencez par les domaines où
            votre diagnostic est le plus faible. NOMAQbanq rattache ses
            questions à ces objectifs, classées par{" "}
            <Internal href={MARKETING_PATHS.domaines}>domaine médical</Internal>
            .
          </>,
          <>
            <strong className="text-ink font-semibold">
              Apprenez avec des séries ciblées.
            </strong>{" "}
            En mode tuteur, la correction s&apos;affiche après chaque réponse,
            avec l&apos;explication et les références : vous apprenez autant de
            vos erreurs que de vos réussites.
          </>,
          <>
            <strong className="text-ink font-semibold">
              Entraînez-vous en conditions d&apos;examen.
            </strong>{" "}
            L&apos;EACMC laisse en moyenne 1 min 23 s par question (2 h 40 pour
            115 questions). Des examens blancs chronométrés vous habituent à ce
            rythme et à l&apos;endurance d&apos;une longue section.
          </>,
          <>
            <strong className="text-ink font-semibold">
              Révisez vos erreurs.
            </strong>{" "}
            Revenez sur les questions manquées et marquées, puis refaites une
            série sur les domaines qui restent faibles.
          </>,
        ]}
      />
      <P>
        Le détail de chaque étape dans l&apos;application est sur la page{" "}
        <Internal href={MARKETING_PATHS.fonctionnement}>
          Comment fonctionne NOMAQbanq
        </Internal>
        . Le CMC propose aussi des{" "}
        <Source href={SOURCES.ressources}>ressources de préparation</Source>,
        dont des examens préparatoires.
      </P>
    </>
  ),
}

const OFFICIAL_SOURCES = [
  { href: SOURCES.eacmc, label: "L'EACMC (CMC)" },
  { href: SOURCES.jourExamen, label: "Le jour de l'examen (CMC)" },
  { href: SOURCES.resultats, label: "Résultats et notation (CMC)" },
  { href: SOURCES.admissibilite, label: "Admissibilité et demande (CMC)" },
  { href: SOURCES.planification, label: "Calendrier des sessions (CMC)" },
  { href: SOURCES.prometric, label: "Réserver auprès de Prometric (CMC)" },
  { href: SOURCES.frais, label: "Frais d'examen (CMC)" },
  { href: SOURCES.lcmc, label: "Le titre de LCMC (CMC)" },
  { href: SOURCES.carms, label: "CaRMS et les examens du CMC (CMC)" },
  { href: SOURCES.objectifs, label: "Objectifs d'examen du CMC" },
]

export default function EacmcGuidePage() {
  return (
    <>
      <JsonLd
        data={articleJsonLd({
          path: MARKETING_PATHS.eacmc,
          headline: GUIDE_TITLE,
          description: GUIDE_DESCRIPTION,
          datePublished: GUIDE_PUBLISHED_ON,
          dateModified: GUIDE_REVIEWED_ON,
        })}
      />
      <MarketingHero
        label="Guide EACMC"
        title={`L'EACMC, anciennement Partie${NBSP}I : le guide en français`}
        description="Ce qu'est l'examen, comment il se déroule et se note, comment s'inscrire, où il se place dans le parcours des diplômés à l'étranger et comment s'y préparer. Chaque fait renvoie à sa source au Conseil médical du Canada."
      >
        <p className="text-ink-3 font-mono text-[13px]">
          Faits vérifiés le{" "}
          <time dateTime={GUIDE_REVIEWED_ON}>
            {formatIsoDay(GUIDE_REVIEWED_ON, "long")}
          </time>
        </p>
      </MarketingHero>

      <section className={MARKETING_SECTION}>
        <div
          className={cn(
            MARKETING_WRAP,
            "grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16",
          )}
        >
          <SectionNav
            items={GUIDE_SECTIONS}
            numbered
            mobileLabel="Sommaire du guide"
            className="top-22"
          />

          <article className="flex max-w-180 min-w-0 flex-col">
            {GUIDE_SECTIONS.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className={cn(
                  "border-line flex scroll-mt-22 flex-col gap-4 border-b",
                  i === 0 ? "pb-10" : "py-10",
                )}
              >
                <h2 id={`${section.id}-title`} className="type-h2 text-ink">
                  {section.title}
                </h2>
                {CONTENT[section.id]}
              </section>
            ))}

            <aside
              aria-labelledby="sources-title"
              className="bg-surface-2 border-line mt-10 flex flex-col gap-3 rounded-lg border p-6"
            >
              <h2 id="sources-title" className="type-h4 text-ink">
                Sources officielles
              </h2>
              <p className="text-ink-3 text-sm">
                Les règles de l&apos;examen changent : en cas d&apos;écart, les
                pages du Conseil médical du Canada font foi.
              </p>
              <ul className="flex flex-col gap-1.5 text-[15px]">
                {OFFICIAL_SOURCES.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} className={LINK}>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          </article>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
