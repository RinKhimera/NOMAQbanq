"use client"

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useAuth } from "@clerk/nextjs"
import { IconGripVertical, IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { useCallback, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// ============================================
// TYPES
// ============================================

export type QuestionImage = {
  url: string
  storagePath: string
  order: number
}

type UploadingImage = {
  id: string
  file: File
  preview: string
  progress: number
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

type QuestionImageUploaderProps = {
  questionId: string
  images: QuestionImage[]
  onImagesChange: (images: QuestionImage[]) => void
  maxImages?: number
  disabled?: boolean
}

// ============================================
// SORTABLE IMAGE ITEM
// ============================================

const SortableImageItem = ({
  image,
  onRemove,
  disabled,
}: {
  image: QuestionImage
  onRemove: () => void
  disabled?: boolean
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.storagePath })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted",
        isDragging && "z-50 opacity-50",
      )}
    >
      <Image
        src={image.url}
        alt={`Image ${image.order + 1}`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 200px"
      />

      {/* Overlay avec actions */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {!disabled && (
          <>
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab rounded-md bg-white/90 p-2 text-gray-700 hover:bg-white active:cursor-grabbing"
            >
              <IconGripVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md bg-red-500/90 p-2 text-white hover:bg-red-600"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Badge ordre */}
      <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-medium text-white">
        {image.order + 1}
      </span>
    </div>
  )
}

// ============================================
// UPLOADING IMAGE ITEM
// ============================================

const UploadingImageItem = ({
  item,
  onCancel,
}: {
  item: UploadingImage
  onCancel: () => void
}) => (
  <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
    <Image
      src={item.preview}
      alt="Upload en cours"
      fill
      className="object-cover opacity-50"
      sizes="(max-width: 768px) 100vw, 200px"
    />

    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 p-2">
      {item.status === "uploading" && (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-white" />
          <Progress value={item.progress} className="mt-2 h-1.5 w-3/4" />
          <span className="mt-1 text-xs text-white">{item.progress}%</span>
        </>
      )}

      {item.status === "error" && (
        <div className="text-center">
          <IconX className="mx-auto h-6 w-6 text-red-400" />
          <span className="mt-1 text-xs text-red-300">{item.error || "Erreur"}</span>
        </div>
      )}

      {item.status === "pending" && (
        <span className="text-xs text-white">En attente...</span>
      )}
    </div>

    {(item.status === "error" || item.status === "pending") && (
      <button
        type="button"
        onClick={onCancel}
        className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
      >
        <IconX className="h-3 w-3" />
      </button>
    )}
  </div>
)

// ============================================
// MAIN COMPONENT
// ============================================

export const QuestionImageUploader = ({
  questionId,
  images,
  onImagesChange,
  maxImages = 10,
  disabled = false,
}: QuestionImageUploaderProps) => {
  const { getToken } = useAuth()
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const canAddMore = images.length + uploadingImages.length < maxImages

  // Refs pour les valeurs stables dans le callback
  const imagesRef = useRef(images)
  imagesRef.current = images

  // Upload d'une image vers Bunny
  const uploadImage = useCallback(async (file: File, index: number): Promise<QuestionImage | null> => {
    const uploadId = `upload-${Date.now()}-${index}`

    setUploadingImages((prev) => [
      ...prev,
      {
        id: uploadId,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: "uploading",
      },
    ])

    try {
      const token = await getToken({ template: "convex" })
      const formData = new FormData()
      formData.append("file", file)
      formData.append("questionId", questionId)
      formData.append("imageIndex", (imagesRef.current.length + index).toString())

      // Simuler le progress (les fetch ne supportent pas nativement le progress)
      const progressInterval = setInterval(() => {
        setUploadingImages((prev) =>
          prev.map((img) =>
            img.id === uploadId && img.progress < 90
              ? { ...img, progress: img.progress + 10 }
              : img,
          ),
        )
      }, 200)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site")}/api/upload/question-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      )

      clearInterval(progressInterval)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de l'upload")
      }

      const result = await response.json()

      // Marquer comme terminé
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, progress: 100, status: "done" } : img,
        ),
      )

      // Nettoyer après un court délai
      setTimeout(() => {
        setUploadingImages((prev) => prev.filter((img) => img.id !== uploadId))
      }, 500)

      return {
        url: result.url,
        storagePath: result.storagePath,
        order: imagesRef.current.length + index,
      }
    } catch (error) {
      console.error("Upload error:", error)

      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId
            ? {
                ...img,
                status: "error",
                error: error instanceof Error ? error.message : "Erreur",
              }
            : img,
        ),
      )

      return null
    }
  }, [getToken, questionId])

  // Gestion du drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return

      const remainingSlots = maxImages - images.length - uploadingImages.length
      const filesToUpload = acceptedFiles.slice(0, remainingSlots)

      if (filesToUpload.length < acceptedFiles.length) {
        toast.warning(`Seulement ${remainingSlots} image(s) peuvent être ajoutée(s)`)
      }

      // Upload en parallèle
      const uploadPromises = filesToUpload.map((file, index) =>
        uploadImage(file, index),
      )

      const results = await Promise.all(uploadPromises)
      const successfulUploads = results.filter(
        (r): r is QuestionImage => r !== null,
      )

      if (successfulUploads.length > 0) {
        const newImages = [...images, ...successfulUploads].map((img, index) => ({
          ...img,
          order: index,
        }))
        onImagesChange(newImages)
        toast.success(`${successfulUploads.length} image(s) ajoutée(s)`)
      }
    },
    [disabled, images, maxImages, onImagesChange, uploadImage, uploadingImages.length],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled: disabled || !canAddMore,
    multiple: true,
  })

  // Gestion du drag & drop pour réordonner
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.storagePath === active.id)
      const newIndex = images.findIndex((img) => img.storagePath === over.id)

      const reorderedImages = arrayMove(images, oldIndex, newIndex).map(
        (img: QuestionImage, index: number) => ({ ...img, order: index }),
      )

      onImagesChange(reorderedImages)
    }
  }

  // Supprimer une image
  const handleRemove = async (storagePath: string) => {
    try {
      const token = await getToken({ template: "convex" })

      // Supprimer de Bunny
      await fetch(
        `${process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site")}/api/upload/question-image`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ storagePath }),
        },
      )

      // Mettre à jour localement
      const newImages = images
        .filter((img) => img.storagePath !== storagePath)
        .map((img, index) => ({ ...img, order: index }))

      onImagesChange(newImages)
      toast.success("Image supprimée")
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Erreur lors de la suppression")
    }
  }

  // Annuler un upload en attente ou en erreur
  const handleCancelUpload = (uploadId: string) => {
    setUploadingImages((prev) => {
      const item = prev.find((img) => img.id === uploadId)
      if (item) {
        URL.revokeObjectURL(item.preview)
      }
      return prev.filter((img) => img.id !== uploadId)
    })
  }

  return (
    <div className="space-y-4">
      {/* Zone de drop */}
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          (disabled || !canAddMore) && "cursor-not-allowed opacity-50",
        )}
      >
        <input {...getInputProps()} />
        <IconUpload className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          {isDragActive
            ? "Déposez les images ici..."
            : canAddMore
              ? "Glissez-déposez des images ou cliquez pour sélectionner"
              : `Maximum ${maxImages} images atteint`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WebP - Max 5MB par image
        </p>
      </div>

      {/* Grille d'images */}
      {(images.length > 0 || uploadingImages.length > 0) && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.storagePath)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => (
                <SortableImageItem
                  key={image.storagePath}
                  image={image}
                  onRemove={() => handleRemove(image.storagePath)}
                  disabled={disabled}
                />
              ))}

              {uploadingImages.map((item) => (
                <UploadingImageItem
                  key={item.id}
                  item={item}
                  onCancel={() => handleCancelUpload(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Compteur */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <IconPhoto className="h-4 w-4" />
          {images.length} / {maxImages} images
        </span>
        {images.length > 1 && !disabled && (
          <span className="text-xs">
            Glissez pour réorganiser
          </span>
        )}
      </div>
    </div>
  )
}
