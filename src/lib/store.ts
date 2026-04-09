import { create } from 'zustand'

interface CrmState {
  currentPage: string
  setCurrentPage: (page: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useCrmStore = create<CrmState>((set) => ({
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
