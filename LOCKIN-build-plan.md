# LOCKIN — Claude Code Build Plan (v2)
### Three surfaces, one brain: Next.js + Tauri Menu Bar + CLI → Supabase → Vercel

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    SUPABASE                         │
│  projects · sessions · daily_plans · shutdown_log   │
│  Auth (email + Google) · RLS · Realtime             │
└──────────┬──────────────┬──────────────┬────────────┘
           │              │              │
     ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
     │  Next.js  │ │   Tauri   │ │    CLI    │
     │  Web App  │ │ Menu Bar  │ │ Terminal  │
     │           │ │           │ │           │
     │ Planning  │ │ Passive   │ │ Active    │
     │ Rituals   │ │ Awareness │ │ Logging   │
     │ Review    │ │ Timer     │ │ Status    │
     │ CRUD      │ │ Nudges    │ │ Quick Ops │
     └───────────┘ └───────────┘ └───────────┘
           │              │              │
     ┌─────▼──────────────▼──────────────▼────────────┐
     │     Builder in terminal running Claude Code     │
     │     Menu bar visible · CLI in same shell        │
     │     Web open only for morning + evening ritual  │
     └────────────────────────────────────────────────┘
```

**When each surface gets used:**
- **6:30am** → Open web app → Morning Lockdown ritual → close tab
- **6:45am** → Open terminal → `lockin start wolfgrey` → menu bar starts ticking
- **All day** → Glance at menu bar timer · get nudge notifications · `lockin done` / `lockin start mypruf` between sessions
- **5:30pm** → Open web app → Evening Shutdown ritual → close laptop

---

## Phase 0: Monorepo Scaffold

**Prompt Claude Code:**
> Set up a pnpm monorepo with three packages:
> - `apps/web` — Next.js 14 (App Router, TypeScript, Tailwind)
> - `apps/menubar` — Tauri v2 app with React + Vite frontend
> - `apps/cli` — Node.js CLI with TypeScript
> - `packages/core` — shared Supabase client, types, and constants
>
> In `packages/core`, create:
> - `lib/supabase.ts` — browser client (for web + Tauri)
> - `lib/supabase-node.ts` — Node.js client (for CLI)
> - `types/index.ts` — shared TypeScript types for all tables
> - `constants.ts` — priorities, nudge messages, timer defaults
>
> Root `.env` with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
> Workspace config so all three apps can import from @lockin/core.

**Verify:** `pnpm dev --filter web` runs Next.js. The Tauri and CLI apps don't need to work yet.

---

## Phase 1: Supabase Schema + Auth

**Prompt Claude Code:**
> Write a Supabase migration at `supabase/migrations/001_initial_schema.sql`:

```sql
-- profiles
create table profiles (
  id uuid primary key references auth.users,
  display_name text,
  timer_duration int default 25,
  created_at timestamptz default now()
);

-- projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  name text not null,
  next_action text,
  objective text,
  status text default 'active' check (status in ('active','paused','shipped')),
  priority text default 'medium' check (priority in ('high','medium','low')),
  notes text,
  context_dump text,
  estimated_minutes int default 0,
  total_minutes int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  project_id uuid references projects(id) not null,
  duration int not null,
  estimated int,
  action text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- daily_plans
create table daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  date date not null,
  planned_project_ids uuid[],
  estimates jsonb,
  committed boolean default false,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- shutdown_log
create table shutdown_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  date date not null,
  completed boolean default true,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- RLS
alter table profiles enable row level security;
alter table projects enable row level security;
alter table sessions enable row level security;
alter table daily_plans enable row level security;
alter table shutdown_log enable row level security;

