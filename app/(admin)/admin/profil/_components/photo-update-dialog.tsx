"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PhotoUpdateDialogProps = {
  open: boolean
  imageUrl: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function PhotoUpdateDialog(props: PhotoUpdateDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="dark:bg-card bg-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-blue-600 dark:text-white">
            Confirmer la modification de la photo
          </DialogTitle>
          <DialogDescription>
            Vérifiez l&#39;aperçu de votre nouvelle photo avant d&#39;appliquer
            les changements.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.imageUrl}
            alt="Aperçu de la nouvelle photo"
            className="h-40 w-40 rounded-full object-cover"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            variant="none"
            onClick={props.onConfirm}
          >
            Modifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
