@AGENTS.md

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
