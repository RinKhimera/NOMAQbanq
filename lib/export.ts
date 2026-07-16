/**
 * Helpers d'export côté client (XLSX via SheetJS, CSV manuel + BOM UTF-8).
 * Consolidé depuis export-users-button et export-questions-button (C6, #113).
 *
 * ATTENTION : les fichiers produits sont gelés au bit près — ne pas « normaliser »
 * séparateurs, échappement, BOM ou noms de fichiers sans vérifier chaque
 * consommateur (les deux boutons n'assemblent pas leurs lignes CSV pareil).
 */
import { utils, writeFile } from "xlsx"

/** Déclenche le téléchargement navigateur d'un Blob puis libère l'URL. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** `base-2026-07-16.ext` (date ISO courte). */
export const timestampedFilename = (base: string, ext: string): string =>
  `${base}-${new Date().toISOString().split("T")[0]}.${ext}`

/** Entoure de guillemets en doublant les guillemets internes (`"` → `""`). */
export const csvQuote = (value: string): string =>
  `"${value.replace(/"/g, '""')}"`

/**
 * Télécharge un CSV : BOM UTF-8 (Excel) + lignes jointes par `\n`.
 * Les lignes arrivent déjà assemblées — séparateur et échappement restent la
 * responsabilité de l'appelant (ils diffèrent d'un export à l'autre).
 */
export const downloadCsv = (lines: string[], filename: string): void => {
  const BOM = "\uFEFF"
  const blob = new Blob([BOM + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  })
  downloadBlob(blob, filename)
}

/** Feuille XLSX depuis des objets (en-têtes = clés), largeurs en `wch`. */
export const exportRowsToXlsx = (
  rows: Record<string, unknown>[],
  opts: { sheetName: string; filename: string; colWidths?: number[] },
): void => {
  const worksheet = utils.json_to_sheet(rows)
  if (opts.colWidths) {
    worksheet["!cols"] = opts.colWidths.map((wch) => ({ wch }))
  }
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, opts.sheetName)
  writeFile(workbook, opts.filename)
}
