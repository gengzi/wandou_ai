# Wandou AI

Wandou AI is a video-generation workspace prototype with a React/Vite frontend and a Spring Boot backend scaffold. The current application focuses on the canvas/chat workflow, simulated agent runs, SSE status events, asset management UI, and user management UI.

## Project structure

- `src/` — React frontend, including the workspace canvas, sidebar, assets view, and users view.
- `server.ts` — Node/Express development server and legacy Gemini `/api/chat` proxy.
- `backend/` — Spring Boot backend scaffold for projects, agent runs, SSE streaming, and mock LLM responses.
- `.env.example` — example environment variables for local development.

## Prerequisites

- Node.js 20+
- npm
- Java 17+
- Maven 3.9+

## Environment setup

Copy the example file and adjust values as needed:

```bash
cp .env.example .env.local
```

Important variables:

- `VITE_API_BASE_URL` — frontend API base URL for the Spring Boot backend. Defaults to `http://localhost:8080` in code if not set.
- `GEMINI_API_KEY` — required only for the legacy Node `/api/chat` Gemini proxy.
- `WANDOU_AI_PROVIDER_TYPE` — currently `mock`; the Spring backend does not yet include a real LLM provider implementation.

## Run locally

Install frontend dependencies:

```bash
npm install
```

Start the Spring Boot backend:

```bash
cd backend
mvn spring-boot:run
```

In another terminal, start the frontend/dev server from the repository root:

```bash
npm run dev
```

Open the frontend at `http://localhost:3000`.

## Useful commands

```bash
npm run lint
npm run build
```

Backend checks:

```bash
cd backend
mvn test
```

## Current implementation notes

- The React workspace sends agent runs to `POST /api/agent/runs` and subscribes to run updates through server-sent events.
- The Spring backend currently emits simulated run events and uses a mock LLM provider.
- Project data is stored in memory and is lost when the backend restarts.
- Asset and user management screens are currently UI prototypes backed by local static data.
