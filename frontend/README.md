# Signal Clone — frontend

Next.js (App Router) + TypeScript + Tailwind v4 client for the Signal-style messenger.

Full project documentation (architecture, API, WebSocket events, schema, deployment) is in the
[root README](../README.md).

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                  # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
npm test                     # needs the backend running, see root README → Testing
```
