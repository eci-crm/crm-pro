import { create } from 'zustand'

interface UserData {
  id: string
  name: string
  email: string
  role: string
}

interface CrmState {
  currentPage: string
  setCurrentPage: (page: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  user: UserData | null
  setUser: (user: UserData | null) => void
  isAuthenticated: boolean
}

function getInitialUser(): UserData | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('crm_user')
    if (stored) {
      return JSON.parse(stored) as UserData
    }
  } catch {
    // ignore parse errors
  }
  return null
}

export const useCrmStore = create<CrmState>((set) => ({
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  user: getInitialUser(),
  setUser: (user) => {
    if (user) {
      localStorage.setItem('crm_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('crm_user')
    }
    set({ user, isAuthenticated: user !== null })
  },
  isAuthenticated: getInitialUser() !== null,
}))
