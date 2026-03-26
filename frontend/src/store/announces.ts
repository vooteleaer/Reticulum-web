/**
 * Module-level announce store — persists across component mounts/unmounts.
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
