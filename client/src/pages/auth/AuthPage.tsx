import { useParams } from "react-router-dom"
import { AuthView } from "@daveyplate/better-auth-ui"

export default function AuthPage() {
  const { pathname } = useParams()

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <AuthView
        pathname={pathname}
        classNames={{ base: "bg-black/10 ring ring-indigo-900" }}
      />
    </main>
  )
}
