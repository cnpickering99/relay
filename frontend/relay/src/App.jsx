import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import RelayGame from './components/relay-game'
import MultiplayerLobby from './components/multiplayer/MultiplayerLobby.jsx'

const ACTIVE_ROOM_KEY = 'relay-active-room'
const TOAST_STORAGE_KEY = 'relay-room-toast'
const LEGACY_ROOM_STORAGE_KEY = 'relay-open-rooms'
const SOCKET_URL = 'ws://localhost:3000/multiplayer'

function readActiveRoomFromStorage() {
  try {
    return localStorage.getItem(ACTIVE_ROOM_KEY) || ''
  } catch {
    return ''
  }
}

function writeActiveRoomToStorage(roomId) {
  try {
    if (roomId) localStorage.setItem(ACTIVE_ROOM_KEY, roomId)
    else localStorage.removeItem(ACTIVE_ROOM_KEY)
  } catch {
    // ignore storage write errors in private browser modes
  }
}

function readToastFromStorage() {
  try {
    const raw = localStorage.getItem(TOAST_STORAGE_KEY)
    return raw ? JSON.parse(raw) : { message: '', type: 'success' }
  } catch {
    return { message: '', type: 'success' }
  }
}

function writeToastToStorage(toast) {
  try {
    if (toast && toast.message) localStorage.setItem(TOAST_STORAGE_KEY, JSON.stringify(toast))
    else localStorage.removeItem(TOAST_STORAGE_KEY)
  } catch {
    // ignore storage write errors in private browser modes
  }
}

function createRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits = '0123456789'
  const partOne = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
  const partTwo = Array.from({ length: 3 }, () => digits[Math.floor(Math.random() * digits.length)]).join('')
  return `${partOne}${partTwo}`
}

