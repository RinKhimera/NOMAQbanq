export type ImageOptimizationParams = {
  width?: number
  height?: number
  quality?: number // 0-100, default 85
  crop?: "fit" | "fill" | "scale"
}

/**
 * Génère une URL CDN optimisée avec les paramètres Bunny Optimizer
 */
export const getOptimizedImageUrl = (
  baseUrl: string,
  params: ImageOptimizationParams,
): string => {
  const searchParams = new URLSearchParams()

  if (params.width) searchParams.set("width", params.width.toString())
  if (params.height) searchParams.set("height", params.height.toString())
  if (params.quality) searchParams.set("quality", params.quality.toString())
  if (params.crop) searchParams.set("crop", params.crop)

  const queryString = searchParams.toString()
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

export const getThumbnailUrl = (
  baseUrl: string,
  size: number = 200,
): string =>
  getOptimizedImageUrl(baseUrl, {
    width: size,
    height: size,
    crop: "fit",
    quality: 80,
  })

export const getQuestionImageUrl = (baseUrl: string): string =>
  getOptimizedImageUrl(baseUrl, {
    width: 800,
    quality: 85,
  })

export const getAvatarUrl = (baseUrl: string, size: number = 128): string =>
  getOptimizedImageUrl(baseUrl, {
    width: size,
    height: size,
    crop: "fit",
    quality: 85,
  })
