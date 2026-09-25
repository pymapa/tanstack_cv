/** RFC 9562 UUIDv7: 48-bit ms timestamp + 74 random bits. Time-sortable, not guessable. */
export const uuidv7 = (nowMs: number = Date.now()): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const ts = BigInt(nowMs)
  for (let i = 0; i < 6; i++) bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
