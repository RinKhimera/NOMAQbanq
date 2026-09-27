import { describe, expect, it } from "vitest"
import {
  diagnoseCorrection,
  normalizeExplanation,
  normalizeReferenceEntry,
  normalizeReferences,
  splitReferenceEntry,
  tidyReference,
} from "@/features/questions/normalization"

// Échantillons tirés de develop (copie anonymisée de la prod), raccourcis.

const OE_AIRY = `1.
Current Concepts in Diagnosis and Treatment of Functional Neurological Disorders.

Espay AJ, Aybek S, Carson A, et al.

JAMA logoJAMA Neurology. 2018;75(9):1132-1141. doi:10.1001/jamaneurol.2018.1264.
Leading Journal





2.
Common Hand Conditions: A Review.

Currie KB, Tadisina KK, Mackinnon SE.

JAMA logoJAMA. 2022;327(24):2434-2445. doi:10.1001/jama.2022.8481.
Practice Guideline
Leading Journal`

const OE_COMPACT = `1.
Population-Level Risks of Alcohol Consumption by Amount, Geography, Age, Sex, and Year.
Lancet. 2022. GBD 2020 Alcohol Collaborators.
2.
Alcohol Use and Cardiovascular Disease: A Scientific Statement From the American Heart Association.
Circulation. 2025. Piano MR, Marcus GM, Aycock DM, et al.GuidelineNew
3.
Alcohol and CV Health: Jekyll and Hyde J-Curves.
Progress in Cardiovascular Diseases. 2018. O'Keefe EL, DiNicolantonio JJ, O'Keefe JH, Lavie CJ.New`

const TURRENTINE = `1.
Management of Infants at Risk for Group B Streptococcal Disease.
Pediatrics. 2019. Puopolo KM, Lynfield R, Cummings JJ.Guideline


2.
Prevention of Group B Streptococcal Early-Onset Disease in Newborns.
American College of Obstetricians and Gynecologists (2019). 2019. Tekoa L. King, Mark TurrentineGuideline










3.
Group B Streptococcus Disease: AAP Updates Guidelines for the Management of At-Risk Infants.
American Academy of Family Physicians (2020). 2020. Moss PI.New
New Research`

const CHAPTER = `1.
Sulfonylureas and Hypoglycemia.
Diabetes Care. 2020. Smith R.
2.
Comparative Risk of Serious Hypoglycemia With Oral Antidiabetic Monotherapy: A Retrospective Cohort Study.
Pharmacoepidemiology and Drug Safety. 2017. Leonard CE, Han X, Brensinger CM, et al.
3.
9. Pharmacologic Approaches to Glycemic Treatment: Standards of Care in Diabetes-2026.
Diabetes Care. 2025. American Diabetes Association Professional Practice Committee for Diabetes*.GuidelineNew`

const MCC_NUMBERED = `1. Brandt JS, Ananth CV. Placental abruption at near-term and term gestations: Pathophysiology,
epidemiology, diagnosis, and management. American Journal of Obstetrics & Gynecology.
Medical Council of Canada | Le Conseil médical du Canada | 29
2023;228(5):S1313–S1329.
2. Wagner SA. Third-trimester vaginal bleeding. Dans : DeCherney AH, Nathan L, Laufer N,
Roman AS (dir.). CURRENT Diagnosis & Treatment: Obstetrics & Gynecology. 12e éd. New
York (NY) : McGraw-Hill Education ; 2019.`

const MCC_UNNUMBERED = `Brandt JS, Ananth CV. Placental abruption at near-term and term gestations. American Journal of Obstetrics & Gynecology. 2023;228(5):S1313–S1329.
Wagner SA. Third-trimester vaginal bleeding. CURRENT Diagnosis & Treatment: Obstetrics & Gynecology. 12e éd. McGraw-Hill Education ; 2019.
Oyelese Y, Ananth CV. Placental abruption. Obstetrics & Gynecology. 2006;108(4):1005-1016.`

