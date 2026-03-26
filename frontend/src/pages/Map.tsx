import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ForceGraph2D from 'react-force-graph-2d'
import { api } from '../api/client'
import type { PathEntry, NetworkStatus } from '../api/types'
import { getAnnounceMap } from '../store/announces'
import { announceNodeType, pathNodeType, NODE_TYPE_COLOR, NODE_TYPE_LABEL } from '../utils/nodeType'

import type { NodeType } from '../utils/nodeType'

interface GraphNode {
  id: string
  hops: number
  iface?: string
  isOurs?: boolean
  isTransport?: boolean
  nodeType?: NodeType
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  iface?: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

function hopBucket(hops: number): number {
  if (hops <= 0) return 0
  if (hops === 1) return 1
  if (hops <= 3) return 2
  if (hops <= 6) return 3
  if (hops <= 10) return 4
  if (hops <= 15) return 5
  return 6
}

const RING_RADIUS = 110
const RING_LABELS = ['', '1 hop', '2–3 hops', '4–6 hops', '7–10 hops', '11–15 hops', '16+ hops']

// Custom radial force: pulls nodes toward their target ring radius
function makeRadialForce(strength = 0.6) {
  let nodes: GraphNode[] = []
  function force(alpha: number) {
    for (const n of nodes) {
      if (n.isOurs) { n.fx = 0; n.fy = 0; continue }
      const targetR = hopBucket(n.hops) * RING_RADIUS
      const x = n.x ?? 1
      const y = n.y ?? 1
      const dist = Math.sqrt(x * x + y * y) || 1
      const f = (targetR - dist) / dist * alpha * strength
      n.vx = (n.vx ?? 0) + x * f
      n.vy = (n.vy ?? 0) + y * f
    }
  }
  force.initialize = (ns: GraphNode[]) => { nodes = ns }
  return force
}

function buildGraph(ourId: string | undefined, paths: PathEntry[]): GraphData {
  const nodeMap = new Map<string, GraphNode>()
  const linkSet = new Set<string>()
  const links: GraphLink[] = []
  const announceMap = getAnnounceMap()

  const centerId = ourId ?? '__us__'
  nodeMap.set(centerId, { id: centerId, hops: 0, isOurs: true, x: 0, y: 0 })

  const destHashes = new Set(paths.map((p) => p.hash))

  function addLink(source: string, target: string, iface?: string) {
    if (source === target) return
    const key = `${source}->${target}`
    if (linkSet.has(key)) return
    linkSet.add(key)
    links.push({ source, target, iface })
  }

  let angleOffset = 0
  for (const p of paths) {
    if (!nodeMap.has(p.hash)) {
      const r = hopBucket(p.hops) * RING_RADIUS
      const angle = angleOffset++ * 2.399
      const announce = announceMap.get(p.hash)
      const nodeType = announce ? announceNodeType(announce.app_data) : pathNodeType(false)
      nodeMap.set(p.hash, {
        id: p.hash,
        hops: p.hops,
        iface: p.interface,
        nodeType,
        x: r * Math.cos(angle),
        y: r * Math.sin(angle),
      })
    }

    if (p.hops === 1) {
      addLink(centerId, p.hash, p.interface)
    } else {
      const via = p.via ?? centerId
      if (!destHashes.has(via)) {
        if (!nodeMap.has(via)) {
          nodeMap.set(via, {
            id: via,
            hops: 1,
            isTransport: true,
            nodeType: 'transport',
            iface: p.interface,
            x: RING_RADIUS,
            y: 0,
          })
        }
        addLink(centerId, via, p.interface)
      }
      addLink(via, p.hash, p.interface)
    }
  }

  return { nodes: Array.from(nodeMap.values()), links }
}

// Apply forces to the graph simulation
type ForceObj = { strength?: (s: number) => ForceObj; distance?: (d: number) => ForceObj }
function applyForces(fg: { d3Force: (name: string, f?: unknown) => unknown; d3ReheatSimulation: () => void }) {
  fg.d3Force('radial', makeRadialForce(0.7))
  const charge = fg.d3Force('charge') as ForceObj | null
  charge?.strength?.(-20)
  const link = fg.d3Force('link') as ForceObj | null
  link?.distance?.(30)
  fg.d3ReheatSimulation()
}

export default function MapPage() {
  const fgRef = useRef<{ d3Force: (n: string, f?: unknown) => unknown; d3ReheatSimulation: () => void } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const { data: status } = useQuery<NetworkStatus>({
    queryKey: ['status'],
    queryFn: api.status,
    refetchInterval: 30000,
  })

  const { data: paths } = useQuery<PathEntry[]>({
    queryKey: ['paths-topo'],
    queryFn: () => api.paths(),
    refetchInterval: 15000,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    ro.observe(el)
    setDimensions({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Reapply forces whenever data changes
  useEffect(() => {
    if (fgRef.current) applyForces(fgRef.current)
  }, [paths, status])

  const graphData = buildGraph(status?.transport_id, paths ?? [])

  // Draw ring guides on background canvas
  const onRenderFramePre = useCallback((ctx: CanvasRenderingContext2D) => {
    for (let ring = 1; ring <= 6; ring++) {
      const r = ring * RING_RADIUS
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, 2 * Math.PI)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 7])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '9px sans-serif'
      ctx.fillStyle = '#334155'
      ctx.textAlign = 'center'
      ctx.fillText(RING_LABELS[ring], 0, -(r - 6))
    }
  }, [])

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x: number; y: number }
      const color = n.isOurs ? NODE_TYPE_COLOR['ours'] : NODE_TYPE_COLOR[n.nodeType ?? 'unknown']
      const r = n.isOurs ? 9 : n.isTransport ? 7 : 5
      const isSelected = selectedNode?.id === n.id

      if (n.isOurs || isSelected) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, r + 5, 0, 2 * Math.PI)
        ctx.fillStyle = isSelected ? '#ffffff22' : '#34d39922'
        ctx.fill()
        if (isSelected) {
          ctx.strokeStyle = '#ffffff88'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      const showLabel = n.isOurs || n.isTransport || isSelected || globalScale > 3
      if (showLabel) {
        const label = n.isOurs
          ? (n.id === '__us__' ? 'Us' : n.id.slice(0, 10) + '…')
          : n.id.slice(0, 8) + '…'
        const fs = Math.max(7, (n.isOurs ? 12 : 9) / globalScale)
        ctx.font = `${fs}px monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = n.isOurs ? '#a7f3d0' : isSelected ? '#ffffff' : '#94a3b8'
        ctx.fillText(label, n.x, n.y + r + fs + 1)
      }
    },
    [selectedNode],
  )

  const linkColor = useCallback((link: object) => {
    const t = (link as GraphLink).target as GraphNode
    const color = NODE_TYPE_COLOR[t?.nodeType ?? 'unknown']
    return color + '55'
  }, [])

  const typeCounts: Partial<Record<NodeType, number>> = {}
  for (const n of graphData.nodes) {
    if (n.isOurs) continue
    const t = n.nodeType ?? 'unknown'
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
          Network Topology
        </h1>
        <span className="text-xs text-gray-600">
          {graphData.nodes.length} nodes · {graphData.links.length} links
        </span>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          {(['ours', 'transport', 'named', 'data', 'path-only', 'unknown'] as NodeType[]).map((t) => {
            const count = t === 'ours' ? 1 : (typeCounts[t] ?? 0)
            if (count === 0) return null
            return (
              <span key={t} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: NODE_TYPE_COLOR[t] }} />
                {NODE_TYPE_LABEL[t]}
                {t !== 'ours' && <span className="text-gray-700">({count})</span>}
              </span>
            )
          })}
        </div>
      </div>

      {graphData.nodes.length <= 1 && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-3 shrink-0">
          No path entries yet. Network topology will appear as paths are discovered.
        </div>
      )}

      <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-800 flex-1" style={{ minHeight: '60vh' }}>
        <ForceGraph2D
          ref={fgRef as never}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData as never}
          nodeId="id"
          nodeCanvasObject={nodeCanvasObject as never}
          nodeCanvasObjectMode={() => 'replace'}
          onRenderFramePre={onRenderFramePre as never}
          linkColor={linkColor as never}
          linkWidth={0.5}
          backgroundColor="#030712"
          nodeLabel={(node: object) => {
            const n = node as GraphNode
            return `${n.id}  (${n.hops} hop${n.hops !== 1 ? 's' : ''}${n.isTransport ? ', transport' : ''})`
          }}
          linkLabel={(link: object) => (link as GraphLink).iface ?? ''}
          enableZoomInteraction
          enablePanInteraction
          enableNodeDrag={false}
          cooldownTicks={200}
          nodePointerAreaPaint={(node: object, color: string, ctx: CanvasRenderingContext2D) => {
            const n = node as GraphNode & { x: number; y: number }
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(n.x, n.y, 14, 0, 2 * Math.PI)
            ctx.fill()
          }}
          onNodeClick={(node: object) => {
            const n = node as GraphNode
            setSelectedNode((prev) => prev?.id === n.id ? null : n)
          }}
          onBackgroundClick={() => setSelectedNode(null)}
          onEngineStop={() => {
            if (fgRef.current) {
              (fgRef.current as unknown as { zoomToFit: (ms: number, px: number) => void }).zoomToFit(400, 40)
            }
          }}
        />
      </div>

      {selectedNode && (() => {
        const pathEntry = paths?.find((p) => p.hash === selectedNode.id)
        const viaEntry = pathEntry?.via ? paths?.find((p) => p.hash === pathEntry.via) : null
        const nodeType = selectedNode.isOurs ? 'ours' : (selectedNode.nodeType ?? 'unknown')
        const typeLabel = NODE_TYPE_LABEL[nodeType]
        const color = NODE_TYPE_COLOR[nodeType]
        return (
          <div className="shrink-0 bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 uppercase tracking-wider text-[10px]">{typeLabel}</span>
              <button onClick={() => setSelectedNode(null)} className="text-gray-600 hover:text-gray-400 text-base leading-none">×</button>
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Hash</div>
              <div className="font-mono break-all" style={{ color: color }}>{selectedNode.id}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-gray-500 mb-0.5">Hops</div>
                <div className="font-mono text-gray-200">{selectedNode.hops === 0 ? '—' : selectedNode.hops}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Interface</div>
                <div className="font-mono text-gray-200">{pathEntry?.interface ?? selectedNode.iface ?? '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Via</div>
                <div className="font-mono text-gray-200 break-all">
                  {pathEntry?.via && pathEntry.via !== selectedNode.id
                    ? pathEntry.via.slice(0, 16) + '…'
                    : '— (direct)'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Expires</div>
                <div className="font-mono text-gray-200">
                  {pathEntry?.expires ? new Date(pathEntry.expires * 1000).toLocaleTimeString() : '—'}
                </div>
              </div>
            </div>
            {viaEntry && (
              <div className="text-gray-600 text-[11px]">
                Via node is itself {viaEntry.hops} hop{viaEntry.hops !== 1 ? 's' : ''} away via {viaEntry.interface ?? '—'}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
