import type {
  Announce,
  LogEntry,
  ReticulumConfig,
  InterfaceStats,
  KVSection,
  NetworkStatus,
  NodeEntry,
  PathEntry,
} from './types'

const BASE = '/api/v1'

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function send(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  status: () => json<NetworkStatus>('/status'),
  interfaces: () => json<InterfaceStats[]>('/interfaces'),
  paths: (maxHops?: number) =>
    json<PathEntry[]>(`/paths${maxHops != null ? `?max_hops=${maxHops}` : ''}`),
  announces: (limit = 100) => json<Announce[]>(`/announces?limit=${limit}`),
  nodes: () => json<NodeEntry[]>('/nodes'),
  logs: (limit = 500) => json<LogEntry[]>(`/logs?limit=${limit}`),
  getLoglevel: () => json<{ loglevel: number }>('/loglevel'),
  setLoglevel: (level: number) => send('POST', `/loglevel/${level}`),

  config: () => json<ReticulumConfig>('/config'),
  saveGeneral: (section: string, keys: KVSection) =>
    send('PUT', `/config/general/${encodeURIComponent(section)}`, { keys }),
  saveInterface: (name: string, keys: KVSection) =>
    send('PUT', `/config/interfaces/${encodeURIComponent(name)}`, { keys }),
  addInterface: (name: string, type: string) =>
    send('POST', '/config/interfaces', { name, type }),
  deleteInterface: (name: string) =>
    send('DELETE', `/config/interfaces/${encodeURIComponent(name)}`),
  restart: () => send('POST', '/restart'),
}

export function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/v1/ws`
}