const FDA = `3.
Lithium Carbonate. FDA Drug Label.
Food and Drug Administration. Updated date: 2023-10-02.
Based on the following primary sources:
Lithium in the Acute Treatment of Bipolar I Disorder: A Double-Blind, Placebo-Controlled Study.
Pediatrics. 2015. Findling RL, Robb A, McNamara NK, et al.`

const BRACKETS = `[1] UpToDate. Clinical features, diagnosis, and evaluation of nephrotic syndrome in children. Wolters Kluwer Health.
[2] American Academy of Pediatrics (AAP). Minimal Change Disease. Nelson Textbook of Pediatrics, 21st ed. Elsevier.
[3] American Society of Nephrology (ASN). Approach to Proteinuria in Children. NephSAP Pediatrics.`

const SAME_LINE = `1. Eating Disorders: A Review.
The Journal of the American Medical Association. 2025. Attia E, Walsh BT.New

2. Eating Disorders.
Lancet. 2020. Treasure J, Duarte TA, Schmidt U.`

const SOFT_HYPHEN = `American Association for the Surgery of Trauma/­American College of Surgeons Committee on Trauma: Clinical Protocol for Damage-Control Resuscitation.
The Journal of Trauma. 2024. Smith A.`

const ALREADY_SPLIT = [
  "How I Treat Acute Chest Syndrome in Children With Sickle Cell Disease. Miller ST. Blood. 2011;117(20):5297-305. doi:10.1182/blood-2010-11-261834.",
  "Respiratory Management of Acute Chest Syndrome in Children With Sickle Cell Disease. Ahmed B, Arigliani M, Gupta A. European Respiratory Review. 2023.",
]

const EXPLANATION_ISOLATED = `Douleur à l'effort, qui persiste environ 30 minutes après l'arrêt de l'activité.
[1-2] Le SCCE du compartiment antérieur est particulièrement fréquent chez les coureurs de fond.
[3-4]


La mesure des pressions intracompartimentales confirme le diagnostic.
[5][6-7]`

const EXPLANATION_FOOTER = `L'anéjaculation est un effet indésirable connu des inhibiteurs sélectifs du recaptage de la sérotonine
(ISRS), et le passage à un antidépresseur présentant un risque moindre d’effets indésirables sur la
Medical Council of Canada | Le Conseil médical du Canada | 22
fonction sexuelle est une approche raisonnable.`

const NNBSP = " "
const EXPLANATION_NNBSP = `Il convient de discuter des alternatives${NNBSP}:

    La stérilisation tubaire en intervalle${NNBSP}!   Elle   est   sûre.`

describe("normalizeExplanation", () => {
  it("rattache un appel seul sur sa ligne à la ligne non vide qui précède", () => {
    expect(normalizeExplanation(EXPLANATION_ISOLATED)).toBe(
      `Douleur à l'effort, qui persiste environ 30 minutes après l'arrêt de l'activité.
[1-2] Le SCCE du compartiment antérieur est particulièrement fréquent chez les coureurs de fond. [3-4]

La mesure des pressions intracompartimentales confirme le diagnostic. [5][6-7]`,
    )
  })

  it("retire le pied de page du Conseil médical sans toucher au texte", () => {
    expect(normalizeExplanation(EXPLANATION_FOOTER)).toBe(
      `L'anéjaculation est un effet indésirable connu des inhibiteurs sélectifs du recaptage de la sérotonine
(ISRS), et le passage à un antidépresseur présentant un risque moindre d’effets indésirables sur la
fonction sexuelle est une approche raisonnable.`,
    )
  })

  it("rogne et réduit les espaces, garde les espaces fines insécables", () => {
    expect(normalizeExplanation(EXPLANATION_NNBSP)).toBe(
      `Il convient de discuter des alternatives${NNBSP}:

La stérilisation tubaire en intervalle${NNBSP}! Elle est sûre.`,
    )
  })

  it("détache un appel collé à un mot", () => {
    expect(normalizeExplanation("La glycémie[3] monte, HbA1c[1][2-4].")).toBe(
      "La glycémie [3] monte, HbA1c [1][2-4].",
    )
  })

  it("laisse un appel collé à une ponctuation", () => {
    expect(normalizeExplanation("à ce stade.[1-2]")).toBe("à ce stade.[1-2]")
  })

  it("ramène les retours chariot et les lignes vides multiples à une seule", () => {
    expect(normalizeExplanation("\n\nA.\r\n\r\n\r\n\r\nB.\t\n\n")).toBe(
      "A.\n\nB.",
    )
  })

  it("ne rattache pas un appel en tête de texte", () => {
    expect(normalizeExplanation("[1]\nTexte.")).toBe("[1]\nTexte.")
  })
})

