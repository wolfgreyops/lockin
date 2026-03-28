'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'

type Project = {
  id: string
  name: string
  objective: string | null
  priority: 'high' | 'medium' | 'low'
}

const timeOptions = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '1.5h', value: 90 },
  { label: '2h', value: 120 },
]

const priorityBadgeColors: Record<string, string> = {
  high: 'bg-amber/20 text-amber',
  medium: 'bg-muted/20 text-muted',
  low: 'bg-border/20 text-border',
}

export default function MorningPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [estimates, setEstimates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('id, name, objective, priority')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (data) setProjects(data)
      setLoading(false)
    }
    if (user) load()
  }, [user, supabase])

  function toggleProject(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  function setEstimate(projectId: string, minutes: number) {
    setEstimates((prev) => ({ ...prev, [projectId]: minutes }))
  }

  const totalEstimated = Object.values(estimates).reduce((sum, v) => sum + v, 0)
  const totalHours = totalEstimated / 60

  async function handleCommit() {
    if (!user) return
    setCommitting(true)
    const today = new Date().toISOString().split('T')[0]

    await supabase.from('daily_plans').upsert({
      user_id: user.id,
      date: today,
      planned_project_ids: selected,
      estimates,
      committed: true,
    }, { onConflict: 'user_id,date' })

    // Update each project's estimated_minutes
    for (const id of selected) {
      if (estimates[id]) {
        await supabase
          .from('projects')
          .update({ estimated_minutes: estimates[id] })
          .eq('id', id)
      }
    }

    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted text-sm uppercase tracking-widest">Loading...</p>
      </div>
    )
  }

  const selectedProjects = projects.filter((p) => selected.includes(p.id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-widest text-amber">Morning Lockdown</h1>
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
                  ? 'bg-amber text-background'
                  : 'bg-card border border-border text-muted'
            }`}
          >
            {step > s ? '✓' : s}
          </div>
        ))}
      </div>

      {/* Step 1: Select */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted text-center">Pick 1-3 projects for today</p>
          <div className="space-y-2">
            {projects.map((project) => {
              const isSelected = selected.includes(project.id)
              const isDisabled = !isSelected && selected.length >= 3
              return (
                <button
                  key={project.id}
                  onClick={() => toggleProject(project.id)}
                  disabled={isDisabled}
                  className={`w-full text-left p-4 rounded border transition-colors ${
                    isSelected
                      ? 'border-amber bg-amber/10'
                      : isDisabled
                        ? 'border-border bg-card opacity-40 cursor-not-allowed'
                        : 'border-border bg-card hover:border-amber/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{project.name}</span>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${priorityBadgeColors[project.priority]}`}>
                      {project.priority}
                    </span>
                  </div>
                  {project.objective && (
                    <p className="text-xs text-muted mt-1">{project.objective}</p>
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={selected.length === 0}
            className="w-full bg-amber text-background font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-amber/90 transition-colors disabled:opacity-50"
          >
            Next: Estimate Time
          </button>
        </div>
      )}

      {/* Step 2: Estimate */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted text-center">How long for each project?</p>
          <div className="bg-purple/10 border border-purple/30 rounded p-3 text-center">
            <p className="text-xs text-purple">Your ADHD brain will underestimate. Add 50%.</p>
          </div>
          {selectedProjects.map((project) => (
            <div key={project.id} className="bg-card border border-border rounded p-4 space-y-3">
              <p className="font-bold text-foreground">{project.name}</p>
              <div className="grid grid-cols-3 gap-2">
                {timeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEstimate(project.id, opt.value)}
                    className={`py-2 rounded text-xs uppercase tracking-widest font-bold transition-colors ${
                      estimates[project.id] === opt.value
                        ? 'bg-amber text-background'
                        : 'bg-background border border-border text-muted hover:border-amber/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className={`text-center p-3 rounded border ${
            totalHours > 8
              ? 'border-red bg-red/10 text-red'
              : totalHours > 6
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-green bg-green/10 text-green'
          }`}>
            <p className="text-lg font-bold">{totalEstimated}m total</p>
            <p className="text-xs">
              {totalHours > 8 ? 'Be realistic' : totalHours > 6 ? 'Heavy day' : 'Looks achievable'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-border bg-card text-muted py-2.5 rounded text-xs uppercase tracking-widest font-bold hover:text-foreground transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedProjects.some((p) => !estimates[p.id])}
              className="flex-1 bg-amber text-background font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-amber/90 transition-colors disabled:opacity-50"
            >
              Next: Commit
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Commit */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted text-center">Your plan for today</p>
          <div className="space-y-2">
            {selectedProjects.map((project, i) => (
              <div key={project.id} className="bg-card border border-border rounded p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-amber font-bold">{i + 1}</span>
                  <span className="font-bold text-foreground">{project.name}</span>
                </div>
                <span className="text-sm text-muted">{estimates[project.id]}m</span>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber">{totalEstimated}m</p>
            <p className="text-xs text-muted uppercase tracking-widest">Total commitment</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-border bg-card text-muted py-2.5 rounded text-xs uppercase tracking-widest font-bold hover:text-foreground transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCommit}
              disabled={committing}
              className="flex-1 bg-amber text-background font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-amber/90 transition-colors disabled:opacity-50"
            >
              {committing ? 'Locking in...' : 'Lock In My Day'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
