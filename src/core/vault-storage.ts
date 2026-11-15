import { createCalculationDataV2 } from './tree-v2'
import type { CalculationDataV2, EntityId, SettingTypeDefinition } from './models-v2'
import { defaultAppPreferences, validateAppPreferences, type AppPreferences } from './app-preferences'

/**
 * `icons` is retained only so old Quick Settings records can be migrated.
 * New records store all greeting content in `text` and write `icons: []`.
 */
export interface GreetingSettingsV2 {
  text: string
  fontSize: string
  fontFamily: string
  color: string
  icons: string[]
  animatedIcons?: string[]
  illustratedIcons?: string[]
}

export interface QuickSettingsV2 {
  schemaVersion: 1
  hiddenGroup2Names?: string[]
  hiddenSettingTypeIds?: string[]
  group2NameSuggestions: string[]
  settingTypes: SettingTypeDefinition[]
  greeting: GreetingSettingsV2
}

/** Legacy autosaved record. Read-only migration input; never written again. */
export interface CalculationDraftV2 {
  schemaVersion: 1
  data: CalculationDataV2
  screen: 'home' | 'page'
  selectedGroup1Id: EntityId | null
  selectedGroup2Id: EntityId | null
  a4Mode: 'combined' | 'group2'
  activeSettingTypeId: EntityId | null
  draftRowsByType: Record<string, Array<{
    id: string
    listing: string
    point: string
    coefficientD: string
    coefficientT: string
  }>>
  savedRowDrafts: Record<string, {
    listing: string
    point: string
    coefficientD: string
    coefficientT: string
  }>
  drawOneToSeven: string
  drawGdb: string
  dateDraft: string
  newGroupName: string
  showNewGroupInput: boolean
  calculationEnabled: boolean
  updatedAt: number
}

/** Legacy manually-saved record. Read-only migration input; never written again. */
export interface StoredCalculationDataV2 {
  schemaVersion: 1
  data: CalculationDataV2
  savedAt: number
}

export interface CalculationWorkspaceEditorStateV2 {
  selectedGroup1Id: EntityId | null
  selectedGroup2Id: EntityId | null
  a4Mode: 'combined' | 'group2'
  activeSettingTypeId: EntityId | null
  draftRowsByType: CalculationDraftV2['draftRowsByType']
  savedRowDrafts: CalculationDraftV2['savedRowDrafts']
  drawOneToSeven: string
  drawGdb: string
  dateDraft: string
  newGroupName: string
  showNewGroupInput: boolean
  calculationEnabled: boolean
  /** The active page panel to restore when the same A4 is opened again. */
  activePanel: 'view' | 'edit' | 'results' | null
  managementPanel: 'date' | 'groups' | 'types' | null
}

/**
 * Single encrypted source of truth for every A4 and the unfinished editor state.
 * Startup always returns to the library; editorState is resumed when its A4 opens.
 */
export interface CalculationWorkspaceV2 {
  schemaVersion: 2
  data: CalculationDataV2
  editorState: CalculationWorkspaceEditorStateV2
  updatedAt: number
}

export interface StoredCalculationWorkspaceV2 {
  value: CalculationWorkspaceV2
  updatedAt: number
  migratedFromLegacy: boolean
}

interface EncryptedRecord {
  id: string
  version: 1
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
  updatedAt: number
}

interface StoredCryptoKey {
  id: 'quick-settings' | 'calculation-data'
  key: CryptoKey
}

type DataStoreName = 'quickSettings' | 'calculationData'
type KeyId = StoredCryptoKey['id']

const DATABASE_NAME = 'calculatorapp-vault'
const DATABASE_VERSION = 1
const KEY_STORE = 'keys'
const QUICK_SETTINGS_STORE: DataStoreName = 'quickSettings'
const CALCULATION_DATA_STORE: DataStoreName = 'calculationData'
const WORKSPACE_RECORD_ID = 'workspace'
const encoder = new TextEncoder()
const decoder = new TextDecoder()
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueueVaultWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation)
  writeQueue = next.then(() => undefined, () => undefined)
  return next
}

