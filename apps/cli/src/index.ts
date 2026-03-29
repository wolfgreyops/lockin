#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import open from 'open'
import { createClient } from '@supabase/supabase-js'
import { NUDGE_QUOTES } from '@lockin/core'
import { getState, saveState, saveCredentials, isLoggedIn } from './state.js'
import { getSupabase } from './client.js'
import { createServer } from 'http'

const amber = chalk.hex('#F59E0B')
const purple = chalk.hex('#6366f1')
const green = chalk.hex('#22c55e')
const dim = chalk.gray

const program = new Command()
  .name('lockin')
  .description('LOCKIN — Focus management from your terminal')
  .version('0.1.0')

// ─── LOGIN ────────────────────────────────────────────────────

program
  .command('login')
  .description('Authenticate with Supabase')
  .requiredOption('--url <url>', 'Supabase project URL')
  .requiredOption('--key <key>', 'Supabase anon key')
  .option('--email <email>', 'Email for password login')
  .option('--password <password>', 'Password')
  .action(async (opts) => {
    const supabase = createClient(opts.url, opts.key)

    if (opts.email && opts.password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: opts.email,
        password: opts.password,
      })
      if (error) {
        console.log(chalk.red(`Login failed: ${error.message}`))
        process.exit(1)
      }
      saveCredentials({
        url: opts.url,
        key: opts.key,
        access_token: data.session!.access_token,
        refresh_token: data.session!.refresh_token,
      })
      console.log(amber('◆') + ' Logged in as ' + chalk.bold(data.user!.email))
    } else {
      // Browser OAuth flow with local callback server
      const port = 54321
      const redirectUrl = `http://localhost:${port}/callback`

      console.log(dim('Opening browser for authentication...'))

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl },
      })

      if (error || !data.url) {
        console.log(chalk.red('Failed to start OAuth flow'))
        process.exit(1)
      }

      // Start local server to catch the callback
      const server = createServer(async (req, res) => {
        const url = new URL(req.url!, `http://localhost:${port}`)
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code')
          if (code) {
            const { data: session, error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error && session.session) {
              saveCredentials({
                url: opts.url,
                key: opts.key,
                access_token: session.session.access_token,
                refresh_token: session.session.refresh_token,
              })
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end('<h1>Logged in! You can close this tab.</h1>')
              console.log(amber('◆') + ' Logged in successfully')
              server.close()
              process.exit(0)
            }
          }
          res.writeHead(400)
          res.end('Login failed')
          server.close()
          process.exit(1)
        }
      })

      server.listen(port, () => {
        open(data.url!)
      })
    }
  })

// ─── STATUS ───────────────────────────────────────────────────

program
  .command('status')
  .description('Show current focus state and today\'s plan')
  .action(async () => {
    if (!isLoggedIn()) {
      console.log(chalk.red('Not logged in. Run `lockin login` first.'))
      return
    }

    const state = getState()
    const supabase = getSupabase()
    const today = new Date().toISOString().split('T')[0]

    console.log()
    if (state.active_project_name && state.timer_start) {
      const elapsed = Math.floor((Date.now() - new Date(state.timer_start).getTime()) / 60000)
      console.log(amber('◆ LOCKED IN: ') + chalk.bold(state.active_project_name) + dim(` [${elapsed}min]`))
      if (state.next_action) {
        console.log(dim('  → ') + state.next_action)
      }
    } else {
      console.log(dim('◆ No active session'))
    }

    // Today's plan
    const { data: plan } = await supabase
      .from('daily_plans')
      .select('planned_project_ids, estimates')
      .eq('date', today)
      .single()

    if (plan?.planned_project_ids?.length) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', plan.planned_project_ids)

      console.log()
      console.log(amber('TODAY\'S PLAN'))
      projects?.forEach((p, i) => {
        const est = (plan.estimates as Record<string, number>)?.[p.id] || 0
        console.log(dim(`  ${i + 1}. `) + p.name + dim(` (${est}m)`))
      })
    }

    // Random nudge
    console.log()
    const q = NUDGE_QUOTES[Math.floor(Math.random() * NUDGE_QUOTES.length)]
    console.log(dim(`  "${q}"`))
    console.log()
  })

// ─── START ────────────────────────────────────────────────────

program
  .command('start [name]')
  .description('Start a focus session on a project')
  .action(async (name) => {
    const supabase = getSupabase()

    let query = supabase.from('projects').select('id, name, next_action, objective, total_minutes').eq('status', 'active')

    if (name) {
      query = query.ilike('name', `%${name}%`)
    }

    const { data: projects } = await query

    if (!projects || projects.length === 0) {
      console.log(chalk.red(name ? `No project matching "${name}"` : 'No active projects'))
      return
    }

    const project = projects[0]

    saveState({
      active_project_id: project.id,
      active_project_name: project.name,
      next_action: project.next_action,
      timer_start: new Date().toISOString(),
      timer_duration: 25,
    })

    console.log()
    console.log(amber('◆ LOCKED IN: ') + chalk.bold(project.name))
    if (project.next_action) {
      console.log(dim('  → ') + project.next_action)
    }
    if (project.objective) {
      console.log(dim('  Goal: ') + project.objective)
    }
    console.log()

    // Live timer display
    const start = Date.now()
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const m = Math.floor(elapsed / 60)
      const s = elapsed % 60
      process.stdout.write(`\r${amber('◆')} ${chalk.bold(project.name)} → ${dim(project.next_action || 'focusing')} ${amber(`[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`)}`)
    }

    const interval = setInterval(tick, 1000)
    tick()

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      clearInterval(interval)
      const elapsed = Math.floor((Date.now() - start) / 60000)
      console.log()
      console.log()

      if (elapsed > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('sessions').insert({
            user_id: user.id,
            project_id: project.id,
            duration: elapsed,
            action: project.next_action,
            date: new Date().toISOString().split('T')[0],
          })

          await supabase
            .from('projects')
            .update({ total_minutes: project.total_minutes + elapsed })
            .eq('id', project.id)

          console.log(green('✓') + ` Logged ${amber(elapsed + 'min')} to ${chalk.bold(project.name)}`)
        }
      } else {
        console.log(dim('Session too short to log (<1min)'))
      }

      saveState({
        active_project_id: null,
        active_project_name: null,
        next_action: null,
        timer_start: null,
        timer_duration: 25,
      })
      process.exit(0)
    })
  })

