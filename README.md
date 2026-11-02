# church-operation-admin

LifePointe Church admin dashboard (PRD v3): member register, Sunday attendance, weekly headcount, trends, call lists, settings and audit log. One Super Admin account.

Next.js 15 (App Router) · Postgres on Neon · Prisma 6 · Auth.js v5 · Tailwind v4 + shadcn/ui · Recharts.

## Setup

```bash
npm install
cp .env.example .env.local  # fill in DATABASE_URL, DIRECT_URL (unpooled host), AUTH_SECRET
npm run db:migrate          # apply prisma/migrations to Neon
npm run db:seed             # import data/just_attendance.csv + data/chart_2026.csv
npm run setup-admin -- --email you@example.org --password 'at-least-10-chars'
npm run dev
```

- `data/` holds the source sheets with personal data. It is git-ignored and must never be committed.
- `npm run db:seed` is idempotent: running it again changes nothing.
- Forgot the password and email isn't set up yet: `npm run setup-admin -- --email you@example.org --password 'new-password' --reset`.

## Environment

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Neon pooled connection (app) |
| `DIRECT_URL` | Neon direct connection (migrations) |
| `AUTH_SECRET` | Session signing — `openssl rand -base64 32` |
| `APP_URL` | Links in password-reset emails |
| `BLOB_READ_WRITE_TOKEN` | Optional. Keeps uploaded files and weekly backups in Vercel Blob |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional. Password-reset email (sender domain must be verified in Resend) |
| `CRON_SECRET` | Protects `/api/cron/backup` (Vercel sends it automatically) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (phone, names, dates, importers) |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Import the CSVs in `data/` |
| `npm run setup-admin` | Create or reset the Super Admin |
| `npm run db:studio` | Prisma Studio |

## Deploying (Vercel)

1. Import the repo in Vercel, add the Neon integration (sets `DATABASE_URL`/`DIRECT_URL`) and the env vars above.
2. Run `npm run db:migrate` against production before the first deploy and after any schema change.
3. `vercel.json` schedules `/api/cron/backup` every Monday 03:00 UTC: CSV backup of members, attendance and headcounts to Blob, permanent removal of people deleted more than 30 days ago, and audit-log trimming to 2 years.

**Sunday freeze:** no deploys from Saturday 6pm to Sunday 3pm (Lagos time) — attendance is being marked.