function assertCryptoSupport(): void {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error('Trình duyệt chưa hỗ trợ Web Crypto. Hãy mở ứng dụng bằng HTTPS hoặc localhost.')
  }
  if (!globalThis.indexedDB) {
    throw new Error('Trình duyệt chưa hỗ trợ IndexedDB; không thể lưu dữ liệu an toàn.')
  }
}

function openVaultDatabase(): Promise<IDBDatabase> {
  assertCryptoSupport()
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    let settled = false
    const timeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Mở IndexedDB quá thời gian cho phép. Có thể một tab/phiên ứng dụng khác đang giữ kho dữ liệu.'))
    }, 12000)
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      callback()
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(QUICK_SETTINGS_STORE)) db.createObjectStore(QUICK_SETTINGS_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CALCULATION_DATA_STORE)) db.createObjectStore(CALCULATION_DATA_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => {
      if (settled) {
        request.result.close()
        return
      }
      finish(() => resolve(request.result))
    }
    request.onerror = () => finish(() => reject(request.error ?? new Error('Không thể mở kho dữ liệu IndexedDB.')))
    // A blocked open may continue once the other tab closes its connection.
    // Keep waiting until it succeeds or the explicit timeout above expires.
    request.onblocked = () => undefined
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Giao dịch IndexedDB thất bại.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Giao dịch IndexedDB đã bị hủy.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể đọc dữ liệu IndexedDB.'))
  })
}

async function readStoredKey(db: IDBDatabase, keyId: KeyId): Promise<CryptoKey | null> {
  const transaction = db.transaction(KEY_STORE, 'readonly')
  const done = transactionDone(transaction)
  const record = await requestResult<StoredCryptoKey | undefined>(transaction.objectStore(KEY_STORE).get(keyId))
  await done
  return record?.key ?? null
}

async function getExistingKey(db: IDBDatabase, keyId: KeyId): Promise<CryptoKey> {
  const key = await readStoredKey(db, keyId)
  if (!key) {
    throw new Error('Không tìm thấy khóa mã hóa của dữ liệu hiện có. Ứng dụng đã khóa thao tác ghi để tránh ghi đè dữ liệu không thể giải mã.')
  }
  return key
}

