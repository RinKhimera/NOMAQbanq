import type { Area } from "react-easy-crop"

// Borne la sortie pour garder l'avatar léger (bien sous la limite Server Action
// de 1 Mo, même issu d'une source 5 Mo). Carré (aspect 1 du cropper avatar).
const MAX_OUTPUT_SIZE = 512

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener("load", () => resolve(img))
    img.addEventListener("error", () =>
      reject(new Error("Image illisible")),
    )
    img.src = src
  })

/**
 * Recadre `imageSrc` selon `area` (pixels, fournie par react-easy-crop) et
 * renvoie un Blob JPEG carré borné à {@link MAX_OUTPUT_SIZE}. Appelé côté client
 * par l'avatar uploader avant l'envoi au Server Action `uploadAvatar`.
 */
export const getCroppedImageBlob = async (
  imageSrc: string,
  area: Area,
): Promise<Blob> => {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas non supporté par le navigateur")

  // Jamais d'agrandissement au-delà de la zone recadrée ; plafonné à 512 px.
  const outputSize = Math.min(
    MAX_OUTPUT_SIZE,
    Math.round(area.width),
    Math.round(area.height),
  )
  canvas.width = outputSize
  canvas.height = outputSize

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Échec du recadrage")),
      "image/jpeg",
      0.9,
    )
  })
}
