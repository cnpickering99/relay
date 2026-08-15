const BASE_URL = "http://localhost:3000";

/**
 * Submit a score when the game ends
 */
export async function submitScore(username, score, wordsUsed) {
  try {
    const res = await fetch(`${BASE_URL}/scores/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, score, wordsUsed }),
    });
    const data = await res.json();
    return data.score;
  } catch (error) {
    console.error("Failed to submit score:", error);
    return null;
  }
}

/**
 * Get the top 10 leaderboard
 */
export async function getLeaderboard() {
  try {
    const res = await fetch(`${BASE_URL}/scores/leaderboard`);
    const data = await res.json();
    return data.scores;
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return [];
  }
}

/**
 * Get personal best for a username
 */
export async function getPersonalBest(username) {
  try {
    const res = await fetch(
      `${BASE_URL}/scores/personal-best?username=${username}`
    );
    const data = await res.json();
    return data.best;
  } catch (error) {
    console.error("Failed to fetch personal best:", error);
    return null;
  }
}