import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import pngToIco from "png-to-ico"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const svgSource = readFileSync(resolve(root, "public/icons/concept_4_abstract_n.svg"))

// --- Generate PNGs ---
const sizes = [
  { name: "app/apple-icon.png", size: 180 },
  { name: "public/icons/icon-192.png", size: 192 },
  { name: "public/icons/icon-512.png", size: 512 },
]

for (const { name, size } of sizes) {
  await sharp(svgSource).resize(size, size).png().toFile(resolve(root, name))
  console.log(`✓ ${name} (${size}x${size})`)
}

// --- Generate favicon.ico (16x16 + 32x32) ---
const png16 = await sharp(svgSource).resize(16, 16).png().toBuffer()
const png32 = await sharp(svgSource).resize(32, 32).png().toBuffer()
const ico = await pngToIco([png16, png32])
writeFileSync(resolve(root, "app/favicon.ico"), ico)
console.log("✓ app/favicon.ico (16x16 + 32x32)")

// --- Generate icon.svg with dark mode support ---
let svgContent = svgSource.toString("utf-8")

// Add class="bg" to the background rect
svgContent = svgContent.replace(
  '<rect width="512" height="512" fill="url(#bgGrad)" rx="64"/>',
  '<rect class="bg" width="512" height="512" fill="url(#bgGrad)" rx="64"/>'
)

// Insert dark mode <style> after <defs>...</defs>
const darkModeStyle = `
  <style>
    @media (prefers-color-scheme: dark) {
      .bg { fill: #1e293b !important; }
    }
  </style>`

svgContent = svgContent.replace("</defs>", `</defs>${darkModeStyle}`)

writeFileSync(resolve(root, "app/icon.svg"), svgContent)
console.log("✓ app/icon.svg (with dark mode support)")

console.log("\nDone! All favicons generated.")
