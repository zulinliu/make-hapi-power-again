/**
 * Generates a random ID string that works in both secure and non-secure contexts.
 *
 * crypto.randomUUID() is only available in secure contexts (HTTPS or localhost).
 * When accessed over HTTP on a LAN IP, it throws TypeError, breaking file
 * attachment and other ID-generation paths.
 *
 * Fallback chain:
 *   1. crypto.randomUUID()           — secure context (HTTPS / localhost)
 *   2. crypto.getRandomValues()      — available in non-secure contexts on modern browsers
 *   3. Math.random() UUID v4         — last resort for very old environments
 *
 * All paths return a UUID v4-format string, maintaining compatibility with
 * strict ID consumers (DB, SSE, RPC payloads, cloneId validation).
 */
function uuidV4FromBytes(source: Uint8Array): string {
    const bytes = Array.from(source)
    // Set version 4 bits
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
    // Set variant bits
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function randomId(): string {
    const c = globalThis.crypto

    if (typeof c?.randomUUID === 'function') {
        return c.randomUUID()
    }

    if (typeof c?.getRandomValues === 'function') {
        const bytes = new Uint8Array(16)
        c.getRandomValues(bytes)
        return uuidV4FromBytes(bytes)
    }

    // Fallback for environments without any crypto support
    const bytes = new Uint8Array(16)
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256)
    }
    return uuidV4FromBytes(bytes)
}
