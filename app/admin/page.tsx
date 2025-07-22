import QuestionForm from "@/components/QuestionForm"

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Administration
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Gestion des questions pour NOMAQbank
          </p>
        </div>

        <QuestionForm />
      </div>
    </div>
  )
}
