import { describe, expect, it } from 'vitest'
import { migrateCalculationDataV1ToV2 } from '../../src/core/migrate-v1-to-v2'
import type { CalculationDataV1 } from '../../src/core/models-v2'

describe('migrateCalculationDataV1ToV2', () => {
  it('preserves each V1 setting as a direct Group3 and keeps historical values', () => {
    const legacy: CalculationDataV1 = {
      schemaVersion: 1,
      groups1: [{
        kind: 'group1', id: 'date-1', dateLabel: '12/11/2026',
        drawData: { oneToSeven: ['00123'], gdb: '45678' },
        groups2: [{
          kind: 'group2', id: 'group-1', name: 'Obito', isVisibleOnA4: false,
          settings: [
            { kind: 'setting', id: 'old-1', name: 'ĐA', listing: '12, 23', point: '2', coefficientD: '1.5', coefficientT: '2.5' },
            { kind: 'setting', id: 'old-2', name: 'ĐA', listing: '35', point: '3', coefficientD: '3', coefficientT: '4' },
          ],
        }],
      }],
    }
    const migrated = migrateCalculationDataV1ToV2(legacy)
    const group2 = migrated.groups1[0]!.groups2[0]!
    expect(group2.groups3).toHaveLength(2)
    expect(group2).not.toHaveProperty('isVisibleOnA4')
    expect(group2.groups3[0]).toMatchObject({ id: 'old-1', listing: '12, 23', point: '2', coefficientD: '1.5', coefficientT: '2.5' })
    expect(group2.groups3[1]).toMatchObject({ id: 'old-2', listing: '35', point: '3', coefficientD: '3', coefficientT: '4' })
    expect(group2.groups3[0]).not.toHaveProperty('instances')
    expect(migrated.settingTypes).toHaveLength(2)
    expect(migrated.settingTypes[0]!.name).toBe('ĐA')
    expect(migrated.settingTypes[1]!.name).toBe('ĐA')
    expect(migrated.settingTypes[0]!.defaultCoefficientD).toBeNull()
    expect(migrated.groups1[0]!.drawData).toEqual({ oneToSeven: ['00123'], gdb: '45678' })
  })

  it('preserves empty groups and dates', () => {
    const legacy: CalculationDataV1 = {
      schemaVersion: 1,
      groups1: [{
        kind: 'group1', id: 'date-1', dateLabel: '12/11/2026',
        drawData: { oneToSeven: [], gdb: '' },
        groups2: [{ kind: 'group2', id: 'group-1', name: 'Empty', isVisibleOnA4: true, settings: [] }],
      }],
    }
    const migrated = migrateCalculationDataV1ToV2(legacy)
    expect(migrated.settingTypes).toEqual([])
    expect(migrated.groups1[0]!.groups2[0]!.groups3).toEqual([])
  })

  it('rejects unsupported or malformed V1 data', () => {
    expect(() => migrateCalculationDataV1ToV2({ schemaVersion: 3, groups1: [] } as unknown as CalculationDataV1)).toThrow()
    expect(() => migrateCalculationDataV1ToV2({ schemaVersion: 1, groups1: null } as unknown as CalculationDataV1)).toThrow()
  })
})
