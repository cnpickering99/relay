import * as C from '../relay-game/ComponentStyles.jsx';
import Toast from '../relay-game/Toast.jsx';

export const font = "'Poppins', 'Nunito', sans-serif";

// The same phone-style card the solo game plays in, so the multiplayer
// screens feel like the same app.
export default function GameFrame({ toast, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: font,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes scoreBounce {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.4); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes wordFlyUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          70%  { opacity: 0.7; transform: translateX(-50%) translateY(-180px) scale(0.8); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-220px) scale(0.65); }
        }
        @keyframes goldFlashAnim {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pillPop {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
      `}</style>

      <div style={{
        width: 'min(390px, calc(100vw - 24px))',
        minHeight: 780,
        boxSizing: 'border-box',
        background: C.purpleBg,
        borderRadius: 44,
        padding: '36px 28px 40px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Toast message={toast?.message} type={toast?.type} />
        {children}
      </div>
    </div>
  );
}
