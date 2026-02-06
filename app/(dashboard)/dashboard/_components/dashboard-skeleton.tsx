"use client"

import { cn } from "@/lib/utils"

const SkeletonPulse = ({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) => (
  <div
    className={cn(
      "animate-pulse rounded-xl bg-linear-to-r from-blue-100 via-blue-50 to-blue-100 dark:from-blue-900/20 dark:via-blue-800/10 dark:to-blue-900/20",
      className
    )}
    style={style}
  />
)

export const DashboardSkeleton = () => {
  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      {/* Hero Skeleton */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-50 via-white to-indigo-50 p-8 dark:from-blue-950/50 dark:via-gray-900 dark:to-indigo-950/50">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          {/* Left - Greeting */}
          <div className="flex flex-col gap-3 text-center lg:text-left">
            <SkeletonPulse className="mx-auto h-8 w-48 lg:mx-0" />
            <SkeletonPulse className="mx-auto h-5 w-64 lg:mx-0" />
          </div>

          {/* Center - Score Ring */}
          <div className="relative flex items-center justify-center">
            <SkeletonPulse className="h-40 w-40 rounded-full" />
          </div>

          {/* Right - Access Status */}
          <div className="flex flex-col gap-3">
            <SkeletonPulse className="h-16 w-48 rounded-2xl" />
            <SkeletonPulse className="h-16 w-48 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vital Cards */}
        <div className="space-y-4">
          <SkeletonPulse className="h-6 w-40" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonPulse
                key={i}
                className="h-32 rounded-2xl"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="space-y-4">
          <SkeletonPulse className="h-6 w-48" />
          <SkeletonPulse className="h-64 rounded-2xl" />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Actions */}
        <div className="space-y-4">
          <SkeletonPulse className="h-6 w-40" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonPulse
                key={i}
                className="h-20 rounded-2xl"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="space-y-4">
          <SkeletonPulse className="h-6 w-40" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonPulse
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
        <SkeletonPulse className="h-6 w-32" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonPulse
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
