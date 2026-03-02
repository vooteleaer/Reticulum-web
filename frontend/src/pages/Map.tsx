import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../api/client'
import type { NodeEntry } from '../api/types'
import { useWebSocket } from '../hooks/useWebSocket'
import { formatHash } from '../utils/format'

// Fix Leaflet's default marker icon path broken by Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const EMERALD_ICON = new L.DivIcon({
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#34d399;border:2px solid #065f46;
    box-shadow:0 0 6px #34d399aa;
  "></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -10],
})

function FitBounds({ nodes }: { nodes: NodeEntry[] }) {
  const map = useMap()
  useEffect(() => {
    if (nodes.length === 0) return
    const bounds = L.latLngBounds(nodes.map((n) => [n.lat, n.lon]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [nodes.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function MapPage() {
  const [nodes, setNodes] = useState<Record<string, NodeEntry>>({})

  const { data } = useQuery({
    queryKey: ['nodes'],
    queryFn: api.nodes,
    refetchInterval: 15000,
  })

  // Seed from REST on load
  useEffect(() => {
    if (!data) return
    setNodes((prev) => {
      const next = { ...prev }
      for (const n of data) next[n.hash] = n
      return next
    })
  }, [data])

  // Live updates via WebSocket
  useWebSocket((msg) => {
    if (msg.type === 'node_update') {
      const n = msg.data as NodeEntry
      setNodes((prev) => ({ ...prev, [n.hash]: n }))
    }
  })

  const nodeList = Object.values(nodes)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
          Node Map
        </h1>
        <span className="text-xs text-gray-600">
          {nodeList.length} node{nodeList.length !== 1 ? 's' : ''} with location
        </span>
      </div>

      {nodeList.length === 0 && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-3">
          Waiting for Sideband announces with GPS location. Nodes appear here as they are received.
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-gray-800" style={{ height: '70vh' }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%', background: '#111827' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds nodes={nodeList} />
          {nodeList.map((node) => (
            <Marker key={node.hash} position={[node.lat, node.lon]} icon={EMERALD_ICON}>
              <Popup>
                <div className="text-xs space-y-1 min-w-[160px]">
                  {node.name && (
                    <div className="font-semibold text-sm">{node.name}</div>
                  )}
                  <div className="font-mono text-gray-500">{formatHash(node.hash)}</div>
                  <div>
                    {node.lat.toFixed(5)}, {node.lon.toFixed(5)}
                    {node.alt != null && ` · ${node.alt.toFixed(0)} m`}
                  </div>
                  <div className="text-gray-400">
                    {new Date(node.ts * 1000).toLocaleString()}
                  </div>
                  {node.app_data && (
                    <div className="text-gray-500 truncate max-w-[200px]">{node.app_data}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
