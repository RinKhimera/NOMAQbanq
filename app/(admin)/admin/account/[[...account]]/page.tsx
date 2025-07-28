import { UserProfile } from "@clerk/nextjs"

const AdminAccountPage = () => {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres du profil</h1>
        <p className="text-muted-foreground">
          Gérez votre profil, sécurité et paramètres de compte
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "",
              card: "shadow-lg border-0",
            },
          }}
        />
      </div>
    </div>
  )
}

export default AdminAccountPage
