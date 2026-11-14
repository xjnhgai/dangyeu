import { describe, expect, it } from 'vitest'
import { applyRetention, checkPin, createPinCredential, defaultAppPreferences, expiredA4Ids, validateAppPreferences } from '../../src/core/app-preferences'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import type { CalculationWorkspaceV2 } from '../../src/core/vault-storage'

function workspace(): CalculationWorkspaceV2 {
  return {
    schemaVersion: 2, updatedAt: 1,
    data: { ...createCalculationDataV2(), groups1: [
      { kind: 'group1', id: 'expired', dateLabel: '01/11/2026', drawData: { oneToSeven: [], gdb: '' }, groups2: [
        { kind: 'group2', id: 'old-name', name: 'Tên cũ', groups3: [{ kind: 'group3', id: 'old-row', settingTypeId: 'setting-type-1', listing: '00', point: '1', coefficientD: '1', coefficientT: '2' }] },
      ] },
      ...['02/11/2026', '14/11/2026', '15/11/2026', '31/02/2026', '2026-11-01'].map((dateLabel, index) => ({ kind: 'group1' as const, id: `keep-${index}`, dateLabel, drawData: { oneToSeven: [], gdb: '' }, groups2: [] })),
    ] },
    editorState: { selectedGroup1Id: 'expired', selectedGroup2Id: 'old-name', a4Mode: 'group2', activeSettingTypeId: 'setting-type-1', draftRowsByType: {
      'old-name:setting-type-1': [{ id: 'draft', listing: '01', point: '1', coefficientD: '1', coefficientT: '2' }],
      'other:setting-type-1': [{ id: 'other', listing: '02', point: '2', coefficientD: '1', coefficientT: '2' }],
    }, savedRowDrafts: { 'old-row': { listing: '03', point: '1', coefficientD: '1', coefficientT: '2' } }, drawOneToSeven: '11', drawGdb: '12345', dateDraft: '2026-11-01', newGroupName: 'nháp', showNewGroupInput: true, calculationEnabled: true, activePanel: 'edit', managementPanel: 'groups' },
  }
}
const today = new Date(2026, 10, 14, 12)

describe('retention calendar boundaries and editor cleanup', () => {
  it('defaults to no automatic deletion and preserves the existing workspace', () => {
    const initial = workspace()
    expect(applyRetention(initial, defaultAppPreferences(), today).workspace).toBe(initial)
  })
  it('keeps today and 12 previous calendar days, future dates and malformed dates', () => {
    expect([...expiredA4Ids(workspace().data, 13, today)]).toEqual(['expired', 'keep-4'])
    const noon = expiredA4Ids(workspace().data, 1, today)
    const midnight = expiredA4Ids(workspace().data, 1, new Date(2026, 10, 14, 0, 0, 0))
    expect([...noon]).toEqual([...midnight])
    expect(noon.has('keep-1')).toBe(false)
    expect(noon.has('keep-2')).toBe(false)
    expect(noon.has('keep-3')).toBe(false)
  })
  it('removes only expired pages and their drafts without mutating the input or catalog', () => {
    const initial = workspace()
    const result = applyRetention(initial, { ...defaultAppPreferences(), retention: { enabled: true, days: 13 } }, today)
    expect(result.removedCount).toBe(2)
    expect(initial.data.groups1).toHaveLength(6)
    expect(result.workspace.data.groups1).toHaveLength(4)
    expect(result.workspace.data.settingTypes).toEqual(initial.data.settingTypes)
    expect(result.workspace.editorState.selectedGroup1Id).toBeNull()
    expect(result.workspace.editorState.selectedGroup2Id).toBeNull()
    expect(result.workspace.editorState.drawGdb).toBe('')
    expect(result.workspace.editorState.draftRowsByType['old-name:setting-type-1']).toBeUndefined()
    expect(result.workspace.editorState.draftRowsByType['other:setting-type-1']).toBeDefined()
    expect(result.workspace.editorState.savedRowDrafts).toEqual({})
    expect(applyRetention(result.workspace, { ...defaultAppPreferences(), retention: { enabled: true, days: 13 } }, today).removedCount).toBe(0)
  })
  it('retains the selected current A4 and its unfinished input', () => {
    const initial = workspace()
    initial.editorState.selectedGroup1Id = 'keep-1'
    const result = applyRetention(initial, { ...defaultAppPreferences(), retention: { enabled: true, days: 13 } }, today)
    expect(result.workspace.editorState.selectedGroup1Id).toBe('keep-1')
    expect(result.workspace.editorState.drawGdb).toBe('12345')
  })
  it('handles a leap day and rejects invalid retention settings', () => {
    const data = workspace().data
    data.groups1[0].dateLabel = '29/02/2024'
    expect(expiredA4Ids(data, 2, new Date(2024, 2, 1)).has('expired')).toBe(false)
    expect(expiredA4Ids(data, 1, new Date(2024, 2, 1)).has('expired')).toBe(true)
    for (const days of [0, -1, 1.5, 3651, NaN]) expect(() => expiredA4Ids(data, days)).toThrow()
    expect(() => validateAppPreferences({ ...defaultAppPreferences(), pin: {} })).toThrow()
  })
})

describe('PIN verification and persisted retry limits', () => {
  it('accepts exactly 4 digits including leading zeroes and creates unique salts', async () => {
    for (const value of ['123', '12345', '12a4', '１２３４']) await expect(createPinCredential(value)).rejects.toThrow()
    const first = await createPinCredential('0123')
    const second = await createPinCredential('0123')
    expect(first.salt).not.toBe(second.salt)
    expect(first.hash).not.toBe(second.hash)
    expect(first.hash).toHaveLength(64)
    const preferences = { ...defaultAppPreferences(), pin: first }
    expect((await checkPin(preferences, '0123')).ok).toBe(true)
    expect((await checkPin(preferences, '1230')).ok).toBe(false)
    expect((await checkPin(preferences, '123')).ok).toBe(false)
  })
  it('schedules a wipe on the third wrong PIN and always accepts the publisher PIN', async () => {
    let preferences = { ...defaultAppPreferences(), pin: await createPinCredential('4567') }
    for (let i = 0; i < 2; i += 1) {
      const result = await checkPin(preferences, '0000')
      expect(result.wipeRequired).toBe(false)
      preferences = result.preferences
    }
    const third = await checkPin(preferences, '0000')
    expect(third.wipeRequired).toBe(true)
    expect(third.preferences.failedAttempts).toBe(3)
    expect(third.preferences.wipePending).toBe(true)
    const publisher = await checkPin({ ...preferences, blockedUntil: Number.MAX_SAFE_INTEGER }, '1495')
    expect(publisher.ok).toBe(true)
    expect(publisher.preferences.failedAttempts).toBe(0)
    const success = await checkPin(preferences, '4567')
    expect(success.ok).toBe(true)
    expect(success.preferences.failedAttempts).toBe(0)
  })
})
