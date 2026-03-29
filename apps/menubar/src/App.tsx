import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { NUDGE_QUOTES, TIMER_DEFAULT_MINUTES } from '@lockin/core'

const C = {
  bg: '#0a0a0a',
  card: '#111111',
  border: '#1f1f1f',
  text: '#e5e5e5',
  muted: '#666666',
  amber: '#F59E0B',
  green: '#22c55e',
}

type Project = {
  id: string
  name: string
  next_action: string | null
  priority: string
}

function App() {
  const [projects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [timerDuration] = useState(TIMER_DEFAULT_MINUTES)
  const [secondsLeft, setSecondsLeft] = useState(TIMER_DEFAULT_MINUTES * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [showProjectList, setShowProjectList] = useState(false)
  const [loggedMessage, setLoggedMessage] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [quote] = useState(() =>
    NUDGE_QUOTES[Math.floor(Math.random() * NUDGE_QUOTES.length)]
  )

  const updateTrayTitle = useCallback(async (secs: number, running: boolean) => {
    try {
      if (running) {
        const m = Math.floor(secs / 60)
        const s = secs % 60
        await invoke('set_tray_title', { title: `◆ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` })
      } else {
        await invoke('set_tray_title', { title: '◆ LOCKIN' })
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            setLoggedMessage('Session complete!')
            setTimeout(() => setLoggedMessage(''), 3000)
            updateTrayTitle(0, false)
            return timerDuration * 60
          }
          updateTrayTitle(prev - 1, true)
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, timerDuration, updateTrayTitle])

  function toggleTimer() {
    if (!activeProject) return
    const next = !isRunning
    setIsRunning(next)
    if (!next) updateTrayTitle(secondsLeft, false)
  }

  function resetTimer() {
    setIsRunning(false)
    setSecondsLeft(timerDuration * 60)
    updateTrayTitle(0, false)
  }

  function selectProject(project: Project) {
    setActiveProject(project)
    setShowProjectList(false)
    resetTimer()
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const progress = secondsLeft / (timerDuration * 60)
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {loggedMessage && (
        <div style={{
          background: C.green + '20', border: `1px solid ${C.green}50`,
          borderRadius: 4, padding: '6px 10px', color: C.green,
          fontSize: 11, textAlign: 'center', textTransform: 'uppercase',
          letterSpacing: 2, fontWeight: 700,
        }}>
          {loggedMessage}
        </div>
      )}

      {/* Project selector */}
      <div
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', cursor: 'pointer' }}
        onClick={() => setShowProjectList(!showProjectList)}
      >
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: C.muted, marginBottom: 4 }}>
          {activeProject ? 'Focused On' : 'Select Project'} ▾
        </div>
        <div style={{ fontWeight: 700, color: C.text }}>
          {activeProject ? activeProject.name : 'No active session'}
        </div>
        {activeProject?.next_action && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>→ {activeProject.next_action}</div>
        )}
      </div>

      {showProjectList && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, maxHeight: 150, overflow: 'auto' }}>
          {projects.length === 0 ? (
            <div style={{ padding: 12, color: C.muted, fontSize: 11, textAlign: 'center' }}>
              Connect Supabase to load projects
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                onClick={() => selectProject(p)}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  borderBottom: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${p.priority === 'high' ? C.amber : C.muted}`,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12 }}>{p.name}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Timer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="70" cy="70" r={radius} fill="none" stroke={C.border} strokeWidth="3" />
            <circle
              cx="70" cy="70" r={radius} fill="none" stroke={C.amber}
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={toggleTimer}
            disabled={!activeProject}
            style={{
              background: isRunning ? C.card : C.amber,
              color: isRunning ? C.text : C.bg,
              border: isRunning ? `1px solid ${C.border}` : 'none',
              borderRadius: 4, padding: '6px 20px', fontSize: 11,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2,
              cursor: activeProject ? 'pointer' : 'not-allowed',
              opacity: activeProject ? 1 : 0.4, fontFamily: 'inherit',
            }}
          >
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button
            onClick={resetTimer}
            style={{
              background: C.card, color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 4, padding: '6px 20px', fontSize: 11,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Nudge */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 6, padding: '8px 12px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>
          &ldquo;{quote}&rdquo;
        </p>
      </div>
    </div>
  )
}

export default App
