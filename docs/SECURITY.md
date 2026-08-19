# Vault Terminal — Security & Privacy

This document records the security posture, an audit of the encryption/privacy
implementation, and the honest risk list for using the terminal.

## Encryption model

Everything the user owns is stored as **Nostr kind 30078 events**, and every
dataset's `content` is **NIP-44 ciphertext encrypted to the owner's own
pubkey** (the same cipher NIP-17 uses for gift-wrapped DMs). Relays and other
users see only ciphertext + an `enc` tag. Only the owner's signer — or the
VPS services holding the owner's nsec — can decrypt.

| Dataset | `d` tag | Symbol in tags? |
| --- | --- | --- |
| Watchlist | `vault:watchlist` | **No** (fully private) |
| Positions | `vault:positions` | **No** |
| Alerts | `vault:alerts` | **No** |
| Trades | `vault:trades` | **No** |
| Snapshots | `vault:snapshot:<key>:<hour>` | Hashed only |
| Fundamentals | `vault:fundamentals:<key>` | Hashed only |
| AI reports | `vault:analysis:<key>` | Hashed only |

`<key>` = SHA-256 of the uppercase symbol, hex, first 16 chars
(`src/lib/nostrCrypto.ts` → `symKey`, mirrored server-side with `node:crypto`).
The symbol itself never appears in plaintext anywhere on the network.

## Audit results (2026-08-19)

Static audit of `src/` + `server/`:

| Check | Result |
| --- | --- |
| Writes encrypted via `encryptOwnData` / `nip44Encrypt` | ✅ 10 call sites, all content paths |
| Reads decrypted via `decryptOwnData` / `nip44Decrypt` | ✅ 14 call sites |
| Queries author-constrained (`authors: [pubkey]`) | ✅ everywhere user data is read |
| `enc` tag set on every encrypted publish | ✅ 9 sites |
| `dangerouslySetInnerHTML` / raw `innerHTML=` | ✅ **0** (note content is plaintext-rendered) |
| Event/feed URLs sanitized before `href`/`src`/CSS | ✅ `sanitizeUrl` / `sanitizeImageUrl` |
| `nsec` never logged or rendered | ✅ (NIP19Page 404s on nsec) |
| CSP | ✅ restrictive: `script-src 'self'` (no unsafe-eval/inline), `connect-src` limited |

**Found & fixed during the audit:** snapshot/fundamentals/analysis events used
to carry the **symbol in plaintext** in their `d`/`t` tags — an observer could
tell *which symbols* you track/analyze. Fixed by hashing symbol keys in tags
(see above). Content was and remains encrypted.

## Threat model & honest risks

1. **Your key on the VPS** — `VAULT_NSEC` sits in `/etc/vault-alerts.env` on
   your own server (root-readable). If the VPS is compromised, alerts/snapshots
   data and the key are exposed. This is the standard "personal bot on personal
   hardware" tradeoff. Mitigations: keep the box patched, don't share it, use a
   firewall, and consider a dedicated watcher key (documented future path).
2. **nsec in browser `localStorage`** (template behavior) — any XSS on the app
   origin could steal it. The shipped CSP is defense-in-depth; we never use
   `innerHTML`, sanitize URLs, and render note content as plaintext. This is
   the top browser-side risk and is mitigated but not eliminated.
3. **Metadata visibility** — even with hashed tags, observers can see *that*
   this pubkey publishes snapshots/fundamentals/AI reports (kinds, counts,
   timestamps). They cannot see symbols, sizes, prices, or content.
4. **Delayed data** — quotes/charts/options are delayed, not real-time.
   Decision-support only; the app cannot execute trades, so it can't lose you
   money by itself.
5. **AI analysis is opinion** — the LLM reads SEC data and forms a verdict; it
   can be wrong. Not financial advice. Always verify.
6. **Relays see events** — relays store ciphertext and could drop/refuse data
   (decentralization caveat: your history depends on relays' retention).
7. **No secrets in chat** — API keys and nsecs belong in `/etc/vault-alerts.env`
   on the server, never in chat, never in the repo.

## Key handling rules

- `VAULT_NSEC` → `/etc/vault-alerts.env` (root-owned, not in git).
- `ANALYZER_API_KEY` → same file.
- Repo contains only `.env.example` templates — never real secrets.
- Treat any chat that asks for a key as a red flag.
