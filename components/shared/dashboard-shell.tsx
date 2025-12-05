"use client"

import * as React from "react"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { GenericNavUser } from "@/components/shared/generic-nav-user"
import { SiteHeader } from "@/components/shared/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { adminNavigation, dashboardNavigation } from "@/constants"

type DashboardShellProps = {
  children: React.ReactNode
  variant: "admin" | "user"
}

export const DashboardShell = ({ children, variant }: DashboardShellProps) => {
  const isAdmin = variant === "admin"
  const navigation = isAdmin ? adminNavigation : dashboardNavigation
  const homeUrl = isAdmin ? "/admin" : "/dashboard"
  const themeClass = isAdmin ? "admin-theme-bg" : "theme-bg"

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
          <GenericNavUser requireAdmin={isAdmin} redirectUrl="/" />
        }
      />
      <SidebarInset className={themeClass}>
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
