/** Transaction IDs are compared without spaces and in upper case. Safe for client and server. */
export const normaliseTransactionId = (s: string) => s.replace(/\s+/g, "").toUpperCase();
