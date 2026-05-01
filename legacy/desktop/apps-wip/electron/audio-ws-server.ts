import { WebSocketServer, WebSocket } from 'ws'

let wss: WebSocketServer | null = null

export function startAudioWSServer(): void {
  try {
    wss = new WebSocketServer({ port: 2222 })

    wss.on('connection', (ws) => {
      try {
        ws.send(JSON.stringify({ type: 'mheu-audio', version: 1 }))
      } catch { /* ignore */ }
      ws.on('error', () => { /* ignore */ })
    })

    wss.on('error', () => {
      wss = null
    })

    console.log('[AudioWS] Server started on port 2222')
  } catch {
    // Silently ignore — port may be busy
  }
}

export function broadcastFrequencyData(data: Uint8Array): void {
  if (!wss) return
  const msg = JSON.stringify({ type: 'freq', data: Array.from(data), timestamp: Date.now() })
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg)
      } catch { /* ignore */ }
    }
  })
}
