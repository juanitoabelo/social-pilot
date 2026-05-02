# Plan.md — Social Media Automation Platform

Complete build plan. Every decision, every task, every dependency, every gotcha — documented here so you never have to go back and forth.

---

## Project overview

**Goal:** A SaaS platform that lets individuals and businesses automate social media content creation, scheduling, and publishing using AI.

**Revenue model:** Subscription tiers (Solo / Team / Agency) + usage metering for AI API calls above the plan limit.

**Target user:** Small business owners, content creators, marketing teams who post regularly but don't have time to create and schedule content manually.

---

## Phases at a glance

| Phase | Focus | Duration | Output |
|---|---|---|---|
| 1 | Foundation | Weeks 1–3 | Auth, DB, dashboard shell |
| 2 | AI content engine | Weeks 4–7 | Generate + review content |
| 3 | Scheduler + publisher | Weeks 8–11 | Schedule + auto-post to IG/FB/LinkedIn |
| 4 | Analytics + polish | Weeks 12–14 | Metrics, feedback loop, billing |
| Post-launch | Growth features | Ongoing | Video, X, TikTok, best-time AI |

---

## Phase 1 — Foundation (Weeks 1–3)

### Goals
Get the skeleton running: monorepo, auth, database, and a navigable dashboard shell. No AI yet.

### Week 1 — Project setup

#### Tasks
- [ ] Initialize pnpm monorepo with workspaces (`apps/web`, `apps/worker`, `packages/database`, `packages/shared`, `packages/ui`)
- [ ] Set up Next.js 14 with App Router, TypeScript strict mode, Tailwind, ESLint, Prettier
- [ ] Configure Husky + lint-staged (pre-commit: lint + typecheck)
- [ ] Set up Vitest for unit testing
- [ ] Set up Playwright for E2E testing
- [ ] Configure absolute imports and path aliases
- [ ] Create `.env.example` with all required keys documented
- [ ] Set up GitHub repo with branch protection on `main` (require PR + passing CI)
- [ ] Configure GitHub Actions: lint → typecheck → test on every PR

#### Decisions made
- **Monorepo tool:** pnpm workspaces (no Turborepo initially — add later if build times become a problem)
- **Branch strategy:** `main` (production), `dev` (staging), feature branches off `dev`
- **Node version:** 20 LTS (pin in `.nvmrc` and `package.json#engines`)

---

### Week 2 — Auth + database

#### Tasks
- [ ] Set up Neon PostgreSQL (create project, get connection string)
- [ ] Set up Prisma in `packages/database` with the full schema (see schema below)
- [ ] Run initial migration, set up seed script with test workspace + user 
- [ ] Set up Upstash Redis (get connection URL)
- [ ] Implement NextAuth.js v5 with:
  - Email/password (credentials provider with bcrypt)
  - Google OAuth provider
  - JWT sessions in HttpOnly cookies
- [ ] Build auth screens: login, register, forgot password, reset password
- [ ] Implement workspace model:
  - On first login, auto-create a default workspace for the user
  - `workspace_members` table with roles: `owner`, `admin`, `member`
- [ ] Middleware: protect all `/dashboard/*` routes, redirect to login if unauthenticated 

#### Prisma schema (full)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Workspace {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  brand_config Json     @default("{}")
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  members             WorkspaceMember[]
  campaigns           Campaign[]
  platform_connections PlatformConnection[]
}

model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String?
  password   String?  // null for OAuth users
  avatar_url String?
  created_at DateTime @default(now())

  workspaces WorkspaceMember[]
  accounts   Account[]
  sessions   Session[]
}

model WorkspaceMember {
  id           String    @id @default(cuid())
  workspace_id String
  user_id      String
  role         String    @default("member") // owner | admin | member
  joined_at    DateTime  @default(now())

  workspace Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([workspace_id, user_id])
}

// NextAuth required tables
model Account {
  id                  String  @id @default(cuid())
  user_id             String
  type                String
  provider            String
  provider_account_id String
  refresh_token       String?
  access_token        String?
  expires_at          Int?
  token_type          String?
  scope               String?
  id_token            String?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  @@unique([provider, provider_account_id])
}

