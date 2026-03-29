import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

function getCredentials(): { url: string; key: string; access_token?: string; refresh_token?: string } {
  const credPath = join(homedir(), '.lockin', 'credentials.json')
  if (existsSync(credPath)) {
    return JSON.parse(readFileSync(credPath, 'utf-8'))
  }
  throw new Error('Not logged in. Run `lockin login` first.')
}

export function createNodeClient() {
  const creds = getCredentials()
  const client = createSupabaseClient(creds.url, creds.key)

  if (creds.access_token && creds.refresh_token) {
    client.auth.setSession({
      access_token: creds.access_token,
      refresh_token: creds.refresh_token,
    })
  }

  return client
}

export { getCredentials }
