# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted web application base with user auth, admin panel, and settings. Built with FastAPI + React. Previously a social media scheduler; stripped down to the core user/auth/admin foundation for use as a starting point for new projects.

## Commands

### Start everything
```bash
cp .env.example .env   # fill in TWITTER_CONSUMER_KEY/SECRET and SECRET_KEY
podman-compose up --build
```
App runs at http://localhost:3000, API at http://localhost:8000.

### Production deployment
```bash
podman-compose -f docker-compose.prod.yml up -d
```
Uses pre-built images from GHCR with Nginx reverse proxy on port 80.

### Backend only (for API dev)
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://... uvicorn app.main:app --reload
```

### Frontend only (for UI dev)
```bash
cd frontend
npm install
npm run dev
```

### Database migrations
```bash
# Generate a new migration after changing models
podman-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
podman-compose exec backend alembic upgrade head
```

> **Note:** Autogenerate picks up the `apscheduler_jobs` table as "removed" — always delete those lines from the generated migration before applying.

### Lint frontend
```bash
cd frontend && npm run lint
```

## Architecture

### Backend (`backend/app/`)

**Authentication:**
- JWT-based auth (24h expiry) via `core/security.py`. Dependencies in `api/deps.py`: `get_current_user()`, `get_current_admin()`.
- Users self-register but require admin approval (`is_approved` flag). Admin credentials seeded on startup via `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_USERNAME` env vars.
- Admin panel API: `api/routes/admin.py` — stats, user CRUD, global settings.

**Data model:**
- `User` — email/username/hashed password, role (`ADMIN`/`USER`), `is_approved`, optional `avatar_path`
- `AppSetting` — key/value store for app-wide and per-user settings (e.g. `timezone`, `registration_enabled`). Supports per-user settings via `user_id`. Defaults defined in `models/settings.py:DEFAULTS`.

**Token encryption:** `crypto.py` uses PBKDF2-derived Fernet key from `SECRET_KEY`. Call `encrypt()`/`decrypt()` for any secrets stored in the DB.

### Frontend (`frontend/src/`)

- **Routing:** React Router with a single `Layout` wrapper (sidebar + main content outlet)
- **Data fetching:** TanStack Query — query keys follow `['posts', status?]` and `['accounts']` patterns
- **Forms:** React Hook Form + Zod validation (see `Compose.tsx`)
- **Notifications:** `react-hot-toast`
- **Styling:** Tailwind CSS with shared component classes defined in `index.css` (`.btn`, `.btn-primary`, `.card`, `.badge`, `.input`)

**Pages:**
- `Dashboard` — welcome page; extend with app-specific content
- `Settings` — timezone selector (searchable dropdown with live clock preview); persisted via `AppSetting`
- `Admin` — tabs for system stats (user counts), user management (approve/create/delete), and global settings (`registration_enabled`)
- `Login` / `Register` — JWT auth flow; registration may be disabled by admin

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | _(required)_ | Derives Fernet encryption key for OAuth tokens and JWT signing |
| `FRONTEND_URL` | `http://localhost:3000` | Used for CORS |
| `BACKEND_URL` | `http://localhost:8000` | Used internally |
| `ADMIN_EMAIL` | `admin@example.com` | Seeded admin account |
| `ADMIN_PASSWORD` | `changeme123` | Seeded admin password (change this!) |
| `ADMIN_USERNAME` | `admin` | Seeded admin username |
| `UPLOAD_DIR` | `/app/uploads` | File storage path |

