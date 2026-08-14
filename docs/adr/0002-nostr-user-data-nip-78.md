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
| Watchlist | `vault:watchlist` | `{version, symbols[]}` + `t` tags per symbol (relay-queryable) |
| Positions | `vault:positions` | `{version, positions[]}` (equity + OCC option contracts) |
| Price alerts | `vault:alerts` | `{version, alerts[]}` (direction/value/firedAt) |
| Trade journal | `vault:trades` | `{version, trades[]}` (buy/sell, price, fees, note) |

Rules enforced everywhere:

- Queries always constrain `authors: [user.pubkey]` — the `d` tag alone is not
  a trust boundary (Nostr is permissionless).
- Reads go through the default relay pool; writes via `useNostrPublish`
  (auto-adds the NIP-89 `client` tag).
- Mutations are optimistic in TanStack Query, with rollback on publish failure.
- The full schema is documented in `NIP.md`.

## Consequences

- Users own their data; any Nostr client can see the events; switching devices
  just requires logging in with the same npub.
- Relays decide retention; replaceable events mean only the latest version per
  `(pubkey, kind, d)` is kept by conforming relays.
- Events are public by nature — nothing private is stored (trades, positions
  and alerts are readable by anyone with the pubkey). Acceptable for this app.
- Publishing requires the user's signer; a logged-out user gets read-only
  previews (starter watchlist) and login prompts at every write surface.