describe("normalizeReferenceEntry", () => {
  it("découpe le format OpenEvidence aéré en une source par ligne", () => {
    expect(normalizeReferenceEntry(OE_AIRY)).toEqual([
      "Current Concepts in Diagnosis and Treatment of Functional Neurological Disorders. Espay AJ, Aybek S, Carson A, et al. JAMA Neurology. 2018;75(9):1132-1141. doi:10.1001/jamaneurol.2018.1264.",
      "Common Hand Conditions: A Review. Currie KB, Tadisina KK, Mackinnon SE. JAMA. 2022;327(24):2434-2445. doi:10.1001/jama.2022.8481.",
    ])
  })

  it("découpe le format compact et retire les étiquettes collées", () => {
    expect(normalizeReferenceEntry(OE_COMPACT)).toEqual([
      "Population-Level Risks of Alcohol Consumption by Amount, Geography, Age, Sex, and Year. Lancet. 2022. GBD 2020 Alcohol Collaborators.",
      "Alcohol Use and Cardiovascular Disease: A Scientific Statement From the American Heart Association. Circulation. 2025. Piano MR, Marcus GM, Aycock DM, et al.",
      "Alcohol and CV Health: Jekyll and Hyde J-Curves. Progress in Cardiovascular Diseases. 2018. O'Keefe EL, DiNicolantonio JJ, O'Keefe JH, Lavie CJ.",
    ])
  })

  it("retire une étiquette placée dans la case des auteurs, pas un mot du titre", () => {
    expect(
      normalizeReferenceEntry(
        "Medical Treatment of Ectopic Pregnancy.\nFertility and Sterility. 2013. Guideline",
      ),
    ).toEqual([
      "Medical Treatment of Ectopic Pregnancy. Fertility and Sterility. 2013.",
    ])
    expect(
      normalizeReferenceEntry(
        "Thyroid Guidelines.\nThyroid. 2025;35(8):841-985. doi:10.1177/1050. Practice Guideline New Research",
      ),
    ).toEqual([
      "Thyroid Guidelines. Thyroid. 2025;35(8):841-985. doi:10.1177/1050.",
    ])
    expect(
      normalizeReferenceEntry(
        "Eating Disorders: A Review\nLancet. 2020;395(1):1-2.",
      ),
    ).toEqual(["Eating Disorders: A Review Lancet. 2020;395(1):1-2."])
  })

  it("garde « Practice Guideline » quand il termine un titre", () => {
    expect(
      normalizeReferenceEntry(
        "Management of Hypertension: A Clinical Practice Guideline\nAnnals of Internal Medicine. 2020;172(1):1-10.",
      ),
    ).toEqual([
      "Management of Hypertension: A Clinical Practice Guideline Annals of Internal Medicine. 2020;172(1):1-10.",
    ])
  })

  it("joint une source unique dont le DOI porte d'autres années", () => {
    expect(
      normalizeReferenceEntry(
        "Hemodynamic Assessment of Atrial Septal Defects.\nTorres AJ. Journal of Thoracic Disease. 2018;10(Suppl 24):S2882-S2889. doi:10.21037/jtd.2018.02.17.",
      ),
    ).toEqual([
      "Hemodynamic Assessment of Atrial Septal Defects. Torres AJ. Journal of Thoracic Disease. 2018;10(Suppl 24):S2882-S2889. doi:10.21037/jtd.2018.02.17.",
    ])
  })

  it("ne joint pas des lignes sans repère de fin de source : rien ne dit qu'elles forment une seule source", () => {
    const lines =
      "Smith J. Title one. Paediatr Child Health. 2014, 19(9):485-91.\nDoe A. Title two. Consulté le 3 mars 2024.\nUpToDate. Title three. Wolters Kluwer."
    expect(normalizeReferenceEntry(lines)).toEqual([lines])
    expect(
      diagnoseCorrection({ explanation: "Texte [1].", references: [lines] }),
    ).toContainEqual(
      expect.objectContaining({ code: "multiple-sources", index: 0 }),
    )
  })

  it("garde le numéro de chapitre d'une source unique « 1. Titre »", () => {
    expect(
      normalizeReferenceEntry(
        "1. Improving Care and Promoting Health in Populations: Standards of Care in Diabetes-2025.\nDiabetes Care. 2025. American Diabetes Association.GuidelineNew",
      ),
    ).toEqual([
      "1. Improving Care and Promoting Health in Populations: Standards of Care in Diabetes-2025. Diabetes Care. 2025. American Diabetes Association.",
    ])
  })

  it("ne retire pas une étiquette qui fait partie d'un mot", () => {
    expect(
      normalizeReferenceEntry(
        "Title of Paper.\nLancet. 2020;1:1-2. Jane Smith, Robert McNew",
      ),
    ).toEqual(["Title of Paper. Lancet. 2020;1:1-2. Jane Smith, Robert McNew"])
    expect(
      normalizeReferenceEntry("Open Peer-Review\nBMJ. 2020;1:1-2."),
    ).toEqual(["Open Peer-Review BMJ. 2020;1:1-2."])
    expect(
      normalizeReferenceEntry(
        "Management of Anemia: Clinical Practice\nGuideline for Adults. Lancet. 2020;1:1-2.",
      ),
    ).toEqual([
      "Management of Anemia: Clinical Practice Guideline for Adults. Lancet. 2020;1:1-2.",
    ])
  })

  it("retire une étiquette de recommandation collée à un nom ou à des initiales", () => {
    expect(
      normalizeReferenceEntry(
        "Placenta Accreta.\nObstet Gynecol. 2018;132(6):e259. Alessandro Ghidini MDGuideline",
      ),
    ).toEqual([
      "Placenta Accreta. Obstet Gynecol. 2018;132(6):e259. Alessandro Ghidini MD",
    ])
    expect(
      normalizeReferenceEntry(
        "DSM-5.\nAPA. 2022;1:1. David Fassler, et alPractice Guideline",
      ),
    ).toEqual(["DSM-5. APA. 2022;1:1. David Fassler, et al"])
    expect(
      normalizeReferenceEntry(
        "VA/DoD Guideline for Asthma.\nVA. 2025. U.S. Department of Veterans Affairs\nPractice Guideline",
      ),
    ).toEqual([
      "VA/DoD Guideline for Asthma. VA. 2025. U.S. Department of Veterans Affairs",
    ])
    expect(
      splitReferenceEntry(
        "Management of Pregnancy (2023).\n\nColleen C. Blosser MSN RN, et al\n\nDepartment of Veterans Affairs\nPractice Guideline",
      ).at(-1),
    ).toBe("Department of Veterans Affairs")
  })

  it("ne produit jamais de source vide", () => {
    expect(normalizeReferenceEntry("Review")).toEqual(["Review"])
    expect(
      normalizeReferenceEntry(
        "1.\nFoo. Lancet. 2020;1:1-2.\nNew Research\n2.\nBar. BMJ. 2021;2:3-4.",
      ),
    ).toEqual(["Foo. Lancet. 2020;1:1-2.", "Bar. BMJ. 2021;2:3-4."])
  })

  it("retire une étiquette collée sans point et « New Research »", () => {
    const sources = normalizeReferenceEntry(TURRENTINE)
    expect(sources).toHaveLength(3)
    expect(sources[1]).toMatch(/Tekoa L\. King, Mark Turrentine$/)
    expect(sources[2]).toMatch(/Moss PI\.$/)
  })

  it("garde un titre de chapitre numéroté hors suite dans sa source", () => {
    const sources = normalizeReferenceEntry(CHAPTER)
    expect(sources).toHaveLength(3)
    expect(sources[2]).toBe(
      "9. Pharmacologic Approaches to Glycemic Treatment: Standards of Care in Diabetes-2026. Diabetes Care. 2025. American Diabetes Association Professional Practice Committee for Diabetes*.",
    )
  })

  it("découpe le bloc numéroté du Conseil médical et retire son pied de page", () => {
    expect(normalizeReferenceEntry(MCC_NUMBERED)).toEqual([
      "Brandt JS, Ananth CV. Placental abruption at near-term and term gestations: Pathophysiology, epidemiology, diagnosis, and management. American Journal of Obstetrics & Gynecology. 2023;228(5):S1313–S1329.",
      "Wagner SA. Third-trimester vaginal bleeding. Dans : DeCherney AH, Nathan L, Laufer N, Roman AS (dir.). CURRENT Diagnosis & Treatment: Obstetrics & Gynecology. 12e éd. New York (NY) : McGraw-Hill Education ; 2019.",
    ])
  })

  it("découpe les formats [N] et « N. Titre »", () => {
    expect(normalizeReferenceEntry(BRACKETS)).toHaveLength(3)
    expect(normalizeReferenceEntry(BRACKETS)[0]).toMatch(/^UpToDate\./)
    expect(normalizeReferenceEntry(SAME_LINE)).toEqual([
      "Eating Disorders: A Review. The Journal of the American Medical Association. 2025. Attia E, Walsh BT.",
      "Eating Disorders. Lancet. 2020. Treasure J, Duarte TA, Schmidt U.",
    ])
  })

  it("ne découpe pas un bloc non numéroté et n'en joint pas les lignes", () => {
    expect(normalizeReferenceEntry(MCC_UNNUMBERED)).toEqual([MCC_UNNUMBERED])
  })

  it("nettoie une source unique, même sans numéro, et retire le tiret conditionnel", () => {
    expect(normalizeReferenceEntry(SOFT_HYPHEN)).toEqual([
      "American Association for the Surgery of Trauma/American College of Surgeons Committee on Trauma: Clinical Protocol for Damage-Control Resuscitation. The Journal of Trauma. 2024. Smith A.",
    ])
  })

  it("laisse intactes des références déjà découpées", () => {
    expect(normalizeReferences(ALREADY_SPLIT)).toEqual(ALREADY_SPLIT)
  })

  it("ne découpe pas une numérotation trouée", () => {
    const gap =
      "1.\nSource A. Lancet. 2020.\n2.\nSource B. BMJ. 2021.\n4.\nSource D. JAMA. 2022."
    expect(normalizeReferenceEntry(gap)).toEqual([gap])
  })

  it("renvoie une liste vide pour une entrée vide", () => {
    expect(normalizeReferenceEntry("  \n ")).toEqual([])
  })
})

