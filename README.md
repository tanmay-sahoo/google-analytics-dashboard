# Marketing Data Hub

Multi-tenant analytics dashboard for GA4 and Google Ads with role-based access control.

## Tech stack
- Next.js App Router + TypeScript + Tailwind
- PostgreSQL + Prisma
- NextAuth (Credentials, optional Google OAuth)

## Setup

1) Install dependencies

```bash
npm install
```

2) Configure environment

Create `.env` (see `.env.example`).

3) Run migrations + seed

```bash
npm run prisma:migrate
npm run prisma:seed
```

4) Start the app

```bash
npm run dev
```

Default admin:
- Email: `admin@company.com`
- Password: `Admin@123`

## Useful endpoints
- `POST /api/metrics/sync` `{ projectId }` to generate mock metrics
- `POST /api/cron/evaluate-alerts` to evaluate rules daily
- `POST /api/cron/ingest-metrics` to ingest daily GA4/Ads metrics for all projects

## Notes
- GA4/Ads OAuth is supported; connect the workspace OAuth in Admin -> Integrations and store property/customer IDs per project.
- Slack webhook is stored in rule channels for future integration.

## Cron security
- Set `CRON_SECRET` in `.env` to secure cron endpoints.
- When set, call cron endpoints with header `x-cron-secret: <CRON_SECRET>`.

## VPS automatic scheduler
- Run the ingestion worker alongside the app:
- By default, `npm run start` now launches both the web server and the ingestion worker.
- You can still run the worker alone with `npm run worker:ingestion`.
- It polls ingestion settings every minute and triggers `POST /api/cron/ingest-metrics` when due.
- Set `APP_BASE_URL` (or `NEXTAUTH_URL`) and `CRON_SECRET` in the environment.

## Logging
- Admin logs are available at `/admin/logs` with tabs for activity, ingestion runs, and per-project fetches.

## AI suggestions
- Optional product optimization suggestions in Merchant Products.
- Set one or more of: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`.

## Google OAuth integration
- Create a Google Cloud OAuth client (Web app) and set the redirect URI to `GOOGLE_REDIRECT_URI`.
- Enable the GA4 Data API and Google Ads API in the project.
- Provide a Google Ads developer token. Manager customer ID is optional and only needed when using an MCC. Leave it empty for direct-access accounts. If you hit a 404, set `GOOGLE_ADS_API_VERSION` (default `v19`) to a supported Ads API version.
