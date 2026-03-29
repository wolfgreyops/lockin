'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { nudgeQuotes } from '@/lib/quotes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Project = {
  id: string
  name: string
  next_action: string | null
  objective: string | null
  priority: 'high' | 'medium' | 'low'
  status: string
  total_minutes: number
  estimated_minutes: number
}

type DailyPlan = {
  committed: boolean
  planned_project_ids: string[]
  estimates: Record<string, number>
}

const priorityColors: Record<string, string> = {
  high: 'border-l-amber',
  medium: 'border-l-muted',
  low: 'border-l-border',
}

const priorityOrder: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [todaySessions, setTodaySessions] = useState<Record<string, number>>({})
  const [morningDone, setMorningDone] = useState(false)
  const [shutdownDone, setShutdownDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const [quote] = useState(() =>
    nudgeQuotes[Math.floor(Math.random() * nudgeQuotes.length)]
  )

  useEffect(() => {
    if (!user) return

    async function fetchData() {
      const today = new Date().toISOString().split('T')[0]

      const [projectsRes, planRes, shutdownRes, sessionsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, next_action, objective, priority, status, total_minutes, estimated_minutes')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('daily_plans')
          .select('committed, planned_project_ids, estimates')
          .eq('date', today)
          .single(),
        supabase
          .from('shutdown_log')
          .select('completed')
          .eq('date', today)
          .single(),
        supabase
          .from('sessions')
          .select('project_id, duration')
          .eq('date', today),
      ])

      if (projectsRes.data) {
        const sorted = projectsRes.data.sort(
          (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
        )
        setProjects(sorted)
      }

      if (planRes.data?.committed) {
        setPlan(planRes.data as DailyPlan)
        setMorningDone(true)
      }

      setShutdownDone(shutdownRes.data?.completed ?? false)

      // Group today's sessions by project
      const sessionMap: Record<string, number> = {}
      sessionsRes.data?.forEach((s) => {
        sessionMap[s.project_id] = (sessionMap[s.project_id] || 0) + s.duration
      })
      setTodaySessions(sessionMap)

      setLoading(false)
    }

    fetchData()

    // Real-time subscription for project updates
    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => { fetchData() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted text-sm uppercase tracking-widest">Loading...</p>
      </div>
    )
  }

  const now = new Date().getHours()
  const isMorning = now < 12
  const isEvening = now >= 17

  const plannedProjects = plan
    ? projects.filter((p) => plan.planned_project_ids.includes(p.id))
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider text-amber">LOCKIN</h1>
        <button
          onClick={handleLogout}
          className="text-xs text-muted uppercase tracking-widest hover:text-foreground transition-colors"
        >
          Log out
        </button>
      </div>

      {/* Nudge bar */}
      <div className="bg-card border border-border rounded p-4 text-center">
        <p className="text-sm text-muted italic">&ldquo;{quote}&rdquo;</p>
      </div>

      {/* Ritual buttons */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/morning"
          className={`flex flex-col items-center gap-1 p-3 rounded border transition-colors ${
            morningDone
              ? 'border-green bg-green/10 text-green'
              : isMorning
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-border bg-card text-muted'
          }`}
        >
          <span className="text-xl">☀</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">Morning</span>
        </Link>
        <Link
          href="/shutdown"
          className={`flex flex-col items-center gap-1 p-3 rounded border transition-colors ${
            shutdownDone
              ? 'border-green bg-green/10 text-green'
              : isEvening
                ? 'border-purple bg-purple/10 text-purple'
                : 'border-border bg-card text-muted'
          }`}
        >
          <span className="text-xl">☾</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">Shutdown</span>
        </Link>
        <Link
          href="/review"
          className="flex flex-col items-center gap-1 p-3 rounded border border-border bg-card text-muted hover:border-amber/50 transition-colors"
        >
          <span className="text-xl">◷</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">Review</span>
        </Link>
      </div>

      {/* Today's Plan */}
      {plan && plannedProjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-amber font-bold">Today&apos;s Plan</h2>
          {plannedProjects.map((project) => {
            const estimated = plan.estimates[project.id] || 0
            const actual = todaySessions[project.id] || 0
            const isOver = estimated > 0 && actual > estimated
            return (
              <div
                key={project.id}
                className="bg-card border border-border rounded p-4 border-l-[3px] border-l-amber"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{project.name}</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={isOver ? 'text-red font-bold' : 'text-green font-bold'}>
                      {actual}m
                    </span>
                    <span className="text-muted">/ {estimated}m</span>
                  </div>
                </div>
                <div className="mt-2">
                  <Link
                    href={`/focus/${project.id}`}
                    className="inline-block bg-amber text-background text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded hover:bg-amber/90 transition-colors"
                  >
                    Lock In
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* All Active Projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-widest text-muted font-bold">Active Projects</h2>
          <Link
            href="/project/new"
            className="text-xs uppercase tracking-widest text-amber hover:text-amber/80 font-bold"
          >
            + Add
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-card border border-border rounded p-8 text-center">
            <p className="text-muted text-sm">No active projects yet.</p>
            <Link href="/project/new" className="text-amber text-sm hover:underline mt-2 inline-block">
              Create your first project
            </Link>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`bg-card border border-border rounded p-4 border-l-[3px] ${priorityColors[project.priority]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate">{project.name}</h3>
                  {project.objective && (
                    <p className="text-xs text-muted mt-1 truncate">{project.objective}</p>
                  )}
                  {project.next_action && (
                    <p className="text-xs text-foreground/70 mt-2">
                      <span className="text-muted uppercase tracking-widest text-[10px]">Next: </span>
                      {project.next_action}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted">{project.total_minutes}m</span>
                  <Link
                    href={`/project/${project.id}/edit`}
                    className="text-muted hover:text-foreground transition-colors text-sm"
                  >
                    ✎
                  </Link>
                </div>
              </div>
              <div className="mt-3">
                <Link
                  href={`/focus/${project.id}`}
                  className="inline-block bg-amber text-background text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded hover:bg-amber/90 transition-colors"
                >
                  Lock In
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