async function getOrCreateKey(db: IDBDatabase, keyId: KeyId, dataStore: DataStoreName): Promise<CryptoKey> {
  const existing = await readStoredKey(db, keyId)
  if (existing) return existing

  // Never replace a missing key when encrypted records still exist in its store.
  // Doing so would make the older ciphertext permanently unreadable.
  const dataTx = db.transaction(dataStore, 'readonly')
  const dataDone = transactionDone(dataTx)
  const existingRecords = await requestResult<IDBValidKey[]>(dataTx.objectStore(dataStore).getAllKeys())
  await dataDone
  if (existingRecords.length > 0) {
    throw new Error('Kho dữ liệu có bản mã hóa nhưng thiếu khóa tương ứng. Ứng dụng đã ngừng ghi để bảo vệ dữ liệu cũ.')
  }

  // Generate before opening the write transaction so Web Crypto cannot cause
  // the IndexedDB transaction to become inactive while awaiting a Promise.
  const candidate = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  const writeTx = db.transaction(KEY_STORE, 'readwrite')
  const writeDone = transactionDone(writeTx)
  const keyStore = writeTx.objectStore(KEY_STORE)
  const keyResult = await new Promise<CryptoKey>((resolve, reject) => {
    const request = keyStore.get(keyId)
    request.onsuccess = () => {
      const raced = request.result as StoredCryptoKey | undefined
      if (raced?.key) {
        resolve(raced.key)
      } else {
        keyStore.add({ id: keyId, key: candidate } satisfies StoredCryptoKey)
        resolve(candidate)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Không thể khởi tạo khóa mã hóa.'))
  })
  await writeDone
  return keyResult
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function additionalData(storeName: DataStoreName, recordId: string): ArrayBuffer {
  return toArrayBuffer(encoder.encode(`${DATABASE_NAME}:${storeName}:${recordId}:v1`))
}

async function prepareEncryptedRecord<T>(db: IDBDatabase, storeName: DataStoreName, recordId: string, keyId: KeyId, value: T): Promise<EncryptedRecord> {
  const key = await getOrCreateKey(db, keyId, storeName)
  const iv = toArrayBuffer(crypto.getRandomValues(new Uint8Array(12)))
  const plaintext = toArrayBuffer(encoder.encode(JSON.stringify(value)))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(storeName, recordId) }, key, plaintext)
  return { id: recordId, version: 1, iv, ciphertext, updatedAt: Date.now() }
}

async function writeEncrypted<T>(storeName: DataStoreName, recordId: string, keyId: KeyId, value: T): Promise<number> {
  const db = await openVaultDatabase()
  try {
    const record = await prepareEncryptedRecord(db, storeName, recordId, keyId, value)
    const tx = db.transaction(storeName, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(storeName).put(record)
    await done
    return record.updatedAt
  } finally { db.close() }
}

async function readEncrypted<T>(storeName: DataStoreName, recordId: string, keyId: KeyId): Promise<{ value: T; updatedAt: number } | null> {
  const db = await openVaultDatabase()
  try {
    const tx = db.transaction(storeName, 'readonly')
    const done = transactionDone(tx)
    const record = await requestResult<EncryptedRecord | undefined>(tx.objectStore(storeName).get(recordId))
    await done
    if (!record) return null
    if (record.version !== 1) throw new Error('Phiên bản bản ghi lưu trữ không được hỗ trợ.')

    const key = await getExistingKey(db, keyId)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv, additionalData: additionalData(storeName, recordId) },
      key,
      record.ciphertext,
    )
    return { value: JSON.parse(decoder.decode(plaintext)) as T, updatedAt: record.updatedAt }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OperationError') {
      throw new Error('Không thể giải mã dữ liệu. Khóa lưu trữ có thể đã bị thay đổi hoặc dữ liệu bị hỏng.', { cause: error })
    }
    throw error
  } finally {
    db.close()
  }
}

export async function loadQuickSettings(): Promise<{ value: QuickSettingsV2; updatedAt: number } | null> {
  return readEncrypted<QuickSettingsV2>(QUICK_SETTINGS_STORE, 'current', 'quick-settings')
}

export function saveQuickSettings(value: QuickSettingsV2): Promise<number> {
  return enqueueVaultWrite(() => writeEncrypted(QUICK_SETTINGS_STORE, 'current', 'quick-settings', value))
}

/** Read optional app protection settings without changing existing vault keys. */
export async function loadAppPreferences(): Promise<AppPreferences> {
  const record = await readEncrypted<unknown>(QUICK_SETTINGS_STORE, 'app-preferences', 'quick-settings')
  return record ? validateAppPreferences(record.value) : defaultAppPreferences()
}

export function saveAppPreferences(value: AppPreferences): Promise<number> {
  const validated = validateAppPreferences(value)
  return enqueueVaultWrite(() => writeEncrypted(QUICK_SETTINGS_STORE, 'app-preferences', 'quick-settings', validated))
}

function isCalculationData(value: unknown): value is CalculationDataV2 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CalculationDataV2>
  return candidate.schemaVersion === 2
    && Array.isArray(candidate.groups1)
    && Array.isArray(candidate.settingTypes)
}

