/**
 * Hash function utilities for consistent ID conversion
 */

/**
 * Convert a string to a consistent integer hash
 * Used for converting video IDs to Qdrant point IDs
 */
export function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
