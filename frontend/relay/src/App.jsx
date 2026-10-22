import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import RelayGame from './components/relay-game'
import MultiplayerLobby from './components/multiplayer/MultiplayerLobby.jsx'
import MultiplayerRoom from './components/multiplayer/MultiplayerRoom.jsx'
import MultiplayerGame from './components/multiplayer/MultiplayerGame.jsx'
import MultiplayerResults from './components/multiplayer/MultiplayerResults.jsx'

const ACTIVE_ROOM_KEY = 'relay-active-room'
const TOAST_STORAGE_KEY = 'relay-room-toast'
const LEGACY_ROOM_STORAGE_KEY = 'relay-open-rooms'
const AUTH_STORAGE_KEY = 'relay-auth'
// Every screen that belongs to being inside a room.
const ROOM_SCREENS = ['multiplayer-room', 'multiplayer-game', 'multiplayer-results']
const SOCKET_URL = 'ws://localhost:3000/multiplayer'
const API_URL = 'http://localhost:3000'

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

function readAuthFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeAuthToStorage(auth) {
  try {
    if (auth && auth.email && auth.authToken) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
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
  const [auth, setAuth] = useState(() => readAuthFromStorage())
  const [screen, setScreen] = useState(() => (readAuthFromStorage()?.email ? 'menu' : 'login'))
  const [roomId, setRoomId] = useState(() => readActiveRoomFromStorage())
  const [playerName, setPlayerName] = useState('Player')
  const [rooms, setRooms] = useState([])
  const [toast, setToast] = useState(() => readToastFromStorage())
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const toastTimerRef = useRef(null)
  const socketRef = useRef(null)
  const roomIdRef = useRef(roomId)
  // Live state for the room the player is currently in (null when in the lobby).
  const [myPlayerId, setMyPlayerId] = useState('')
  const [currentRoom, setCurrentRoom] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  // The running timed game: { endsAt (local clock), durationMs }, this player's
  // own run, everyone's scores, and (once it ends) the results.
  const [game, setGame] = useState(null)
  const [myRun, setMyRun] = useState(null)
  const [scoreboard, setScoreboard] = useState([])
  const [gameResult, setGameResult] = useState(null)

  useEffect(() => {
    roomIdRef.current = roomId
  }, [roomId])

  const normalizeRoomPayload = useCallback((room) => {
    if (!room || !room.roomId && !room.id) return null

    const roomId = room.roomId || room.id
    // The server sends `playerCount`; `players` is kept for array/number payloads.
    const playersCount = Array.isArray(room.players)
      ? room.players.length
      : Number(room.playerCount ?? room.players ?? 0)

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

  // Back to the lobby after leaving (or being removed from) a room.
  const leaveRoomScreen = useCallback(() => {
    setCurrentRoom(null)
    setChatMessages([])
    setGame(null)
    setMyRun(null)
    setScoreboard([])
    setGameResult(null)
    setRoomId('')
    writeActiveRoomToStorage('')
    setScreen((current) => (ROOM_SCREENS.includes(current) ? 'multiplayer-lobby' : current))
  }, [])

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

  // One-click email login: if the page was opened from the link in a
  // login email (?token=...&email=...), exchange the token for a real
  // session, then strip the params so a refresh doesn't retry an
  // already-consumed, single-use token.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const email = params.get('email')
    if (!token || !email) return

    let cancelled = false

    fetch(`${API_URL}/users/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Login link is invalid or expired.')
        return data
      })
      .then((data) => {
        if (cancelled) return
        const nextAuth = { email: data.user?.email || email, authToken: data.authToken }
        setAuth(nextAuth)
        writeAuthToStorage(nextAuth)
        setScreen('menu')
        showToast('Logged in!', 'success')
      })
      .catch((err) => {
        if (cancelled) return
        showToast(err.message || 'Login link is invalid or expired.', 'error')
      })
      .finally(() => {
        window.history.replaceState({}, '', window.location.pathname)
      })

    return () => {
      cancelled = true
    }
    // Only ever relevant on the initial page load that carries the link.
  }, [])

  const handleRequestLoginLink = async (event) => {
    event.preventDefault()
    const email = loginEmail.trim()
    if (!email) {
      showToast('Enter an email first.', 'error')
      return
    }

    setLoginPending(true)
    try {
      const response = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to send login link.')

      showToast(
        data.emailSent === false
          ? "Couldn't send the email — try again shortly."
          : 'Check your email for a login link!',
        data.emailSent === false ? 'error' : 'success'
      )
    } catch (err) {
      showToast(err.message || 'Unable to send login link.', 'error')
    } finally {
      setLoginPending(false)
    }
  }

  const handleLogout = () => {
    setAuth(null)
    writeAuthToStorage(null)
    setScreen('login')
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
    if (!auth?.email || !auth?.authToken) {
      return undefined
    }

    if (socketRef.current) {
      return undefined
    }

    const socketUrl = `${SOCKET_URL}?email=${encodeURIComponent(auth.email)}&token=${encodeURIComponent(auth.authToken)}`
    const socket = new WebSocket(socketUrl)
    socketRef.current = socket
    let didOpen = false

    socket.onopen = () => {
      didOpen = true
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
        setMyPlayerId(payload.playerId || '')
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
        setCurrentRoom(null)
        setChatMessages([])
        setScreen('multiplayer-room')
        socket.send(JSON.stringify({ type: 'list_rooms' }))
        socket.send(JSON.stringify({ type: 'get_room' }))
        socket.send(JSON.stringify({ type: 'get_chat' }))
        return
      }

      if (payload.type === 'room_state' || payload.type === 'player_managed') {
        if (payload.room) setCurrentRoom(payload.room)
        return
      }

      if (payload.type === 'room_updated') {
        // Only the room we're in matters here; the lobby list has its own feed.
        if (payload.room && payload.room.code === roomIdRef.current) setCurrentRoom(payload.room)
        return
      }

      if (payload.type === 'ready_status') {
        // Our own toggle: the server only broadcasts it to the *other* members.
        setCurrentRoom((room) => room && {
          ...room,
          players: room.players.map((entry) => (
            entry.player.id === payload.playerId ? { ...entry, status: payload.status } : entry
          )),
        })
        return
      }

      if (payload.type === 'chat_history') {
        setChatMessages(Array.isArray(payload.messages) ? payload.messages : [])
        return
      }

      if (payload.type === 'chat_message') {
        setChatMessages((messages) => (
          messages.some((message) => message.id === payload.message.id)
            ? messages
            : [...messages, payload.message]
        ))
        return
      }

      if (payload.type === 'game_started') {
        // The server's clock may differ from ours; only trust "time left".
        const msLeft = payload.game.endsAt - payload.game.serverNow
        setGame({ endsAt: Date.now() + msLeft, durationMs: payload.game.durationMs })
        setMyRun({ fragment: payload.game.fragment, score: 0, wordsUsed: [], finished: false, finishReason: null })
        setScoreboard(payload.scoreboard || [])
        setGameResult(null)
        if (payload.room) setCurrentRoom(payload.room)
        setScreen('multiplayer-game')
        return
      }

      if (payload.type === 'word_accepted') {
        setMyRun((run) => run && {
          ...run,
          score: payload.score,
          fragment: payload.fragment,
          wordsUsed: [...run.wordsUsed, payload.word],
        })
        showToast(`+${payload.points} pts`, 'success')
        return
      }

      if (payload.type === 'word_rejected') {
        showToast(payload.message || 'Word not accepted.', 'error')
        return
      }

      if (payload.type === 'player_finished') {
        setMyRun((run) => run && {
          ...run,
          score: payload.score,
          finished: true,
          finishReason: { word: payload.word, lastTwo: payload.lastTwo },
        })
        return
      }

      if (payload.type === 'game_progress') {
        setScoreboard(payload.scoreboard || [])
        return
      }

      if (payload.type === 'game_ended') {
        setGame(null)
        setGameResult({ results: payload.results, winnerIds: payload.winnerIds, isTie: payload.isTie })
        setScreen('multiplayer-results')
        return
      }

      if (payload.type === 'room_left') {
        leaveRoomScreen()
        return
      }

      if (payload.type === 'player_kicked' || payload.type === 'player_banned') {
        leaveRoomScreen()
        showToast(
          payload.type === 'player_banned'
            ? 'You were banned from the room.'
            : 'You were kicked from the room.',
          'error',
        )
        return
      }

      if (payload.type === 'room_deleted') {
        leaveRoomScreen()
        showToast('The room was closed by its owner.', 'error')
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
      // If we never finished opening, this is almost certainly the server
      // rejecting the login credentials on the connection URL (handled in
      // onclose below) rather than a generic connectivity problem — don't
      // double-toast it.
      if (didOpen) {
        showToast('Unable to connect to multiplayer server.', 'error')
      }
    }

    socket.onclose = () => {
      // A newer socket may already have replaced this one; don't clobber its ref.
      if (socketRef.current === socket) socketRef.current = null

      // The browser WebSocket API never exposes *why* a connection failed
      // (no HTTP status code reaches JS), so "never got to open" is the
      // only signal available that the server rejected our credentials —
      // treat it as an expired/invalid session and bounce back to login.
      if (!didOpen) {
        setAuth(null)
        writeAuthToStorage(null)
        setScreen('login')
        showToast('Your session expired — please log in again.', 'error')
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
      socketRef.current = null
    }
  }, [auth, syncRoomsFromServer, syncRoomsListFromServer, leaveRoomScreen])

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
        owner: name,
        roomName: payload.roomName,
        maxPlayers: payload.maxPlayers,
        code: payload.code,
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

  const sendToServer = (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
      return true
    }
    showToast('Unable to connect to multiplayer server.', 'error')
    return false
  }

  const handleLeaveRoom = () => {
    sendToServer({ type: 'leave_room' })
  }

  const handleSubmitWord = (word) => {
    sendToServer({ type: 'submit_word', word })
  }

  const handleBackToRoom = () => {
    setGameResult(null)
    setScreen('multiplayer-room')
  }

  const handleToggleReady = () => {
    const me = currentRoom?.players.find((entry) => entry.player.id === myPlayerId)
    if (!me) return
    sendToServer({ type: 'set_ready', ready: me.status !== 'ready' })
  }

  const handleManagePlayer = (targetPlayerId, action) => {
    sendToServer({ type: 'manage_player', targetPlayerId, action })
  }

  const handleSendChat = (text) => {
    sendToServer({ type: 'chat', text })
  }

  const handleBackToMenu = () => {
    setScreen('menu')
    setRoomId('')
    writeActiveRoomToStorage('')
  }

  if (screen === 'login') {
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

          <h1 style={{ margin: '14px 0 10px', fontSize: 36, lineHeight: 1.1 }}>Log in to play</h1>

          <p style={{ margin: '0 0 24px', color: '#c8c2dc', lineHeight: 1.6 }}>
            Enter your email and we'll send you a one-click login link — no password needed.
          </p>

          <form onSubmit={handleRequestLoginLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="you@example.com"
              autoFocus
              style={{
                background: '#0f0c1c',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 10,
                padding: '14px 16px',
                color: '#f7f1ff',
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              disabled={loginPending}
              style={{
                background: '#f5c518',
                color: '#1a1328',
                border: 'none',
                borderRadius: 12,
                padding: '16px 18px',
                fontSize: 16,
                fontWeight: 800,
                cursor: loginPending ? 'default' : 'pointer',
                opacity: loginPending ? 0.6 : 1,
              }}
            >
              {loginPending ? 'Sending…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (screen === 'solo') {
    return (
      <>
        <section id="center">
          <RelayGame auth={auth} />
        </section>
      </>
    )
  }

  if (screen === 'multiplayer-game' && game && myRun) {
    return (
      <MultiplayerGame
        game={game}
        run={myRun}
        scoreboard={scoreboard}
        myPlayerId={myPlayerId}
        toast={toast}
        onSubmitWord={handleSubmitWord}
      />
    )
  }

  if (screen === 'multiplayer-results' && gameResult) {
    return (
      <MultiplayerResults
        result={gameResult}
        myPlayerId={myPlayerId}
        toast={toast}
        onBackToRoom={handleBackToRoom}
        onLeave={handleLeaveRoom}
      />
    )
  }

  if (screen === 'multiplayer-room') {
    return (
      <MultiplayerRoom
        room={currentRoom}
        myPlayerId={myPlayerId}
        messages={chatMessages}
        toast={toast}
        onSendChat={handleSendChat}
        onToggleReady={handleToggleReady}
        onManagePlayer={handleManagePlayer}
        onLeave={handleLeaveRoom}
      />
    )
  }

  if (screen === 'multiplayer-lobby') {
    return (
      <MultiplayerLobby
        roomId={roomId}
        playerName={playerName === 'Player' ? (auth?.email?.split('@')[0] || 'Player') : playerName}
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

        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <p style={{ margin: 0, color: '#c8c2dc', fontSize: 14 }}>
            Logged in as <strong style={{ color: '#f7f1ff' }}>{auth?.email}</strong>
            {' · '}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#d5b8ff',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
              }}
            >
              Log out
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
