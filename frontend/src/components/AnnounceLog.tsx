import type { Announce } from '../api/types'
import { formatHash } from '../utils/format'

interface Props {
  announces: Announce[]
}

export default function AnnounceLog({ announces }: Props) {
  return (
    <div className="space-y-px">
      {announces.length === 0 && (
        <div className="text-gray-600 text-sm py-8 text-center">No announces yet</div>
      )}
      {announces
        .slice()
        .reverse()
        .map((a, i) => (
          <div
            key={`${a.hash}-${a.ts}-${i}`}
            className="flex gap-3 text-xs py-1.5 border-b border-gray-900 hover:bg-gray-800/30 px-1"
          >
            <span className="text-gray-600 shrink-0 w-20">
              {new Date(a.ts * 1000).toLocaleTimeString()}
            </span>
            <span className="text-emerald-400 shrink-0 font-mono">{formatHash(a.hash)}</span>
            <span className="text-gray-300 truncate">{a.app_data ?? '—'}</span>
          </div>
        ))}
    </div>
  )
}
