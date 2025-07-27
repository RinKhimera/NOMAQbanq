import { ChartAreaInteractive } from "@/components/admin/chart-area-interactive"
import { DataTable } from "@/components/admin/data-table"
import { SectionCards } from "@/components/admin/section-cards"
import data from "./data.json"

const AdminDashboard = () => {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={data} />
    </div>
  )
}

export default AdminDashboard
