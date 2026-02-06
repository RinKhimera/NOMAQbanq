import { Skeleton } from "@/components/ui/skeleton"

export const ProfileSkeleton = () => {
  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header skeleton */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-linear-to-br from-blue-50/80 via-indigo-50/50 to-violet-50/80 p-6 shadow-sm dark:border-gray-800 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-violet-950/30 md:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Skeleton className="h-32 w-32 rounded-2xl sm:h-36 sm:w-36" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <Skeleton className="mx-auto h-8 w-48 sm:mx-0" />
            <Skeleton className="mx-auto h-5 w-32 sm:mx-0" />
            <Skeleton className="mx-auto h-5 w-56 sm:mx-0" />
            <div className="flex justify-center gap-2 pt-2 sm:justify-start">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Personal info skeleton */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other sections skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
