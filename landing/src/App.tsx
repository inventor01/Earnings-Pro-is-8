import { RouterProvider, useRouter } from './components/router'
import LandingPage from './pages/LandingPage'
import UpgradePage from './pages/UpgradePage'

function Routes() {
  const { path } = useRouter()
  if (path.replace(/\/$/, '') === '/upgrade') return <UpgradePage />
  return <LandingPage />
}

export default function App() {
  return (
    <RouterProvider>
      <Routes />
    </RouterProvider>
  )
}
