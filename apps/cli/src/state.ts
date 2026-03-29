import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { CLIState } from '@lockin/core'

const LOCKIN_DIR = join(homedir(), '.lockin')
const STATE_FILE = join(LOCKIN_DIR, 'state.json')
const CREDS_FILE = join(LOCKIN_DIR, 'credentials.json')

function ensureDir() {
  if (!existsSync(LOCKIN_DIR)) {
    mkdirSync(LOCKIN_DIR, { recursive: true })
  }
}

export function getState(): CLIState {
  ensureDir()
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  }
  return {
    active_project_id: null,
    active_project_name: null,
    next_action: null,
    timer_start: null,
    timer_duration: 25,
  }
}

export function saveState(state: CLIState) {
  ensureDir()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

export function getCredentials() {
  if (existsSync(CREDS_FILE)) {
    return JSON.parse(readFileSync(CREDS_FILE, 'utf-8'))
  }
  return null
}

export function saveCredentials(creds: { url: string; key: string; access_token: string; refresh_token: string }) {
  ensureDir()
  writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2))
}

export function isLoggedIn(): boolean {
  return getCredentials() !== null
}