function isLegacyDraft(value: unknown): value is CalculationDraftV2 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CalculationDraftV2>
  return candidate.schemaVersion === 1
    && isCalculationData(candidate.data)
    && (candidate.screen === 'home' || candidate.screen === 'page')
    && (candidate.selectedGroup1Id === null || typeof candidate.selectedGroup1Id === 'string')
    && (candidate.selectedGroup2Id === null || typeof candidate.selectedGroup2Id === 'string')
    && !!candidate.draftRowsByType && typeof candidate.draftRowsByType === 'object'
    && !!candidate.savedRowDrafts && typeof candidate.savedRowDrafts === 'object'
}

function isStoredCalculationData(value: unknown): value is StoredCalculationDataV2 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredCalculationDataV2>
  return candidate.schemaVersion === 1 && isCalculationData(candidate.data) && typeof candidate.savedAt === 'number'
}

function isWorkspace(value: unknown): value is CalculationWorkspaceV2 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CalculationWorkspaceV2>
  const editor = candidate.editorState
  return candidate.schemaVersion === 2
    && isCalculationData(candidate.data)
    && !!editor
    && (editor.selectedGroup1Id === null || typeof editor.selectedGroup1Id === 'string')
    && (editor.selectedGroup2Id === null || typeof editor.selectedGroup2Id === 'string')
    && (editor.a4Mode === 'combined' || editor.a4Mode === 'group2')
    && !!editor.draftRowsByType && typeof editor.draftRowsByType === 'object'
    && !!editor.savedRowDrafts && typeof editor.savedRowDrafts === 'object'
    && typeof editor.drawOneToSeven === 'string'
    && typeof editor.drawGdb === 'string'
    && typeof editor.dateDraft === 'string'
    && typeof editor.newGroupName === 'string'
    && typeof editor.showNewGroupInput === 'boolean'
    && typeof editor.calculationEnabled === 'boolean'
    && (editor.activePanel === null || editor.activePanel === 'view' || editor.activePanel === 'edit' || editor.activePanel === 'results')
    && (editor.managementPanel === null || editor.managementPanel === 'date' || editor.managementPanel === 'groups' || editor.managementPanel === 'types')
    && typeof candidate.updatedAt === 'number'
}

function emptyEditorState(): CalculationWorkspaceEditorStateV2 {
  return {
    selectedGroup1Id: null,
    selectedGroup2Id: null,
    a4Mode: 'combined',
    activeSettingTypeId: null,
    draftRowsByType: {},
    savedRowDrafts: {},
    drawOneToSeven: '',
    drawGdb: '',
    dateDraft: '',
    newGroupName: '',
    showNewGroupInput: false,
    calculationEnabled: false,
    activePanel: null,
    managementPanel: null,
  }
}

