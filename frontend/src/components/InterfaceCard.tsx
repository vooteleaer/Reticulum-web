import type { InterfaceStats } from '../api/types'
import { formatBytes, formatSpeed } from '../utils/format'

interface Props {
  iface: InterfaceStats
}

const MODE_LABELS: Record<number, string> = {
  1: 'Full',
  2: 'P2P',
  3: 'AP',
  4: 'Roaming',
  5: 'Boundary',
  6: 'Gateway',
}

export default function InterfaceCard({ iface }: Props) {
  const mode = iface.mode != null ? (MODE_LABELS[iface.mode] ?? `Mode ${iface.mode}`) : null

  return (
    <div
      className={`rounded-lg border p-4 bg-gray-900 transition-colors ${
        iface.status ? 'border-emerald-700' : 'border-gray-700 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-sm text-gray-100">{iface.name}</div>
          {iface.type && (
            <div className="text-xs text-gray-500 mt-0.5">{iface.type}</div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {mode && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{mode}</span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              iface.status
                ? 'bg-emerald-900 text-emerald-300'
                : 'bg-gray-800 text-gray-500'
            }`}
          >
            {iface.status ? 'online' : 'offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Stat label="RX" value={formatBytes(iface.rxb)} />
        <Stat label="TX" value={formatBytes(iface.txb)} />
        {iface.rxs != null && <Stat label="RX rate" value={formatSpeed(iface.rxs)} />}
        {iface.txs != null && <Stat label="TX rate" value={formatSpeed(iface.txs)} />}
        {iface.clients != null && <Stat label="Clients" value={String(iface.clients)} />}
        {iface.announce_queue != null && (
          <Stat label="Ann. queue" value={String(iface.announce_queue)} />
        )}
        {iface.airtime_short != null && (
          <Stat label="Airtime" value={`${iface.airtime_short.toFixed(1)}%`} />
        )}
        {iface.battery_percent != null && (
          <Stat label="Battery" value={`${iface.battery_percent}%`} />
        )}
      </div>

      {iface.hash && (
        <div className="mt-3 text-[10px] text-gray-600 truncate">
          {iface.hash}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  )
}
