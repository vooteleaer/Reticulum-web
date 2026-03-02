import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import type { KVSection } from '../api/types'

const INTERFACE_TYPES = [
  'AutoInterface',
  'TCPClientInterface',
  'TCPServerInterface',
  'UDPInterface',
  'RNodeInterface',
  'I2PInterface',
  'LocalInterface',
]

// ---------------------------------------------------------------------------
// Restart polling — wait until backend responds again
// ---------------------------------------------------------------------------
async function waitForBackend(maxMs = 30000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const res = await fetch('/api/v1/status')
      if (res.ok) return
    } catch {}
  }
  throw new Error('Backend did not come back online')
}

// ---------------------------------------------------------------------------
// Add interface modal
// ---------------------------------------------------------------------------
function AddInterfaceModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, type: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState(INTERFACE_TYPES[0])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 space-y-4">
        <h2 className="text-sm font-semibold text-gray-200">Add Interface</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MyTCPInterface"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-600"
            >
              {INTERFACE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => { if (name.trim()) onAdd(name.trim(), type) }}
            className="text-xs px-3 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log viewer — shown when "logging" general section is selected
// ---------------------------------------------------------------------------

const LOG_LEVELS = [
  { level: 0, name: 'CRITICAL' },
  { level: 1, name: 'ERROR' },
  { level: 2, name: 'WARNING' },
  { level: 3, name: 'NOTICE' },
  { level: 4, name: 'INFO' },
  { level: 5, name: 'VERBOSE' },
  { level: 6, name: 'DEBUG' },
  { level: 7, name: 'EXTREME' },
] as const

function logLineColor(msg: string): string {
  if (msg.includes('[Critical]') || msg.includes('[Error]'))   return 'text-red-400'
  if (msg.includes('[Warning]'))                               return 'text-yellow-400'
  if (msg.includes('[Notice]'))                                return 'text-gray-200'
  if (msg.includes('[Info]'))                                  return 'text-blue-300'
  if (msg.includes('[Verbose]'))                               return 'text-gray-400'
  if (msg.includes('[Debug]') || msg.includes('[Extreme]'))    return 'text-gray-600'
  return 'text-gray-400'
}