describe("splitReferenceEntry (bouton « Découper »)", () => {
  it("place le texte qui précède la numérotation dans son propre champ", () => {
    expect(
      splitReferenceEntry(
        "Références\n1.\nSource A.\n\nLancet. 2020;1:1-2.\n2.\nSource B.\n\nBMJ. 2021;2:3-4.",
      ),
    ).toEqual([
      "Références",
      "Source A. Lancet. 2020;1:1-2.",
      "Source B. BMJ. 2021;2:3-4.",
    ])
  })

  it("découpe d'abord selon les numéros", () => {
    expect(splitReferenceEntry(OE_COMPACT)).toEqual(
      normalizeReferenceEntry(OE_COMPACT),
    )
  })

  it("sans numéro, découpe selon les lignes vides", () => {
    const withBlankLines = MCC_UNNUMBERED.replaceAll("\n", "\n\n")
    expect(splitReferenceEntry(withBlankLines)).toEqual(
      MCC_UNNUMBERED.split("\n"),
    )
  })

  it("sans numéro ni ligne vide, rend l'entrée nettoyée", () => {
    expect(splitReferenceEntry("Source A.\nLancet. 2020.")).toEqual([
      "Source A. Lancet. 2020.",
    ])
  })
})

describe("tidyReference (partie sûre, enregistrement)", () => {
  it("ne découpe jamais et garde les lignes d'un bloc", () => {
    const tidy = tidyReference(TURRENTINE)
    expect(tidy.split("\n\n").length).toBeGreaterThan(1)
    expect(tidy).toMatch(/^1\.\nManagement/)
    expect(tidy).not.toMatch(/\n{3}/)
  })

  it("retire le pied de page et le tiret conditionnel", () => {
    expect(tidyReference(MCC_NUMBERED)).not.toMatch(/Medical Council/)
    expect(tidyReference(SOFT_HYPHEN)).not.toMatch(/­/)
  })
})

