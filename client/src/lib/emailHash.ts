function normalizeEmail(email: string) {
  return email.trim().toLowerCase().normalize('NFKC');
}

export async function hashEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const input = new TextEncoder().encode(normalizedEmail);
  const digest = await crypto.subtle.digest('SHA-256', input);
  const bytes = new Uint8Array(digest);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