/** Pure legacy conversion, exported so migration rules can be tested independently. */
export function createWorkspaceFromLegacyRecords(
  saved: { value: StoredCalculationDataV2; updatedAt: number } | null,
  draft: { value: CalculationDraftV2; updatedAt: number } | null,
): CalculationWorkspaceV2 | null {
  if (saved && !isStoredCalculationData(saved.value)) {
    throw new Error('Calculation Data cũ có phiên bản hoặc cấu trúc không được hỗ trợ. Dữ liệu cũ được giữ nguyên.')
  }
  if (draft && !isLegacyDraft(draft.value)) {
    throw new Error('Bản nháp cũ có phiên bản hoặc cấu trúc không được hỗ trợ. Dữ liệu cũ được giữ nguyên.')
  }
  if (!saved && !draft) return null

  // Compare the IndexedDB record timestamps, not user-supplied timestamps inside
  // the encrypted JSON. The record timestamp reflects the actual completed write.
  const useDraftData = Boolean(draft && (!saved || draft.updatedAt >= saved.updatedAt))
  const data = useDraftData ? draft!.value.data : saved!.value.data
  const legacyEditor = draft?.value
  const editorState: CalculationWorkspaceEditorStateV2 = legacyEditor
    ? {
        selectedGroup1Id: legacyEditor.selectedGroup1Id,
        selectedGroup2Id: legacyEditor.selectedGroup2Id,
        a4Mode: legacyEditor.a4Mode,
        activeSettingTypeId: legacyEditor.activeSettingTypeId,
        draftRowsByType: legacyEditor.draftRowsByType,
        savedRowDrafts: legacyEditor.savedRowDrafts,
        drawOneToSeven: legacyEditor.drawOneToSeven,
        drawGdb: legacyEditor.drawGdb,
        dateDraft: legacyEditor.dateDraft,
        newGroupName: legacyEditor.newGroupName,
        showNewGroupInput: legacyEditor.showNewGroupInput,
        calculationEnabled: legacyEditor.calculationEnabled,
        activePanel: null,
        managementPanel: null,
      }
    : emptyEditorState()

  const group1Exists = editorState.selectedGroup1Id !== null
    && data.groups1.some((group1) => group1.id === editorState.selectedGroup1Id)
  if (!group1Exists) {
    editorState.selectedGroup1Id = null
    editorState.selectedGroup2Id = null
    editorState.activeSettingTypeId = null
    editorState.a4Mode = 'combined'
  } else if (editorState.selectedGroup2Id !== null) {
    const group2Exists = data.groups1
      .find((group1) => group1.id === editorState.selectedGroup1Id)
      ?.groups2.some((group2) => group2.id === editorState.selectedGroup2Id)
    if (!group2Exists) {
      editorState.selectedGroup2Id = null
      editorState.a4Mode = 'combined'
    }
  }

  return {
    schemaVersion: 2,
    data,
    editorState,
    updatedAt: Math.max(saved?.updatedAt ?? 0, draft?.updatedAt ?? 0, Date.now()),
  }
}

/**
 * Loads the unified workspace. If this is an older installation, it reads both
 * legacy records and migrates the newest A4 tree into `workspace`.
 * Legacy records are intentionally retained as a recovery copy; they are not
 * deleted by migration.
 */
export async function loadCalculationWorkspace(): Promise<StoredCalculationWorkspaceV2 | null> {
  const workspaceRecord = await readEncrypted<CalculationWorkspaceV2>(CALCULATION_DATA_STORE, WORKSPACE_RECORD_ID, 'calculation-data')
  if (workspaceRecord) {
    if (!isWorkspace(workspaceRecord.value)) {
      throw new Error('A4 Workspace có phiên bản hoặc cấu trúc không được hỗ trợ. Dữ liệu mã hóa cũ được giữ nguyên.')
    }
    return { value: workspaceRecord.value, updatedAt: workspaceRecord.updatedAt, migratedFromLegacy: false }
  }

  const [saved, draft] = await Promise.all([
    readEncrypted<StoredCalculationDataV2>(CALCULATION_DATA_STORE, 'saved', 'calculation-data'),
    readEncrypted<CalculationDraftV2>(CALCULATION_DATA_STORE, 'draft', 'calculation-data'),
  ])
  const migrated = createWorkspaceFromLegacyRecords(saved, draft)
  if (!migrated) return null

  await enqueueVaultWrite(() => writeEncrypted(CALCULATION_DATA_STORE, WORKSPACE_RECORD_ID, 'calculation-data', migrated))
  const verified = await readEncrypted<CalculationWorkspaceV2>(CALCULATION_DATA_STORE, WORKSPACE_RECORD_ID, 'calculation-data')
  if (!verified || !isWorkspace(verified.value) || JSON.stringify(verified.value) !== JSON.stringify(migrated)) {
    throw new Error('Đã tạo A4 Workspace nhưng kiểm chứng sau mã hóa thất bại. Bản ghi cũ vẫn được giữ nguyên để khôi phục.')
  }
  return { value: verified.value, updatedAt: verified.updatedAt, migratedFromLegacy: true }
}