describe("stabilisation : normaliser une deuxième fois ne change rien", () => {
  const entries = [
    OE_AIRY,
    OE_COMPACT,
    TURRENTINE,
    CHAPTER,
    MCC_NUMBERED,
    MCC_UNNUMBERED,
    FDA,
    BRACKETS,
    SAME_LINE,
    SOFT_HYPHEN,
    ...ALREADY_SPLIT,
  ]
  it.each(entries.map((e) => [e.slice(0, 30), e]))(
    "références : %s",
    (_, entry) => {
      const once = normalizeReferenceEntry(entry)
      expect(normalizeReferences(once)).toEqual(once)
      expect(tidyReference(tidyReference(entry))).toBe(tidyReference(entry))
    },
  )

  it.each([
    ["étiquette seule", "Review"],
    ["source faite d'étiquettes", "1.\nFoo. Lancet. 2020.\n2.\nNew Research"],
    ["préambule", "Références\n1.\nSource A.\n2.\nSource B."],
    [
      "source unique numérotée",
      "1. Improving Care.\nDiabetes Care. 2025. ADA.",
    ],
  ])("cas limite : %s", (_, entry) => {
    const once = normalizeReferenceEntry(entry)
    expect(normalizeReferences(once)).toEqual(once)
    const split = splitReferenceEntry(entry)
    expect(normalizeReferences(split)).toEqual(split)
  })

  it("un titre de chapitre « 1. … » découpé reste stable", () => {
    const once = normalizeReferenceEntry(
      "1.\n1. Improving Care and Promoting Health in Populations.\nDiabetes Care. 2025. ADA.\n2.\nOther. Lancet. 2020.",
    )
    expect(once[0]).toMatch(/^1\. Improving Care/)
    expect(normalizeReferences(once)).toEqual(once)
  })

  it.each(
    [
      EXPLANATION_ISOLATED,
      EXPLANATION_FOOTER,
      EXPLANATION_NNBSP,
      "a maladie coronarienne est la cause [1].\n[2]",
      "Chaîne [1][3-5][7] d'appels,collés[2].",
    ].map((e) => [e.slice(0, 30), e]),
  )("explication : %s", (_, text) => {
    const once = normalizeExplanation(text)
    expect(normalizeExplanation(once)).toBe(once)
  })
})

