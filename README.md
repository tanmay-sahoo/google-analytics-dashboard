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

## Notes
- GA4/Ads OAuth is supported; connect the workspace OAuth in Admin → Integrations and store property/customer IDs per project.
- Slack webhook is stored in rule channels for future integration.
## Google OAuth integration
- Create a Google Cloud OAuth client (Web app) and set the redirect URI to `GOOGLE_REDIRECT_URI`.
- Enable the GA4 Data API and Google Ads API in the project.
- Provide a Google Ads developer token and optional manager customer ID if using MCC.
