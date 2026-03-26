/**
 * Uniform node type classification and color scheme used across
 * Announces, Path Table, and Map pages.
 */

export type NodeType = 'ours' | 'transport' | 'named' | 'data' | 'path-only' | 'unknown'

export const NODE_TYPE_COLOR: Record<NodeType, string> = {
  ours:        '#34d399', // emerald  — our own node
  transport:   '#f59e0b', // amber    — routing-only, never announces
  named:       '#38bdf8', // sky blue — LXMF / NomadNetwork node with readable name
  data:        '#8b5cf6', // violet   — binary app_data (Sideband, hubs, etc.)
  'path-only': '#94a3b8', // slate    — in path table, never seen announcing
  unknown:     '#6b7280', // gray     — no useful data
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  ours:        'Our node',
  transport:   'Transport',
  named:       'Named node',
  data:        'Data node',
  'path-only': 'Path-only',
  unknown:     'Unknown',
}

/** Returns true if the string looks like lowercase hex with even length (binary encoded as hex). */
function looksLikeHex(s: string): boolean {
  return s.length % 2 === 0 && /^[0-9a-f]+$/.test(s)
}

/** Classify a node based on its announce app_data. */
export function announceNodeType(appData: string | null | undefined): NodeType {
  if (!appData) return 'unknown'
  if (looksLikeHex(appData)) return 'data'
  return 'named'
}

/** Classify a path-table-only entry (no announce seen). */
export function pathNodeType(isTransport: boolean): NodeType {
  return isTransport ? 'transport' : 'path-only'
}
