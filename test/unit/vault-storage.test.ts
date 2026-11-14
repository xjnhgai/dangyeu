import { describe, expect, it } from 'vitest'
import { addGroup1V2, addGroup2V2, addGroup3V2, createCalculationDataV2 } from '../../src/core/tree-v2'
import {
  createQuickSettingsSnapshot,
  createWorkspaceFromLegacyRecords,
  mergeQuickSettingsIntoCalculationData,
  normalizeGreetingSettings,
  type CalculationDraftV2,
  type GreetingSettingsV2,
  type StoredCalculationDataV2,
} from '../../src/core/vault-storage'

const greeting: GreetingSettingsV2 = {
  text: 'Xin chào',
  fontSize: '20',
  fontFamily: 'Georgia, serif',
  color: '#123456',
  icons: ['🌸', '✨'],
}

function createA4Data(dateLabel: string, id = 'date-1') {
  let data = createCalculationDataV2()
  data = addGroup1V2(data, {
    kind: 'group1', id, dateLabel,
    drawData: { oneToSeven: [], gdb: '' }, groups2: [],
  })
  return data
}

function createLegacyDraft(
  data: ReturnType<typeof createCalculationDataV2>,
  overrides: Partial<CalculationDraftV2> = {},
): CalculationDraftV2 {
  return {
    schemaVersion: 1,
    data,
    screen: 'page',
    selectedGroup1Id: 'date-1',
    selectedGroup2Id: 'group-1',
    a4Mode: 'group2',
    activeSettingTypeId: 'setting-type-1',
    draftRowsByType: { 'group-1:setting-type-1': [{ id: 'draft-1', listing: '01 02', point: '2', coefficientD: '1', coefficientT: '1' }] },
    savedRowDrafts: {},
    drawOneToSeven: '123, 456',
    drawGdb: '12345',
    dateDraft: '2026-11-14',
    newGroupName: 'Đang nhập',
    showNewGroupInput: true,
    calculationEnabled: true,
    updatedAt: 100,
    ...overrides,
  }
}

describe('encrypted vault data preparation', () => {
  it('persists only explicitly managed quick Group2 suggestions, not names derived from A4 data', () => {
    let data = createA4Data('14/11/2026')
    data = addGroup2V2(data, 'date-1', {
      kind: 'group2', id: 'group-1', name: 'Obito', groups3: [],
    })

    const snapshot = createQuickSettingsSnapshot(data, ['Obita', 'obitu', ' Obitu '], greeting)

    expect(snapshot.group2NameSuggestions).toEqual(['Obita', 'Obitu'])
    expect(snapshot.group2NameSuggestions).not.toContain('Obito')
    expect(data.groups1[0]?.groups2[0]?.name).toBe('Obito')
    expect(snapshot.greeting.text).toBe('Xin chào')
    expect(snapshot.greeting.icons).toEqual([])
    expect(snapshot.settingTypes).toEqual(data.settingTypes)
  })

  it('allows the quick suggestion catalog to be empty while A4 Group2 records remain intact', () => {
    let data = createA4Data('14/11/2026')
    data = addGroup2V2(data, 'date-1', {
      kind: 'group2', id: 'group-1', name: 'Nhóm A', groups3: [],
    })

    const snapshot = createQuickSettingsSnapshot(data, [], greeting)

    expect(snapshot.group2NameSuggestions).toEqual([])
    expect(data.groups1[0]?.groups2).toHaveLength(1)
    expect(data.groups1[0]?.groups2[0]?.name).toBe('Nhóm A')
  })

  it('uses persisted quick setting names and coefficients as the global catalog source', () => {
    const data = createCalculationDataV2()
    const quick = createQuickSettingsSnapshot({
      ...data,
      settingTypes: data.settingTypes.map((type) => type.id === 'setting-type-1'
        ? { ...type, name: 'LB Mới', defaultCoefficientD: '2.5', defaultCoefficientT: '3' }
        : type),
    }, [], greeting)

    const merged = mergeQuickSettingsIntoCalculationData(data, quick)
    expect(merged.settingTypes[0]?.name).toBe('LB Mới')
    expect(merged.settingTypes[0]?.defaultCoefficientD).toBe('2.5')
    expect(merged.settingTypes[0]?.defaultCoefficientT).toBe('3')
  })

  it('preserves an older setting type still referenced by saved Group3 rows', () => {
    let data = createA4Data('14/11/2026')
    data = addGroup2V2(data, 'date-1', {
      kind: 'group2', id: 'group-1', name: 'Obito', groups3: [],
    })
    data = addGroup3V2(data, 'date-1', 'group-1', {
      kind: 'group3', id: 'row-1', settingTypeId: 'setting-type-8',
      listing: '00 11', point: '1', coefficientD: '1', coefficientT: '1',
    })
    const quick = createQuickSettingsSnapshot({ ...data, settingTypes: data.settingTypes.filter((type) => type.id !== 'setting-type-8') }, [], greeting)
    const merged = mergeQuickSettingsIntoCalculationData(data, quick)

    expect(merged.settingTypes.some((type) => type.id === 'setting-type-8')).toBe(true)
  })

  it('does not let quick settings replace the saved calculation tree', () => {
    const data = createA4Data('14/11/2026')
    const quick = createQuickSettingsSnapshot(createCalculationDataV2(), ['Obito'], greeting)
    const merged = mergeQuickSettingsIntoCalculationData(data, quick)
    expect(merged.groups1).toEqual(data.groups1)
  })

  it('moves legacy greeting icons into the single greeting text field', () => {
    expect(normalizeGreetingSettings(greeting)).toEqual({
      text: 'Xin chào 🌸 ✨',
      fontSize: '20',
      fontFamily: 'Georgia, serif',
      color: '#123456',
      icons: [],
    })
  })

  it('keeps the old A4 tree including empty dates and groups when migrating', () => {
    let data = createA4Data('14/11/2026')
    data = addGroup2V2(data, 'date-1', { kind: 'group2', id: 'group-1', name: 'Chưa nhập', groups3: [] })
    const legacyDraft = createLegacyDraft(data)
    const migrated = createWorkspaceFromLegacyRecords(null, { value: legacyDraft, updatedAt: 200 })

    expect(migrated?.schemaVersion).toBe(2)
    expect(migrated?.data.groups1).toEqual(data.groups1)
    expect(migrated?.data.groups1[0]?.groups2[0]?.groups3).toEqual([])
    expect(migrated?.editorState.selectedGroup1Id).toBe('date-1')
    expect(migrated?.editorState.selectedGroup2Id).toBe('group-1')
    expect(migrated?.editorState.draftRowsByType['group-1:setting-type-1']?.[0]?.listing).toBe('01 02')
    expect(migrated?.editorState.newGroupName).toBe('Đang nhập')
  })

  it('chooses the more recently written A4 tree without discarding editor input', () => {
    const savedData = createA4Data('13/11/2026', 'saved-date')
    const draftData = createA4Data('14/11/2026', 'draft-date')
    const saved: StoredCalculationDataV2 = { schemaVersion: 1, data: savedData, savedAt: 100 }
    const draft = createLegacyDraft(draftData)
    const migrated = createWorkspaceFromLegacyRecords(
      { value: saved, updatedAt: 500 },
      { value: draft, updatedAt: 400 },
    )

    expect(migrated?.data.groups1.map((item) => item.id)).toEqual(['saved-date'])
    expect(migrated?.editorState.draftRowsByType['group-1:setting-type-1']?.[0]?.listing).toBe('01 02')
  })

  it('selects the legacy draft tree when that record was written later', () => {
    const saved: StoredCalculationDataV2 = { schemaVersion: 1, data: createA4Data('13/11/2026', 'saved-date'), savedAt: 100 }
    const draft = createLegacyDraft(createA4Data('14/11/2026', 'draft-date'))
    const migrated = createWorkspaceFromLegacyRecords(
      { value: saved, updatedAt: 400 },
      { value: draft, updatedAt: 500 },
    )

    expect(migrated?.data.groups1.map((item) => item.id)).toEqual(['draft-date'])
  })

  it('clears invalid selected IDs when the selected date is absent from the chosen tree', () => {
    const draft = createLegacyDraft(createA4Data('14/11/2026', 'different-date'))
    const migrated = createWorkspaceFromLegacyRecords(null, { value: draft, updatedAt: 500 })

    expect(migrated?.editorState.selectedGroup1Id).toBeNull()
    expect(migrated?.editorState.selectedGroup2Id).toBeNull()
    expect(migrated?.editorState.a4Mode).toBe('combined')
  })

  it('returns no migration result when neither legacy record exists', () => {
    expect(createWorkspaceFromLegacyRecords(null, null)).toBeNull()
  })
})