describe("diagnoseCorrection", () => {
  const codes = (explanation: string, references: string[]) =>
    diagnoseCorrection({ explanation, references }).map((i) => [
      i.code,
      i.field,
      i.index,
    ])

  it("une correction propre ne remonte rien", () => {
    expect(codes("Texte [1] et [2].", ALREADY_SPLIT)).toEqual([])
  })

  it("plusieurs sources numérotées dans un champ", () => {
    expect(codes("Texte [1].", [OE_COMPACT])).toEqual([
      ["multiple-sources", "references", 0],
    ])
  })

  it("plusieurs sources sans numérotation exploitable", () => {
    expect(codes("Texte [1].", [MCC_UNNUMBERED])).toEqual([
      ["multiple-sources", "references", 0],
    ])
  })

  it("numérotation trouée ou dupliquée", () => {
    const gap =
      "1.\nSource A. Lancet. 2020.\n2.\nSource B. BMJ. 2021.\n4.\nSource D. JAMA. 2022."
    const dup =
      "1.\nSource A. Lancet. 2020.\n2.\nSource B. BMJ. 2021.\n2.\nSource C. JAMA. 2022."
    expect(codes("Texte [1].", [gap])).toContainEqual([
      "numbering-gap",
      "references",
      0,
    ])
    expect(codes("Texte [1].", [dup])).toContainEqual([
      "numbering-gap",
      "references",
      0,
    ])
  })

  it("référence identique à l'explication", () => {
    const text = "Explication longue ".repeat(20).trim()
    expect(codes(text, [`${text}\n`])).toContainEqual([
      "same-as-explanation",
      "references",
      0,
    ])
  })

  it("entrée anormalement longue", () => {
    expect(codes("Texte [1].", ["Titre. ".repeat(200)])).toContainEqual([
      "too-long",
      "references",
      0,
    ])
  })

  it("une source au format aéré, sans repère, ne déclenche pas d'avertissement", () => {
    expect(
      codes("Texte [1].", [
        "Immunizations.\n\nAmerican Academy of Family Physicians (2025)",
      ]),
    ).toEqual([])
  })

  it("texte avant la première source numérotée", () => {
    const pre =
      "Références\n1.\nSource A. Lancet. 2020;1:1-2.\n2.\nSource B. BMJ. 2021;2:3-4."
    expect(codes("Texte [1].", [pre])).toEqual([
      ["multiple-sources", "references", 0],
      ["text-before-numbering", "references", 0],
    ])
    expect(normalizeReferenceEntry(pre)).toEqual([pre])
  })

  it("sous-liste FDA", () => {
    expect(codes("Texte [1].", [FDA])).toContainEqual([
      "fda-sublist",
      "references",
      0,
    ])
  })

  it("retours à la ligne forcés de PDF", () => {
    expect(codes(EXPLANATION_FOOTER, ["Source A. Lancet. 2020."])).toEqual([
      ["pdf-line-breaks", "explanation", undefined],
    ])
  })

  it("première lettre minuscule", () => {
    expect(
      codes("a maladie coronarienne est la cause [1].", ["Source."]),
    ).toEqual([["lowercase-start", "explanation", undefined]])
  })

  it("appel au-delà du nombre de références", () => {
    expect(codes("Texte [1][2-3].", ["Source A.", "Source B."])).toEqual([
      ["citation-out-of-range", "explanation", undefined],
    ])
    expect(codes("Texte [1].", [])).toEqual([
      ["citation-out-of-range", "explanation", undefined],
    ])
  })

  it("ignore les champs de référence vides du formulaire", () => {
    expect(codes("Texte [1].", ["Source A.", ""])).toEqual([])
  })

  it("chaque motif porte un libellé français", () => {
    const issues = diagnoseCorrection({
      explanation: "a texte [9].",
      references: [FDA],
    })
    expect(issues.length).toBeGreaterThan(2)
    for (const issue of issues) {
      expect(issue.message).toMatch(/[àâçéèêîôû«]/)
    }
  })
})
