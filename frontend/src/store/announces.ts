/**
 * Module-level announce store — persists across component mounts/unmounts.
 * Also exposes a hash→announce lookup map for type-based coloring.
 */
import type { Announce } from '../api/types'

let _announces: Announce[] = []
const _listeners = new Set<(a: Announce[]) => void>()

export function getAnnounces(): Announce[] {
  return _announces
}

export function setAnnounces(list: Announce[]): void {
  _announces = list.slice(-500)
  _listeners.forEach((fn) => fn(_announces))
}

export function addAnnounce(entry: Announce): void {
  _announces = [..._announces, entry].slice(-500)
  _listeners.forEach((fn) => fn(_announces))
}

export function subscribe(fn: (a: Announce[]) => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/** Lookup map: destination hash → most recent announce for that hash. */
export function getAnnounceMap(): Map<string, Announce> {
  const map = new Map<string, Announce>()
  for (const a of _announces) map.set(a.hash, a)
  return map
}
