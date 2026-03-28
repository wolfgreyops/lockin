'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useParams, useRouter } from 'next/navigation'

type Project = {
  id: string
  name: string
  objective: string | null
  next_action: string | null
  notes: string | null
  context_dump: string | null
  total_minutes: number
  estimated_minutes: number
}

export default function FocusPage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Timer state
  const [timerDuration, setTimerDuration] = useState(25) // minutes
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [completionFlash, setCompletionFlash] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Editable fields
  const [currentAction, setCurrentAction] = useState('')
  const [scratchPad, setScratchPad] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: profile }, { count }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('profiles').select('timer_duration').eq('id', user!.id).single(),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      ])

      if (proj) {
        setProject(proj)
        setCurrentAction(proj.next_action || '')
        setScratchPad(proj.notes || '')
      }
      if (profile?.timer_duration) {
        setTimerDuration(profile.timer_duration)
        setSecondsLeft(profile.timer_duration * 60)
      }
      setSessionCount(count || 0)
      setLoading(false)
    }
    if (user) load()
  }, [user, projectId, supabase])

  const completeSession = useCallback(async () => {
    if (!user || !project) return
    setIsRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)

    // Log session
    await supabase.from('sessions').insert({
      user_id: user.id,
      project_id: project.id,
      duration: timerDuration,
      action: currentAction || null,
      date: new Date().toISOString().split('T')[0],
    })

    // Update project total_minutes
    await supabase
      .from('projects')
      .update({ total_minutes: project.total_minutes + timerDuration })
      .eq('id', project.id)

    setProject((p) => p ? { ...p, total_minutes: p.total_minutes + timerDuration } : p)
    setSessionCount((c) => c + 1)

    // Flash
    setCompletionFlash(true)
    setTimeout(() => setCompletionFlash(false), 2000)

    // Reset
    setSecondsLeft(timerDuration * 60)
  }, [user, project, timerDuration, currentAction, supabase])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            completeSession()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, completeSession])

  function toggleTimer() {
    setIsRunning((prev) => !prev)
  }

  function resetTimer() {
    setIsRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setSecondsLeft(timerDuration * 60)
  }

  async function handleActionBlur() {
    if (!project) return
    await supabase.from('projects').update({ next_action: currentAction || null }).eq('id', project.id)
  }

  async function handleNotesBlur() {
    if (!project) return
    await supabase.from('projects').update({ notes: scratchPad || null }).eq('id', project.id)
  }

  async function handleShip() {
    if (!project) return
    await supabase.from('projects').update({ status: 'shipped' }).eq('id', project.id)
    router.push('/dashboard')
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted text-sm uppercase tracking-widest">Loading...</p>
      </div>
    )
  }

  const totalSeconds = timerDuration * 60
  const progress = secondsLeft / totalSeconds
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  // SVG ring
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="space-y-6">
      {/* Completion flash */}
      {completionFlash && (
        <div className="fixed inset-0 bg-amber/10 pointer-events-none z-50 animate-pulse" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-xs text-muted uppercase tracking-widest hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleShip}
          className="text-xs text-green uppercase tracking-widest font-bold hover:text-green/80 transition-colors"
        >
          Mark as Shipped
        </button>
      </div>

      {/* Project info */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
        {project.objective && (
          <p className="text-sm text-muted mt-1">{project.objective}</p>
        )}
      </div>

      {/* Context dump banner */}
      {project.context_dump && (
        <div className="bg-purple/10 border border-purple/30 rounded p-3">
          <p className="text-[10px] uppercase tracking-widest text-purple font-bold mb-1">Where You Left Off</p>
          <p className="text-sm text-foreground/80">{project.context_dump}</p>
        </div>
      )}

      {/* Timer */}
      <div className="flex flex-col items-center">
        <div className="relative w-52 h-52">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#1f1f1f"
              strokeWidth="4"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold tabular-nums text-foreground">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={toggleTimer}
            className={`px-6 py-2 rounded text-xs uppercase tracking-widest font-bold transition-colors ${
              isRunning
                ? 'bg-card border border-border text-foreground hover:border-amber/50'
                : 'bg-amber text-background hover:bg-amber/90'
            }`}
          >
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button
            onClick={resetTimer}
            className="px-6 py-2 rounded text-xs uppercase tracking-widest font-bold bg-card border border-border text-muted hover:text-foreground transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Current task */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-2">Current Task</label>
        <input
          type="text"
          value={currentAction}
          onChange={(e) => setCurrentAction(e.target.value)}
          onBlur={handleActionBlur}
          className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors"
          placeholder="What are you working on right now?"
        />
      </div>

      {/* Scratch pad */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-2">Scratch Pad</label>
        <textarea
          value={scratchPad}
          onChange={(e) => setScratchPad(e.target.value)}
          onBlur={handleNotesBlur}
          rows={4}
          className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors resize-none"
          placeholder="Quick notes, links, thoughts..."
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded p-3 text-center">
          <p className="text-xl font-bold text-amber">{project.total_minutes}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted mt-1">Total Min</p>
        </div>
        <div className="bg-card border border-border rounded p-3 text-center">
          <p className="text-xl font-bold text-foreground">{sessionCount}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted mt-1">Sessions</p>
        </div>
        <div className="bg-card border border-border rounded p-3 text-center">
          <p className="text-xl font-bold text-foreground">{project.estimated_minutes}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted mt-1">Est Min</p>
        </div>
      </div>
    </div>
  )
}
