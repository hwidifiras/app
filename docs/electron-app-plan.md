# Offline Electron implementation

Implemented in the offline edition of `hwidifiras/app` on `codex/offline-nosql`.

The former connected-client proposal is superseded by a standalone Windows x64 application. Electron launches the packaged Next.js application and an authenticated local MongoDB replica set. Screens and business services are shared; server and database processes bind only to loopback. No cloud service or installed database server is required for daily work.

See [the current architecture](offline-architecture.md) and the root README for packaging, testing, backup, restore and opt-in import instructions. The route inventory remains a reference to the original application surface. This edition starts with a fresh local club; no live database is accessed automatically.
