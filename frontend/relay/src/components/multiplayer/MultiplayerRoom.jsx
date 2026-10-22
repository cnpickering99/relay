import { useEffect, useRef, useState } from 'react';

const gold = '#f5c518';
const muted = '#c8c2dc';
const panelBorder = '1px solid rgba(255,255,255,0.08)';
const CHAT_MAX_LENGTH = 500;

export default function MultiplayerRoom({
  room,
  myPlayerId,
  messages = [],
  toast,
  onSendChat,
  onToggleReady,
  onManagePlayer,
  onLeave,
}) {
  const [draft, setDraft] = useState('');
  const [managedId, setManagedId] = useState('');
  const [confirmBanId, setConfirmBanId] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const players = room?.players ?? [];
  const me = players.find((entry) => entry.player.id === myPlayerId);
  const isOwner = Boolean(room) && room.ownerId === myPlayerId;
  const isReady = me?.status === 'ready';

  const closeManageMenu = () => {
    setManagedId('');
    setConfirmBanId('');
  };

  const sendChat = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSendChat(text);
    setDraft('');
  };

  const manage = (targetPlayerId, action) => {
    onManagePlayer(targetPlayerId, action);
    closeManageMenu();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      boxSizing: 'border-box',
      background: '#090611',
      color: '#f7f1ff',
      fontFamily: 'Poppins, sans-serif',
    }}>
      <style>{`
        .room-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); height: min(80vh, 640px); }
        @media (max-width: 720px) {
          .room-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); height: 88vh; }
          .room-chat { border-right: none !important; border-bottom: ${panelBorder}; }
        }
      `}</style>

      {toast?.message && (
        <div style={{
          position: 'fixed',
          top: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ff5a5f' : gold,
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

      <div className="room-layout" style={{
        width: 'min(96vw, 960px)',
        background: '#151225',
        border: panelBorder,
        borderRadius: 22,
        boxShadow: '0 28px 70px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Chat (left) */}
        <section className="room-chat" aria-label="Chat" style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: 20,
          borderRight: panelBorder,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: muted, textTransform: 'uppercase', marginBottom: 12 }}>
            Chat
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
            {messages.length === 0 ? (
              <div style={{ color: muted, fontSize: 13, marginTop: 8 }}>No messages yet. Say hi!</div>
            ) : (
              messages.map((message) => {
                const mine = message.playerId === myPlayerId;
                return (
                  <div key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 2, textAlign: mine ? 'right' : 'left' }}>
                      {mine ? 'You' : message.name}
                    </div>
                    <div style={{
                      background: mine ? 'rgba(245,197,24,0.16)' : 'rgba(255,255,255,0.06)',
                      border: mine ? '1px solid rgba(245,197,24,0.3)' : panelBorder,
                      borderRadius: 12,
                      padding: '8px 12px',
                      fontSize: 14,
                      overflowWrap: 'anywhere',
                    }}>
                      {message.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendChat} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={CHAT_MAX_LENGTH}
              placeholder="Type a message..."
              aria-label="Chat message"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'rgba(255,255,255,0.04)',
                border: panelBorder,
                borderRadius: 12,
                color: '#f7f1ff',
                padding: '11px 14px',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              style={{
                background: gold,
                border: 'none',
                borderRadius: 12,
                color: '#1a1328',
                padding: '0 16px',
                fontWeight: 800,
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
                opacity: draft.trim() ? 1 : 0.5,
              }}
            >
              ➤
            </button>
          </form>
        </section>

        {/* Players (right) */}
        <section aria-label="Players" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: muted, textTransform: 'uppercase', marginBottom: 6 }}>
                Players{room ? ` · ${room.playerCount}/${room.maxPlayers}` : ''}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }}>
                {room ? room.name : 'Loading room...'}
              </div>
              {room && (
                <div style={{ fontSize: 12, letterSpacing: '0.12em', color: '#f7d66d', marginTop: 2 }}>{room.code}</div>
              )}
            </div>

            <button
              onClick={onLeave}
              aria-label="Leave room"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,90,95,0.6)',
                color: '#ff8a8e',
                borderRadius: 10,
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              Leave ⇥
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((entry) => {
              const isMe = entry.player.id === myPlayerId;
              const ready = entry.status === 'ready';
              const showManage = isOwner && !isMe;
              const menuOpen = managedId === entry.player.id;

              return (
                <div key={entry.player.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: panelBorder,
                  borderRadius: 14,
                  padding: '10px 14px',
                }}>
                  <div aria-hidden="true" style={{
                    width: 34,
                    height: 34,
                    flex: 'none',
                    borderRadius: '50%',
                    background: isMe ? gold : 'rgba(255,255,255,0.12)',
                    color: isMe ? '#1a1328' : '#f7f1ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                  }}>
                    {(entry.player.name || '?').charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {entry.player.name}
                      {isMe ? ' (you)' : ''}
                      {entry.isOwner && (
                        <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: '0.1em', color: gold, border: '1px solid rgba(245,197,24,0.4)', borderRadius: 999, padding: '2px 8px' }}>
                          OWNER
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: ready ? '#7be0a0' : muted }}>
                      {ready ? 'Ready' : 'Not ready'}
                    </div>
                  </div>

                  {showManage && (
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => (menuOpen ? closeManageMenu() : (setManagedId(entry.player.id), setConfirmBanId('')))}
                        aria-expanded={menuOpen}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(245,197,24,0.5)',
                          color: '#f7d66d',
                          borderRadius: 10,
                          padding: '6px 12px',
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: '0.08em',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        MANAGE
                      </button>

                      {menuOpen && (
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 6px)',
                          zIndex: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          minWidth: 130,
                          background: '#1d1833',
                          border: panelBorder,
                          borderRadius: 12,
                          padding: 8,
                          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                        }}>
                          <button onClick={() => manage(entry.player.id, 'kick')} style={menuButtonStyle('#f7f1ff')}>
                            Kick
                          </button>
                          {confirmBanId === entry.player.id ? (
                            <button onClick={() => manage(entry.player.id, 'ban')} style={menuButtonStyle('#ff8a8e', true)}>
                              Confirm ban
                            </button>
                          ) : (
                            <button onClick={() => setConfirmBanId(entry.player.id)} style={menuButtonStyle('#ff8a8e')}>
                              Ban
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              onClick={onToggleReady}
              disabled={!me}
              aria-pressed={isReady}
              style={{
                background: isReady ? 'rgba(123,224,160,0.16)' : gold,
                border: isReady ? '1px solid rgba(123,224,160,0.5)' : 'none',
                color: isReady ? '#7be0a0' : '#1a1328',
                borderRadius: 12,
                padding: '12px 26px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: me ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {isReady ? 'Ready ✓' : 'Ready'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function menuButtonStyle(color, strong = false) {
  return {
    background: strong ? 'rgba(255,90,95,0.18)' : 'transparent',
    border: strong ? '1px solid rgba(255,90,95,0.6)' : '1px solid transparent',
    color,
    borderRadius: 8,
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
