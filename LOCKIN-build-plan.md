# LOCKIN — Claude Code Build Plan
### Stack: Next.js 14 (App Router) + Supabase + Vercel

---

## Phase 0: Project Scaffold
**Prompt Claude Code:**
> Initialize a Next.js 14 app with App Router, TypeScript, Tailwind CSS, and the Supabase JS client. Use pnpm. Set up the folder structure: `app/`, `components/`, `lib/`, `types/`, `hooks/`. Add a `.env.local` with placeholders for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Install @supabase/supabase-js and @supabase/ssr.

**Then:**
> Create a Supabase client utility at `lib/supabase/client.ts` for browser usage and `lib/supabase/server.ts` for server components. Follow the latest @supabase/ssr pattern with cookies.

**Verify:** `pnpm dev` runs on localhost:3000.

---

## Phase 1: Supabase Schema
**Go to your Supabase dashboard or prompt Claude Code:**
> Write a Supabase migration SQL file at `supabase/migrations/001_initial_schema.sql` that creates these tables:

```
profiles
  - id (uuid, FK to auth.users, PK)
  - display_name (text)
  - timer_duration (int, default 25)
  - created_at (timestamptz)

projects
  - id (uuid, PK, default gen_random_uuid())
  - user_id (uuid, FK to profiles.id)
  - name (text, not null)
  - next_action (text)
  - objective (text)
  - status (text, default 'active') — active | paused | shipped
  - priority (text, default 'medium') — high | medium | low
  - notes (text)
  - context_dump (text)
  - estimated_minutes (int, default 0)
  - total_minutes (int, default 0)
  - created_at (timestamptz)
  - updated_at (timestamptz)

sessions
  - id (uuid, PK)
  - user_id (uuid, FK)
  - project_id (uuid, FK to projects.id)
  - duration (int, not null) — minutes
  - estimated (int)
  - action (text)
  - date (date, not null)
  - created_at (timestamptz)

daily_plans
  - id (uuid, PK)
  - user_id (uuid, FK)
  - date (date, not null)
  - planned_project_ids (uuid[])
  - estimates (jsonb) — { "project_id": minutes }
  - committed (boolean, default false)
  - created_at (timestamptz)
  - UNIQUE(user_id, date)

shutdown_log
  - id (uuid, PK)
  - user_id (uuid, FK)
  - date (date, not null)
  - completed (boolean, default true)
  - created_at (timestamptz)
  - UNIQUE(user_id, date)
```

> Add Row Level Security policies: users can only SELECT, INSERT, UPDATE, DELETE their own rows (where user_id = auth.uid()). Enable RLS on all tables.

**Run:** `supabase db push` or apply via dashboard.

---

## Phase 2: Auth
**Prompt Claude Code:**
> Add Supabase Auth with email/password and Google OAuth. Create `app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx` with a dark theme login form matching this style: background #0a0a0a, amber (#F59E0B) accents, monospace font (JetBrains Mono from Google Fonts). After successful auth, redirect to `/dashboard`. Create a middleware.ts that protects all routes except /login and /signup.

**Then:**
> Create a `hooks/useUser.ts` hook that returns the current Supabase user and a loading state. Create an auth context provider at `components/providers/auth-provider.tsx`.

**Verify:** Can sign up, log in, and get redirected to /dashboard.

---

## Phase 3: Core Layout + Dashboard
**Prompt Claude Code:**
> Create the app layout at `app/(app)/layout.tsx` — full dark theme, max-width 600px centered, monospace font. Create `app/(app)/dashboard/page.tsx` as a client component that fetches the user's active projects from Supabase ordered by priority (high first), and renders them as cards with: name, next action, objective, priority color bar on left (high=#F59E0B, medium=#6B7280, low=#374151), total minutes logged, and a "LOCK IN" button. Include the header with the LOCKIN logo and timer duration selector. Add the nudge bar that shows a random ADHD-friendly motivational quote on each load.

