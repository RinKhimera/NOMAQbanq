"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type DeletePhotoDialogProps = {
  onConfirm: () => void
  trigger: React.ReactNode
}

export function DeletePhotoDialog(props: DeletePhotoDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className="dark:bg-card bg-white">
        <DialogHeader>
          <DialogTitle className="text-blue-600 dark:text-white">
            Supprimer la photo de profil
          </DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer votre photo de profil ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            variant="none"
            onClick={props.onConfirm}
          >
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
