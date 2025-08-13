"use client"

import { Upload } from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"

type ChangePhotoButtonProps = {
  label?: string
  onSelected: (file: File) => void
  className?: string
}

export function ChangePhotoButton(props: ChangePhotoButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleClick = () => fileInputRef.current?.click()
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    props.onSelected(file)
    // reset
    e.currentTarget.value = ""
  }

  return (
    <div className={props.className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        onClick={handleClick}
        className="bg-blue-600 text-white hover:bg-blue-700"
      >
        <Upload className="mr-2 h-4 w-4" />
        {props.label ?? "Modifier la photo"}
      </Button>
    </div>
  )
}
