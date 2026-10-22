const BASE_URL = "http://localhost:3000";

/**
 * Headers for the backend's authenticate middleware.
 * `auth` is the { email, authToken } object App.jsx keeps in state.
 */
function authHeaders(auth) {
  if (!auth?.email || !auth?.authToken) return {};
  return {
    Authorization: `Bearer ${auth.authToken}`,
    "x-user-email": auth.email,
  };
}

/**
 * Submit a score when the game ends. Requires a logged-in user; the
 * server takes the player's identity from the auth headers.
 * Returns the saved score, or null on failure.
 */
export async function submitScore(auth, score, wordsUsed) {
  try {
    const res = await fetch(`${BASE_URL}/scores/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(auth) },
      body: JSON.stringify({ score, wordsUsed }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data.score;
  } catch (error) {
    console.error("Failed to submit score:", error);
    return null;
  }
}

/**
 * Get the top 10 leaderboard. When `auth` is given the response also
 * includes `me` ({ rank, best }) and an `isMe` flag on the player's row.
 * Throws on failure so the UI can show an error state.
 */
export async function getLeaderboard(auth) {
  const res = await fetch(`${BASE_URL}/scores/leaderboard`, {
    headers: authHeaders(auth),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return { scores: data.scores ?? [], me: data.me ?? null };
}

/**
 * Get the logged-in player's best score, or null if they have none yet.
 */
export async function getPersonalBest(auth) {
  try {
    const res = await fetch(`${BASE_URL}/scores/personal-best`, {
      headers: authHeaders(auth),
    });
    if (res.status === 404) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data.best;
  } catch (error) {
    console.error("Failed to fetch personal best:", error);
    return null;
  }
}
