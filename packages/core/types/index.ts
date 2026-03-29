export type Priority = 'high' | 'medium' | 'low'
export type ProjectStatus = 'active' | 'paused' | 'shipped'

export type Profile = {
  id: string
  display_name: string | null
  timer_duration: number
  created_at: string
}

export type Project = {
  id: string
  user_id: string
  name: string
  next_action: string | null
  objective: string | null
  status: ProjectStatus
  priority: Priority
  notes: string | null
  context_dump: string | null
  estimated_minutes: number
  total_minutes: number
  created_at: string
  updated_at: string
}

export type Session = {
  id: string
  user_id: string
  project_id: string
  duration: number
  estimated: number | null
  action: string | null
  date: string
  created_at: string
}

export type DailyPlan = {
  id: string
  user_id: string
  date: string
  planned_project_ids: string[]
  estimates: Record<string, number>
  committed: boolean
  created_at: string
}

export type ShutdownLog = {
  id: string
  user_id: string
  date: string
  completed: boolean
  created_at: string
}

export type CLIState = {
  active_project_id: string | null
  active_project_name: string | null
  next_action: string | null
  timer_start: string | null
  timer_duration: number
}
