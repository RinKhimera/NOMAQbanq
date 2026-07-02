import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccessStatus } from "@/features/payments/dal"
import { PaymentSuccessContent } from "../_components/payment-success-client"

const LoadingFallback = () => (
  <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
    <div className="text-center">
      <Skeleton className="mx-auto mb-8 h-24 w-24 rounded-3xl" />
      <Skeleton className="mx-auto mb-3 h-8 w-64" />
      <Skeleton className="mx-auto h-4 w-80" />
    </div>
  </div>
)

export default async function PaymentSuccessPage() {
  const accessStatus = await getAccessStatus()

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <Suspense fallback={<LoadingFallback />}>
        <PaymentSuccessContent
          accessStatus={
            accessStatus ?? { examAccess: null, trainingAccess: null }
          }
        />
      </Suspense>
    </div>
  )
}
