"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const BackButton = () => (
  <Button
    variant="outline"
    className="max-md:h-11"
    onClick={() => window.history.back()}
  >
    <ArrowLeft aria-hidden />
    Page précédente
  </Button>
)
