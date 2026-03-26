import type { Announce } from '../api/types'

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
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-emerald-400 font-mono break-all">{a.hash}</span>
              {a.identity && (
                <span className="text-gray-500 font-mono break-all">{a.identity}</span>
              )}
            </div>
            <span className="text-gray-300 truncate shrink-0 max-w-[30%]">{a.app_data ?? '—'}</span>
          </div>
        ))}
    </div>
  )
}