create policy "own data" on profiles for all using (id = auth.uid());
create policy "own data" on projects for all using (user_id = auth.uid());
create policy "own data" on sessions for all using (user_id = auth.uid());
create policy "own data" on daily_plans for all using (user_id = auth.uid());
create policy "own data" on shutdown_log for all using (user_id = auth.uid());
```

> Then add auth to the web app: email/password + Google OAuth. Create login and signup pages at `apps/web/app/(auth)/login/page.tsx` and `signup/page.tsx`. Dark theme matching LOCKIN design (bg #0a0a0a, amber accents, JetBrains Mono). Middleware protecting all routes except /login and /signup.

**Run:** `supabase db push`
**Verify:** Can sign up, log in, redirect to /dashboard.

---

## Phase 2: Tauri Menu Bar App

This is the highest-impact surface. Build it early.

**Prompt Claude Code:**
> In `apps/menubar`, set up a Tauri v2 app configured as a macOS menu bar / system tray application. Use the Tauri system tray API. The app should:
>
> 1. Show a tray icon (amber diamond ◆ or a simple "L" icon)
> 2. Clicking the tray icon opens a small popover window (320x400px, no title bar, always on top)
> 3. The popover uses React + Vite and imports the Supabase client from @lockin/core
>
> The popover UI should show (dark theme, #0a0a0a bg, amber accents, JetBrains Mono):
> - Current project name (or "No active session")
> - Big countdown timer (MM:SS)
> - Start / Pause / Reset buttons
> - The current next_action for the focused project
> - A random nudge message from the shared constants
> - A "Switch Project" dropdown listing active projects
>
> Auth: On first launch, open a login window that does Supabase auth (email/password). Store the session token in the system keychain via Tauri's secure storage plugin. After auth, close the login window and show the tray icon.

**Then prompt:**
> Add macOS native notifications via Tauri's notification plugin:
> - When a timer session completes: "Session complete! [project name] — [duration]min logged"
> - If no session has been started by 9am: "Morning lockdown reminder — plan your day"
> - When the user has been in a session for 5+ hours without a break: "Take a break. The code will be here when you get back."
>
> Also: update the tray icon title text to show the live timer countdown so it's visible in the menu bar itself — e.g. "◆ 14:32" that updates every second while a session is running.

**Then prompt:**
> When the timer completes or the user clicks "Done":
> - Insert a session row into Supabase
> - Update the project's total_minutes
> - Show a brief "✓ Logged" confirmation in the popover
> - Reset the timer

**Verify:** Menu bar shows diamond icon. Clicking opens popover with timer. Timer ticks in the menu bar text. Notifications fire. Sessions log to Supabase.

---

## Phase 3: CLI Companion

**Prompt Claude Code:**
> In `apps/cli`, build a Node.js CLI tool called `lockin` using Commander.js. It imports the Supabase Node client from @lockin/core. Commands:
>
> **Auth:**
> `lockin login` — opens a browser window for Supabase auth, stores the refresh token in ~/.lockin/credentials.json
>
> **Core commands:**
> `lockin status` — shows current focus project, timer state, next action, and today's plan
> `lockin start [project-name]` — starts a focus session on the named project (fuzzy matches against active projects). Prints the project name, next action, and starts a visible timer in the terminal
> `lockin done` — ends the current session, logs duration to Supabase, shows total logged today
> `lockin next` — shows the next planned project from today's daily plan
> `lockin projects` — lists all active projects with priority, next action, and total minutes
> `lockin ship [project-name]` — marks a project as shipped
>
> **Timer display:**
> When `lockin start` is running, show a live updating line in the terminal:
> `◆ LOCKED IN: wolfgrey.ai → "fix auth redirect" [14:32]`
> Update every second using process.stdout.write with \r carriage return.
> On Ctrl+C, prompt "Log this session? (y/n)" before exiting.
>
> Style the output using chalk: amber for accents, white for text, gray for secondary info. Keep it minimal and fast.

**Then prompt:**
> Add tmux integration:
> `lockin tmux` — outputs a formatted string for tmux status-right. User adds this to their .tmux.conf:
> `set -g status-right "#(lockin tmux)"`
> The output should be: "◆ wolfgrey.ai 14:32" when a session is active, or "◆ no session" when idle.
> Read state from a local file (~/.lockin/state.json) that the `lockin start` and `lockin done` commands update, so the tmux call is instant (no Supabase round-trip).

**Then prompt:**
> Create the npm package config so the CLI can be installed globally:
> `npm install -g @lockin/cli`
> Or run directly: `npx @lockin/cli status`

**Verify:** `lockin login` → `lockin start wolfgrey` → timer ticks in terminal → `lockin done` → session appears in Supabase. tmux status bar shows project name.

---

## Phase 4: Web Dashboard

**Prompt Claude Code:**
> Create `apps/web/app/(app)/dashboard/page.tsx`. Fetch active projects from Supabase ordered by priority. Render project cards with: name, next action, objective, priority color bar, total minutes, "LOCK IN" button (which starts a session that syncs to menu bar + CLI via Supabase realtime). Show the nudge bar, ritual trigger buttons (Morning Lockdown, Shutdown, Review), and today's plan if committed.
>
> Subscribe to Supabase Realtime on the sessions table so the dashboard updates live when the menu bar or CLI logs a session.

---

## Phase 5: Project CRUD (Web)

**Prompt Claude Code:**
> Create project/new and project/[id]/edit pages. Fields: name, next action, objective, priority, notes. Dark theme, amber accents. DELETE with confirmation. Wire + ADD and ✎ buttons on dashboard.

---

## Phase 6: Focus Mode (Web)

**Prompt Claude Code:**
> Create focus/[id] page. This is a web-based focus view as a fallback when the menu bar app isn't available. Show: project name, objective, context dump banner, SVG ring timer, start/pause/reset, current task input, scratch pad, stats. On timer complete, log session and update project. Include MARK AS SHIPPED button.

---

## Phase 7: Morning Lockdown Ritual (Web)

**Prompt Claude Code:**
> Create morning lockdown flow — 3 steps: SELECT (pick 1-3 projects from active list), ESTIMATE (time buttons per project with reality-check feedback), COMMIT (lock in the day plan). Upsert daily_plans row. Step indicators with amber dots.
>
> After commit, the menu bar app and CLI can read today's plan and show what's queued.

---

## Phase 8: Evening Shutdown Ritual (Web)

**Prompt Claude Code:**
> Create shutdown flow — 3 steps with purple (#6366f1) accent: REVIEW (actual vs estimated), CAPTURE (context dump per project — "Where'd you leave off?"), CLOSE (motivational close + save context dumps to projects + insert shutdown_log row).
>
> After shutdown, the menu bar app should show "Day closed ✓" and stop prompting for sessions.

---

## Phase 9: Weekly Review (Web)

**Prompt Claude Code:**
> Create review page. Week navigator. Total focus time, time-by-project bars, daily heatmap, estimated vs actual comparison. All from Supabase session queries filtered by date range.

---

## Phase 10: Deploy

**Web app:**
> Push apps/web to GitHub. Deploy to Vercel. Add env vars. Add Vercel production URL as Supabase auth redirect.

**Menu bar app:**
> Use `tauri build` to create a .dmg for macOS. For now, distribute via GitHub Releases or direct download link from the LOCKIN website. Later: notarize for macOS Gatekeeper.

**CLI:**
> Publish to npm as @lockin/cli. Users install with `npm i -g @lockin/cli`.

---

## Phase 11: PWA Fallback (Web)

**Prompt Claude Code:**
> Add manifest.json for PWA support — "LOCKIN", #0a0a0a theme, standalone display. Service worker for offline app shell. iOS home screen meta tags. Simple 512x512 amber diamond icon. This makes the web app installable on phones without an app store.

---

## Build Order + Effort Estimates

| Phase | Surface | What | Prompts | Time |
|-------|---------|------|---------|------|
| 0 | All | Monorepo scaffold | 1 | 30min |
| 1 | All | Schema + Auth | 2 | 1hr |
| **2** | **Menu bar** | **Tauri tray app + timer + notifications** | **3** | **3hr** |
| **3** | **CLI** | **Terminal commands + tmux integration** | **3** | **2hr** |
| 4 | Web | Dashboard + realtime | 1 | 1hr |
| 5 | Web | Project CRUD | 1 | 45min |
| 6 | Web | Focus mode | 1 | 1hr |
| 7 | Web | Morning lockdown | 1 | 1.5hr |
| 8 | Web | Evening shutdown | 1 | 1.5hr |
| 9 | Web | Weekly review | 1 | 1hr |
| 10 | All | Deploy (Vercel + .dmg + npm) | 2 | 1hr |
| 11 | Web | PWA | 1 | 30min |

**Total: ~18 prompts, ~14 hours of build time across a weekend.**

Phases 2 and 3 (menu bar + CLI) are the differentiators. A builder can be productive with JUST those two + Supabase on day one. The web app rituals are the compounding layer you add next.

---

## CLAUDE.md (Save in repo root)

```markdown
# LOCKIN

