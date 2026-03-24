# SocialPost

A self-hosted social media scheduler that runs in Docker. Schedule posts across multiple accounts and platforms from a clean web UI. Built to be extensible — Twitter/X is supported today, with more platforms easy to add.

## Features

- **Schedule posts** to one or multiple accounts at a specific date and time
- **Twitter threads** — compose multiple chained tweets in a single post
- **Drafts** — save work in progress and schedule it later
- **Multiple accounts** per platform — connect as many Twitter accounts as you like
- **Queue & History** — view upcoming posts, past sends, and failures with error details
- **Retry & reschedule failed posts** directly from the UI
- **Timezone support** — configure your timezone in Settings; all times display accordingly
- **Encrypted credentials** — OAuth tokens are encrypted at rest using a Fernet key derived from your secret key
- **Persistent scheduler** — APScheduler backed by PostgreSQL, so scheduled posts survive container restarts

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy, APScheduler |
| Frontend | React 18, TypeScript, Tailwind CSS, TanStack Query |
| Database | PostgreSQL 16 |
| Auth | Twitter OAuth 1.0a via Tweepy |
| Infrastructure | Docker Compose |

## Getting Started

### 1. Twitter Developer App

Before running the app, create a Twitter Developer App at [developer.twitter.com](https://developer.twitter.com):

1. Create a new project and app
2. Enable **OAuth 1.0a** with **Read and Write** permissions
3. Add `http://localhost:8000/api/oauth/twitter/callback` to the **Callback URLs**
4. Copy your **API Key** and **API Secret**

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Generate with: openssl rand -hex 32
SECRET_KEY=your-secret-key-here

TWITTER_CONSUMER_KEY=your-api-key
TWITTER_CONSUMER_SECRET=your-api-secret
```

### 3. Run

```bash
docker compose up --build
```

- App: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 4. Connect your Twitter account

Navigate to **Accounts** in the sidebar and click **Connect Twitter Account**. You can connect multiple accounts and choose which ones to target when composing a post.

## Usage

**Compose** — write your post, select one or more accounts, pick a date and time, and hit Schedule. Add tweets to turn it into a thread. Hit **Save as Draft** to save without scheduling.

**Drafts** — posts saved without a schedule. Open any draft to edit and schedule it when ready.

**Queue** — all upcoming scheduled posts. Use the send button to send immediately, or the edit button to make changes before it goes out.

**History** — all sent, failed, and cancelled posts. Filter by status. Failed posts show the exact error and can be retried immediately or rescheduled to a new time.

**Settings** — set your timezone. All scheduled times are displayed and interpreted in this timezone.

## Project Structure

```
socialpost/
├── backend/
│   └── app/
│       ├── adapters/       # Platform adapter pattern (base + twitter)
│       ├── api/routes/     # FastAPI route handlers
│       ├── models/         # SQLAlchemy models
│       ├── scheduler/      # APScheduler job runner
│       ├── crypto.py       # Fernet token encryption
│       └── main.py
└── frontend/
    └── src/
        ├── api/            # Typed API client
        ├── components/     # Shared UI components
        ├── pages/          # Route-level page components
        └── hooks/          # useSettings, useFormatDate
```

## Adding a New Platform

1. Create `backend/app/adapters/<platform>.py` implementing the `SocialAdapter` abstract class
2. Register it in `ADAPTERS` in `adapters/registry.py`
3. Add a seed entry in `seed_platforms()` in `main.py`
4. Add OAuth route(s) in `api/routes/oauth.py`
5. Add a connect button in `frontend/src/pages/Accounts.tsx`
6. Add a platform icon to the `platformIcon` maps in `PostCard.tsx` and `Accounts.tsx`

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SECRET_KEY` | Fernet encryption key seed — keep this secret | — |
| `TWITTER_CONSUMER_KEY` | Twitter App API key | — |
| `TWITTER_CONSUMER_SECRET` | Twitter App API secret | — |
| `TWITTER_CALLBACK_URL` | Must match Twitter Developer Portal | `http://localhost:8000/api/oauth/twitter/callback` |
| `FRONTEND_URL` | Used for CORS and OAuth redirects | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | set by Docker Compose |