export function saveCalculationWorkspace(value: CalculationWorkspaceV2): Promise<number> {
  if (!isWorkspace(value)) return Promise.reject(new Error('Không thể lưu A4 Workspace vì cấu trúc dữ liệu không hợp lệ.'))
  return enqueueVaultWrite(() => writeEncrypted(CALCULATION_DATA_STORE, WORKSPACE_RECORD_ID, 'calculation-data', value))
}

/** Legacy read helpers retained for backward-compatible diagnostics/tests. */
export async function loadSavedCalculationData(): Promise<{ value: StoredCalculationDataV2; updatedAt: number } | null> {
  return readEncrypted<StoredCalculationDataV2>(CALCULATION_DATA_STORE, 'saved', 'calculation-data')
}

export async function loadCalculationDraft(): Promise<{ value: CalculationDraftV2; updatedAt: number } | null> {
  return readEncrypted<CalculationDraftV2>(CALCULATION_DATA_STORE, 'draft', 'calculation-data')
}

export function mergeQuickSettingsIntoCalculationData(
  data: CalculationDataV2,
  quickSettings: QuickSettingsV2 | null,
): CalculationDataV2 {
  if (!quickSettings || quickSettings.schemaVersion !== 1 || quickSettings.settingTypes.length === 0) return data

  const referencedTypeIds = new Set(
    data.groups1.flatMap((group1) => group1.groups2.flatMap((group2) => group2.groups3.map((group3) => group3.settingTypeId))),
  )
  const quickById = new Map(quickSettings.settingTypes.map((type) => [type.id, type]))
  const settingTypes = quickSettings.settingTypes.map((type) => type)
  for (const oldType of data.settingTypes) {
    if (referencedTypeIds.has(oldType.id) && !quickById.has(oldType.id)) settingTypes.push(oldType)
  }
  return { ...data, settingTypes }
}

export function normalizeGreetingSettings(value: Partial<GreetingSettingsV2> | null | undefined): GreetingSettingsV2 {
  const text = typeof value?.text === 'string' ? value.text : 'Hello'
  const legacyIcons = Array.isArray(value?.icons)
    ? value.icons.filter((icon): icon is string => typeof icon === 'string' && icon.trim().length > 0)
    : []
  const suffix = legacyIcons.join(' ')
  const migratedText = suffix ? `${text.trimEnd()}${text.trim() ? ' ' : ''}${suffix}` : text
  return {
    ...(Array.isArray(value?.animatedIcons) && value.animatedIcons.length ? { animatedIcons: [...new Set(value.animatedIcons.filter((icon): icon is string => typeof icon === 'string' && icon.length <= 24))] } : {}),
    ...(Array.isArray(value?.illustratedIcons) ? { illustratedIcons: [...new Set(value.illustratedIcons.filter((icon): icon is string => typeof icon === 'string' && icon.length <= 24))] } : {}),
    text: migratedText,
    fontSize: typeof value?.fontSize === 'string' ? value.fontSize : '16',
    fontFamily: typeof value?.fontFamily === 'string' ? value.fontFamily : 'Arial, Helvetica, sans-serif',
    color: typeof value?.color === 'string' ? value.color : '#34475e',
    icons: [],
  }
}

export function createQuickSettingsSnapshot(
  data: CalculationDataV2,
  group2NameSuggestions: string[],
  greeting: GreetingSettingsV2,
): QuickSettingsV2 {
  const uniqueNames = new Map<string, string>()
  for (const rawName of group2NameSuggestions) {
    const name = rawName.trim().normalize('NFC')
    if (name) uniqueNames.set(name.toLocaleLowerCase('vi-VN'), name)
  }
  // Group2 records belong to their individual A4 pages. Only the explicit
  // quick-suggestion catalog is persisted here, so deleting a suggestion is durable.
  return {
    schemaVersion: 1,
    group2NameSuggestions: [...uniqueNames.values()],
    settingTypes: data.settingTypes,
    greeting: {
      ...(greeting.animatedIcons?.length ? { animatedIcons: [...greeting.animatedIcons] } : {}),
      ...(greeting.illustratedIcons?.length ? { illustratedIcons: [...greeting.illustratedIcons] } : {}),
      text: greeting.text,
      fontSize: greeting.fontSize,
      fontFamily: greeting.fontFamily,
      color: greeting.color,
      // All new greeting content is stored in the single text field.
      icons: [],
    },
  }
}