model Session {
  id            String   @id @default(cuid())
  session_token String   @unique
  user_id       String
  expires       DateTime

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Campaign {
  id           String   @id @default(cuid())
  workspace_id String
  title        String
  brief        String
  audience     Json     @default("{}")
  platforms    String[] // ["instagram", "facebook", "linkedin"]
  status       String   @default("draft") // draft | generating | ready | archived
  created_by   String
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  posts     Post[]

  @@index([workspace_id, status])
}

model Post {
  id              String    @id @default(cuid())
  campaign_id     String
  platform        String    // instagram | facebook | twitter | tiktok | linkedin | pinterest
  status          String    @default("pending_review") // pending_review | approved | scheduled | publishing | published | failed
  caption         String
  hashtags        String[]
  cta             String?
  scheduled_at    DateTime?
  published_at    DateTime?
  platform_post_id String?
  error           String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  campaign Campaign     @relation(fields: [campaign_id], references: [id], onDelete: Cascade)
  assets   Asset[]
  metrics  PostMetrics[]
  jobs     ScheduleJob[]

  @@index([campaign_id])
  @@index([status, scheduled_at])
}

model Asset {
  id         String   @id @default(cuid())
  post_id    String
  type       String   // image | video | thumbnail
  s3_key     String
  url        String
  format     String   // jpg | png | mp4 | webp
  width      Int?
  height     Int?
  size_bytes Int?
  alt_text   String?
  created_at DateTime @default(now())

  post Post @relation(fields: [post_id], references: [id], onDelete: Cascade)
}

model PlatformConnection {
  id               String   @id @default(cuid())
  workspace_id     String
  platform         String   // instagram | facebook | twitter | tiktok | linkedin | pinterest
  access_token     String   // AES-256-GCM encrypted
  refresh_token    String?  // AES-256-GCM encrypted
  token_expires_at DateTime?
  scopes           String[]
  platform_user_id String?
  platform_username String?
  connected_at     DateTime @default(now())
  updated_at       DateTime @updatedAt

  workspace Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)

  @@unique([workspace_id, platform])
  @@index([token_expires_at]) // for refresh job
}

model PostMetrics {
  id               String   @id @default(cuid())
  post_id          String
  platform_post_id String
  likes            Int      @default(0)
  comments         Int      @default(0)
  shares           Int      @default(0)
  saves            Int      @default(0)
  reach            Int      @default(0)
  impressions      Int      @default(0)
  clicks           Int      @default(0)
  engagement_rate  Float    @default(0)
  fetched_at       DateTime @default(now())

  post Post @relation(fields: [post_id], references: [id], onDelete: Cascade)

  @@index([post_id, fetched_at(sort: Desc)])
}

model ScheduleJob {
  id           String   @id @default(cuid())
  post_id      String
  bullmq_job_id String?
  scheduled_at DateTime
  status       String   @default("pending") // pending | processing | completed | failed
  attempts     Int      @default(0)
  last_error   String?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  post Post @relation(fields: [post_id], references: [id], onDelete: Cascade)
}
```

---

### Week 3 — Dashboard shell

#### Tasks
- [ ] Build main layout: sidebar nav, top bar with workspace switcher, user avatar menu
- [ ] Sidebar nav links: Campaigns, Content Library, Schedule, Analytics, Settings
- [ ] Settings screen:
  - Brand config form (name, tone, do/don't rules, hashtag style, emoji policy)
  - Connected platforms section (placeholder — connect flows in Phase 3)
  - Team members management (invite by email, role assignment)
- [ ] Workspace switcher: dropdown to switch between workspaces, create new workspace
- [ ] Toast notification system (react-hot-toast or Sonner)
- [ ] Empty states for all sections (show helpful prompts, not blank screens)
- [ ] Mobile responsive layout (sidebar collapses to hamburger on mobile)

---

## Phase 2 — AI content engine (Weeks 4–7)

### Goals
Users can create a campaign, generate content (copy + image), review it, and approve it. No publishing yet.

### Week 4 — Campaign creation + copy generation

#### Tasks
- [ ] Campaign list page: grid of campaign cards, status badges, create button
- [ ] Campaign brief form:
  - Title field
  - Brief / topic textarea
  - Tone selector (dropdown: professional, casual, humorous, inspirational, educational)
  - Audience tags (multi-select: age groups, interests, location)
  - Platform checkboxes (select which platforms to generate for)
  - Brand voice toggle (use workspace brand config yes/no)
  - Generate button → triggers background job
- [ ] BullMQ setup in `apps/worker`:
  - Redis connection
  - `content-generation` queue
  - Worker process with graceful shutdown
- [ ] Content generation job:
  - Call Claude API with structured prompt
  - Parse JSON response
  - Create `Post` records in DB for each platform
  - Update campaign status
  - Emit SSE progress events

#### Claude API prompt structure

```typescript
// packages/shared/src/prompts/copy-generation.ts

