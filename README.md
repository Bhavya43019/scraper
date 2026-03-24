# UniCart Workspace

## Project Structure

- `frontend/` - React + Vite client application
- `backend/` - Express scraping and wishlist API

## Run

Open two terminals:

1. Backend
   - `npm run dev:backend`
2. Frontend
   - `npm run dev:frontend`

The frontend runs on `http://localhost:5173` and uses Vite proxy to call backend APIs at `/api`.

## Port Conflict Fix

If backend throws `EADDRINUSE`, it means port `5000` is already used.

- `backend` dev script now auto-clears the port before start.
- You can also run `npx kill-port 5000` manually.

## Deploy On Render

This repo includes `render.yaml` with:

- `unicart-backend` (Node web service from `backend/`)
- `unicart-frontend` (static site from `frontend/`)

After creating services on Render:

1. Set backend env var `MONGO_URI`
2. Copy backend URL (example `https://unicart-backend.onrender.com`)
3. In frontend service set:
   - `VITE_API_URL=https://unicart-backend.onrender.com/api`
4. Redeploy frontend
