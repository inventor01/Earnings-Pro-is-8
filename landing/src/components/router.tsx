import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type MouseEvent,
} from 'react'

interface RouterValue {
  path: string
  navigate: (to: string) => void
}

const RouterContext = createContext<RouterValue>({ path: '/', navigate: () => {} })

function isExternal(to: string) {
  return (
    to.startsWith('http') ||
    to.startsWith('mailto:') ||
    to.startsWith('tel:') ||
    to.includes('://')
  )
}

// Scroll to an element by id, retrying across a handful of animation frames so
// it still works when the target section hasn't mounted yet (cross-page jumps).
function scrollToId(id: string, attempts = 30) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  if (attempts > 0) {
    requestAnimationFrame(() => scrollToId(id, attempts - 1))
  }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback(
    (to: string) => {
      if (isExternal(to)) {
        window.location.href = to
        return
      }
      // Pure anchor on the current page — scroll, don't change route.
      if (to.startsWith('#')) {
        const id = to.slice(1)
        window.setTimeout(
          () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          0,
        )
        return
      }
      const [rawPath, hash] = to.split('#')
      const targetPath = rawPath || '/'
      const samePage = targetPath === window.location.pathname

      if (!samePage) {
        window.history.pushState({}, '', to)
        setPath(targetPath)
      }

      if (hash) {
        const scroll = () =>
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Wait a tick when the page itself changed so the target exists.
        window.setTimeout(scroll, samePage ? 0 : 70)
      } else {
        window.scrollTo({ top: 0, behavior: samePage ? 'auto' : 'auto' })
      }
    },
    [],
  )

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}

export function useRouter() {
  return useContext(RouterContext)
}

interface LinkProps {
  to: string
  children: ReactNode
  className?: string
  'aria-label'?: string
  onClick?: () => void
}

export function Link({ to, children, className, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter()
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isExternal(to) || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    onClick?.()
    navigate(to)
  }
  return (
    <a href={to} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  )
}
