# Property Manager

A self-hosted property management portal for landlords and tenants. Built with FastAPI + React.

## Features

- **Multi-role auth** — Admin, Landlord, and Tenant accounts with JWT authentication
- **Property management** — Landlords create and manage properties (flat, house, HMO)
- **Tenant management** — Admins create tenant accounts scoped to a specific landlord; landlords assign/unassign tenants to properties
- **Tenant invite system** — Landlords generate single-use invite links; tenants self-register via invite and are automatically linked
- **Ticket system** — Tenants raise maintenance requests with priority (low/medium/high/urgent); landlords manage status (open → in progress → awaiting tenant → resolved → closed); tenants confirm resolution to close; unread badge tracking
- **File attachments** — Files (images, PDFs, etc.) can be attached to tickets at creation and to individual comments; images render inline, other files as download links
- **Admin panel** — User management (approve, create, disable, delete with guard rails), global settings (registration toggle, allowed attachment types), stats

## Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Frontend | React 18, TypeScript, Vite, TanStack Query, React Hook Form + Zod, Tailwind CSS |
| Container | Podman / Docker Compose |

## Getting started

```bash
cp .env.example .env   # set SECRET_KEY at minimum
podman-compose up --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

Default admin credentials are set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_USERNAME` env vars (see `.env.example`).

## Database migrations

```bash
# Apply all pending migrations
podman-compose exec backend alembic upgrade head

# Generate a new migration after changing models
podman-compose exec backend alembic revision --autogenerate -m "description"
```

> **Note:** Autogenerate may detect `apscheduler_jobs` as removed — delete those lines before applying.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | _(required)_ | JWT signing key |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `BACKEND_URL` | `http://localhost:8000` | Used for avatar URLs |
| `ADMIN_EMAIL` | `admin@example.com` | Seeded admin email |
| `ADMIN_PASSWORD` | `changeme123` | Seeded admin password (change this!) |
| `ADMIN_USERNAME` | `admin` | Seeded admin username |
| `UPLOAD_DIR` | `/app/uploads` | File upload path |

## Project structure

```
backend/
  app/
    api/routes/       # auth, admin, properties, tenancies, tenants, tickets
    models/           # User, Property, Tenancy, PropertyInvite, LandlordTenant, Ticket, TicketComment, TicketAttachment, TicketRead
    schemas/          # Pydantic v2 request/response schemas
    core/             # JWT + password hashing
  alembic/versions/   # database migrations

frontend/src/
  api/                # typed axios clients (auth, properties, tenants, tickets)
  pages/              # Properties, PropertyDetail, Tenants, Tickets, TicketDetail, Admin, Settings
  components/         # Layout, Sidebar, ProtectedRoute, PageHeader
  contexts/           # AuthContext (JWT + current user)
```
