import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { InterfaceStats, NetworkStatus } from '../api/types'
import { useWebSocket } from '../hooks/useWebSocket'
import InterfaceCard from '../components/InterfaceCard'
import PathTable from '../components/PathTable'
import { formatBytes, formatSpeed, formatUptime } from '../utils/format'

export default function Dashboard() {
  const [liveStats, setLiveStats] = useState<NetworkStatus | null>(null)
  const [liveInterfaces, setLiveInterfaces] = useState<InterfaceStats[] | null>(null)

  const statusQ = useQuery({ queryKey: ['status'], queryFn: api.status, retry: 1 })
  const ifacesQ = useQuery({ queryKey: ['interfaces'], queryFn: api.interfaces, retry: 1 })
  const pathsQ = useQuery({ queryKey: ['paths'], queryFn: () => api.paths(), retry: 1 })

  const wsConnected = useWebSocket((msg) => {
    if (msg.type === 'stats') {
      const d = msg.data as NetworkStatus & { interfaces: InterfaceStats[] }
      setLiveStats(d)
      if (d.interfaces) setLiveInterfaces(d.interfaces)
    }
  })

  const status = liveStats ?? statusQ.data
  const interfaces = liveInterfaces ?? ifacesQ.data ?? []

  return (
    <div className="space-y-8">
      {/* Transport summary */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Transport
          </h2>
          <div
            className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-yellow-500'}`}
            title={wsConnected ? 'Live' : 'Polling'}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Uptime"
            value={formatUptime(status?.transport_uptime ?? status?.instance_uptime)}
          />
          <StatCard label="Links" value={status?.link_count != null ? String(status.link_count) : '—'} />
          <StatCard label="RX total" value={status?.rxb != null ? formatBytes(status.rxb) : '—'} />
          <StatCard label="TX total" value={status?.txb != null ? formatBytes(status.txb) : '—'} />
          <StatCard label="RX rate" value={status?.rxs != null ? formatSpeed(status.rxs) : '—'} />
          <StatCard label="TX rate" value={status?.txs != null ? formatSpeed(status.txs) : '—'} />
        </div>
        {status?.transport_id && (
          <div className="mt-2 text-[11px] text-gray-600">
            ID: <span className="text-gray-400">{status.transport_id}</span>
          </div>
        )}
      </section>

      {/* Interfaces */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Interfaces ({interfaces.length})
        </h2>
        {ifacesQ.isLoading && !interfaces.length ? (
          <div className="text-gray-600 text-sm">Loading…</div>
        ) : ifacesQ.isError ? (
          <div className="text-red-400 text-xs font-mono bg-gray-900 rounded p-3">
            {String(ifacesQ.error)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {interfaces.map((iface) => (
              <InterfaceCard key={iface.hash ?? iface.name} iface={iface} />
            ))}
          </div>
        )}
      </section>

      {/* Path table */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Path Table ({pathsQ.data?.length ?? 0})
        </h2>
        {pathsQ.isLoading ? (
          <div className="text-gray-600 text-sm">Loading…</div>
        ) : pathsQ.isError ? (
          <div className="text-red-400 text-xs font-mono bg-gray-900 rounded p-3">
            {String(pathsQ.error)}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <PathTable paths={pathsQ.data ?? []} />
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-semibold text-gray-100">{value}</div>
    </div>
  )
}