// ─── DONE ─────────────────────────────────────────────────────

program
  .command('done')
  .description('End the current session and log it')
  .action(async () => {
    const state = getState()
    if (!state.active_project_id || !state.timer_start) {
      console.log(dim('No active session to end'))
      return
    }

    const elapsed = Math.floor((Date.now() - new Date(state.timer_start).getTime()) / 60000)
    const supabase = getSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log(chalk.red('Auth error. Run `lockin login` again.'))
      return
    }

    if (elapsed > 0) {
      await supabase.from('sessions').insert({
        user_id: user.id,
        project_id: state.active_project_id,
        duration: elapsed,
        action: state.next_action,
        date: today,
      })

      // Update total
      const { data: proj } = await supabase
        .from('projects')
        .select('total_minutes')
        .eq('id', state.active_project_id)
        .single()

      if (proj) {
        await supabase
          .from('projects')
          .update({ total_minutes: proj.total_minutes + elapsed })
          .eq('id', state.active_project_id)
      }

      console.log(green('✓') + ` Logged ${amber(elapsed + 'min')} to ${chalk.bold(state.active_project_name)}`)
    } else {
      console.log(dim('Session too short to log (<1min)'))
    }

    saveState({
      active_project_id: null,
      active_project_name: null,
      next_action: null,
      timer_start: null,
      timer_duration: 25,
    })
  })

// ─── NEXT ─────────────────────────────────────────────────────

program
  .command('next')
  .description('Show the next planned project for today')
  .action(async () => {
    const supabase = getSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data: plan } = await supabase
      .from('daily_plans')
      .select('planned_project_ids')
      .eq('date', today)
      .single()

    if (!plan?.planned_project_ids?.length) {
      console.log(dim('No plan for today. Run the morning lockdown on the web app.'))
      return
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, next_action')
      .in('id', plan.planned_project_ids)

    const state = getState()
    const remaining = projects?.filter(p => p.id !== state.active_project_id) || []

    if (remaining.length === 0) {
      console.log(green('✓') + ' All planned projects done for today!')
      return
    }

    const next = remaining[0]
    console.log(amber('◆ Next up: ') + chalk.bold(next.name))
    if (next.next_action) {
      console.log(dim('  → ') + next.next_action)
    }
  })

// ─── PROJECTS ─────────────────────────────────────────────────

program
  .command('projects')
  .description('List all active projects')
  .action(async () => {
    const supabase = getSupabase()
    const { data: projects } = await supabase
      .from('projects')
      .select('name, priority, next_action, total_minutes, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (!projects?.length) {
      console.log(dim('No active projects'))
      return
    }

    console.log()
    console.log(amber('ACTIVE PROJECTS'))
    console.log()
    projects.forEach((p) => {
      const badge = p.priority === 'high' ? amber('▪') : p.priority === 'medium' ? dim('▪') : chalk.gray('▪')
      console.log(`  ${badge} ${chalk.bold(p.name)} ${dim(`(${p.total_minutes}m)`)}`)
      if (p.next_action) {
        console.log(dim(`    → ${p.next_action}`))
      }
    })
    console.log()
  })

// ─── SHIP ─────────────────────────────────────────────────────

program
  .command('ship [name]')
  .description('Mark a project as shipped')
  .action(async (name) => {
    if (!name) {
      console.log(chalk.red('Provide a project name: lockin ship <name>'))
      return
    }

    const supabase = getSupabase()
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active')
      .ilike('name', `%${name}%`)

    if (!projects?.length) {
      console.log(chalk.red(`No active project matching "${name}"`))
      return
    }

    const project = projects[0]
    await supabase.from('projects').update({ status: 'shipped' }).eq('id', project.id)

    console.log(green('🚢 SHIPPED: ') + chalk.bold(project.name))
  })

// ─── TMUX ─────────────────────────────────────────────────────

program
  .command('tmux')
  .description('Output status for tmux status-right')
  .action(() => {
    const state = getState()
    if (state.active_project_name && state.timer_start) {
      const elapsed = Math.floor((Date.now() - new Date(state.timer_start).getTime()) / 1000)
      const m = Math.floor(elapsed / 60)
      const s = elapsed % 60
      process.stdout.write(`◆ ${state.active_project_name} ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    } else {
      process.stdout.write('◆ no session')
    }
  })

program.parse()
