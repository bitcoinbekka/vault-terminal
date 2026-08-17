# ADR 0002 — User data stored on Nostr (NIP-78, kind 30078)

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

The product promise is "decentralized": the user's watchlist, positions,
alerts and trade journal should follow their npub across devices and not be
locked in a proprietary backend. There is no server of our own for user data.

## Decision

Store all user state as **NIP-78 application-specific data**, event kind
`30078` (addressable), one event per dataset, with author-constrained reads:

| Dataset | `d` tag | Content |
| --- | --- | --- |
| Watchlist | `vault:watchlist` | `{version, symbols[]}` |
| Positions | `vault:positions` | `{version, positions[]}` (equity + OCC option contracts) |
| Price alerts | `vault:alerts` | `{version, alerts[]}` (direction/value/firedAt) |
| Trade journal | `vault:trades` | `{version, trades[]}` (buy/sell, price, fees, note) |
| Hourly snapshots | `vault:snapshot:<SYMBOL>:<hour>` | `{version, symbol, price, …}` (written by the VPS pusher) |
| SEC fundamentals | `vault:fundamentals:<SYMBOL>` | `{version, years[], …}` (written by the VPS SEC fetcher) |

Rules enforced everywhere:

- Queries always constrain `authors: [user.pubkey]` — the `d` tag alone is not
  a trust boundary (Nostr is permissionless).
- **All user datasets are encrypted with NIP-44 to the owner's own pubkey**
  (the same cipher NIP-17 uses for gift-wrapped DMs). The event `content` is
  ciphertext, marked with an `enc` tag, so relays and other users cannot read
  the symbols, positions, alerts or trades. Server-side services decrypt
  because they hold the owner's nsec on the owner's VPS. See `NIP.md`.
- Reads go through the default relay pool; writes via `useNostrPublish`
  (auto-adds the NIP-89 `client` tag).
- Mutations are optimistic in TanStack Query, with rollback on publish failure.
- The full schema is documented in `NIP.md`.

## Consequences

- Users own their data; only the owner can decrypt it; switching devices just
  requires logging in with the same npub.
- Relays decide retention; replaceable events mean only the latest version per
  `(pubkey, kind, d)` is kept by conforming relays.
- NIP-44 self-encryption makes the events private-by-default — nothing about
  the user's holdings is exposed on relays (earlier plaintext events remain
  readable via a plaintext fallback).
- Signers must support `nip44.encrypt/decrypt` (nsec, modern NIP-07
  extensions, NIP-46 remote signers all do).
- Publishing requires the user's signer; a logged-out user gets read-only
  previews (starter watchlist) and login prompts at every write surface.
