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
import { CircleAlert, GripVertical, ImagePlus, X } from "lucide-react"
import Image from "next/image"
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { type FileRejection, useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { createQuestionImageUpload } from "@/features/questions/actions"
import { cdnUrl } from "@/lib/cdn"
import { callAction } from "@/lib/safe-action"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"

export type QuestionImage = {
  url: string
  storagePath: string
  order: number
}

type Upload = {
  id: string
  file: File
  preview: string
  status: "uploading" | "error"
  error?: string
}

type QuestionImageUploaderProps = {
  /** Identifiant de la question, réservé par le formulaire avant sa création. */
  questionId: string
  // `statement` = images d'énoncé (visibles en passation) ;
  // `explanation` = images d'explication (visibles à la correction uniquement).
  // Détermine le sous-dossier S3 namespacé côté presign (`createQuestionImageUpload`).
  kind?: "statement" | "explanation"
  label: string
  help?: string
  images: QuestionImage[]
  // Accepte une valeur OU un updater fonctionnel : plusieurs envois concurrents
  // ne s'écrasent pas.
  onImagesChange: Dispatch<SetStateAction<QuestionImage[]>>
  /** Signale au formulaire qu'un envoi est en cours ou en échec. */
  onPendingChange?: (pending: { uploading: number; failed: number }) => void
  maxImages?: number
  disabled?: boolean
}

const MAX_BYTES = 5 * 1024 * 1024

const rejectionMessage = (r: FileRejection) => {
  const code = r.errors[0]?.code
  if (code === "file-too-large")
    return `${r.file.name} : Fichier trop volumineux : 5 Mo au plus.`
  if (code === "file-invalid-type")
    return `${r.file.name} : Format non supporté. Utilisez JPG, PNG ou WebP.`
  return `${r.file.name} : fichier refusé.`
}

const SortableImage = ({
  image,
  index,
  onRemove,
  disabled,
}: {
  image: QuestionImage
  index: number
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

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-surface-2 border-line relative aspect-square overflow-hidden rounded-md border",
        isDragging && "z-10 opacity-60",
      )}
    >
      <Image
        src={image.url}
        alt={`Image ${index + 1}`}
        fill
        className="object-cover"
        sizes="160px"
      />
      <span className="bg-surface text-ink absolute bottom-1 left-1 rounded-xs px-1 font-mono text-[11px]">
        {index + 1}
      </span>
      {!disabled && (
        <>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Déplacer l'image ${index + 1} (flèches gauche et droite)`}
            title="Glisser pour réordonner"
            className={cn(
              TOUCH_TARGET,
              "focus-ring bg-surface text-ink-2 absolute top-1 left-1 flex size-7 cursor-grab items-center justify-center rounded-md active:cursor-grabbing",
            )}
          >
            <GripVertical aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer l'image ${index + 1}`}
            className={cn(
              TOUCH_TARGET,
              "focus-ring bg-surface text-ink-2 hover:text-danger-ink absolute top-1 right-1 flex size-7 cursor-pointer items-center justify-center rounded-md",
            )}
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </>
      )}
    </li>
  )
}

/**
 * Images d'une question : envoi direct vers S3 (presign), ordre par glisser
 * ou au clavier, erreurs en ligne. La persistance se fait à l'enregistrement
 * du formulaire (`setQuestionImages`).
 */
