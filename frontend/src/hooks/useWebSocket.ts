import { useEffect, useRef, useState } from 'react'
import { wsUrl } from '../api/client'

export type WsMessage = {
  type: 'stats' | 'announce'
  data: unknown
}

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const cbRef = useRef(onMessage)
  cbRef.current = onMessage

  useEffect(() => {
    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      ws = new WebSocket(wsUrl())
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        reconnectTimer = setTimeout(connect, 3000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (ev) => {
        try {
          cbRef.current(JSON.parse(ev.data) as WsMessage)
        } catch {}
      }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  return connected
}
