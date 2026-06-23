import { useMemo, useState, type ReactNode } from 'react'
import { CompactModeContext } from './useCompactMode'

export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false)
  const value = useMemo(() => ({ compact, setCompact }), [compact])
  return <CompactModeContext.Provider value={value}>{children}</CompactModeContext.Provider>
}
