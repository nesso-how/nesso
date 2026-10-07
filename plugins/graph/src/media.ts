import { useEffect, useState } from 'react'

export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const list = window.matchMedia('(max-width: 767px)')
    const update = () => setCompact(list.matches)
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [])
  return compact
}
