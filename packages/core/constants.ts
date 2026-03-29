export const TIMER_DEFAULT_MINUTES = 25

export const PRIORITIES = ['high', 'medium', 'low'] as const

export const PRIORITY_COLORS = {
  high: '#F59E0B',
  medium: '#6B7280',
  low: '#374151',
} as const

export const COLORS = {
  background: '#0a0a0a',
  card: '#111111',
  border: '#1f1f1f',
  text: '#e5e5e5',
  muted: '#666666',
  amber: '#F59E0B',
  purple: '#6366f1',
  green: '#22c55e',
  red: '#ef4444',
} as const

export const NUDGE_QUOTES = [
  "Your brain wants novelty. Give it depth instead.",
  "One project. One hour. That's the whole game.",
  "Switching costs more than struggling.",
  "The urge to start something new is the old thing working.",
  "Ship this first. The next idea will wait.",
  "Focus isn't about willpower. It's about removing choices.",
  "You don't need motivation. You need momentum.",
  "Twenty-five minutes. That's all. Then decide.",
  "The dopamine is in the finishing.",
  "Less open tabs. More shipped projects.",
  "Your future self will thank present you for staying.",
  "Boredom is the bridge between starting and mastering.",
  "Deep work isn't natural. Do it anyway.",
  "The best productivity hack is finishing what you started.",
  "You're not behind. You're building.",
] as const

export const TIME_OPTIONS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '1.5h', value: 90 },
  { label: '2h', value: 120 },
] as const
