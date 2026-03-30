/**
 * Spotify Integration for Focus Timer
 * Part of v1.3.0 "Harmony"
 *
 * Integrates with Spotify Web API to:
 * - Auto-play focus playlists when timer starts
 * - Auto-pause when timer ends
 * - Show currently playing track
 *
 * Note: Requires Spotify Premium for playback control
 */

import { logger } from "./logger";
import { safeSessionStorageGet, safeSessionStorageSet } from "./safeJson";
import { SSK } from "@/lib/storageKeys";
import { rateLimiter, RateLimitError } from "./rateLimiter";
import { SPOTIFY_CLIENT_ID } from "@/lib/env";

// ============================================
// TYPES
// ============================================

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  albumArt?: string;
  isPlaying: boolean;
  durationMs: number;
  progressMs: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl?: string;
  trackCount: number;
}

// Spotify API response types
interface SpotifyApiPlaylistItem {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  tracks?: { total: number };
}

// ============================================
// CONSTANTS
// ============================================

// Whitelist allowed redirect URIs to prevent OAuth hijacking
const ALLOWED_ORIGINS = [
  "https://yehor212.github.io",
  "capacitor://localhost",
] as const;

function getSecureRedirectUri(): string {
  const currentOrigin = window.location.origin;

  // Check if current origin is in whitelist
  if (
    ALLOWED_ORIGINS.includes(currentOrigin as (typeof ALLOWED_ORIGINS)[number])
  ) {
    // For GitHub Pages, append the base path
    if (currentOrigin === "https://yehor212.github.io") {
      return `${currentOrigin}/people-first-app/spotify-callback`;
    }
    return `${currentOrigin}/spotify-callback`;
  }

  // Fallback to production URL without logging the invalid origin
  // (logging could reveal the whitelist to attackers)
  return "https://yehor212.github.io/people-first-app/spotify-callback";
}

const REDIRECT_URI = getSecureRedirectUri();
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

// Popular focus/study playlists (fallback)
const FOCUS_PLAYLIST_QUERY = "focus study concentration lo-fi";

// ============================================
// RATE-LIMITED FETCH
// ============================================

/**
 * Rate-limited fetch for Spotify API
 * Prevents hitting Spotify's rate limits and getting blocked
 */
async function spotifyFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  if (!rateLimiter.checkAndRecord("spotify")) {
    const retryAfter = rateLimiter.getTimeUntilReset("spotify");
    throw new RateLimitError("spotify", retryAfter);
  }
  return fetch(url, options);
}

// ============================================
// OAUTH HELPERS
// ============================================

/**
 * Generate PKCE code verifier and challenge
 */
async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = generateRandomString(128);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { verifier, challenge };
}

function generateRandomString(length: number): string {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // Rejection sampling: accept bytes < 248 (62*4) for uniform distribution (CWE-330 fix)
  const maxValid = 248; // 62 * 4 = 248, so possible[byte % 62] is uniform for byte < 248
  let result = "";
  while (result.length < length) {
    const values = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const x of values) {
      if (x < maxValid) result += possible[x % possible.length];
      if (result.length >= length) break;
    }
  }
  return result;
}

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * Check if Spotify is connected
 */
export function isSpotifyConnected(): boolean {
  const tokens = getStoredTokens();
  return tokens !== null && tokens.expiresAt > Date.now();
}

/**
 * Get stored tokens
 * Use sessionStorage instead of localStorage for tokens
 */
function getStoredTokens(): SpotifyTokens | null {
  return safeSessionStorageGet<SpotifyTokens | null>(SSK.SPOTIFY_TOKENS, null);
}

/**
 * Store tokens
 * Use sessionStorage instead of localStorage for tokens
 */
function storeTokens(tokens: SpotifyTokens): void {
  safeSessionStorageSet(SSK.SPOTIFY_TOKENS, tokens);
}

/**
 * Clear tokens (disconnect)
 * Use sessionStorage for token storage
 */
export function disconnectSpotify(): void {
  sessionStorage.removeItem(SSK.SPOTIFY_TOKENS);
  sessionStorage.removeItem(SSK.SPOTIFY_PKCE_VERIFIER);
  logger.log("[Spotify] Disconnected");
}

/**
 * Start OAuth flow
 */
export async function connectSpotify(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) {
    logger.warn("[Spotify] Client ID not configured");
    return;
  }

  const { verifier, challenge } = await generatePKCE();

  // Store verifier for callback
  // Use sessionStorage for PKCE verifier (more secure - cleared on tab close)
  sessionStorage.setItem(SSK.SPOTIFY_PKCE_VERIFIER, verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "true",
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/**
 * Handle OAuth callback
 */
export async function handleSpotifyCallback(code: string): Promise<boolean> {
  const verifier = sessionStorage.getItem(SSK.SPOTIFY_PKCE_VERIFIER);
  if (!verifier) {
    logger.error("[Spotify] No PKCE verifier found");
    return false;
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) {
      throw new Error("Token exchange failed");
    }

    const data = await response.json();

    storeTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    sessionStorage.removeItem(SSK.SPOTIFY_PKCE_VERIFIER);
    logger.log("[Spotify] Connected successfully");
    return true;
  } catch (error) {
    logger.error("[Spotify] Callback error:", error);
    return false;
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(): Promise<boolean> {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) return false;

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();

    storeTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    logger.log("[Spotify] Token refreshed");
    return true;
  } catch (error) {
    logger.error("[Spotify] Refresh error:", error);
    disconnectSpotify();
    return false;
  }
}

