# King's Cribbage

A real-time multiplayer word tile game on [tabledeck.us](https://tabledeck.us). Players take turns placing letter tiles on a shared board to form words and score points — inspired by the scoring mechanics of cribbage.

## Stack

- [React Router v7](https://reactrouter.com) — full-stack React framework
- [Cloudflare Workers](https://workers.cloudflare.com) + [Durable Objects](https://developers.cloudflare.com/durable-objects/) — edge compute and real-time WebSocket state
- [@tabledeck/game-room](https://github.com/nrsundberg/tabledeck-game-room) — shared DO base class, WebSocket hook, and guest-join infrastructure
- [Prisma](https://www.prisma.io) + [Turso](https://turso.tech) — database
- [Tailwind CSS](https://tailwindcss.com) — styling

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. You'll need a `.dev.vars` file with the required environment variables (Turso DB URL and auth token, etc.).

## Deployment

```bash
npm run build
wrangler deploy
```

## How the real-time layer works

Game state lives in a Cloudflare Durable Object (`GameRoomDO`) that extends `BaseGameRoomDO` from `@tabledeck/game-room`. Each game room is a single DO instance identified by the game's nanoid slug.

- Players connect via WebSocket on `/game/:gameId/ws`
- The DO persists state to its built-in KV storage and broadcasts updates to all connected clients
- Guest identity is stored in a short-lived cookie (`kc_<gameId>`) so players reclaim their seat on reload

See the [@tabledeck/game-room docs](https://github.com/nrsundberg/tabledeck-game-room) for the full architecture.

## License

Copyright © Noah Sundberg. Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

You are free to view, fork, and contribute to this code. **Commercial use is not permitted.** This project is part of [tabledeck.us](https://tabledeck.us) — a free, non-commercial platform for online board games.
