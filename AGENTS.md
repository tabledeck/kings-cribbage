# Kings Cribbage — Dev Notes

## Cloudflare Durable Objects: Persistent State Pattern

**Rule: DO class fields are ephemeral. Persist everything that matters to `gameState`.**

DOs can hibernate/evict between requests (e.g. between an HTTP `/join` call and the subsequent WebSocket connection). Any `private _foo` class field resets to its default on re-initialization.

- `persistState()` → writes full `gameState` to DO storage (survives eviction)
- `serializeGameState()` → client transport only; strip server-only fields here
- WebSockets are a **write-through cache** on top of persisted state, not the source of truth

If you need a server-only field (e.g. a secret number clients shouldn't see), store it in `gameState` and exclude it in `serializeGameState()`. Do NOT store it as a class field.
