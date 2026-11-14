// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb'
import { createPinCredential, defaultAppPreferences } from '../../src/core/app-preferences'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { loadAppPreferences, loadCalculationWorkspace, saveAppPreferences, saveCalculationWorkspace, type CalculationWorkspaceV2 } from '../../src/core/vault-storage'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('crypto', webcrypto)
})

describe('encrypted preferences through IndexedDB', () => {
  it('loads safe defaults without creating a PIN or enabling automatic deletion', async () => {
    expect(await loadAppPreferences()).toEqual(defaultAppPreferences())
  })
  it('persists PIN verifiers and retry limits, while retaining the existing A4 vault', async () => {
    const workspace: CalculationWorkspaceV2 = { schemaVersion: 2, data: createCalculationDataV2(), editorState: {
      selectedGroup1Id: null, selectedGroup2Id: null, a4Mode: 'combined', activeSettingTypeId: null, draftRowsByType: {}, savedRowDrafts: {}, drawOneToSeven: '', drawGdb: '', dateDraft: '', newGroupName: '', showNewGroupInput: false, calculationEnabled: false, activePanel: null, managementPanel: null,
    }, updatedAt: 123 }
    await saveCalculationWorkspace(workspace)
    const preferences = { ...defaultAppPreferences(), pin: await createPinCredential('0123'), failedAttempts: 5, blockedUntil: 123000, retention: { enabled: true, days: 30 } }
    await saveAppPreferences(preferences)
    expect(await loadAppPreferences()).toEqual(preferences)
    expect((await loadCalculationWorkspace())?.value).toEqual(workspace)
    await saveAppPreferences({ ...preferences, pin: null, failedAttempts: 0, blockedUntil: 0 })
    expect((await loadAppPreferences()).pin).toBeNull()
    expect((await loadCalculationWorkspace())?.value).toEqual(workspace)
  })
})

import { loadQuickSettings, saveQuickSettings, wipeCalculationEntries, createQuickSettingsSnapshot } from '../../src/core/vault-storage'

describe('atomic calculation wipe', () => {
  it('runs after queued autosaves, preserves names and edited coefficients, and removes all A4/legacy records', async () => {
    const data = createCalculationDataV2()
    data.settingTypes[0].defaultCoefficientD = '3.5'
    data.settingTypes[0].defaultCoefficientT = '8'
    data.groups1.push({ kind: 'group1', id: 'a4', dateLabel: '14/11/2026', drawData: { oneToSeven: ['12'], gdb: '12345' }, groups2: [{ kind: 'group2', id: 'group', name: 'Lan', groups3: [{ kind: 'group3', id: 'row', settingTypeId: 'setting-type-1', listing: '12', point: '3', coefficientD: '3.5', coefficientT: '8' }] }] })
    const workspace: CalculationWorkspaceV2 = { schemaVersion: 2, data, editorState: {
      selectedGroup1Id: 'a4', selectedGroup2Id: 'group', a4Mode: 'group2', activeSettingTypeId: 'setting-type-1', draftRowsByType: { 'group:setting-type-1': [{ id: 'draft', listing: '34', point: '', coefficientD: '3.5', coefficientT: '8' }] }, savedRowDrafts: { row: { listing: '56', point: '1', coefficientD: '3.5', coefficientT: '8' } }, drawOneToSeven: '12', drawGdb: '12345', dateDraft: '2026-11-14', newGroupName: '', showNewGroupInput: false, calculationEnabled: false, activePanel: 'edit', managementPanel: null,
    }, updatedAt: 123 }
    const preferences = { ...defaultAppPreferences(), pin: await createPinCredential('0123'), failedAttempts: 3, wipePending: true }
    await saveAppPreferences(preferences)
    await saveQuickSettings(createQuickSettingsSnapshot(data, ['Mai'], { text: 'Hello', fontSize: '16', fontFamily: 'Arial', color: '#000000', icons: [] }))
    const autosave = saveCalculationWorkspace(workspace)
    const cleared = await wipeCalculationEntries(preferences)
    await autosave
    const result = (await loadCalculationWorkspace())!.value
    expect(result.data.groups1).toEqual([])
    expect(result.editorState.draftRowsByType).toEqual({})
    expect(result.editorState.savedRowDrafts).toEqual({})
    expect(result.editorState.drawGdb).toBe('')
    expect(result.data.settingTypes[0].defaultCoefficientD).toBe('3.5')
    expect((await loadQuickSettings())?.value.group2NameSuggestions).toEqual(['Mai', 'Lan'])
    expect(cleared.pin).toEqual(preferences.pin)
    expect(cleared.failedAttempts).toBe(0)
    expect(cleared.wipePending).toBe(false)
    expect(await loadAppPreferences()).toEqual(cleared)
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('calculatorapp-vault'); request.onsuccess = () => resolve(request.result) })
    const keys = await new Promise<IDBValidKey[]>((resolve) => { const request = db.transaction('calculationData').objectStore('calculationData').getAllKeys(); request.onsuccess = () => resolve(request.result) })
    expect(keys).toEqual(['workspace'])
    db.close()
  })
})


describe('interrupted wipe recovery', () => {
  it('rolls back the entire transaction on storage failure and leaves a retry marker', async () => {
    const data = createCalculationDataV2()
    data.groups1.push({ kind: 'group1', id: 'keep-until-commit', dateLabel: '14/11/2026', drawData: { oneToSeven: [], gdb: '' }, groups2: [] })
    const workspace: CalculationWorkspaceV2 = { schemaVersion: 2, data, editorState: {
      selectedGroup1Id: null, selectedGroup2Id: null, a4Mode: 'combined', activeSettingTypeId: null, draftRowsByType: {}, savedRowDrafts: {}, drawOneToSeven: '', drawGdb: '', dateDraft: '', newGroupName: '', showNewGroupInput: false, calculationEnabled: false, activePanel: null, managementPanel: null,
    }, updatedAt: 123 }
    const preferences = { ...defaultAppPreferences(), pin: await createPinCredential('0123'), wipePending: true, failedAttempts: 3 }
    await saveCalculationWorkspace(workspace)
    await saveAppPreferences(preferences)
    const originalPut = FakeObjectStore.prototype.put
    const fault = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: FakeObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'quickSettings' && (value as { id?: string }).id === 'current') throw new DOMException('Simulated storage failure', 'QuotaExceededError')
      return originalPut.call(this, value, key)
    })
    await expect(wipeCalculationEntries(preferences)).rejects.toThrow('Simulated storage failure')
    fault.mockRestore()
    expect((await loadCalculationWorkspace())?.value.data.groups1[0].id).toBe('keep-until-commit')
    expect((await loadAppPreferences()).wipePending).toBe(true)
    await wipeCalculationEntries(preferences)
    expect((await loadCalculationWorkspace())?.value.data.groups1).toEqual([])
    expect((await loadAppPreferences()).wipePending).toBe(false)
  })
})