**Then:**
> Add the three ritual trigger buttons below the nudge bar: Morning Lockdown (☀), Shutdown (☾), and Review (◷). Morning highlights amber before noon, Shutdown highlights purple after 5pm, both show green when completed for today. Query daily_plans and shutdown_log for today's date to determine state.

---

## Phase 4: Project CRUD
**Prompt Claude Code:**
> Create `app/(app)/project/new/page.tsx` — a form to create a new project with fields: name, next action, objective, priority (toggle buttons), and notes. On submit, insert into Supabase projects table and redirect to /dashboard. Style matches dark theme with amber accent buttons.

> Create `app/(app)/project/[id]/edit/page.tsx` — same form but loads existing project data, updates on submit. Add a DELETE button with confirmation.

> On the dashboard, wire the ✎ button to navigate to /project/[id]/edit and the + ADD button to /project/new.

---

## Phase 5: Focus Mode + Timer
**Prompt Claude Code:**
> Create `app/(app)/focus/[id]/page.tsx` — the focus view. Fetch the project by ID. Show: project name, objective, context dump banner (if exists, purple background with "WHERE YOU LEFT OFF" label), SVG ring timer, start/pause/reset controls, current task input (updates project.next_action on blur), scratch pad textarea (updates project.notes on blur), stats row (total minutes, session count, estimated minutes). Timer state is client-side only — use useState and useInterval.

> When the timer completes: insert a row into sessions table (duration = timer setting, project_id, date = today, action = current next_action), and update the project's total_minutes by adding the session duration. Show a brief completion flash. Reset timer automatically.

> Add a "MARK AS SHIPPED" button that updates project.status to 'shipped' and redirects to /dashboard.

---

## Phase 6: Morning Lockdown Ritual
**Prompt Claude Code:**
> Create `app/(app)/morning/page.tsx` — a 3-step guided flow.

> Step 1 (SELECT): Show all active projects as selectable cards. User can pick 1-3. Show priority badge and objective on each. Disable selection after 3 are chosen.

> Step 2 (ESTIMATE): For each selected project, show time estimate buttons (15m, 30m, 45m, 1h, 1.5h, 2h). Show running total at bottom with feedback: green "Looks achievable" under 6h, amber "Heavy day" 6-8h, red "Be realistic" over 8h. Include the callout: "Your ADHD brain will underestimate. Add 50%."

> Step 3 (COMMIT): Show final numbered list with estimates. "LOCK IN MY DAY" button upserts a daily_plans row for today with planned_project_ids, estimates jsonb, and committed=true. Also update each project's estimated_minutes. Redirect to /dashboard.

> Add step indicators at top (numbered dots, active = amber, done = checkmark).

---