export const QuestionImageUploader = ({
  questionId,
  kind = "statement",
  label,
  help,
  images,
  onImagesChange,
  onPendingChange,
  maxImages = 10,
  disabled = false,
}: QuestionImageUploaderProps) => {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [messages, setMessages] = useState<string[]>([])

  // Les object-URLs de prévisualisation sont révoqués au démontage.
  const previewUrlsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const urls = previewUrlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.clear()
    }
  }, [])

  useEffect(() => {
    onPendingChange?.({
      uploading: uploads.filter((u) => u.status === "uploading").length,
      failed: uploads.filter((u) => u.status === "error").length,
    })
  }, [uploads, onPendingChange])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const count = images.length + uploads.length
  const canAddMore = count < maxImages

  const fail = (id: string, error: string) =>
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: "error", error } : u)),
    )

  // Presign (garde admin, rate-limit, validation serveur) puis POST direct du
  // fichier vers S3 ; le chemin `tmp/` rejoint la liste persistée au save.
  const send = useCallback(
    async (item: Upload, index: number) => {
      const presign = await callAction(() =>
        createQuestionImageUpload({
          questionId,
          kind,
          imageIndex: index,
          contentType: item.file.type,
          size: item.file.size,
        }),
      )
      if (!presign.success) return fail(item.id, presign.error)

      const form = new FormData()
      Object.entries(presign.fields).forEach(([k, v]) => form.append(k, v))
      form.append("file", item.file) // "file" en dernier (exigence S3 POST)
      try {
        const res = await fetch(presign.url, { method: "POST", body: form })
        if (!res.ok) return fail(item.id, "Échec de l'envoi. Réessayez.")
      } catch {
        return fail(item.id, "Connexion perdue. Réessayez.")
      }

      onImagesChange((prev) => [
        ...prev,
        {
          url: cdnUrl(presign.storagePath),
          storagePath: presign.storagePath,
          order: prev.length,
        },
      ])
      setUploads((prev) => prev.filter((u) => u.id !== item.id))
      URL.revokeObjectURL(item.preview)
      previewUrlsRef.current.delete(item.preview)
    },
    [questionId, kind, onImagesChange],
  )

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (disabled) return
      const room = Math.max(0, maxImages - count)
      const files = accepted.slice(0, room)
      const skipped = accepted.length - files.length
      setMessages([
        ...rejected.map(rejectionMessage),
        ...(skipped > 0
          ? [
              `${maxImages} images au plus : ${skipped} fichier${skipped > 1 ? "s n'ont" : " n'a"} pas été ajouté${skipped > 1 ? "s" : ""}.`,
            ]
          : []),
      ])
      const stamp = Date.now()
      const queued: Upload[] = files.map((file, i) => ({
        id: `${stamp}-${i}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
        status: "uploading",
      }))
      queued.forEach((q) => previewUrlsRef.current.add(q.preview))
      setUploads((prev) => [...prev, ...queued])
      queued.forEach((item, i) => void send(item, count + i))
    },
    [disabled, maxImages, count, send],
  )

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: MAX_BYTES,
    disabled: disabled || !canAddMore,
    noClick: true,
    multiple: true,
  })

  const retry = (item: Upload) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.id === item.id ? { ...u, status: "uploading", error: undefined } : u,
      ),
    )
    void send(item, images.length)
  }

  const dismiss = (item: Upload) => {
    URL.revokeObjectURL(item.preview)
    previewUrlsRef.current.delete(item.preview)
    setUploads((prev) => prev.filter((u) => u.id !== item.id))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = images.findIndex((img) => img.storagePath === active.id)
    const to = images.findIndex((img) => img.storagePath === over.id)
    onImagesChange(
      arrayMove(images, from, to).map((img, order) => ({ ...img, order })),
    )
  }

  const remove = (storagePath: string) =>
    onImagesChange((prev) =>
      prev
        .filter((img) => img.storagePath !== storagePath)
        .map((img, order) => ({ ...img, order })),
    )

  const failed = uploads.filter((u) => u.status === "error")

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col gap-2.5 rounded-md",
        isDragActive && "outline-accent outline-2 outline-offset-4",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ink text-sm font-medium">{label}</span>
        <span className="text-ink-3 font-mono text-xs">
          {images.length} / {maxImages} images
        </span>
      </div>
      {help && <span className="text-ink-3 text-[0.8125rem]">{help}</span>}

      {count > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.storagePath)}
            strategy={rectSortingStrategy}
          >
            <ol
              aria-label={label}
              className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2"
            >
              {images.map((image, i) => (
                <SortableImage
                  key={image.storagePath}
                  image={image}
                  index={i}
                  onRemove={() => remove(image.storagePath)}
                  disabled={disabled}
                />
              ))}
              {uploads.map((u) => (
                <li
                  key={u.id}
                  className={cn(
                    "bg-surface-2 relative aspect-square overflow-hidden rounded-md border",
                    u.status === "error" ? "border-danger" : "border-line",
                  )}
                >
                  <Image
                    src={u.preview}
                    alt=""
                    fill
                    className="object-cover opacity-50"
                    sizes="160px"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    {u.status === "uploading" ? (
                      <Spinner size="md" label="Envoi en cours" />
                    ) : (
                      <CircleAlert
                        aria-label="Envoi en échec"
                        className="text-danger size-5"
                      />
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !canAddMore}
          onClick={open}
        >
          <ImagePlus aria-hidden />
          Ajouter des images
        </Button>
        <span className="text-ink-3 text-xs">
          JPG, PNG ou WebP · 5 Mo au plus
        </span>
      </div>

      {(failed.length > 0 || messages.length > 0) && (
        <ul className="text-danger-ink flex flex-col gap-1 text-[0.8125rem]">
          {failed.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-2">
              <CircleAlert aria-hidden className="size-3.5 shrink-0" />
              <span>
                <span className="font-mono">{u.file.name}</span> : {u.error}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => retry(u)}
              >
                Réessayer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Abandonner ${u.file.name}`}
                onClick={() => dismiss(u)}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
          {messages.map((m, i) => (
            <li key={m} className="flex flex-wrap items-center gap-2">
              <CircleAlert aria-hidden className="size-3.5 shrink-0" />
              <span>{m}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Masquer le message"
                onClick={() => setMessages(messages.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
