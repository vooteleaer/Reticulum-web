import { useEffect, useState } from 'react'
import type { Announce } from '../api/types'
import { getAnnounces, subscribe } from '../store/announces'
import AnnounceLog from '../components/AnnounceLog'

export default function Announces() {
  const [announces, setLocal] = useState<Announce[]>(getAnnounces)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (paused) return
    return subscribe(setLocal)
  }, [paused])

  const filtered = filter
    ? announces.filter(
        (a) =>
          a.hash.includes(filter.toLowerCase()) ||
          (a.app_data ?? '').toLowerCase().includes(filter.toLowerCase()),
      )
    : announces

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
          Announce Monitor
        </h1>
        <span className="text-xs text-gray-600">
          {announces.length} received
        </span>
        <button
          onClick={() => setPaused(!paused)}
          className={`ml-auto text-xs px-3 py-1 rounded border transition-colors ${
            paused
              ? 'border-yellow-600 text-yellow-400 hover:bg-yellow-900/20'
              : 'border-gray-700 text-gray-400 hover:bg-gray-800'
          }`}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by hash or app_data…"
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-600"
      />

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 max-h-[70vh] overflow-y-auto">
        <AnnounceLog announces={filtered} />
      </div>
    </div>
  )
}
