'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'

type SessionRow = {
  project_id: string
  duration: number
  date: string
}

type ProjectInfo = {
  id: string
  name: string
  estimated_minutes: number
}

function getWeekRange(offset: number) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    days,
    label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  }
}

const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function ReviewPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [weekOffset, setWeekOffset] = useState(0)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [projects, setProjects] = useState<Map<string, ProjectInfo>>(new Map())
  const [loading, setLoading] = useState(true)

  const week = getWeekRange(weekOffset)

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)

      const [{ data: sessionsData }, { data: projectsData }] = await Promise.all([
        supabase
          .from('sessions')
          .select('project_id, duration, date')
          .gte('date', week.start)
          .lte('date', week.end),
        supabase
          .from('projects')
          .select('id, name, estimated_minutes'),
      ])

      setSessions(sessionsData || [])
      setProjects(new Map(projectsData?.map((p) => [p.id, p]) || []))
      setLoading(false)
    }
    load()
  }, [user, weekOffset, supabase, week.start, week.end])

  // Total focus time
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0)

  // Time by project
  const byProject = new Map<string, number>()
  sessions.forEach((s) => {
    byProject.set(s.project_id, (byProject.get(s.project_id) || 0) + s.duration)
  })
  const maxProjectMinutes = Math.max(...byProject.values(), 1)

  // Daily totals for heatmap
  const byDay = new Map<string, number>()
  sessions.forEach((s) => {
    byDay.set(s.date, (byDay.get(s.date) || 0) + s.duration)
  })

  // Est vs actual
  const projectStats = Array.from(byProject.entries()).map(([id, actual]) => {
    const proj = projects.get(id)
    const estimated = proj?.estimated_minutes || 0
    const delta = estimated > 0 ? Math.round(((actual - estimated) / estimated) * 100) : 0
    return {
      id,
      name: proj?.name || 'Unknown',
      actual,
      estimated,
      delta,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-widest text-foreground">Weekly Review</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-xs text-muted uppercase tracking-widest hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between bg-card border border-border rounded p-3">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="text-muted hover:text-foreground transition-colors px-2"
        >
          ←
        </button>
        <span className="text-sm font-bold text-foreground">{week.label}</span>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          disabled={weekOffset >= 0}
          className="text-muted hover:text-foreground transition-colors px-2 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {loading ? (
        <p className="text-muted text-sm text-center uppercase tracking-widest">Loading...</p>
      ) : (
        <>
          {/* Total */}
          <div className="text-center py-4">
            <p className="text-5xl font-bold text-amber">{totalMinutes}</p>
            <p className="text-xs text-muted uppercase tracking-widest mt-1">Minutes focused</p>
          </div>

          {/* Time by project */}
          {byProject.size > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold">Time by Project</h2>
              {Array.from(byProject.entries()).map(([id, minutes]) => {
                const proj = projects.get(id)
                const pct = (minutes / maxProjectMinutes) * 100
                return (
                  <div key={id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{proj?.name || 'Unknown'}</span>
                      <span className="text-muted">{minutes}m</span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className="bg-amber h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Daily heatmap */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted font-bold">Daily Activity</h2>
            <div className="flex gap-2 justify-center">
              {week.days.map((day, i) => {
                const mins = byDay.get(day) || 0
                const opacity = Math.min(mins / 120, 1)
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded border border-border"
                      style={{
                        backgroundColor: mins > 0
                          ? `rgba(245, 158, 11, ${Math.max(opacity, 0.15)})`
                          : '#111111',
                      }}
                      title={`${day}: ${mins}m`}
                    />
                    <span className="text-[10px] text-muted">{dayLabels[i]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Est vs Actual */}
          {projectStats.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold">Estimated vs Actual</h2>
              <div className="bg-card border border-border rounded overflow-hidden">
                <div className="grid grid-cols-4 gap-2 p-3 border-b border-border text-[10px] uppercase tracking-widest text-muted font-bold">
                  <span className="col-span-1">Project</span>
                  <span className="text-right">Est</span>
                  <span className="text-right">Actual</span>
                  <span className="text-right">Delta</span>
                </div>
                {projectStats.map((s) => (
                  <div key={s.id} className="grid grid-cols-4 gap-2 p-3 text-sm">
                    <span className="col-span-1 text-foreground truncate">{s.name}</span>
                    <span className="text-right text-muted">{s.estimated}m</span>
                    <span className="text-right text-foreground">{s.actual}m</span>
                    <span className={`text-right font-bold ${s.delta > 0 ? 'text-red' : 'text-green'}`}>
                      {s.delta > 0 ? '+' : ''}{s.delta}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalMinutes === 0 && (
            <div className="text-center py-8">
              <p className="text-muted text-sm">No sessions this week.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
