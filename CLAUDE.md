# CLAUDE.md — Social Media Automation Platform

This file is the authoritative context document for AI-assisted development on this project.
Read this before writing any code, suggesting any architecture change, or answering any question about the system.

---

## Project identity

**Name:** SocialPilot (working title — rename as needed)
**Type:** Full-stack SaaS web application
**Purpose:** Automate social media content creation, scheduling, and publishing across all major platforms using AI.

### What this system does
A user provides a campaign brief (topic, tone, target audience). The system:
1. Generates platform-specific copy (captions, hashtags, CTAs) using Claude API
2. Generates images using DALL·E 3 or Replicate (Flux/SDXL)
3. Resizes and formats assets per platform specs
4. Lets the user review, edit, and approve content
5. Schedules posts at optimal times (AI-recommended or manual)
6. Publishes automatically via each platform's official API
7. Fetches engagement metrics and feeds them back to improve future content

---

## Monorepo structure

```
/
├── apps/
│   ├── web/                  # Next.js 14 frontend + API routes
│   └── worker/               # BullMQ job processor (standalone Node process)
├── packages/
│   ├── database/             # Prisma schema, migrations, DB client
│   ├── shared/               # Shared types, constants, utilities
│   └── ui/                   # Shared React component library (Shadcn/ui base)
├── CLAUDE.md                 # ← You are here
└── Plan.md                   # Full project plan and build timeline
```

---

## Tech stack (locked — do not suggest alternatives without a strong reason)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Server components by default |
| Language | TypeScript (strict mode) | No `any` types |
| Styling | Tailwind CSS + Shadcn/ui | No CSS modules, no styled-components |
| State (client) | Zustand | For global UI state only |
| State (server) | TanStack Query (React Query) | All server data fetching |
| Auth | NextAuth.js v5 | Email/password + Google OAuth |
| Database | PostgreSQL via Neon | Serverless Postgres |
| ORM | Prisma | All DB access goes through Prisma client |
| Job queue | BullMQ + Redis (Upstash) | All async/scheduled work |
| File storage | AWS S3 + CloudFront CDN | All generated images and videos |
| AI — text | Anthropic Claude API | `claude-sonnet-4-5` model |
| AI — image | OpenAI DALL·E 3 | Primary; Replicate as fallback/bulk |
| AI — video | FFmpeg + OpenAI TTS | Server-side video composition |
| Image processing | Sharp (Node.js) | Resize, format conversion |
| Calendar UI | FullCalendar (React) | Drag-and-drop scheduler |
| Charts | Recharts | Analytics dashboard |
| Email | Resend | Transactional emails |
| Payments | Stripe | Subscriptions + usage billing |
| Deployment — web | Vercel | Auto-deploy from main branch |
| Deployment — worker | Railway | Always-on container |

---

## Key architectural decisions

### Multi-tenancy model
- Every resource belongs to a **workspace** (brand account)
- Users can belong to multiple workspaces with different roles
- All database queries MUST include `workspace_id` in the WHERE clause
- Row-level security enforced at the application layer (not DB-level for now)

### Content generation flow
```
Campaign brief
  → Claude API (copy per platform, returns JSON)
  → DALL·E 3 (image, using Claude-engineered prompt)
  → Sharp (resize to platform specs)
  → S3 upload
  → Review queue (status: pending_review)
  → User approves
  → BullMQ (status: scheduled)
  → Publisher worker fires at scheduled_at
  → Platform API
  → PostMetrics fetched every 6h
```

### Async everything
- Content generation is a background job — never block the HTTP request
- Use SSE (Server-Sent Events) to push progress to the frontend in real time
- All platform publishing goes through BullMQ, never direct HTTP calls in API routes

### OAuth token security
- All platform OAuth tokens are encrypted at rest (AES-256-GCM)
- The encryption key is in `ENCRYPTION_KEY` env var — never commit this
- Tokens are refreshed proactively every 6 hours by a background job

---

## Database schema (canonical)

See `packages/database/prisma/schema.prisma` for the full schema.

