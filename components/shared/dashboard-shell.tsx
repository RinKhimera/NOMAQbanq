"use client"

import * as React from "react"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { GenericNavUser } from "@/components/shared/generic-nav-user"
import { SiteHeader } from "@/components/shared/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { adminNavigation, dashboardNavigation } from "@/constants"
import { cn } from "@/lib/utils"

type DashboardShellProps = {
  children: React.ReactNode
  variant: "admin" | "user"
}

export const DashboardShell = ({ children, variant }: DashboardShellProps) => {
  const isAdmin = variant === "admin"
  const navigation = isAdmin ? adminNavigation : dashboardNavigation
  const homeUrl = isAdmin ? "/admin" : "/dashboard"

  return (
    <SidebarProvider
      data-dashboard-mode={variant}
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
        isAdmin={isAdmin}
        userComponent={
          <GenericNavUser requireAdmin={isAdmin} redirectUrl="/" />
        }
      />
      <SidebarInset className={cn(isAdmin ? "admin-theme-bg" : "theme-bg")}>
        <SiteHeader isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="@container/main flex flex-1 flex-col gap-4 overflow-auto p-4 md:gap-6 md:p-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
