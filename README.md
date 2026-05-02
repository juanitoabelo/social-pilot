# SocialPilot

AI-powered social media content creation, scheduling, and publishing platform.

## What It Does

Campaign brief → AI generates platform-specific copy (Claude) + images (DALL-E 3) → User reviews, edits, approves → Scheduled publishing via BullMQ worker queue → Engagement analytics.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | NextAuth.js v5 (Credentials + Google OAuth) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Job Queue | BullMQ + Redis (Upstash) |
| AI — Text | Anthropic Claude API |
| AI — Image | OpenAI DALL-E 3 |
| Image Processing | Sharp (resize/format per platform specs) |
| Storage | AWS S3 + CloudFront CDN |
| State | TanStack Query (server), Zustand (client) |
| UI | Shadcn/ui components |

## Monorepo Structure

```
/
├── apps/
│   ├── web/                  # Next.js 14 frontend + API routes
│   └── worker/               # BullMQ job processor (standalone Node process)
├── packages/
│   ├── database/             # Prisma schema, migrations, DB client
│   ├── shared/               # Shared types, constants, Redis/Queue utilities
│   └── ui/                   # Shared React component library
├── .env.local                # Environment secrets (never commit)
└── CLAUDE.md                 # AI development context
```

## Key Architecture

- **Multi-tenant** — every resource belongs to a workspace, all queries filtered by `workspace_id`
- **Async everything** — content generation runs as background BullMQ jobs, never blocks HTTP
- **SSE streaming** — live generation progress pushed to frontend via Server-Sent Events
- **Brand compliance scoring** — each post scored against workspace `do`/`dont` rules
- **OAuth tokens encrypted at rest** — AES-256-GCM, key in `ENCRYPTION_KEY` env var

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local   # Fill in your secrets

# Run database migrations
pnpm db:migrate

# Start dev server
pnpm dev:web                  # Next.js on http://localhost:3000

# Start worker (separate terminal)
pnpm dev:worker               # BullMQ content generation worker

# Optional: open database GUI
pnpm db:studio                # Prisma Studio on http://localhost:5555
```

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in parallel |
| `pnpm dev:web` | Start Next.js dev server only |
| `pnpm dev:worker` | Start BullMQ worker only |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed database with test data |
| `pnpm typecheck` | TypeScript check across monorepo |
| `pnpm lint` | ESLint across monorepo |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | E2E tests (Playwright) |

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL=           # PostgreSQL connection string
REDIS_URL=              # Redis connection string
NEXTAUTH_SECRET=        # NextAuth signing key
NEXTAUTH_URL=           # App URL (http://localhost:3000 for dev)
ANTHROPIC_API_KEY=      # Claude API key
OPENAI_API_KEY=         # DALL-E 3 API key
ENCRYPTION_KEY=         # 32-char key for OAuth token encryption
AWS_ACCESS_KEY_ID=      # S3 access
AWS_SECRET_ACCESS_KEY=  # S3 secret
AWS_REGION=             # S3 region
S3_BUCKET=              # S3 bucket name
CLOUDFRONT_URL=         # CDN base URL
```

## Build Status

Phase 1-2 complete: Auth, workspaces, campaigns, AI content pipeline, review UI, compliance scoring, TanStack Query, SSE progress streaming.

MVP scope: Instagram + Facebook, text + image, manual scheduling, basic analytics.
