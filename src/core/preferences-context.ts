import { createContext, useContext } from 'react'
import type { AppPreferences } from './app-preferences'

export interface PreferencesContextValue {
  preferences: AppPreferences
  updatePreferences: (value: AppPreferences) => Promise<void>
  lockApp: () => void
  verifyAccess: (pin: string) => Promise<{ ok: boolean; wiped: boolean }>
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function useAppPreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('Chưa mở cài đặt ứng dụng.')
  return value
}