export function buildCopyPrompt(params: {
  brief: string;
  platform: Platform;
  audience: AudienceConfig;
  brandConfig: BrandConfig;
  goal: string;
}): { system: string; user: string } {
  return {
    system: `You are a social media expert for ${params.brandConfig.brand_name}.
Tone: ${params.brandConfig.tone}.
Rules you MUST follow:
DO: ${params.brandConfig.do.join(', ')}
DO NOT: ${params.brandConfig.dont.join(', ')}
Hashtag style: ${params.brandConfig.hashtag_style}
Emoji policy: ${params.brandConfig.emoji_policy}

Always respond with valid JSON only. No preamble, no markdown.`,

    user: `Generate a ${params.platform} post for this campaign:
Campaign brief: ${params.brief}
Target audience: ${JSON.stringify(params.audience)}
Goal: ${params.goal}
Platform character limit: ${PLATFORM_LIMITS[params.platform].caption}

Respond with this exact JSON structure:
{
  "caption": "the full post caption",
  "hashtags": ["hashtag1", "hashtag2"],
  "cta": "call to action text",
  "alt_text": "image alt text for accessibility",
  "image_prompt_hint": "brief description of ideal image for this post"
}`,
  };
}
```

- [ ] SSE endpoint: `GET /api/campaigns/[id]/stream` — streams generation progress to frontend
- [ ] Frontend: show live progress bar during generation (connecting to SSE)

---

### Week 5 — Image generation

#### Tasks
- [ ] Two-step image generation:
  1. Call Claude to engineer the image prompt from the caption + `image_prompt_hint`
  2. Call DALL·E 3 with the engineered prompt
- [ ] Sharp integration for image resizing:
  - Resize to all required platform dimensions
  - Convert to correct format (jpg for IG/FB, png for others)
  - Optimize file size
- [ ] S3 upload service:
  - Upload original + all resized variants
  - Store S3 keys and CDN URLs in `Asset` records
  - Key structure: `{workspaceId}/campaigns/{campaignId}/{postId}/{variant}.jpg`
- [ ] CloudFront distribution set up in front of S3 bucket
- [ ] Image prompt engineering prompt:

```typescript
export function buildImagePromptEngineeringPrompt(params: {
  caption: string;
  imageHint: string;
  brandConfig: BrandConfig;
  platform: Platform;
}): string {
  return `Given this social media caption, write a DALL·E 3 image generation prompt.

Caption: "${params.caption}"
Image hint: "${params.imageHint}"
Brand visual style: ${params.brandConfig.visual_style ?? 'clean, modern, professional'}
Platform: ${params.platform}
Aspect ratio needed: ${PLATFORM_DIMENSIONS[params.platform].feed.aspectRatio}

Rules for the image prompt:
- Do NOT include any text, words, or letters in the image
- Make it visually compelling and scroll-stopping
- Match the tone and subject of the caption
- Photorealistic style unless brand specifies otherwise
- High quality, well-lit, professional look

Respond with ONLY the image prompt. Nothing else.`;
}
```

- [ ] Platform dimension constants:

```typescript
export const PLATFORM_DIMENSIONS = {
  instagram: {
    feed:    { width: 1080, height: 1080, aspectRatio: '1:1' },
    story:   { width: 1080, height: 1920, aspectRatio: '9:16' },
  },
  facebook: {
    feed:    { width: 1200, height: 630,  aspectRatio: '1.91:1' },
    story:   { width: 1080, height: 1920, aspectRatio: '9:16' },
  },
  twitter: {
    feed:    { width: 1200, height: 675,  aspectRatio: '16:9' },
  },
  linkedin: {
    feed:    { width: 1200, height: 627,  aspectRatio: '1.91:1' },
  },
  tiktok: {
    video:   { width: 1080, height: 1920, aspectRatio: '9:16' },
  },
  pinterest: {
    pin:     { width: 1000, height: 1500, aspectRatio: '2:3' },
  },
} as const;
```

---

### Week 6 — Content review screen

#### Tasks
- [ ] Campaign detail page with tabs: Overview, Content, Schedule, Analytics
- [ ] Content review screen (the most important UX screen):
  - Cards per platform showing: generated image + caption + hashtags + CTA
  - Inline text editing (click caption to edit, auto-save on blur)
  - Image swap button (regenerate image with new prompt)
  - Approve button (per post) → changes status to `approved`
  - Reject button (per post) → deletes post, offers to regenerate
  - Bulk approve all button
  - Status indicators: pending review / approved / scheduled / published
- [ ] Regenerate individual post (copy only, image only, or both)
- [ ] Brand compliance score badge shown on each post card

---

### Week 7 — Content library

#### Tasks
- [ ] Content library page: all posts across all campaigns
- [ ] Grid view with image thumbnails + platform icon + status badge
- [ ] Filters: platform, status, date range, campaign
- [ ] Search: full-text search on caption
- [ ] Post detail drawer/modal: full post view with all assets
- [ ] "Reuse" button: duplicate a post into a new campaign, with option to regenerate copy
- [ ] Asset download button (download original image)
- [ ] Bulk actions: approve selected, delete selected, reschedule selected

---

## Phase 3 — Scheduler + publisher (Weeks 8–11)

### Goals
Approved content gets scheduled and posted automatically. Start with Instagram, Facebook, LinkedIn.

### Week 8 — BullMQ publisher infrastructure

#### Tasks
- [ ] Publisher worker setup with queue: `scheduled-posts`
- [ ] Platform adapter pattern:

```typescript
// packages/shared/src/types/platform-adapter.ts
export interface PlatformAdapter {
  platform: Platform;
  publish(post: PostWithAssets): Promise<{ platform_post_id: string }>;
  fetchMetrics(platformPostId: string): Promise<RawMetrics>;
  refreshToken(connection: PlatformConnection): Promise<TokenPair>;
  validateConnection(connection: PlatformConnection): Promise<boolean>;
}
```

- [ ] Base adapter class with retry error types:

```typescript
export class RetryableError extends Error {
  constructor(message: string, public delayMs?: number) {
    super(message);
    this.name = 'RetryableError';
  }
}
export class PermanentError extends Error { ... }
export class RateLimitError extends RetryableError { ... }
export class AuthError extends PermanentError { ... }
```

- [ ] Publisher orchestrator function (called by BullMQ worker)
- [ ] Slack/email alerting on post failure
- [ ] BullBoard UI for queue monitoring (protected admin route)
- [ ] Token refresh background job (runs every 6h via cron worker)

---

### Week 9 — Instagram + Facebook publisher

#### Tasks
- [ ] Meta developer app setup (one app covers both IG and Facebook)
- [ ] OAuth connect flow for Meta:
  - Connect button → redirect to Meta OAuth
  - Callback handler → exchange code for token → encrypt + store
  - Show connected account name + avatar in settings
  - Disconnect button
- [ ] Instagram adapter:

```typescript
// apps/worker/src/adapters/instagram.ts

