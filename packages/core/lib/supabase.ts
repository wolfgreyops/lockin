import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient(url: string, key: string) {
  return createSupabaseClient(url, key)
}
