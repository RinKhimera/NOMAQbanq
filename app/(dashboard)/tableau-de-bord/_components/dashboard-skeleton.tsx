"use client"

import { Skeleton } from "@/components/ui/skeleton"

export const DashboardSkeleton = () => {
  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      {/* Hero Skeleton */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-50 via-white to-indigo-50 p-8 dark:from-blue-950/50 dark:via-gray-900 dark:to-indigo-950/50">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          {/* Left - Greeting */}
          <div className="flex flex-col gap-3 text-center lg:text-left">
            <Skeleton className="mx-auto h-8 w-48 rounded-xl lg:mx-0" />
            <Skeleton className="mx-auto h-5 w-64 rounded-xl lg:mx-0" />
          </div>

          {/* Center - Score Ring */}
          <div className="relative flex items-center justify-center">
            <Skeleton className="h-40 w-40 rounded-full rounded-xl" />
          </div>

          {/* Right - Access Status */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-48 rounded-2xl rounded-xl" />
            <Skeleton className="h-16 w-48 rounded-2xl rounded-xl" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vital Cards */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className="h-32 rounded-2xl"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded-xl" />
          <Skeleton className="h-64 rounded-2xl rounded-xl" />
        </div>
      </div>

      {/* Domain Mastery */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48 rounded-xl" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              className="h-16 rounded-xl"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Actions */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="h-20 rounded-2xl"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="h-16 rounded-xl"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-36 rounded-2xl"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