## Phase 7: Evening Shutdown Ritual
**Prompt Claude Code:**
> Create `app/(app)/shutdown/page.tsx` — 3-step guided flow with purple (#6366f1) accent.

> Step 1 (REVIEW): Query today's sessions, group by project. Show actual minutes vs estimated (from daily_plans). Color code: green if under estimate, red if over by 20%+.

> Step 2 (CAPTURE): For each project worked on today (or planned), show a textarea pre-filled with existing context_dump. User writes where they left off. These are specific prompts — "What were you working on? What's the next step? Any blockers?"

> Step 3 (CLOSE): Motivational close screen with total minutes worked. "SHUT IT DOWN" button saves all context_dumps to their respective projects and inserts a shutdown_log row. Redirect to /dashboard.

---

## Phase 8: Weekly Review
**Prompt Claude Code:**
> Create `app/(app)/review/page.tsx`. Week navigator (prev/next buttons, current week label). Query sessions for the selected week.

> Show: total focus time (large amber number), time-by-project horizontal bar chart (Tailwind-only, no chart library — use div widths as percentages), daily activity heatmap (7 squares, amber opacity based on minutes — 0 = dark, 120+ = full), and estimated vs actual comparison table with percentage deltas (red if over, green if under).

> All data comes from Supabase queries filtered by date range.

---

## Phase 9: Today's Plan on Dashboard
**Prompt Claude Code:**
> On the dashboard, if a daily_plan exists for today with committed=true, show a "TODAY'S PLAN" section above the full active projects list. Each planned project card shows: estimated minutes, actual minutes logged today (query sessions where date=today and project_id matches), and a LOCK IN button. Color the actual minutes green if under estimate, red if over.

---

## Phase 10: Real-time Updates (Optional)
**Prompt Claude Code:**
> Add Supabase Realtime subscriptions on the dashboard for the projects table. When a project is updated (e.g. from focus mode in another tab), the dashboard reflects the change without refresh. Use the useEffect + supabase.channel pattern.

---

## Phase 11: Deploy to Vercel
**Prompt Claude Code:**
> Create a vercel.json if needed. Make sure all environment variables are set: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY. Push to GitHub. Deploy via Vercel CLI or dashboard. Set up the production domain.

**Manual steps:**
1. Go to Vercel → Import repo
2. Add env vars in Vercel project settings
3. In Supabase dashboard → Auth → URL Configuration → add your Vercel production URL as a redirect URL
4. Deploy

---

## Phase 12: PWA + Mobile
**Prompt Claude Code:**
> Add a `manifest.json` for PWA support — app name "LOCKIN", theme color #0a0a0a, background #0a0a0a, display standalone. Add a service worker for offline caching of the app shell. Add meta tags for iOS home screen support. Create a simple 512x512 app icon — amber diamond on black background.

This makes it installable on phone home screens as a standalone app without an app store.

---

## CLAUDE.md for the Project

Save this in the repo root so Claude Code has context on every session:

```markdown
# LOCKIN

## What this is
A focus management tool for builders shipping software with AI tools (Claude Code, Cursor, etc). Built for people with ADHD who start too many projects and finish too few.

## Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (Postgres, Auth, RLS)
- Tailwind CSS
- Vercel (hosting)

## Design system
- Background: #0a0a0a
- Card bg: #111111
- Borders: #1f1f1f
- Text primary: #e5e5e5
- Text secondary: #666666
- Amber accent: #F59E0B (primary action, focus state)
- Purple accent: #6366f1 (shutdown ritual)
- Green accent: #22c55e (shipped, on-track)
- Red accent: #ef4444 (over estimate, warnings)
- Font: JetBrains Mono
- All caps for labels/badges, letter-spacing: 2px
- Cards have 3px left border colored by priority

## Core flows
1. Morning Lockdown → pick 1-3 projects → estimate time → commit
2. Dashboard → see plan → LOCK IN to focus
3. Focus Mode → timer → ship tasks → log sessions
4. Evening Shutdown → review day → capture context → close
5. Weekly Review → time by project → est vs actual → heatmap

## Key rules
- Max 3 projects per day plan
- Timer logs to sessions table on completion
- Context dumps persist on projects, shown on next focus
- All tables have RLS: user_id = auth.uid()
```

---

## Build Order Summary

| Phase | What | Claude Code Prompts |
|-------|------|-------------------|
| 0 | Scaffold | 2 prompts |
| 1 | DB Schema | 1 prompt |
| 2 | Auth | 2 prompts |
| 3 | Dashboard | 2 prompts |
| 4 | Project CRUD | 2 prompts |
| 5 | Focus + Timer | 2 prompts |
| 6 | Morning Ritual | 1 prompt |
| 7 | Shutdown Ritual | 1 prompt |
| 8 | Weekly Review | 1 prompt |
| 9 | Dashboard Plan | 1 prompt |
| 10 | Realtime | 1 prompt (optional) |
| 11 | Deploy | 1 prompt + manual |
| 12 | PWA | 1 prompt |

**~18 Claude Code prompts to production.**