function App() {
  const [screen, setScreen] = useState('menu')
  const [roomId, setRoomId] = useState(() => readActiveRoomFromStorage())
  const [playerName, setPlayerName] = useState('Player')
  const [rooms, setRooms] = useState([])
  const [toast, setToast] = useState(() => readToastFromStorage())
  const toastTimerRef = useRef(null)
  const socketRef = useRef(null)
  const roomIdRef = useRef(roomId)

  useEffect(() => {
    roomIdRef.current = roomId
  }, [roomId])

  const normalizeRoomPayload = useCallback((room) => {
    if (!room || !room.roomId && !room.id) return null

    const roomId = room.roomId || room.id
    const playersCount = Array.isArray(room.players) ? room.players.length : Number(room.players || 0)

    return {
      id: roomId,
      name: room.name || 'Lobby',
      players: playersCount,
      maxPlayers: room.maxPlayers || 4,
      mode: room.mode || 'classic',
      status: room.status || 'waiting',
    }
  }, [])

  const syncRoomsFromServer = useCallback((incomingRoom) => {
    if (!incomingRoom) return

    const normalized = normalizeRoomPayload(incomingRoom)
    if (!normalized) return

    setRooms((currentRooms) => {
      const nextRooms = Array.isArray(currentRooms) ? [...currentRooms] : []
      const existingIndex = nextRooms.findIndex((room) => room.id === normalized.id)

      return existingIndex >= 0
        ? nextRooms.map((room) => room.id === normalized.id ? { ...room, ...normalized } : room)
        : [...nextRooms, normalized]
    })
  }, [normalizeRoomPayload])

  const syncRoomsListFromServer = useCallback((incomingRooms) => {
    if (!Array.isArray(incomingRooms)) return

    const nextRooms = incomingRooms.map((room) => normalizeRoomPayload(room)).filter(Boolean)
    const roomIds = new Set(nextRooms.map((room) => room.id))

    if (roomIdRef.current && !roomIds.has(roomIdRef.current)) {
      setRoomId('')
      writeActiveRoomToStorage('')
    }

    setRooms(nextRooms)
  }, [normalizeRoomPayload])

  const showToast = (message, type = 'success') => {
    const nextToast = { message, type }
    setToast(nextToast)
    writeToastToStorage(nextToast)

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      const emptyToast = { message: '', type: 'success' }
      setToast(emptyToast)
      writeToastToStorage(emptyToast)
    }, 2500)
  }

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_ROOM_STORAGE_KEY)
    } catch {
      // ignore stale storage cleanup errors
    }

    const onStorage = (event) => {
      if (event.key === ACTIVE_ROOM_KEY) {
        setRoomId(readActiveRoomFromStorage())
      }

      if (event.key === TOAST_STORAGE_KEY) {
        const nextToast = readToastFromStorage()
        setToast(nextToast)
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (socketRef.current) {
      return undefined
    }

    const socket = new WebSocket(SOCKET_URL)
    socketRef.current = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'list_rooms' }))
    }

    socket.onmessage = (event) => {
      let payload
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }

      if (!payload || !payload.type) {
        return
      }

      if (payload.type === 'connected') {
        return
      }

      if (payload.type === 'rooms_list') {
        syncRoomsListFromServer(payload.rooms)
        return
      }

      if (payload.type === 'room_created' || payload.type === 'room_joined') {
        const nextRoomId = payload.roomId || payload.room?.roomId || roomIdRef.current
        setRoomId(nextRoomId)
        writeActiveRoomToStorage(nextRoomId)
        if (payload.room) syncRoomsFromServer(payload.room)
        socket.send(JSON.stringify({ type: 'list_rooms' }))
        return
      }

      if (payload.type === 'lobby_updated') {
        if (payload.room) {
          syncRoomsFromServer(payload.room)
        }
        return
      }

      if (payload.type === 'queued') {
        if (payload.room) syncRoomsFromServer(payload.room)
        showToast('Waiting for a match...', 'success')
        return
      }

      if (payload.type === 'game_room_found') {
        if (payload.room) syncRoomsFromServer(payload.room)
        showToast(`Match found in room ${payload.room?.roomId || roomIdRef.current}`, 'success')
        return
      }

      if (payload.type === 'error') {
        showToast(payload.message || 'Something went wrong.', 'error')
      }
    }

    socket.onerror = () => {
      showToast('Unable to connect to multiplayer server.', 'error')
    }

    socket.onclose = () => {
      socketRef.current = null
    }

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close()
      }
      socketRef.current = null
    }
  }, [syncRoomsFromServer, syncRoomsListFromServer])

  useEffect(() => {
    if (!toast.message) return

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      const emptyToast = { message: '', type: 'success' }
      setToast(emptyToast)
      writeToastToStorage(emptyToast)
    }, 2500)

    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [toast])

  const handleCreateRoom = (payload) => {
    const name = (payload.playerName || 'Player').trim() || 'Player'
    setPlayerName(name)
    setScreen('multiplayer-lobby')

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'create_room',
        name,
      }))
      showToast('Creating room...', 'success')
      return
    }

    showToast('Unable to connect to multiplayer server.', 'error')
  }

  const handleJoinRoom = (code, name) => {
    const roomCode = (code || '').trim().toUpperCase()

    if (!roomCode) {
      showToast("Room doesn't exist.", 'error')
      return
    }

    const targetRoom = rooms.find((room) => room.id === roomCode)
    if (!targetRoom) {
      showToast("Room doesn't exist.", 'error')
      return
    }

    setPlayerName(name)
    setScreen('multiplayer-lobby')

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'join_room',
        roomId: roomCode,
        name,
      }))
      showToast(`Joining room ${roomCode}...`, 'success')
      return
    }

    showToast('Unable to connect to multiplayer server.', 'error')
  }

  const handleBackToMenu = () => {
    setScreen('menu')
    setRoomId('')
    writeActiveRoomToStorage('')
  }

  if (screen === 'solo') {
    return (
      <>
        <section id="center">
          <RelayGame />
        </section>
      </>
    )
  }

  if (screen === 'multiplayer-lobby') {
    return (
      <MultiplayerLobby
        roomId={roomId}
        playerName={playerName}
        hasActiveRoom={Boolean(roomId)}
        rooms={rooms}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onBack={handleBackToMenu}
      />
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#090611',
      color: '#f7f1ff',
      fontFamily: 'Poppins, sans-serif',
      position: 'relative',
    }}>
      {toast.message && (
        <div style={{
          position: 'fixed',
          top: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ff5a5f' : '#f5c518',
          color: toast.type === 'error' ? '#fff5f5' : '#1a1328',
          borderRadius: 999,
          padding: '12px 22px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
          zIndex: 120,
          whiteSpace: 'nowrap',
        }}>
          {toast.message}
        </div>
      )}
      <div style={{
        width: 'min(92vw, 420px)',
        background: '#151225',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        padding: 28,
      }}>
        <p style={{ margin: 0, color: '#d5b8ff', letterSpacing: '0.18em', fontSize: 12, textTransform: 'uppercase' }}>
          Relay Game
        </p>

        <h1 style={{ margin: '14px 0 10px', fontSize: 36, lineHeight: 1.1 }}>Choose a mode</h1>

        <p style={{ margin: '0 0 24px', color: '#c8c2dc', lineHeight: 1.6 }}>
          Start with the classic solo game, or enter the multiplayer lobby and match with other players.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => setScreen('solo')}
            style={{
              background: '#f5c518',
              color: '#1a1328',
              border: 'none',
              borderRadius: 12,
              padding: '16px 18px',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Play Solo
          </button>

          <button
            onClick={() => setScreen('multiplayer-lobby')}
            style={{
              background: 'transparent',
              color: '#f7f1ff',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12,
              padding: '16px 18px',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Play Multiplayer
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
