import { useState } from 'react'
import type { PathEntry } from '../api/types'
import { getAnnounceMap } from '../store/announces'
import { announceNodeType, pathNodeType, NODE_TYPE_COLOR, NODE_TYPE_LABEL } from '../utils/nodeType'

interface Props {
  paths: PathEntry[]
}

export default function PathTable({ paths }: Props) {
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<'hops' | 'hash' | 'expires'>('hops')
  const [asc, setAsc] = useState(true)

  const announceMap = getAnnounceMap()

  const filtered = paths
    .filter(
      (p) =>
        !filter ||
        p.hash.includes(filter.toLowerCase()) ||
        (p.interface ?? '').toLowerCase().includes(filter.toLowerCase()),
    )
    .sort((a, b) => {
      let cmp = 0
      if (sort === 'hops') cmp = a.hops - b.hops
      else if (sort === 'hash') cmp = a.hash.localeCompare(b.hash)
      else if (sort === 'expires') cmp = (a.expires ?? 0) - (b.expires ?? 0)
      return asc ? cmp : -cmp
    })

  function toggleSort(col: typeof sort) {
    if (sort === col) setAsc(!asc)
    else { setSort(col); setAsc(true) }
  }

  const SortBtn = ({ col, label }: { col: typeof sort; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 hover:text-gray-100 transition-colors"
    >
      {label}
      <span className="text-gray-600">{sort === col ? (asc ? '▲' : '▼') : '⇅'}</span>
    </button>
  )

  return (
    <div>
      <div className="flex gap-3 mb-3 items-center">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by hash or interface…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-600"
        />
        <span className="text-xs text-gray-500">{filtered.length} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-2 pr-4 font-normal">
                <SortBtn col="hash" label="Destination" />
              </th>
              <th className="text-left py-2 pr-4 font-normal">Type</th>
              <th className="text-left py-2 pr-4 font-normal">
                <SortBtn col="hops" label="Hops" />
              </th>
              <th className="text-left py-2 pr-4 font-normal">Via</th>
              <th className="text-left py-2 pr-4 font-normal">Interface</th>
              <th className="text-left py-2 font-normal">
                <SortBtn col="expires" label="Expires" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const announce = announceMap.get(p.hash)
              const type = announce ? announceNodeType(announce.app_data) : pathNodeType(false)
              const color = NODE_TYPE_COLOR[type]
              return (
                <tr
                  key={p.hash}
                  className="border-b border-gray-900 hover:bg-gray-800/40 transition-colors"
                >
                  <td className="py-1.5 pr-4 font-mono break-all" style={{ color }}>{p.hash}</td>
                  <td className="py-1.5 pr-4">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
                      style={{ color, border: `1px solid ${color}44`, background: `${color}11` }}
                    >
                      {NODE_TYPE_LABEL[type]}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        p.hops === 1
                          ? 'bg-emerald-900 text-emerald-300'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {p.hops}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-gray-500 break-all">{p.via ?? '—'}</td>
                  <td className="py-1.5 pr-4 text-gray-400">{p.interface ?? '—'}</td>
                  <td className="py-1.5 text-gray-500">
                    {p.expires ? new Date(p.expires * 1000).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-600">
                  No paths found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
