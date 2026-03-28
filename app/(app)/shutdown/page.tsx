'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'

type SessionGroup = {
  projectId: string
  projectName: string
  actualMinutes: number
  estimatedMinutes: number
}

export default function ShutdownPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([])
  const [contextDumps, setContextDumps] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [totalMinutes, setTotalMinutes] = useState(0)

  useEffect(() => {
    async function load() {
      if (!user) return
      const today = new Date().toISOString().split('T')[0]

      const [{ data: sessions }, { data: plan }, { data: projects }] = await Promise.all([
        supabase
          .from('sessions')
          .select('project_id, duration')
          .eq('date', today),
        supabase
          .from('daily_plans')
          .select('planned_project_ids, estimates')
          .eq('date', today)
          .single(),
        supabase
          .from('projects')
          .select('id, name, context_dump, estimated_minutes')
          .eq('status', 'active'),
      ])

      const projectMap = new Map(projects?.map((p) => [p.id, p]) || [])
      const estimates = (plan?.estimates as Record<string, number>) || {}

      // Group sessions by project
      const grouped = new Map<string, number>()
      sessions?.forEach((s) => {
        grouped.set(s.project_id, (grouped.get(s.project_id) || 0) + s.duration)
      })

      // Include planned projects even if no sessions
      const allProjectIds = new Set([
        ...grouped.keys(),
        ...(plan?.planned_project_ids || []),
      ])

      const groups: SessionGroup[] = []
      const dumps: Record<string, string> = {}
      let total = 0

      allProjectIds.forEach((id) => {
        const proj = projectMap.get(id)
        if (!proj) return
        const actual = grouped.get(id) || 0
        total += actual
        groups.push({
          projectId: id,
          projectName: proj.name,
          actualMinutes: actual,
          estimatedMinutes: estimates[id] || proj.estimated_minutes || 0,
        })
        dumps[id] = proj.context_dump || ''
      })

      setSessionGroups(groups)
      setContextDumps(dumps)
      setTotalMinutes(total)
      setLoading(false)
    }
    load()
  }, [user, supabase])

  async function handleClose() {
    if (!user) return
    setClosing(true)
    const today = new Date().toISOString().split('T')[0]

    // Save context dumps
    for (const [projectId, dump] of Object.entries(contextDumps)) {
      if (dump) {
        await supabase
          .from('projects')
          .update({ context_dump: dump, updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }
    }

    // Insert shutdown log
    await supabase.from('shutdown_log').upsert({
      user_id: user.id,
      date: today,
      completed: true,
    }, { onConflict: 'user_id,date' })

    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted text-sm uppercase tracking-widest">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-widest text-purple">Evening Shutdown</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-xs text-muted uppercase tracking-widest hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step > s
                ? 'bg-green text-background'
                : step === s
                  ? 'bg-purple text-white'
                  : 'bg-card border border-border text-muted'
            }`}
          >
            {step > s ? '✓' : s}
          </div>
        ))}
      </div>

      {/* Step 1: Review */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted text-center">How did today go?</p>
          {sessionGroups.length === 0 ? (
            <div className="bg-card border border-border rounded p-8 text-center">
              <p className="text-muted text-sm">No sessions or plans for today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessionGroups.map((g) => {
                const overBy = g.estimatedMinutes > 0
                  ? ((g.actualMinutes - g.estimatedMinutes) / g.estimatedMinutes) * 100
                  : 0
                const isOver = overBy > 20
                return (
                  <div key={g.projectId} className="bg-card border border-border rounded p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{g.projectName}</span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={isOver ? 'text-red' : 'text-green'}>
                          {g.actualMinutes}m
                        </span>
                        {g.estimatedMinutes > 0 && (
                          <span className="text-muted">/ {g.estimatedMinutes}m est</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button
            onClick={() => setStep(2)}
            className="w-full bg-purple text-white font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-purple/90 transition-colors"
          >
            Next: Capture Context
          </button>
        </div>
      )}

      {/* Step 2: Capture */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted text-center">Where did you leave off?</p>
          {sessionGroups.map((g) => (
            <div key={g.projectId} className="bg-card border border-border rounded p-4 space-y-3">
              <p className="font-bold text-foreground">{g.projectName}</p>
              <textarea
                value={contextDumps[g.projectId] || ''}
                onChange={(e) =>
                  setContextDumps((prev) => ({ ...prev, [g.projectId]: e.target.value }))
                }
                rows={3}
                className="w-full bg-background border border-border rounded px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-purple transition-colors resize-none"
                placeholder="What were you working on? What's the next step? Any blockers?"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-border bg-card text-muted py-2.5 rounded text-xs uppercase tracking-widest font-bold hover:text-foreground transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-purple text-white font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-purple/90 transition-colors"
            >
              Next: Close Day
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Close */}
      {step === 3 && (
        <div className="space-y-6 text-center">
          <div className="py-8">
            <p className="text-5xl font-bold text-purple">{totalMinutes}m</p>
            <p className="text-xs text-muted uppercase tracking-widest mt-2">Total focus time today</p>
          </div>
          <p className="text-sm text-foreground/80">
            {totalMinutes >= 120
              ? "Solid day. You showed up and did the work."
              : totalMinutes >= 60
                ? "Progress is progress. Tomorrow is another shot."
                : totalMinutes > 0
                  ? "Every minute counts. You started — that's the hardest part."
                  : "Rest day. Tomorrow you lock in."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-border bg-card text-muted py-2.5 rounded text-xs uppercase tracking-widest font-bold hover:text-foreground transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleClose}
              disabled={closing}
              className="flex-1 bg-purple text-white font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-purple/90 transition-colors disabled:opacity-50"
            >
              {closing ? 'Closing...' : 'Shut It Down'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
