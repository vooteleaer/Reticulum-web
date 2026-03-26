import { useEffect } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Announces from './pages/Announces'
import Config from './pages/Config'
import MapPage from './pages/Map'
import { useWebSocket } from './hooks/useWebSocket'
import { api } from './api/client'
import { setAnnounces, addAnnounce } from './store/announces'
import type { Announce } from './api/types'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 text-sm rounded transition-colors ${
          isActive
            ? 'bg-emerald-700 text-white'
            : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function GlobalListeners() {
  // Load initial history once
  useQuery({
    queryKey: ['announces-init'],
    queryFn: () => api.announces(500),
    onSuccess: (data: Announce[]) => setAnnounces(data),
    staleTime: Infinity,
  } as Parameters<typeof useQuery>[0])

  // Keep WebSocket open always
  useWebSocket((msg) => {
    if (msg.type === 'announce') {
      addAnnounce(msg.data as Announce)
    }
  })

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalListeners />
      <div className="min-h-screen flex flex-col">
        <nav className="border-b border-gray-800 bg-gray-900 px-4 py-2 flex items-center gap-6">
          <span className="text-emerald-400 font-semibold tracking-widest text-sm uppercase mr-4">
            ⬡ Reticulum
          </span>
          <NavItem to="/" label="Dashboard" />
          <NavItem to="/announces" label="Announces" />
          <NavItem to="/map" label="Map" />
          <NavItem to="/config" label="Config" />
        </nav>
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/announces" element={<Announces />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