Key tables:
- `workspaces` — the top-level tenant unit
- `users` + `workspace_members` — users and their workspace roles
- `campaigns` — a collection of posts around a single brief
- `posts` — a single post for a single platform (one campaign → many posts)
- `assets` — images/videos attached to posts (stored in S3)
- `platform_connections` — OAuth credentials per workspace per platform
- `post_metrics` — engagement snapshots (fetched periodically, not real-time)
- `schedule_jobs` — BullMQ job tracking for debugging/retry

---

## Platform API notes

| Platform | API | Auth | Posting flow | Notes |
|---|---|---|---|---|
| Instagram | Meta Graph API v18 | OAuth 2.0 | Upload container → publish | Requires IG Business account linked to FB Page |
| Facebook | Meta Graph API v18 | OAuth 2.0 | Single POST to /feed | Same app as Instagram |
| X / Twitter | X API v2 | OAuth 2.0 PKCE | Upload media → post tweet | Requires Basic plan ($100/mo) for write access |
| TikTok | Content Posting API | OAuth 2.0 | Apply for access first | Approval takes 2–4 weeks — apply on day 1 |
| LinkedIn | Marketing Developer API | OAuth 2.0 | Register asset → UGC post | Apply for Marketing Developer Platform access |
| Pinterest | Pinterest API v5 | OAuth 2.0 | Create Pin endpoint | Requires Business account |

**Rate limit tracking:** Each platform adapter tracks remaining calls in Redis. If remaining < 5, the job is delayed until reset time (retryable error).

---

## Environment variables

All secrets are stored in `.env.local` (never committed). See `.env.example` for required keys.

```
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET=
CLOUDFRONT_URL=

# AI APIs
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Encryption (for OAuth tokens)
ENCRYPTION_KEY=

# Platform OAuth apps
META_APP_ID=
META_APP_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=

# Email
RESEND_API_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## Code conventions

### File naming
- React components: `PascalCase.tsx`
- Utilities, hooks, lib: `camelCase.ts`
- API routes: Next.js App Router convention (`route.ts`)
- Database queries: `packages/database/queries/[model].ts`

### API response format
All API routes return a consistent shape:
```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { code: string, message: string } }
```

### Error handling
- All async functions throw typed errors (never return `null | undefined` to signal failure)
- BullMQ jobs: throw `RetryableError` for transient failures, regular `Error` for permanent failures
- Platform adapters: always distinguish between rate limit errors (retryable) and auth errors (not retryable)

### AI prompt conventions
- All AI prompts live in `apps/web/lib/prompts/` — never inline in component or route files
- Copy generation prompts always request JSON output
- Always include brand config as system prompt prefix
- Model: always `claude-sonnet-4-5` unless explicitly approved otherwise

### Testing
- Unit tests: Vitest
- Integration tests: Vitest + test database
- E2E tests: Playwright (auth flows, content generation, scheduling)
- All platform adapter code must have mocked unit tests — never hit live APIs in tests

---

## MVP scope (build first)

For the initial working version, limit to:
- Platforms: **Instagram + Facebook only** (same API, fastest to ship)
- Content types: **text + image only** (no video)
- Scheduling: **manual date/time only** (no best-time AI)
- Analytics: **basic engagement display only** (no trend charts)

Add everything else in Phase 2+ once real users are using the MVP.

---

## Do not do these things

- Do not add new npm packages without checking if existing stack already covers it
- Do not use `any` in TypeScript
- Do not make direct platform API calls inside Next.js API routes — always queue as a BullMQ job
- Do not store unencrypted OAuth tokens anywhere
- Do not skip `workspace_id` filtering in any database query
- Do not generate content synchronously — always use the job queue
- Do not use `fetch` directly in components — always go through TanStack Query
- Do not commit `.env.local` or any file containing secrets

---

## Useful commands

```bash
# Development
pnpm dev              # Start Next.js dev server
pnpm worker:dev       # Start BullMQ worker in dev mode

# Database
pnpm db:migrate       # Run Prisma migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed with test data

# Testing
pnpm test             # Run unit tests (Vitest)
pnpm test:e2e         # Run E2E tests (Playwright)

# Build
pnpm build            # Build all apps
pnpm lint             # ESLint across monorepo
```

---

*Last updated: May 2026. Update this file whenever a major architectural decision changes.*
