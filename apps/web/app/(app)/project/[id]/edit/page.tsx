'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const priorities = ['high', 'medium', 'low'] as const

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const projectId = params.id as string

  const [name, setName] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [objective, setObjective] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('active')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (data) {
        setName(data.name)
        setNextAction(data.next_action || '')
        setObjective(data.objective || '')
        setPriority(data.priority)
        setNotes(data.notes || '')
        setStatus(data.status)
      }
      setLoading(false)
    }
    load()
  }, [projectId, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    await supabase
      .from('projects')
      .update({
        name,
        next_action: nextAction || null,
        objective: objective || null,
        priority,
        notes: notes || null,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    router.push('/dashboard')
  }

  async function handleDelete() {
    await supabase.from('projects').delete().eq('id', projectId)
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-widest text-foreground">Edit Project</h1>
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
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Next Action</label>
          <input
            type="text"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Objective</label>
          <input
            type="text"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="w-full bg-card border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-amber transition-colors"
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
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Status</label>
          <div className="flex gap-2">
            {(['active', 'paused', 'shipped'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded text-xs uppercase tracking-widest font-bold transition-colors ${
                  status === s
                    ? s === 'shipped'
                      ? 'bg-green text-background'
                      : s === 'paused'
                        ? 'bg-purple text-white'
                        : 'bg-amber text-background'
                    : 'bg-card border border-border text-muted hover:border-amber/30'
                }`}
              >
                {s}
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
          />
        </div>

        <button
          type="submit"
          disabled={saving || !name}
          className="w-full bg-amber text-background font-bold py-2.5 rounded uppercase tracking-widest text-sm hover:bg-amber/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="pt-4 border-t border-border">
        {showDelete ? (
          <div className="space-y-3">
            <p className="text-red text-sm text-center">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 border border-border bg-card text-muted py-2 rounded text-xs uppercase tracking-widest font-bold hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red text-white py-2 rounded text-xs uppercase tracking-widest font-bold hover:bg-red/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDelete(true)}
            className="w-full text-red text-xs uppercase tracking-widest font-bold py-2 hover:text-red/80 transition-colors"
          >
            Delete Project
          </button>
        )}
      </div>
    </div>
  )
}
