const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

async function importKey(rawKeyHex: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(
    rawKeyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
  );
  if (keyBytes.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptToken(
  plaintext: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded,
  );
  const cipherBytes = new Uint8Array(cipherBuf);

  // Format: base64(iv + ciphertext_with_tag)
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  return toBase64(combined);
}

export async function decryptToken(
  encrypted: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex);
  const combined = fromBase64(encrypted);

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plainBuf = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuf);
}

export async function decryptTokenWithKeyRotation(
  encrypted: string,
): Promise<string> {
  const currentKey = Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY');
  if (!currentKey) throw new Error('Missing GMAIL_TOKEN_ENCRYPTION_KEY');

  try {
    return await decryptToken(encrypted, currentKey);
  } catch {
    const oldKey = Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY_OLD');
    if (!oldKey) throw new Error('Decryption failed and no old key available');
    return await decryptToken(encrypted, oldKey);
  }
}
