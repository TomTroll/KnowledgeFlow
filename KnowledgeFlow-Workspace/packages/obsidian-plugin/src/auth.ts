// packages/obsidian-plugin/src/auth.ts
// Bearer token hashing and validation using the Web Crypto API.
//
// Design:
//   - hashToken()     → pure async function, usable anywhere (plugin + tests)
//   - validateBearer() → parses the Authorization header, hashes the raw
//                        token, and compares to the stored SHA-256 hash.
//
// The raw token is NEVER stored. Only the SHA-256 hash lives in PluginSettings.

/**
 * Computes the SHA-256 hex digest of a UTF-8 string.
 * Uses the Web Crypto API (available in both Electron and Chrome Extension).
 */
export async function hashToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates an incoming HTTP Authorization header against the stored SHA-256
 * hash of the raw token.
 *
 * @param authHeader  The raw value of the `Authorization` HTTP header
 *                    (expected format: `"Bearer <rawToken>"`).
 * @param storedHash  The SHA-256 hex digest stored in PluginSettings.
 * @returns           true if the token is valid, false otherwise.
 */
export async function validateBearer(
  authHeader: string | undefined,
  storedHash: string,
): Promise<boolean> {
  // Reject immediately if plugin is unconfigured (no token set yet)
  if (!storedHash) return false;

  // Header must exist and start with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const rawToken = authHeader.slice('Bearer '.length);
  if (!rawToken) return false;

  const incoming = await hashToken(rawToken);
  return incoming === storedHash;
}
