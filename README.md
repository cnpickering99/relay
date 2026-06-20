# Relay

A simple project containing a backend Express server and a frontend React/Vite application for the Relay game.

## Repository Structure

- `backend/`
  - `index.js` - Express server entrypoint
  - `package.json` - backend dependencies and scripts

- `frontend/`
  - `game.html` - standalone HTML page (optional)
  - `relay/` - React/Vite application
    - `package.json` - frontend dependencies and scripts
    - `vite.config.js` - Vite configuration
    - `src/` - React source code
      - `App.jsx` - main app entry
      - `main.jsx` - React root renderer
      - `components/relay-game/` - Relay game components
      - `api/` - API client utilities
      - `Util/` - shared utilities

## Prerequisites

- Node.js 18+ (or compatible LTS version)
- npm

## Backend

The backend is a small Express app located in `backend/`.

### Install

```bash
cd backend
npm install
```

### Run

```bash
npm start
```

This starts the backend on `http://localhost:3000`.

## Frontend

The frontend app is a React project powered by Vite in `frontend/relay/`.

### Install

```bash
cd frontend/relay
npm install
```

### Run in development

```bash
npm run dev
```

Then open the local development URL shown in the terminal (usually `http://localhost:5173`).

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Notes

- The backend currently responds with `Hello World!` at the root route `/`.
- The frontend app renders the `RelayGame` component from `src/components/relay-game`.
- If you want to connect the React frontend to the backend, update the frontend API calls and backend routes accordingly.

## Optional Static Page

- `frontend/game.html` appears to be a standalone HTML page and may be used independently of the Vite React app.

## License

This project does not currently include a license file.
