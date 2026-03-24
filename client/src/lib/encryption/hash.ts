function normalizeString(string: string) {
  return string.trim().toLowerCase().normalize('NFKC');
}

export async function hashString(string: string) {
  const normalizedString = normalizeString(string);
  const input = new TextEncoder().encode(normalizedString);
  const digest = await crypto.subtle.digest('SHA-256', input);
  const bytes = new Uint8Array(digest);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
