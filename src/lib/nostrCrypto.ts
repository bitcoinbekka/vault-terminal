/**
 * NIP-44 self-encryption for user-owned app data.
 *
 * Watchlist, positions, alerts and trades are stored as kind 30078 events.
 * When encryption is enabled their `content` is NIP-44 ciphertext encrypted to
 * the owner's own pubkey, and the event carries an `enc` tag. Only the owner
 * (or the server watcher holding their nsec) can decrypt. NIP-44 is the same
 * cipher used by NIP-17 gift-wrapped DMs.
 *
 * Signers that implement `nip44.encrypt/decrypt` (nsec, browser extension,
 * remote signer) are supported via the user's `NUser.signer`.
 */

export const ENC_TAG = 'nip44';

export interface Nip44Signer {
  nip44: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

/** True when the event's content is encrypted (has an `enc` tag). */
export function isEncryptedEvent(event: { tags: string[][] }): boolean {
  return event.tags.some(([name]) => name === 'enc');
}

/** Encrypt any JSON-serializable payload to the owner's own pubkey. */
export async function encryptOwnData(
  signer: Nip44Signer,
  pubkey: string,
  data: unknown,
): Promise<string> {
  return signer.nip44.encrypt(pubkey, JSON.stringify(data));
}

/** Decrypt the event content and JSON.parse it. Returns null on failure. */
export async function decryptOwnData<T>(
  signer: Nip44Signer,
  pubkey: string,
  content: string,
): Promise<T | null> {
  try {
    const plaintext = await signer.nip44.decrypt(pubkey, content);
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}
