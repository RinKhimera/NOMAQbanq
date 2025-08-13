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

type DeleteAccountDialogProps = {
  onConfirm: () => void
  trigger: React.ReactNode
}

export function DeleteAccountDialog(props: DeleteAccountDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className="dark:bg-card bg-white">
        <DialogHeader>
          <DialogTitle className="text-blue-600 dark:text-white">
            Supprimer le compte
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Toutes les données associées à ce
            compte seront supprimées.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {/*    <Button variant="outline">Annuler</Button> */}
          <Button variant="destructive" onClick={props.onConfirm}>
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
