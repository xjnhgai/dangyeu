import type { CalculationDataV2 } from './models-v2'
import type { CalculationWorkspaceV2 } from './vault-storage'

export interface PinCredential {
  algorithm: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  hash: string
}

export interface AppPreferences {
  schemaVersion: 1
  pin: PinCredential | null
  failedAttempts: number
  blockedUntil: number
  failurePolicyVersion?: 2
  wipePending?: boolean
  retention: { enabled: boolean; days: number }
}

export function defaultAppPreferences(): AppPreferences {
  return { schemaVersion: 1, pin: null, failedAttempts: 0, blockedUntil: 0, failurePolicyVersion: 2, wipePending: false, retention: { enabled: false, days: 13 } }
}

export function validateAppPreferences(value: unknown): AppPreferences {
  if (!value || typeof value !== 'object') throw new Error('Cài đặt bảo vệ không hợp lệ.')
  const item = value as AppPreferences
  if (item.schemaVersion !== 1 || !Number.isInteger(item.failedAttempts) || item.failedAttempts < 0
    || !Number.isFinite(item.blockedUntil) || item.blockedUntil < 0
    || !item.retention || typeof item.retention.enabled !== 'boolean'
    || !Number.isInteger(item.retention.days) || item.retention.days < 1 || item.retention.days > 3650) {
    throw new Error('Cài đặt bảo vệ hoặc lưu trữ không được hỗ trợ. Dữ liệu cũ được giữ nguyên.')
  }
  if (item.pin !== null && (!item.pin || item.pin.algorithm !== 'PBKDF2-SHA256'
    || !Number.isInteger(item.pin.iterations) || item.pin.iterations < 100000 || item.pin.iterations > 1000000
    || !/^[a-f0-9]{32}$/.test(item.pin.salt) || !/^[a-f0-9]{64}$/.test(item.pin.hash))) {
    throw new Error('Bản ghi PIN không hợp lệ. Ứng dụng giữ khóa để bảo vệ dữ liệu.')
  }
  if (item.wipePending !== undefined && typeof item.wipePending !== 'boolean') throw new Error('Trạng thái dọn dữ liệu không hợp lệ.')
  // The old five-attempt policy must not accidentally trigger the new wipe.
  return item.failurePolicyVersion === 2 ? item : { ...item, failurePolicyVersion: 2, failedAttempts: 0, blockedUntil: 0, wipePending: false }
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function unhex(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => parseInt(pair, 16))
}

async function derivePinHash(pin: string, salt: string, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(salt), iterations, hash: 'SHA-256' }, material, 256)
  return hex(new Uint8Array(bits))
}

/** Create a salted verifier; a PIN never replaces the existing vault keys. */
export async function createPinCredential(pin: string): Promise<PinCredential> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN phải gồm đúng 4 chữ số.')
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  const iterations = 210000
  return { algorithm: 'PBKDF2-SHA256', iterations, salt, hash: await derivePinHash(pin, salt, iterations) }
}

export const PUBLISHER_APP_PIN = '1495'
export const PUBLISHER_SETTINGS_PIN = '1945'

export function isPublisherAppPin(pin: string): boolean { return pin === PUBLISHER_APP_PIN || pin === PUBLISHER_SETTINGS_PIN }
export function isPublisherSettingsPin(pin: string): boolean { return pin === PUBLISHER_SETTINGS_PIN }

/** A publisher unlock never counts as a user failure; the third failure schedules a wipe. */
export async function checkPin(preferences: AppPreferences, pin: string): Promise<{ ok: boolean; wipeRequired: boolean; preferences: AppPreferences }> {
  if (isPublisherAppPin(pin)) return { ok: true, wipeRequired: false, preferences: { ...preferences, failedAttempts: 0, blockedUntil: 0 } }
  if (!preferences.pin) throw new Error('Chưa thiết lập PIN.')
  const candidate = /^\d{4}$/.test(pin) ? await derivePinHash(pin, preferences.pin.salt, preferences.pin.iterations) : ''
  let difference = candidate.length ^ preferences.pin.hash.length
  for (let i = 0; i < preferences.pin.hash.length; i += 1) difference |= (candidate.charCodeAt(i) || 0) ^ preferences.pin.hash.charCodeAt(i)
  const ok = difference === 0
  const failedAttempts = ok ? 0 : preferences.failedAttempts + 1
  const wipeRequired = !ok && failedAttempts >= 3
  return { ok, wipeRequired, preferences: {
    ...preferences,
    failedAttempts,
    blockedUntil: 0,
    failurePolicyVersion: 2,
    wipePending: wipeRequired,
  } }
}

/** Integer calendar day, independent of DST. Malformed dates are never expired. */
function calendarDay(label: string): number | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(label.trim())
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label.trim())
  if (!match && !iso) return null
  const [d, m, y] = match ? match.slice(1) : [iso![3], iso![2], iso![1]]
  const date = new Date(0)
  date.setUTCFullYear(Number(y), Number(m) - 1, Number(d))
  date.setUTCHours(0, 0, 0, 0)
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null
  return date.getTime() / 86400000
}

export function expiredA4Ids(data: CalculationDataV2, days: number, now = new Date()): Set<string> {
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('Số ngày lưu trữ phải là số nguyên từ 1 đến 3650.')
  const today = calendarDay(`${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`)!
  const cutoff = today - days + 1
  return new Set(data.groups1.filter((page) => {
    const day = calendarDay(page.dateLabel)
    return day !== null && day < cutoff
  }).map((page) => page.id))
}

/** Expire A4 pages and only their editor drafts; retain global names/settings. */
export function applyRetention(workspace: CalculationWorkspaceV2, preferences: AppPreferences, now = new Date()): { workspace: CalculationWorkspaceV2; removedCount: number } {
  if (!preferences.retention.enabled) return { workspace, removedCount: 0 }
  const expired = expiredA4Ids(workspace.data, preferences.retention.days, now)
  if (!expired.size) return { workspace, removedCount: 0 }
  const groups2 = new Set<string>()
  const groups3 = new Set<string>()
  workspace.data.groups1.filter((page) => expired.has(page.id)).forEach((page) => page.groups2.forEach((group) => {
    groups2.add(group.id)
    group.groups3.forEach((row) => groups3.add(row.id))
  }))
  const editor = workspace.editorState
  const selectionExpired = editor.selectedGroup1Id !== null && expired.has(editor.selectedGroup1Id)
  return { removedCount: expired.size, workspace: {
    ...workspace,
    data: { ...workspace.data, groups1: workspace.data.groups1.filter((page) => !expired.has(page.id)) },
    editorState: {
      ...editor,
      draftRowsByType: Object.fromEntries(Object.entries(editor.draftRowsByType).filter(([key]) => !groups2.has(key.split(':')[0]))),
      savedRowDrafts: Object.fromEntries(Object.entries(editor.savedRowDrafts).filter(([id]) => !groups3.has(id))),
      ...(selectionExpired ? {
        selectedGroup1Id: null, selectedGroup2Id: null, activeSettingTypeId: null, a4Mode: 'combined' as const,
        drawOneToSeven: '', drawGdb: '', dateDraft: '', newGroupName: '', showNewGroupInput: false,
        calculationEnabled: false, activePanel: null, managementPanel: null,
      } : {}),
    },
    updatedAt: now.getTime(),
  } }
}