export class InstagramAdapter implements PlatformAdapter {
  async publish(post: PostWithAssets) {
    const conn = await getConnection(post.workspace_id, 'instagram');
    const token = decrypt(conn.access_token);
    const imageAsset = post.assets.find(a => a.type === 'image');

    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.instagram.com/v18.0/${conn.platform_user_id}/media`,
      {
        method: 'POST',
        body: JSON.stringify({
          image_url: imageAsset.url,
          caption: formatCaption(post.caption, post.hashtags),
          access_token: token,
        }),
      }
    );
    const { id: containerId } = await containerRes.json();

    // Poll until container is ready (FINISHED status)
    await this.waitForContainer(containerId, token);

    // Step 2: Publish container
    const publishRes = await fetch(
      `https://graph.instagram.com/v18.0/${conn.platform_user_id}/media_publish`,
      {
        method: 'POST',
        body: JSON.stringify({
          creation_id: containerId,
          access_token: token,
        }),
      }
    );
    const { id: postId } = await publishRes.json();
    return { platform_post_id: postId };
  }
}
```

- [ ] Facebook adapter (simpler — single POST to page /feed)
- [ ] End-to-end test: brief → generate → approve → schedule → auto-publish → verify on IG

---

### Week 10 — Scheduler UI

#### Tasks
- [ ] Install and configure FullCalendar (React)
- [ ] Calendar page:
  - Month view by default, week view option
  - Approved posts shown as draggable cards on their scheduled date
  - Unscheduled posts shown in a sidebar list
  - Click post to open scheduling modal
  - Drag to reschedule (updates DB + BullMQ job)
  - Color coding by platform
  - Platform filter buttons
- [ ] Scheduling modal:
  - Date + time picker
  - Best time suggestions (show industry defaults initially)
  - Select which platforms to schedule (if post exists for multiple platforms)
  - Confirm button → creates BullMQ job with delay
- [ ] Reschedule logic (update job):

```typescript
async function reschedulePost(postId: string, newTime: Date) {
  await db.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { scheduled_at: newTime, status: 'scheduled' }
    });
    const existing = await tx.scheduleJob.findFirst({ where: { post_id: postId } });
    if (existing?.bullmq_job_id) {
      const job = await postQueue.getJob(existing.bullmq_job_id);
      await job?.remove();
    }
    const delay = newTime.getTime() - Date.now();
    const job = await postQueue.add('publish', { postId }, {
      jobId: postId,
      delay,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });
    await tx.scheduleJob.upsert({
      where: { post_id: postId },
      update: { bullmq_job_id: job.id, scheduled_at: newTime, status: 'pending' },
      create: { post_id: postId, bullmq_job_id: job.id, scheduled_at: newTime }
    });
  });
}
```

- [ ] Recurring post templates:
  - Template model (stores RRULE + post template)
  - Cron worker generates next post from template on schedule
  - UI to create/edit/pause recurring templates

---

### Week 11 — LinkedIn publisher + recurring posts

#### Tasks
- [ ] LinkedIn developer app setup + Marketing Developer Platform access request
- [ ] LinkedIn OAuth connect flow
- [ ] LinkedIn adapter:

```typescript
async publish(post: PostWithAssets) {
  // Step 1: Register image upload
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:person:${userId}`,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }]
      }
    })
  });
  const { value: { uploadMechanism, asset } } = await registerRes.json();

  // Step 2: Upload image binary
  await fetch(uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl, {
    method: 'PUT',
    body: imageBuffer,
  });

  // Step 3: Create UGC post
  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      author: `urn:li:person:${userId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: formatCaption(post.caption, post.hashtags) },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', description: { text: post.cta ?? '' }, media: asset }]
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    })
  });
  const { id } = await postRes.json();
  return { platform_post_id: id };
}
```

- [ ] Recurring posts engine:
  - `PostTemplate` model (add to schema)
  - RRULE storage + parsing (using `rrule` npm package)
  - Cron job every hour: find templates due, generate next post from template, enqueue
  - UI: recurring templates list, create/edit/pause/delete

---

## Phase 4 — Analytics + polish (Weeks 12–14)

### Goals
Complete the feedback loop: fetch metrics, display analytics, improve AI with performance data, add billing.

### Week 12 — Metrics fetching

#### Tasks
- [ ] Metrics fetcher cron job (every 6 hours):
  - Query all published posts from last 90 days
  - Call each platform API to fetch current metrics
  - Upsert into `post_metrics` table
- [ ] Platform metrics endpoints:
  - Instagram: `GET /{media-id}/insights?metric=likes,comments,saves,reach,impressions`
  - Facebook: `GET /{post-id}/insights?metric=post_reactions_like_total,post_comments,...`
  - LinkedIn: `GET /v2/organizationalEntityShareStatistics?q=organizationalEntity&...`
- [ ] Metrics aggregation queries:
  - Top posts by engagement rate (per workspace, per platform, per time range)
  - Average engagement by platform
  - Best performing posting times (day + hour)
  - Hashtag performance correlation

---

### Week 13 — Analytics dashboard

#### Tasks
- [ ] Analytics page with date range filter (7d / 30d / 90d / custom)
- [ ] Summary stat cards: total posts, avg engagement rate, total reach, top platform
- [ ] Charts (Recharts):
  - Line chart: engagement rate over time
  - Bar chart: posts per platform
  - Scatter: post time vs engagement (reveals best posting windows)
  - Table: top 10 posts by engagement rate (with image thumbnail)
- [ ] Per-platform breakdown tabs
- [ ] Export: CSV download of all post metrics
- [ ] AI feedback loop:
  - Query top/bottom performing posts for the workspace
  - Summarize patterns using Claude
  - Append summary to AI system prompt for future generations:

```typescript
async function buildPerformanceContext(workspaceId: string): Promise<string> {
  const topPosts = await db.$queryRaw`
    SELECT p.caption, p.hashtags, p.platform,
           MAX(pm.engagement_rate) as peak_eng,
           EXTRACT(DOW FROM p.published_at) as day_of_week,
           EXTRACT(HOUR FROM p.published_at) as hour
    FROM posts p
    JOIN post_metrics pm ON pm.post_id = p.id
    WHERE p.workspace_id = ${workspaceId}
      AND p.published_at > NOW() - INTERVAL '60 days'
    GROUP BY p.id
    ORDER BY peak_eng DESC
    LIMIT 5
  `;
  // Format into natural language context string
  return formatPerformanceContext(topPosts);
}
```

---

### Week 14 — Billing + launch prep

#### Tasks
- [ ] Stripe integration:
  - Products: Solo ($29/mo), Team ($79/mo), Agency ($199/mo)
  - Usage metering: AI generations above plan limit billed at $0.10 each
  - Stripe Customer Portal for plan changes + invoice history
  - Webhook handler: `customer.subscription.updated`, `invoice.payment_failed`
- [ ] Plan limits enforcement:
  - Middleware checks workspace's current plan before AI generation
  - Shows upgrade modal when limit reached
- [ ] Onboarding flow (for new users):
  - Step 1: workspace name + brand config basics
  - Step 2: connect first platform (Instagram recommended)
  - Step 3: create first campaign (with sample brief pre-filled)
- [ ] Email notifications:
  - Post published successfully
  - Post failed to publish (with retry link)
  - Weekly analytics summary digest
  - Plan limit approaching (80% used warning)
- [ ] Error monitoring: Sentry setup in both `apps/web` and `apps/worker`
- [ ] Uptime monitoring: Betterstack or Better Uptime
- [ ] Pre-launch checklist:
  - [ ] All env vars documented
  - [ ] DB backups configured (Neon auto-backup enabled)
  - [ ] Rate limiting on all public API endpoints
  - [ ] Security headers (next-safe-action or next.config headers)
  - [ ] GDPR: privacy policy, cookie notice, data deletion endpoint
  - [ ] Load test the worker with 100 simultaneous posts

---

## Post-launch roadmap (Phase 5+)

These features are intentionally excluded from the MVP. Build after launch with real user feedback.

### Video / Reel builder
- ✅ `generateVideo()` service — composes video from image + OpenAI TTS voiceover + text overlay
- ✅ `tts.ts` — OpenAI TTS-1 with voice selection by brand tone (professional→onyx, casual→alloy, etc.)
- ✅ `video-composer.ts` — FFmpeg-based composition with scale/pad, text overlay (drawtext), audio muxing
- ✅ Video template registry (`video-templates/registry.ts`) — quote-card, hook-reveal, slide-show
- ✅ Platform-specific aspect ratios (9:16 for reels, 16:9 for landscape, 4:5 for feed)
- ✅ Content worker routes to video generation when `generate_video` flag is set on campaign
- ✅ `generate_video` Boolean field on Campaign model
- ✅ Video assets stored as `type: "video"` in Asset model, MP4 format
- ✅ Campaign detail page shows video player with poster image when video asset exists
- ✅ Campaign creation API accepts `generateVideo` flag
- ⚠️ FFmpeg must be installed on worker server (Railway/Docker)
- ⚠️ Requires `OPENAI_API_KEY` for TTS (separate from DALL·E usage)

### X / Twitter publisher
- ✅ OAuth 2.0 PKCE flow — `/api/platforms/twitter/connect` + `/callback`
- ✅ Token exchange with code verifier/challenge (S256)
- ✅ Media upload via chunked upload API (INIT → APPEND → FINALIZE)
- ✅ Tweet creation via X API v2 (`POST /2/tweets`) with optional media attachment
- ✅ Caption truncation to 280 chars with hashtag limit (max 3)
- ✅ Encrypted token storage (AES-256-GCM) with refresh token support
- ✅ Rate limit handling (429 → retryable, 900s backoff)
- ✅ Settings UI — X/Twitter added to platform connections list
- ⚠️ Requires X API Basic plan ($100/mo) for write access, 50 posts/day limit

### TikTok publisher
- Apply for Content Posting API access on week 1
- Approval takes 2–4 weeks
- Video-only platform — requires video builder first

### Best-time AI engine
- After 20+ published posts: run SQL to find peak engagement by day + hour
- Show optimal slots highlighted in calendar
- One-click "schedule at best time" button
- ✅ Built: `/api/analytics/optimal-times` endpoint, industry defaults fallback
- ✅ Integrated into schedule page modal and campaign scheduling modal
- ✅ Analytics dashboard shows "Best Posting Times" section
- ✅ "Schedule at best time" auto-selects next optimal slot

### AI content variations (A/B testing)
- Generate 2–3 variants per platform
- User picks one or auto-post and auto-pause the loser
- Feed results back to AI
- ✅ Built: `variant_label` (A/B/C) + `is_variant_winner` fields on Post, `variant_count` on Campaign
- ✅ `generateVariants()` service — generates 3 distinct creative angles (benefit-focused, story-driven, question/hook)
- ✅ Content worker generates variants in parallel when variantCount > 1
- ✅ Campaign detail page shows variants side-by-side in grid with labels, approach descriptions
- ✅ Winner tracking via `is_variant_winner` field for future performance-based selection

### Team collaboration
- ✅ Comments on posts — `Comment` model with user/post relations, inline comments panel per post
- ✅ Approval workflows — approve/reject actions with activity logging, role-aware access control
- ✅ Activity log — `ActivityLog` model tracking all workspace actions (approvals, rejections, scheduling, comments, etc.)
- ✅ Activity log page — `/dashboard/activity-log` with action-specific icons, relative timestamps, user attribution
- ✅ Sidebar nav item — "Activity Log" added to dashboard navigation

### White-label / agency features
- Custom domain for client-facing reports
- Client read-only access (view analytics, approve content)
- Bulk workspace management for agencies

### Google Sheets / CSV bulk import
- ✅ Google OAuth connect/callback (`/api/integrations/google/connect` + `/callback`)
- ✅ `spreadsheets.readonly` + `drive.readonly` scopes for listing and reading sheets
- ✅ `listSpreadsheets()` — fetch user's Google Sheets via Drive API v3
- ✅ `readSheetData()` — read tab data via Sheets API v4, parse headers + rows
- ✅ `normalizeColumnMapping()` — auto-detect columns (date, time, platform, caption, hashtags, media_url)
- ✅ `bulk-import` BullMQ queue + worker — processes rows, creates posts + assets
- ✅ Media download from URLs in sheet → S3 upload → asset creation
- ✅ Date/time parsing (ISO format, MM/DD/YYYY, with time column)
- ✅ Platform auto-detection from column values (instagram, facebook, twitter, etc.)
- ✅ Spreadsheet picker UI — list sheets, preview data, map columns, import
- ✅ Import modes: review queue, scheduled (if dates set), draft
- ✅ Campaigns page "Import from Sheets" button + modal
- ⚠️ Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars

### Browser extension
- Capture content inspiration while browsing
- One-click "create post from this" on any image or article

---

## Technical gotchas and decisions log

### Why BullMQ and not just cron?
Cron can't handle delayed jobs, retries, or distributed workers. BullMQ gives us all of that on top of Redis. The worker process is always-on on Railway — not serverless — because BullMQ needs a persistent connection.

### Why not use Vercel serverless functions for the worker?
Vercel functions have a 10-second execution limit (60s on Pro). Content generation + image creation can take 30–90 seconds. The worker must be an always-on Node.js process.

### Why encrypt OAuth tokens ourselves?
Neon/PostgreSQL doesn't encrypt column values by default. Platform OAuth tokens are extremely sensitive — if the DB is compromised, we don't want tokens exposed. AES-256-GCM encryption in the application layer means the token is unreadable without the `ENCRYPTION_KEY` env var.

### Why two-step image generation (Claude → DALL·E)?
Directly sending a marketing brief to DALL·E produces mediocre results. Claude first generates a proper image prompt that describes composition, lighting, style, and subject — then DALL·E renders that. The two-step approach consistently produces better images.

### Why TanStack Query instead of server components for all data?
Dashboard data (campaigns, posts, metrics) changes frequently and benefits from background refetching, optimistic updates, and cache invalidation — all built into TanStack Query. Use server components for static/layout data, TanStack Query for live dashboard data.

### Why pnpm workspaces without Turborepo?
Turborepo adds complexity for caching build artifacts. For a 2–3 app monorepo, plain pnpm workspaces are sufficient. Add Turborepo when build times exceed 5 minutes.

### Platform API access — apply early for:
- **TikTok Content Posting API** — apply on project day 1. Requires app review. Takes 2–6 weeks.
- **X API Basic** — requires a developer account upgrade and can involve manual review. Also apply early.
- **LinkedIn Marketing Developer Platform** — apply separately from the basic LinkedIn API. Takes 1–2 weeks.

---

## Definition of done (per task)

A task is done when:
1. Code is written and working
2. TypeScript compiles with zero errors
3. ESLint passes with zero warnings
4. Unit tests written and passing (for logic-heavy code)
5. PR reviewed and merged to `dev`
6. Feature tested manually in dev environment

---

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TikTok API access denied | Medium | High | Build video content without TikTok first; add manually via browser if needed |
| DALL·E rate limits hit during high usage | Medium | Medium | Add Replicate as fallback; queue generation jobs with rate limit awareness |
| Meta API policy change breaks IG/FB posting | Low | High | Monitor Meta changelog; abstract adapter layer makes swap-out faster |
| Redis goes down, jobs lost | Low | High | BullMQ has built-in persistence; use Upstash with replication |
| OpenAI/Anthropic API outage | Low | High | Graceful degradation: queue generation for retry, show "generation in progress" UI |
| Viral growth exceeds Neon free tier | Medium | Medium | Neon scales automatically; upgrade plan when needed (no migration required) |

---

*Last updated: May 2026. Keep this document updated as decisions change.*