## What this is
Focus management tool for builders using AI coding tools (Claude Code, Cursor, etc).
Built for people with ADHD who start too many projects and finish too few.
Three surfaces: web app (planning), menu bar (awareness), CLI (terminal-native).

## Monorepo structure
- apps/web — Next.js 14, App Router, TypeScript, Tailwind, Vercel
- apps/menubar — Tauri v2, React + Vite, macOS menu bar app
- apps/cli — Node.js CLI, Commander.js, chalk
- packages/core — shared Supabase client, types, constants

## Stack
- Supabase (Postgres, Auth, RLS, Realtime)
- Tauri v2 (menu bar app, ~5MB bundle)
- Next.js 14 (web dashboard)
- Vercel (web hosting)
- npm (CLI distribution)

## Design system
- Background: #0a0a0a
- Card bg: #111111
- Borders: #1f1f1f
- Text primary: #e5e5e5
- Text secondary: #666666
- Amber accent: #F59E0B (primary action, focus, timer)
- Purple accent: #6366f1 (shutdown ritual)
- Green accent: #22c55e (shipped, on-track)
- Red accent: #ef4444 (over estimate, warnings)
- Font: JetBrains Mono (all surfaces)
- All caps labels, letter-spacing: 2px
- Cards have 3px left border colored by priority

## Core flows
1. Morning → Web app → pick 1-3 projects → estimate → commit
2. Build → Terminal → `lockin start` or menu bar → timer ticks
3. Done → `lockin done` or menu bar → session logged
4. Evening → Web app → review → capture context → shutdown
5. Weekly → Web app → review time allocation + accuracy

## Key rules
- Max 3 projects per daily plan
- Timer logs to sessions table on completion (from ANY surface)
- Context dumps persist on projects, shown on next focus
- All tables have RLS: user_id = auth.uid()
- Menu bar reads/writes same Supabase as web and CLI
- CLI stores local state at ~/.lockin/state.json for tmux speed
- Notifications are native macOS via Tauri plugin

## Data flow
Menu bar timer complete → insert session → Supabase Realtime →
web dashboard updates live. All three surfaces are eventually
consistent through Supabase.
```

---

## Quick-Start After Cloning

```bash
# Install dependencies
pnpm install

# Start web app
pnpm dev --filter web

# Start menu bar app (requires Rust toolchain)
pnpm dev --filter menubar

# Install CLI globally from local
cd apps/cli && npm link

# Test CLI
lockin login
lockin status
lockin start wolfgrey
lockin done
```
