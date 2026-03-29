import { createClient } from '@supabase/supabase-js'
import { getCredentials } from './state.js'
import chalk from 'chalk'

export function getSupabase() {
  const creds = getCredentials()
  if (!creds) {
    console.log(chalk.red('Not logged in. Run `lockin login` first.'))
    process.exit(1)
  }

  const client = createClient(creds.url, creds.key)

  if (creds.access_token && creds.refresh_token) {
    client.auth.setSession({
      access_token: creds.access_token,
      refresh_token: creds.refresh_token,
    })
  }

  return client
}
