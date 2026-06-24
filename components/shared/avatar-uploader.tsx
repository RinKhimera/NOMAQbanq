"use client"

import { IconCamera, IconCheck, IconUpload, IconX } from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import Cropper, { Area, Point } from "react-easy-crop"
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
import { confirmAvatarUpload, createAvatarUpload } from "@/features/users/actions"
import { cdnUrl } from "@/lib/cdn"
import { getCroppedImageBlob } from "@/lib/crop-image"
import { cn } from "@/lib/utils"

// ============================================
// TYPES
// ============================================

type AvatarUploaderProps = {
  currentAvatarUrl?: string | null
  onAvatarChange?: (newUrl: string) => void
  size?: "sm" | "md" | "lg"
  disabled?: boolean
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
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  // URL optimiste après upload (précède le rafraîchissement serveur).
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const shownAvatarUrl = uploadedUrl ?? currentAvatarUrl

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

  // Recadre côté client, téléverse via le Server Action `uploadAvatar`, puis
  // rafraîchit les données serveur (le Server Component parent re-fetch l'image).
  const handleSaveCrop = async () => {
    if (!imageSrc || !croppedAreaPixels || isUploading) return

    setIsUploading(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)

      // Étape 1 : presigned POST. Étape 2 : POST direct vers S3. Étape 3 :
      // `confirmAvatarUpload` persiste `user.image` (re-vérifie le préfixe).
      const presign = await createAvatarUpload({
        contentType: blob.type || "image/jpeg",
        size: blob.size,
      })
      if (!presign.success) {
        toast.error(presign.error)
        return
      }

      const s3Form = new FormData()
      Object.entries(presign.fields).forEach(([k, v]) => s3Form.append(k, v))
      s3Form.append("file", blob, "avatar.jpg") // "file" en dernier

      const s3Res = await fetch(presign.url, { method: "POST", body: s3Form })
      if (!s3Res.ok) {
        toast.error("Échec du téléversement. Réessayez.")
        return
      }

      const confirmed = await confirmAvatarUpload({
        storagePath: presign.storagePath,
      })
      if (!confirmed.success) {
        toast.error(confirmed.error ?? "Erreur serveur. Réessayez.")
        return
      }

      const newUrl = cdnUrl(presign.storagePath)
      setUploadedUrl(newUrl)
      onAvatarChange?.(newUrl)
      toast.success("Photo de profil mise à jour")

      setCropDialogOpen(false)
      setImageSrc(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      router.refresh()
    } catch {
      toast.error("Échec du téléversement. Réessayez.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    if (isUploading) return
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
        {shownAvatarUrl ? (
          <Image
            src={shownAvatarUrl}
            alt="Avatar"
            fill
            className="object-cover"
            sizes={`(max-width: 768px) ${size === "lg" ? "128px" : size === "md" ? "96px" : "64px"}`}
          />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <IconCamera className="text-muted-foreground h-1/3 w-1/3" />
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
              <div className="bg-muted relative h-64 w-full overflow-hidden rounded-lg">
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
