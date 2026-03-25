# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted property management portal for landlords and tenants. Built with FastAPI + React. Supports multi-role auth (Admin / Landlord / Tenant), property management, tenant assignment, a ticket/maintenance system, and an admin panel.

## Commands

### Start everything
```bash
cp .env.example .env   # set SECRET_KEY at minimum
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
# Apply migrations
podman-compose exec backend alembic upgrade head

# Generate a new migration after changing models
podman-compose exec backend alembic revision --autogenerate -m "description"
```

> **Note:** If the DB was created via `create_all` (app startup) without running migrations, stamp the current revision first: `alembic stamp <revision_id>`, then run `upgrade head`.

### Lint frontend
```bash
cd frontend && npm run lint
```

## Architecture

### Backend (`backend/app/`)

**Authentication:**
- JWT-based auth (24h expiry) via `core/security.py`. Dependencies in `api/deps.py`: `get_current_user()`, `get_current_admin()`, `get_current_landlord()`, `get_current_tenant()`.
- Users self-register (if enabled) but require admin approval (`is_approved` flag). Admin credentials seeded on startup via `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_USERNAME` env vars.
- Admin panel API: `api/routes/admin.py` — stats, user CRUD, global settings.

**Data model:**
- `User` — email/username/hashed password, role (`ADMIN`/`LANDLORD`/`TENANT`), `is_approved`, optional `avatar_path`
- `Property` — owned by a landlord (`landlord_id`), supports flat/house/HMO types
- `Tenancy` — links a tenant to a property (with optional start/end dates)
- `PropertyInvite` — single-use token for tenant self-registration; auto-creates `Tenancy` and `LandlordTenant` on use
- `LandlordTenant` — composite PK `(landlord_id, tenant_id)`; scoped ownership so tenant accounts belong to one landlord and data is isolated per landlord
- `Ticket` — maintenance request or visit request; tied to a property; `assigned_to_tenant_id` for visit routing
- `TicketComment` — threaded comments on tickets
- `TicketRead` — composite PK `(ticket_id, user_id)`; tracks read/unread state per user
- `AppSetting` — key/value store for global settings (e.g. `registration_enabled`)

**Route files:**
- `auth.py` — register, register-by-invite, login, me, avatar upload
- `admin.py` — user CRUD (with deletion guard rails), landlord list, stats, settings
- `properties.py` — CRUD for landlords; `GET /mine` for tenant property view
- `tenancies.py` — invite generation and tenancy management (under `/api/properties/{id}/...`)
- `tenants.py` — landlord tenant pool: list, assign to property, unassign (`/api/tenants/`)
- `tickets.py` — full ticket CRUD, comments, visit responses, unread count

**Route ordering:** Literal paths (e.g. `/mine`, `/unread-count`) must be registered before parameterised paths (`/{id}`) in the same router.

### Frontend (`frontend/src/`)

- **Routing:** React Router with a single `Layout` wrapper (sidebar + main content outlet)
- **Data fetching:** TanStack Query
- **Forms:** React Hook Form + Zod validation
- **Notifications:** `react-hot-toast`
- **Styling:** Tailwind CSS with shared component classes defined in `index.css` (`.btn`, `.btn-primary`, `.card`, `.badge`, `.input`)

**Pages:**
- `Dashboard` — welcome page
- `Properties` — landlord CRUD view or tenant read-only view (branches on role)
- `PropertyDetail` — property info, tenancy list, invite management, schedule visit button (landlord only)
- `Tenants` — landlord's tenant pool; assign/unassign/move tenants to properties (landlord only)
- `Tickets` — open/closed tabs with property filter, unread highlighting
- `TicketDetail` — thread view, visit response panel for tenants, auto-marks read on mount
- `Settings` — timezone selector
- `Admin` — stats, user management (create with landlord assignment for tenants), global settings

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | _(required)_ | JWT signing key |
| `FRONTEND_URL` | `http://localhost:3000` | Used for CORS |
| `BACKEND_URL` | `http://localhost:8000` | Used for avatar URLs |
| `ADMIN_EMAIL` | `admin@example.com` | Seeded admin account |
| `ADMIN_PASSWORD` | `changeme123` | Seeded admin password (change this!) |
| `ADMIN_USERNAME` | `admin` | Seeded admin username |
| `UPLOAD_DIR` | `/app/uploads` | File storage path |
