import { createContext, useContext } from 'react'

export interface CompactModeValue {
  compact: boolean
  setCompact: (v: boolean) => void
}

export const CompactModeContext = createContext<CompactModeValue>({
  compact: false,
  setCompact: () => {},
})

export function useCompactMode(): CompactModeValue {
  return useContext(CompactModeContext)
}
