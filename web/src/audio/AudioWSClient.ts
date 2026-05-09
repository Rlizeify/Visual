// WebSocket client that receives real-time audio frequency data from the desktop companion.
// Tries ws://mheu.local:2222 first, then ws://localhost:2222, then falls back silently.

export type ConnectionStatus = 'connected' | 'connecting' | 'fallback'

const HOSTS = ['ws://mheu.local:2222', 'ws://localhost:2222']
const CONNECT_TIMEOUT_MS = 2000
const RECONNECT_INTERVAL_MS = 5000

let status: ConnectionStatus = 'connecting'
let latestFreqData: Uint8Array | null = null
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function connect(host: string, onFail: () => void): void {
  // Tear down any existing socket cleanly
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    ws = null
  }

  const socket = new WebSocket(host)
  ws = socket
  let settled = false

  const settle = (succeeded: boolean): void => {
    if (settled) return
    settled = true
    clearTimeout(failTimer)
    if (succeeded) {
      status = 'connected'
      latestFreqData = null
      console.log('[AudioWS] Connected to desktop companion')
    } else {
      onFail()
    }
  }

  const failTimer = setTimeout(() => {
    socket.close()
    settle(false)
  }, CONNECT_TIMEOUT_MS)

  socket.onopen = () => settle(true)

  socket.onerror = () => settle(false)

  socket.onclose = () => {
    settle(false) // no-op if already settled
    if (status === 'connected' && ws === socket) {
      status = 'fallback'
      latestFreqData = null
      scheduleReconnect()
    }
  }

  socket.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string)
      if (msg.type === 'freq' && Array.isArray(msg.data)) {
        latestFreqData = new Uint8Array(msg.data as number[])
      }
    } catch {
      // malformed message — ignore
    }
  }
}

function tryConnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  status = 'connecting'

  const tryHost = (index: number): void => {
    if (index >= HOSTS.length) {
      status = 'fallback'
      latestFreqData = null
      scheduleReconnect()
      return
    }
    connect(HOSTS[index], () => tryHost(index + 1))
  }

  tryHost(0)
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(tryConnect, RECONNECT_INTERVAL_MS)
}

// Auto-start on module load
tryConnect()

export function getFreqData(): Uint8Array | null {
  return latestFreqData
}

export function getConnectionStatus(): ConnectionStatus {
  return status
}
