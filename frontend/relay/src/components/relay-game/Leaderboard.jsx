// Leaderboard.jsx
import { useEffect, useState } from "react";
import * as C from "./ComponentStyles.jsx";
import { getLeaderboard } from "../../api/scoresapi.js";

const font = "'Poppins', 'Nunito', sans-serif";

export default function Leaderboard({ onBack }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      const data = await getLeaderboard();
      setScores(data);
      setLoading(false);
    }
    fetchScores();
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "linear-gradient(160deg, #1a1a2e 0%, #221f3a 100%)",
      borderRadius: 44,
      display: "flex",
      flexDirection: "column",
      zIndex: 200,
      padding: "40px 28px 32px",
      fontFamily: font,
      overflowY: "auto",
    }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          width: 40, height: 5,
          background: C.gold,
          borderRadius: 999,
          marginBottom: 16,
        }} />
        <div style={{
          fontSize: 11, fontWeight: 700,
          letterSpacing: "0.3em",
          color: C.muted,
          textTransform: "uppercase",
          marginBottom: 6,
        }}>
          TOP PLAYERS
        </div>
        <div style={{
          fontSize: 36, fontWeight: 900,
          color: C.white,
          letterSpacing: -1,
          lineHeight: 1,
        }}>
          LEADERBOARD
        </div>
      </div>

      {/* Scores list */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{
            textAlign: "center",
            color: C.muted,
            fontSize: 14,
            marginTop: 60,
          }}>
            Loading scores...
          </div>
        ) : scores.length === 0 ? (
          <div style={{
            textAlign: "center",
            color: C.muted,
            fontSize: 14,
            marginTop: 60,
          }}>
            No scores yet — be the first to play!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scores.map((entry, i) => (
              <div key={i} style={{
                background: i === 0
                  ? "rgba(245,197,24,0.12)"
                  : "rgba(255,255,255,0.05)",
                border: i === 0
                  ? "1px solid rgba(245,197,24,0.3)"
                  : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}>
                {/* Rank */}
                <div style={{
                  fontSize: i < 3 ? 22 : 14,
                  fontWeight: 900,
                  color: i < 3 ? C.gold : C.muted,
                  minWidth: 32,
                  textAlign: "center",
                }}>
                  {i < 3 ? medals[i] : `#${i + 1}`}
                </div>

                {/* Username + words */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 800,
                    color: C.white,
                    marginBottom: 2,
                  }}>
                    {entry.username}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: C.muted,
                  }}>
                    {entry.words_used} words chained
                  </div>
                </div>

                {/* Score */}
                <div style={{
                  fontSize: 24, fontWeight: 900,
                  color: i === 0 ? C.gold : C.white,
                  letterSpacing: -1,
                }}>
                  {entry.score}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          marginTop: 24,
          width: "100%",
          background: C.gold,
          border: "none",
          borderRadius: 14,
          padding: 18,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.18em",
          color: "#1a1a2e",
          cursor: "pointer",
          textTransform: "uppercase",
          fontFamily: font,
        }}
        onMouseEnter={e => e.target.style.opacity = "0.9"}
        onMouseLeave={e => e.target.style.opacity = "1"}
        onMouseDown={e => e.target.style.transform = "scale(0.98)"}
        onMouseUp={e => e.target.style.transform = "scale(1)"}
      >
        ← BACK
      </button>
    </div>
  );
}