describe('Web Crypto vault primitives', () => {
  it('encrypts with separate non-extractable AES-GCM keys and authenticates the record context', async () => {
    const keyQuick = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const keyCalculation = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const toBuffer = (value: Uint8Array): ArrayBuffer => {
      const buffer = new ArrayBuffer(value.byteLength)
      new Uint8Array(buffer).set(value)
      return buffer
    }
    const iv = toBuffer(crypto.getRandomValues(new Uint8Array(12)))
    const additionalData = toBuffer(new TextEncoder().encode('calculatorapp-vault:quickSettings:current:v1'))
    const plaintext = toBuffer(new TextEncoder().encode(JSON.stringify({ group: 'Obito', greeting: 'Xin chào 🌸' })))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, keyQuick, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, keyQuick, ciphertext)

    expect(keyQuick.extractable).toBe(false)
    expect(keyCalculation.extractable).toBe(false)
    expect(keyQuick).not.toBe(keyCalculation)
    expect(new TextDecoder().decode(decrypted)).toBe(new TextDecoder().decode(plaintext))
    expect(new TextDecoder().decode(ciphertext)).not.toContain('Obito')
    await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, keyCalculation, ciphertext)).rejects.toThrow()
    await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: toBuffer(new TextEncoder().encode('different-record')) }, keyQuick, ciphertext)).rejects.toThrow()
  })

  it('keeps a non-extractable CryptoKey usable after structured cloning', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const clonedKey = structuredClone(key)
    const toBuffer = (value: Uint8Array): ArrayBuffer => {
      const buffer = new ArrayBuffer(value.byteLength)
      new Uint8Array(buffer).set(value)
      return buffer
    }
    const iv = toBuffer(crypto.getRandomValues(new Uint8Array(12)))
    const plaintext = toBuffer(new TextEncoder().encode('persisted CryptoKey'))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, clonedKey, ciphertext)

    expect(clonedKey.extractable).toBe(false)
    expect(new TextDecoder().decode(decrypted)).toBe('persisted CryptoKey')
  })
})
