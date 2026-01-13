export type UnitSystem = "us" | "si"

export type LabValue = {
  id: string
  name: string
  usValue: string
  siValue: string
  usUnit: string
  siUnit: string
}

export type LabValueCategory = {
  id: string
  name: string
  values: LabValue[]
}
