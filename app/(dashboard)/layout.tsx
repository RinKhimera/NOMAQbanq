"use client"

import { GenericNavUser } from "@/components/shared/GenericNavUser"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { SiteHeader } from "@/components/shared/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { dashboardNavigation } from "@/constants"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        navigation={dashboardNavigation}
        homeUrl="/dashboard"
        userComponent={<GenericNavUser requireAdmin={false} redirectUrl="/" />}
      />
      <SidebarInset className="theme-bg">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
