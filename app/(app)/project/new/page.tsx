'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const priorities = ['high', 'medium', 'low'] as const

export default function NewProjectPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [objective, setObjective] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const { error } = await supabase.from('projects').insert({
      user_id: user.id,
      name,
      next_action: nextAction || null,
      objective: objective || null,
      priority,
      notes: notes || null,
    })

    if (!error) {
      router.push('/dashboard')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-widest text-foreground">New Project</h1>
        <Link href="/dashboard" className="text-xs text-muted uppercase tracking-widest hover:text-foreground">
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors"
            placeholder="What are you building?"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Next Action</label>
          <input
            type="text"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors"
            placeholder="What's the very next thing to do?"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Objective</label>
          <input
            type="text"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors"
            placeholder="What does 'done' look like?"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Priority</label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 rounded text-xs uppercase tracking-widest font-bold transition-colors ${
                  priority === p
                    ? p === 'high'
                      ? 'bg-amber text-background'
                      : p === 'medium'
                        ? 'bg-muted text-background'
                        : 'bg-border text-foreground'
                    : 'bg-card border border-border text-muted hover:border-amber/30'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors resize-none"
            placeholder="Any additional context..."
          />
        </div>

        <button
          type="submit"
          disabled={saving || !name}
          className="w-full bg-amber text-background font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-amber/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  )
}
