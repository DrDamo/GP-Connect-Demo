import { createContext, useContext } from 'react'

interface GuideNavValue {
  openGuide: (guideFile: string, anchor: string) => void
}

const GuideNavContext = createContext<GuideNavValue | null>(null)

export function GuideNavProvider({ value, children }: { value: GuideNavValue; children: React.ReactNode }) {
  return <GuideNavContext.Provider value={value}>{children}</GuideNavContext.Provider>
}

export function useGuideNav() {
  return useContext(GuideNavContext)
}
