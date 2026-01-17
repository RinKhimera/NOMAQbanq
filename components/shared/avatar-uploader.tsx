"use client"

import { useAuth } from "@clerk/nextjs"
import { IconCamera, IconCheck, IconUpload, IconX } from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { useCallback, useState } from "react"
import Cropper, { Area, Point } from "react-easy-crop"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

// ============================================
// TYPES
// ============================================

type AvatarUploaderProps = {
  currentAvatarUrl?: string
  onAvatarChange: (newUrl: string) => void
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}

// ============================================
// CROP IMAGE HELPER
// ============================================

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = document.createElement("img")
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = url
  })

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("No 2d context")
  }

  // Set canvas size to desired output (square for avatar)
  const outputSize = 400
  canvas.width = outputSize
  canvas.height = outputSize

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Canvas is empty"))
        }
      },
      "image/jpeg",
      0.9,
    )
  })
}

// ============================================
// MAIN COMPONENT
// ============================================

export const AvatarUploader = ({
  currentAvatarUrl,
  onAvatarChange,
  size = "md",
  disabled = false,
}: AvatarUploaderProps) => {
  const { getToken } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  }

  // Handle file selection
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled || acceptedFiles.length === 0) return

      const file = acceptedFiles[0]

      // Create preview URL
      const reader = new FileReader()
      reader.addEventListener("load", () => {
        setImageSrc(reader.result as string)
        setCropDialogOpen(true)
      })
      reader.readAsDataURL(file)
    },
    [disabled],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled: disabled || isUploading,
    multiple: false,
  })

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // Upload cropped image
  const handleSaveCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return

    setIsUploading(true)

    try {
      // Get cropped image blob
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels)

      // Create file from blob
      const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" })

      // Get auth token
      const token = await getToken({ template: "convex" })

      // Create form data
      const formData = new FormData()
      formData.append("file", file)

      // Upload to Bunny via Convex HTTP action
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site")}/api/upload/avatar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de l'upload")
      }

      const result = await response.json()

      // Update parent component
      onAvatarChange(result.url)
      toast.success("Photo de profil mise à jour")

      // Close dialog and reset
      setCropDialogOpen(false)
      setImageSrc(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    } catch (error) {
      console.error("Avatar upload error:", error)
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'upload",
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    setCropDialogOpen(false)
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  return (
    <>
      {/* Avatar display with upload trigger */}
      <div
        {...getRootProps()}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-blue-500",
          sizeClasses[size],
          isDragActive && "ring-blue-500",
          (disabled || isUploading) && "cursor-not-allowed opacity-50",
        )}
      >
        <input {...getInputProps()} />

        {/* Current avatar or placeholder */}
        {currentAvatarUrl ? (
          <Image
            src={currentAvatarUrl}
            alt="Avatar"
            fill
            className="object-cover"
            sizes={`(max-width: 768px) ${size === "lg" ? "128px" : size === "md" ? "96px" : "64px"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <IconCamera className="h-1/3 w-1/3 text-muted-foreground" />
          </div>
        )}

        {/* Hover overlay */}
        {!disabled && !isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <IconUpload className="h-1/3 w-1/3 text-white" />
          </div>
        )}

        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-1/3 w-1/3 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Crop dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={handleCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recadrer la photo</DialogTitle>
            <DialogDescription>
              Ajustez le cadrage de votre photo de profil
            </DialogDescription>
          </DialogHeader>

          {imageSrc && (
            <div className="space-y-4">
              {/* Crop area */}
              <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              {/* Zoom slider */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Zoom</label>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={([value]) => setZoom(value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
            >
              <IconX className="mr-2 h-4 w-4" />
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSaveCrop}
              disabled={isUploading || !croppedAreaPixels}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upload...
                </>
              ) : (
                <>
                  <IconCheck className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
