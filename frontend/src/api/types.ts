export interface InterfaceStats {
  name: string
  short_name?: string
  hash?: string
  type?: string
  rxb: number
  txb: number
  rxs?: number
  txs?: number
  status: boolean
  mode?: number
  bitrate?: number
  announce_queue?: number
  held_announces?: number
  incoming_announce_frequency?: number
  outgoing_announce_frequency?: number
  clients?: number
  // RNode/LoRa
  airtime_short?: number
  airtime_long?: number
  channel_load_short?: number
  channel_load_long?: number
  noise_floor?: number
  battery_state?: number
  battery_percent?: number
  // I2P
  i2p_connectable?: boolean
  i2p_b32?: string
  tunnelstate?: string
}

export interface NetworkStatus {
  transport_id?: string
  network_id?: string
  transport_uptime?: number
  instance_uptime?: number
  rxb: number
  txb: number
  rxs?: number
  txs?: number
  rss?: number
  link_count: number
}

export interface PathEntry {
  hash: string
  hops: number
  via?: string
  interface?: string
  expires?: number
}

export interface Announce {
  ts: number
  hash: string
  identity?: string
  app_data?: string
}

export interface NodeEntry {
  hash: string
  name?: string
  lat: number
  lon: number
  alt?: number
  ts: number
  app_data?: string
}

export interface LogEntry {
  ts: number
  msg: string
}

export type KVSection = Record<string, string>

export interface ReticulumConfig {
  path: string
  general: Record<string, KVSection>
  interfaces: Record<string, KVSection>
}
