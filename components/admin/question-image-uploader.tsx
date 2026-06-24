"use client"

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconGripVertical,
  IconPhoto,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { createQuestionImageUpload } from "@/features/questions/actions"
import { cdnUrl } from "@/lib/cdn"
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
  // Accepte une valeur OU un updater fonctionnel (le parent passe `setImages`) :
  // permet d'enchaîner plusieurs uploads concurrents sans écraser l'état.
  onImagesChange: Dispatch<SetStateAction<QuestionImage[]>>
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
        "group bg-muted relative aspect-square overflow-hidden rounded-lg border",
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
      <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-medium text-white">
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
  <div className="bg-muted relative aspect-square overflow-hidden rounded-lg border">
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
          <span className="mt-1 text-xs text-white">Téléversement…</span>
        </>
      )}

      {item.status === "error" && (
        <div className="text-center">
          <IconX className="mx-auto h-6 w-6 text-red-400" />
          <span className="mt-1 text-xs text-red-300">
            {item.error || "Erreur"}
          </span>
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
        className="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
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
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([])

  // Suit les object-URLs de prévisualisation pour les révoquer au démontage
  // (sinon fuite mémoire si le formulaire est quitté pendant/après un upload).
  const previewUrlsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const urls = previewUrlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.clear()
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const canAddMore = images.length + uploadingImages.length < maxImages

  // Téléverse chaque fichier déposé via le Server Action `uploadQuestionImage`,
  // puis ajoute le résultat (url + storagePath) à la liste persistée au save.
  // Updates fonctionnels (`onImagesChange`/`setUploadingImages`) → sûrs même avec
  // plusieurs uploads en parallèle. La persistance DB et la suppression CDN des
  // images retirées se font dans `setQuestionImages` à l'enregistrement.
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled || acceptedFiles.length === 0) return

      const remaining = maxImages - images.length - uploadingImages.length
      const files = acceptedFiles.slice(0, Math.max(0, remaining))
      if (files.length === 0) {
        toast.error(`Maximum ${maxImages} images atteint`)
        return
      }

      const stamp = Date.now()
      const queued: UploadingImage[] = files.map((file, i) => ({
        id: `${stamp}-${i}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: "uploading",
      }))
      queued.forEach((q) => previewUrlsRef.current.add(q.preview))
      setUploadingImages((prev) => [...prev, ...queued])

      for (let i = 0; i < queued.length; i++) {
        const item = queued[i]
        try {
          // Étape 1 : presigned POST (garde admin + rate-limit + validation
          // serveur). Étape 2 : POST direct du fichier vers S3. Étape 3 : la
          // persistance DB est faite par `setQuestionImages` au save.
          const presign = await createQuestionImageUpload({
            questionId,
            imageIndex: images.length + i,
            contentType: item.file.type,
            size: item.file.size,
          })
          if (!presign.success) {
            toast.error(presign.error)
            setUploadingImages((prev) =>
              prev.map((u) =>
                u.id === item.id
                  ? { ...u, status: "error", error: presign.error }
                  : u,
              ),
            )
            continue
          }

          const s3Form = new FormData()
          Object.entries(presign.fields).forEach(([k, v]) =>
            s3Form.append(k, v),
          )
          s3Form.append("file", item.file) // "file" en dernier (exigence S3 POST)

          const s3Res = await fetch(presign.url, {
            method: "POST",
            body: s3Form,
          })
          if (!s3Res.ok) {
            toast.error("Échec du téléversement. Réessayez.")
            setUploadingImages((prev) =>
              prev.map((u) =>
                u.id === item.id
                  ? { ...u, status: "error", error: "Échec S3" }
                  : u,
              ),
            )
            continue
          }

          onImagesChange((prev) => [
            ...prev,
            {
              // URL d'affichage dérivée du CDN public (`cdnUrl`) — MÊME hôte que
              // l'affichage au reload (`question-form-page` mappe aussi via
              // `cdnUrl`).
              url: cdnUrl(presign.storagePath),
              storagePath: presign.storagePath,
              order: prev.length,
            },
          ])
          setUploadingImages((prev) => {
            URL.revokeObjectURL(item.preview)
            previewUrlsRef.current.delete(item.preview)
            return prev.filter((u) => u.id !== item.id)
          })
        } catch {
          toast.error("Échec du téléversement. Réessayez.")
          setUploadingImages((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? { ...u, status: "error", error: "Erreur réseau" }
                : u,
            ),
          )
        }
      }
    },
    [disabled, maxImages, images.length, uploadingImages.length, questionId, onImagesChange],
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

  // Retire l'image de la liste locale (ré-indexe l'ordre). La suppression réelle
  // du fichier sur le CDN Bunny est déléguée à `setQuestionImages` au moment de
  // l'enregistrement (chemins retirés calculés côté serveur).
  const handleRemove = (storagePath: string) => {
    onImagesChange((prev) =>
      prev
        .filter((img) => img.storagePath !== storagePath)
        .map((img, index) => ({ ...img, order: index })),
    )
  }

  // Annuler un upload en attente ou en erreur
  const handleCancelUpload = (uploadId: string) => {
    setUploadingImages((prev) => {
      const item = prev.find((img) => img.id === uploadId)
      if (item) {
        URL.revokeObjectURL(item.preview)
        previewUrlsRef.current.delete(item.preview)
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
        <IconUpload className="text-muted-foreground mx-auto h-10 w-10" />
        <p className="text-muted-foreground mt-2 text-sm">
          {isDragActive
            ? "Déposez les images ici..."
            : canAddMore
              ? "Glissez-déposez des images ou cliquez pour sélectionner"
              : `Maximum ${maxImages} images atteint`}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
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
      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <span className="flex items-center gap-1">
          <IconPhoto className="h-4 w-4" />
          {images.length} / {maxImages} images
        </span>
        {images.length > 1 && !disabled && (
          <span className="text-xs">Glissez pour réorganiser</span>
        )}
      </div>
    </div>
  )
}
