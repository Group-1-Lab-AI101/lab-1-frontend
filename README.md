# Saigon Route Lab Frontend

Responsive React, TypeScript, Vite, and Leaflet interface for the Ho Chi Minh
City traffic search project.

## Run locally

Start the backend on port 8000 first, then run:

```powershell
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173`. Vite proxies REST and WebSocket requests to
`http://127.0.0.1:8000`.

## Main workflows

- Single route search with BFS, DFS, UCS, A*, Dijkstra, or Greedy Best-First.
- Live playback of visited, frontier, and current search nodes.
- Side-by-side algorithm comparison with selectable map routes.
- Nearest-neighbor and exact multi-landmark route optimization.
- Interactive map with road network, district boundary polygon, and OpenStreetMap background tile map toggle button.
- Five cost criteria and three traffic profiles.
- Desktop and mobile layouts with route metrics and explanations.

## Production check

```powershell
pnpm build
pnpm preview
```