/**
 * Get valid access token (refresh if needed)
 */
async function getAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  // Refresh if expires in less than 5 minutes
  if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    return getStoredTokens()?.accessToken || null;
  }

  return tokens.accessToken;
}

// ============================================
// PLAYBACK CONTROL
// ============================================

/**
 * Get currently playing track
 */
export async function getCurrentTrack(): Promise<SpotifyTrack | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await spotifyFetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 204) {
      return null; // No track playing
    }

    if (!response.ok) {
      throw new Error("Failed to get current track");
    }

    const data = await response.json();

    if (!data.item) return null;

    return {
      name: data.item.name,
      artist: data.item.artists.map((a: { name: string }) => a.name).join(", "),
      albumArt: data.item.album.images?.[0]?.url,
      isPlaying: data.is_playing,
      durationMs: data.item.duration_ms,
      progressMs: data.progress_ms,
    };
  } catch (error) {
    logger.error("[Spotify] Get current track error:", error);
    return null;
  }
}

/**
 * Play/Resume playback
 */
export async function play(contextUri?: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  try {
    const body = contextUri
      ? JSON.stringify({ context_uri: contextUri })
      : undefined;

    const response = await spotifyFetch(
      "https://api.spotify.com/v1/me/player/play",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      },
    );

    if (response.status === 204 || response.ok) {
      logger.log("[Spotify] Playback started");
      return true;
    }

    // Handle 404 - no active device
    if (response.status === 404) {
      logger.warn("[Spotify] No active device found");
      return false;
    }

    throw new Error(`Playback failed: ${response.status}`);
  } catch (error) {
    logger.error("[Spotify] Play error:", error);
    return false;
  }
}

/**
 * Pause playback
 */
export async function pause(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  try {
    const response = await spotifyFetch(
      "https://api.spotify.com/v1/me/player/pause",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 204 || response.ok) {
      logger.log("[Spotify] Playback paused");
      return true;
    }

    throw new Error(`Pause failed: ${response.status}`);
  } catch (error) {
    logger.error("[Spotify] Pause error:", error);
    return false;
  }
}

/**
 * Toggle playback
 */
export async function togglePlayback(): Promise<boolean> {
  const track = await getCurrentTrack();
  if (track?.isPlaying) {
    return pause();
  } else {
    return play();
  }
}

// ============================================
// PLAYLIST HELPERS
// ============================================

/**
 * Search for focus playlists
 */
export async function searchFocusPlaylists(
  query?: string,
): Promise<SpotifyPlaylist[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const searchQuery = encodeURIComponent(query || FOCUS_PLAYLIST_QUERY);
    const response = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${searchQuery}&type=playlist&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const data = await response.json();

    return ((data.playlists?.items || []) as SpotifyApiPlaylistItem[]).map(
      (playlist) => ({
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlist.images?.[0]?.url,
        trackCount: playlist.tracks?.total || 0,
      }),
    );
  } catch (error) {
    logger.error("[Spotify] Search error:", error);
    return [];
  }
}

/**
 * Get user's saved playlists
 */
export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const response = await spotifyFetch(
      "https://api.spotify.com/v1/me/playlists?limit=20",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to get playlists");
    }

    const data = await response.json();

    return ((data.items || []) as SpotifyApiPlaylistItem[]).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      imageUrl: playlist.images?.[0]?.url,
      trackCount: playlist.tracks?.total || 0,
    }));
  } catch (error) {
    logger.error("[Spotify] Get playlists error:", error);
    return [];
  }
}

/**
 * Play a specific playlist
 */
export async function playPlaylist(playlistId: string): Promise<boolean> {
  return play(`spotify:playlist:${playlistId}`);
}

// ============================================
// FOCUS TIMER INTEGRATION
// ============================================

/**
 * Start playback for focus session
 */
export async function startFocusPlayback(
  playlistId?: string,
): Promise<boolean> {
  if (!isSpotifyConnected()) return false;

  // If playlist specified, play it
  if (playlistId) {
    return playPlaylist(playlistId);
  }

  // Otherwise just resume current playback
  return play();
}

/**
 * Stop playback for focus session end
 */
export async function stopFocusPlayback(): Promise<boolean> {
  if (!isSpotifyConnected()) return false;
  return pause();
}

export default {
  isSpotifyConnected,
  connectSpotify,
  disconnectSpotify,
  handleSpotifyCallback,
  getCurrentTrack,
  play,
  pause,
  togglePlayback,
  searchFocusPlaylists,
  getUserPlaylists,
  playPlaylist,
  startFocusPlayback,
  stopFocusPlayback,
};
