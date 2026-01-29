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

import { logger } from './logger';
import { safeLocalStorageGet, safeLocalStorageSet } from './safeJson';

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

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'zenflow_spotify_tokens';
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = `${window.location.origin}/spotify-callback`;
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

// Popular focus/study playlists (fallback)
const FOCUS_PLAYLIST_QUERY = 'focus study concentration lo-fi';

// ============================================
// OAUTH HELPERS
// ============================================

/**
 * Generate PKCE code verifier and challenge
 */
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(128);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { verifier, challenge };
}

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
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
 */
function getStoredTokens(): SpotifyTokens | null {
  return safeLocalStorageGet<SpotifyTokens | null>(STORAGE_KEY, null);
}

/**
 * Store tokens
 */
function storeTokens(tokens: SpotifyTokens): void {
  safeLocalStorageSet(STORAGE_KEY, tokens);
}

/**
 * Clear tokens (disconnect)
 */
export function disconnectSpotify(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem('spotify_pkce_verifier');
  logger.log('[Spotify] Disconnected');
}

/**
 * Start OAuth flow
 */
export async function connectSpotify(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) {
    logger.warn('[Spotify] Client ID not configured');
    return;
  }

  const { verifier, challenge } = await generatePKCE();

  // Store verifier for callback
  // Use sessionStorage for PKCE verifier (more secure - cleared on tab close)
  sessionStorage.setItem('spotify_pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/**
 * Handle OAuth callback
 */
export async function handleSpotifyCallback(code: string): Promise<boolean> {
  const verifier = sessionStorage.getItem('spotify_pkce_verifier');
  if (!verifier) {
    logger.error('[Spotify] No PKCE verifier found');
    return false;
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const data = await response.json();

    storeTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    sessionStorage.removeItem('spotify_pkce_verifier');
    logger.log('[Spotify] Connected successfully');
    return true;
  } catch (error) {
    logger.error('[Spotify] Callback error:', error);
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
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();

    storeTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    logger.log('[Spotify] Token refreshed');
    return true;
  } catch (error) {
    logger.error('[Spotify] Refresh error:', error);
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
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 204) {
      return null; // No track playing
    }

    if (!response.ok) {
      throw new Error('Failed to get current track');
    }

    const data = await response.json();

    if (!data.item) return null;

    return {
      name: data.item.name,
      artist: data.item.artists.map((a: { name: string }) => a.name).join(', '),
      albumArt: data.item.album.images?.[0]?.url,
      isPlaying: data.is_playing,
      durationMs: data.item.duration_ms,
      progressMs: data.progress_ms,
    };
  } catch (error) {
    logger.error('[Spotify] Get current track error:', error);
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
    const body = contextUri ? JSON.stringify({ context_uri: contextUri }) : undefined;

    const response = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (response.status === 204 || response.ok) {
      logger.log('[Spotify] Playback started');
      return true;
    }

    // Handle 404 - no active device
    if (response.status === 404) {
      logger.warn('[Spotify] No active device found');
      return false;
    }

    throw new Error(`Playback failed: ${response.status}`);
  } catch (error) {
    logger.error('[Spotify] Play error:', error);
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
    const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 204 || response.ok) {
      logger.log('[Spotify] Playback paused');
      return true;
    }

    throw new Error(`Pause failed: ${response.status}`);
  } catch (error) {
    logger.error('[Spotify] Pause error:', error);
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
export async function searchFocusPlaylists(query?: string): Promise<SpotifyPlaylist[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const searchQuery = encodeURIComponent(query || FOCUS_PLAYLIST_QUERY);
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${searchQuery}&type=playlist&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();

    return (data.playlists?.items || []).map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      imageUrl: playlist.images?.[0]?.url,
      trackCount: playlist.tracks?.total || 0,
    }));
  } catch (error) {
    logger.error('[Spotify] Search error:', error);
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
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get playlists');
    }

    const data = await response.json();

    return (data.items || []).map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      imageUrl: playlist.images?.[0]?.url,
      trackCount: playlist.tracks?.total || 0,
    }));
  } catch (error) {
    logger.error('[Spotify] Get playlists error:', error);
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
export async function startFocusPlayback(playlistId?: string): Promise<boolean> {
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
