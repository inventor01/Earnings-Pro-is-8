import { RouterProvider, useRouter } from './components/router'
import LandingPage from './pages/LandingPage'
import UpgradePage from './pages/UpgradePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DeleteAccountPage from './pages/DeleteAccountPage'

function Routes() {
  const { path } = useRouter()
  const clean = path.replace(/\/$/, '')
  if (clean === '/upgrade') return <UpgradePage />
  if (clean === '/reset-password') return <ResetPasswordPage />
  if (clean === '/delete-account') return <DeleteAccountPage />
  return <LandingPage />
}

export default function App() {
  return (
    <RouterProvider>
      <Routes />
    </RouterProvider>
  )
}
