import { UserProfile } from "@clerk/nextjs"

const AdminAccountPage = () => {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-600">
          Paramètres du compte et de sécurité
        </h1>
        <p className="text-muted-foreground">
          Gérez votre sécurité et paramètres de compte
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <UserProfile
          appearance={{
            elements: {
              card: "shadow-lg border-0",
            },
          }}
        />
      </div>
    </div>
  )
}

export default AdminAccountPage