function LogViewer({
  title,
  original,
  onSaveRestart,
}: {
  title: string
  original: KVSection
  onSaveRestart: (keys: KVSection) => Promise<void>
}) {
  const qc = useQueryClient()
  const [keys, setKeys] = useState<KVSection>({ ...original })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const logsQ = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.logs(),
    refetchInterval: 2000,
    retry: 1,
  })

  const levelQ = useQuery({
    queryKey: ['loglevel'],
    queryFn: () => api.getLoglevel(),
    refetchInterval: 5000,
  })

  const setLevelMut = useMutation({
    mutationFn: (level: number) => api.setLoglevel(level),
    onSuccess: (_data, level) => {
      qc.setQueryData(['loglevel'], { loglevel: level })
      setKeys((prev) => ({ ...prev, loglevel: String(level) }))
    },
  })

  const currentLevel = levelQ.data?.loglevel ?? parseInt(keys.loglevel ?? '3', 10)

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logsQ.data, autoScroll])

  const dirty = JSON.stringify(keys) !== JSON.stringify(original)

  async function handleSave() {
    setSaveStatus('saving')
    setErrMsg('')
    try {
      await onSaveRestart(keys)
      setSaveStatus('done')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (e) {
      setErrMsg(String(e))
      setSaveStatus('error')
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-200 flex-1">{title}</h2>
          {saveStatus === 'error' && (
            <span className="text-xs text-red-400 truncate max-w-xs">{errMsg}</span>
          )}
          <button
            disabled={!dirty || saveStatus === 'saving'}
            onClick={handleSave}
            className="text-xs px-4 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed min-w-[120px] text-center"
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'done' ? 'Done ✓' : 'Save & Restart'}
          </button>
        </div>

        {/* Log level buttons */}
        <div className="pb-3 border-b border-gray-800">
          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1.5">Log level</div>
          <div className="flex flex-wrap gap-1">
            {LOG_LEVELS.map(({ level, name }) => {
              const active = currentLevel === level
              return (
                <button
                  key={level}
                  onClick={() => setLevelMut.mutate(level)}
                  disabled={setLevelMut.isPending}
                  title={`Level ${level}`}
                  className={`text-xs px-2.5 py-1 rounded border font-mono transition-colors ${
                    active
                      ? 'bg-emerald-900/60 border-emerald-700 text-emerald-300'
                      : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
          <div className="text-[10px] text-gray-700 mt-1.5">
            Applied immediately · persisted on Save &amp; Restart
          </div>
        </div>
      </div>

      {/* Log output */}
      <div
        className="flex-1 overflow-y-auto font-mono text-xs bg-black/40 rounded-lg p-3 space-y-0.5"
        onScroll={(e) => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          setAutoScroll(atBottom)
        }}
      >
        {logsQ.isLoading && (
          <div className="text-gray-600">Loading logs…</div>
        )}
        {logsQ.data?.length === 0 && !logsQ.isLoading && (
          <div className="text-gray-700">No log entries yet.</div>
        )}
        {logsQ.data?.map((entry, i) => (
          <div key={i} className={logLineColor(entry.msg)}>
            <span className="text-gray-700 mr-2 select-none">
              {new Date(entry.ts * 1000).toLocaleTimeString()}
            </span>
            {entry.msg}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="shrink-0 text-xs text-emerald-500 hover:text-emerald-300 text-center"
        >
          ↓ Scroll to latest
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Key-value editor panel (right side)
// ---------------------------------------------------------------------------
function KVEditor({
  title,
  original,
  onSaveRestart,
  onDelete,
}: {
  title: string
  original: KVSection
  onSaveRestart: (keys: KVSection) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [keys, setKeys] = useState<KVSection>({ ...original })
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'restarting' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    setKeys({ ...original })
    setStatus('idle')
    setErrMsg('')
  }, [title]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(keys) !== JSON.stringify(original)
  const busy = status === 'saving' || status === 'restarting'

  function setValue(k: string, v: string) {
    setKeys((prev) => ({ ...prev, [k]: v }))
  }

  function removeKey(k: string) {
    setKeys((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  function addKey() {
    if (!newKey.trim()) return
    setKeys((prev) => ({ ...prev, [newKey.trim()]: newVal }))
    setNewKey('')
    setNewVal('')
  }

  async function handleSave() {
    setStatus('saving')
    setErrMsg('')
    try {
      await onSaveRestart(keys)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (e) {
      setErrMsg(String(e))
      setStatus('error')
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setStatus('saving')
    try {
      await onDelete()
    } catch (e) {
      setErrMsg(String(e))
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <h2 className="text-sm font-semibold text-gray-200 flex-1 truncate">{title}</h2>
        {status === 'error' && (
          <span className="text-xs text-red-400 truncate max-w-xs">{errMsg}</span>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-xs px-3 py-1 rounded border border-red-800 text-red-400 hover:bg-red-900/30 disabled:opacity-40"
          >
            Remove
          </button>
        )}
        <button
          disabled={!dirty || busy}
          onClick={handleSave}
          className="text-xs px-4 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed min-w-[120px] text-center"
        >
          {status === 'saving'    ? 'Saving…'
           : status === 'restarting' ? 'Restarting…'
           : status === 'done'    ? 'Done ✓'
           : 'Save & Restart'}
        </button>
      </div>

      {/* Key-value rows */}
      <div className="overflow-y-auto flex-1 space-y-1">
        {Object.entries(keys).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 group">
            <span className="text-xs text-gray-500 w-44 shrink-0 truncate" title={k}>{k}</span>
            <input
              value={v}
              onChange={(e) => setValue(k, e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-emerald-600"
            />
            <button
              onClick={() => removeKey(k)}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs w-5 transition-opacity shrink-0"
              title="Remove key"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add key row */}
      <div className="flex gap-2 mt-4 shrink-0 pt-3 border-t border-gray-800">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="key"
          onKeyDown={(e) => e.key === 'Enter' && addKey()}
          className="w-44 shrink-0 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-500 placeholder-gray-700 focus:outline-none focus:border-gray-600"
        />
        <input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          placeholder="value"
          onKeyDown={(e) => e.key === 'Enter' && addKey()}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-500 placeholder-gray-700 focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={addKey}
          disabled={!newKey.trim()}
          className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-30 shrink-0"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Config page
// ---------------------------------------------------------------------------
type Selection =
  | { kind: 'interface'; name: string }
  | { kind: 'general'; name: string }
  | null

export default function Config() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['config'],
    queryFn: api.config,
    retry: 1,
  })
  const [selected, setSelected] = useState<Selection>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Auto-select first interface on load
  useEffect(() => {
    if (!data || selected) return
    const firstIface = Object.keys(data.interfaces)[0]
    if (firstIface) { setSelected({ kind: 'interface', name: firstIface }); return }
    const firstGen = Object.keys(data.general)[0]
    if (firstGen) setSelected({ kind: 'general', name: firstGen })
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAndRestart(saveFn: () => Promise<unknown>) {
    await saveFn()
    await api.restart()
    await waitForBackend()
    qc.invalidateQueries({ queryKey: ['config'] })
  }

  async function handleDelete(name: string) {
    await api.deleteInterface(name)
    setSelected(null)
    await api.restart()
    await waitForBackend()
    qc.invalidateQueries({ queryKey: ['config'] })
  }

  async function handleAdd(name: string, type: string) {
    setShowAdd(false)
    await api.addInterface(name, type)
    qc.invalidateQueries({ queryKey: ['config'] })
    setSelected({ kind: 'interface', name })
  }

  if (isLoading) return <div className="text-gray-600 text-sm">Loading config…</div>
  if (isError || !data) return (
    <div className="space-y-3 max-w-lg">
      <div className="text-red-400 text-sm">Failed to load config</div>
      <div className="text-xs text-gray-600 font-mono bg-gray-900 rounded p-3 break-all">
        {String(error ?? 'No data returned')}
      </div>
      <p className="text-xs text-gray-500">
        Make sure the backend is running and has restarted after the last code change.
      </p>
      <button
        onClick={() => refetch()}
        className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:bg-gray-800"
      >
        Retry
      </button>
    </div>
  )

  const selKeys =
    selected?.kind === 'interface' ? data.interfaces[selected.name]
    : selected?.kind === 'general' ? data.general[selected.name]
    : null

  const isLoggingSection = selected?.kind === 'general' && selected.name === 'logging'

  return (
    <>
      {showAdd && (
        <AddInterfaceModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}

      <div className="text-xs text-gray-600 mb-3">{data.path}</div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 10rem)' }}>
        {/* ── Left sidebar ── */}
        <aside className="w-52 shrink-0 flex flex-col overflow-y-auto gap-0.5">
          {/* General sections */}
          {Object.keys(data.general).length > 0 && (
            <>
              <SidebarLabel label="General" />
              {Object.keys(data.general).map((name) => (
                <SidebarItem
                  key={name}
                  label={name}
                  active={selected?.kind === 'general' && selected.name === name}
                  onClick={() => setSelected({ kind: 'general', name })}
                />
              ))}
            </>
          )}

          {/* Interfaces */}
          <div className="flex items-center justify-between pr-1 mt-3 mb-0.5">
            <SidebarLabel label="Interfaces" inline />
            <button
              onClick={() => setShowAdd(true)}
              className="text-emerald-500 hover:text-emerald-300 text-base leading-none px-1"
              title="Add interface"
            >
              +
            </button>
          </div>

          {Object.keys(data.interfaces).length === 0 && (
            <div className="text-xs text-gray-700 px-3 py-1">No interfaces defined</div>
          )}

          {Object.keys(data.interfaces).map((name) => (
            <SidebarItem
              key={name}
              label={name}
              sublabel={data.interfaces[name].type}
              active={selected?.kind === 'interface' && selected.name === name}
              onClick={() => setSelected({ kind: 'interface', name })}
            />
          ))}
        </aside>

        {/* ── Right panel ── */}
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-5 min-h-0 min-w-0">
          {selected && selKeys != null ? (
            isLoggingSection ? (
              <LogViewer
                key="logging"
                title="logging"
                original={selKeys}
                onSaveRestart={(keys) =>
                  saveAndRestart(() => api.saveGeneral('logging', keys))
                }
              />
            ) : (
              <KVEditor
                key={`${selected.kind}::${selected.name}`}
                title={selected.name}
                original={selKeys}
                onSaveRestart={(keys) =>
                  saveAndRestart(() =>
                    selected.kind === 'interface'
                      ? api.saveInterface(selected.name, keys)
                      : api.saveGeneral(selected.name, keys)
                  )
                }
                onDelete={
                  selected.kind === 'interface'
                    ? () => handleDelete(selected.name)
                    : undefined
                }
              />
            )
          ) : (
            <div className="text-gray-700 text-sm flex items-center justify-center h-full">
              Select a section on the left
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function SidebarLabel({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <div className={`text-[10px] uppercase tracking-widest text-gray-600 px-3 ${inline ? '' : 'pt-2 pb-1'}`}>
      {label}
    </div>
  )
}

function SidebarItem({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string
  sublabel?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
        active
          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800/60'
          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
      }`}
    >
      <div className="truncate">{label}</div>
      {sublabel && <div className="text-[10px] text-gray-600 truncate mt-0.5">{sublabel}</div>}
    </button>
  )
}