export function formatStorageTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Chưa có bản lưu'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp))
}

/**
 * Queue behind prior autosaves, then atomically replace all A4/legacy records.
 * Keys, the coefficient catalog, name suggestions and app preferences survive.
 * A pending-wipe marker is persisted by the caller before entering this method.
 */
export function wipeCalculationEntries(preferences: AppPreferences): Promise<AppPreferences> {
  return enqueueVaultWrite(async () => {
    const current = await readEncrypted<CalculationWorkspaceV2>(CALCULATION_DATA_STORE, WORKSPACE_RECORD_ID, 'calculation-data')
    let workspace = current?.value ?? null
    if (workspace && !isWorkspace(workspace)) throw new Error('Không thể xác minh dữ liệu A4 trước khi dọn.')
    if (!workspace) {
      const [saved, draft] = await Promise.all([
        readEncrypted<StoredCalculationDataV2>(CALCULATION_DATA_STORE, 'saved', 'calculation-data'),
        readEncrypted<CalculationDraftV2>(CALCULATION_DATA_STORE, 'draft', 'calculation-data'),
      ])
      workspace = createWorkspaceFromLegacyRecords(saved, draft)
    }
    const quickRecord = await loadQuickSettings()
    const quick = quickRecord?.value ?? null
    if (quick && (quick.schemaVersion !== 1 || !Array.isArray(quick.group2NameSuggestions) || !Array.isArray(quick.settingTypes))) throw new Error('Không thể xác minh danh sách tên và hệ số trước khi dọn.')
    const data = mergeQuickSettingsIntoCalculationData(workspace?.data ?? createCalculationDataV2(), quick)
    const names = [...(quick?.group2NameSuggestions ?? []), ...data.groups1.flatMap((page) => page.groups2.map((group) => group.name))]
    const emptyWorkspace: CalculationWorkspaceV2 = {
      schemaVersion: 2, data: { ...data, groups1: [] }, editorState: emptyEditorState(), updatedAt: Date.now(),
    }
    const snapshot = createQuickSettingsSnapshot(emptyWorkspace.data, names, normalizeGreetingSettings(quick?.greeting))
    const nextPreferences: AppPreferences = { ...preferences, failedAttempts: 0, blockedUntil: 0, failurePolicyVersion: 2, wipePending: false }
    const db = await openVaultDatabase()
    try {
      const records = await Promise.all([
        prepareEncryptedRecord(db, CALCULATION_DATA_STORE, WORKSPACE_RECORD_ID, 'calculation-data', emptyWorkspace),
        prepareEncryptedRecord(db, QUICK_SETTINGS_STORE, 'current', 'quick-settings', snapshot),
        prepareEncryptedRecord(db, QUICK_SETTINGS_STORE, 'app-preferences', 'quick-settings', nextPreferences),
      ])
      const tx = db.transaction([CALCULATION_DATA_STORE, QUICK_SETTINGS_STORE], 'readwrite')
      const done = transactionDone(tx)
      try {
        tx.objectStore(CALCULATION_DATA_STORE).clear()
        tx.objectStore(CALCULATION_DATA_STORE).put(records[0])
        tx.objectStore(QUICK_SETTINGS_STORE).put(records[1])
        tx.objectStore(QUICK_SETTINGS_STORE).put(records[2])
        await done
      } catch (error) {
        try { tx.abort() } catch { /* Already aborted by IndexedDB. */ }
        await done.catch(() => undefined)
        throw error
      }
      return nextPreferences
    } finally { db.close() }
  })
}
