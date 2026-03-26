import type { Announce } from '../api/types'
import { announceNodeType, NODE_TYPE_COLOR, NODE_TYPE_LABEL } from '../utils/nodeType'

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
        .map((a, i) => {
          const type = announceNodeType(a.app_data)
          const color = NODE_TYPE_COLOR[type]
          return (
            <div
              key={`${a.hash}-${a.ts}-${i}`}
              className="flex gap-3 text-xs py-1.5 border-b border-gray-900 hover:bg-gray-800/30 px-1"
            >
              <span className="text-gray-600 shrink-0 w-20">
                {new Date(a.ts * 1000).toLocaleTimeString()}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-mono break-all" style={{ color }}>{a.hash}</span>
                {a.identity && (
                  <span className="text-gray-500 font-mono break-all">{a.identity}</span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="text-gray-300 truncate max-w-[200px]">{a.app_data ?? '—'}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ color, border: `1px solid ${color}44`, background: `${color}11` }}
                >
                  {NODE_TYPE_LABEL[type]}
                </span>
              </div>
            </div>
          )
        })}
    </div>
  )
}
