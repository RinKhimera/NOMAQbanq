"use client"

import { GenericNavUser } from "@/components/shared/GenericNavUser"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { SiteHeader } from "@/components/shared/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { adminNavigation, dashboardNavigation } from "@/constants"

interface GenericLayoutProps {
  children: React.ReactNode
  type: "admin" | "dashboard"
}

export default function GenericLayout({ children, type }: GenericLayoutProps) {
  const navigation = type === "admin" ? adminNavigation : dashboardNavigation
  const homeUrl = type === "admin" ? "/admin" : "/dashboard"
  const requireAdmin = type === "admin"

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
        navigation={navigation}
        homeUrl={homeUrl}
        userComponent={
          <GenericNavUser requireAdmin={requireAdmin} redirectUrl="/" />
        }
      />
      <SidebarInset>
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
