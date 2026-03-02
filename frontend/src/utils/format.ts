export function formatBytes(b: number): string {
  if (b == null) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(2)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

export function formatSpeed(bps: number): string {
  if (bps == null) return '—'
  if (bps < 1000) return `${bps.toFixed(0)} bps`
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(1)} Kbps`
  return `${(bps / 1_000_000).toFixed(2)} Mbps`
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Show first 8 chars of a hex hash, ellipsis, last 4 */
export function formatHash(hex: string): string {
  if (!hex || hex.length <= 14) return hex
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`
}
