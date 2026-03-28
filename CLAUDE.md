@AGENTS.md

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
