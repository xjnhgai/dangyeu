import type { CalculationDataV2 } from './models-v2'
import { createGroup3FromDefaults } from './tree-v2'

export interface EntryTarget {
  mode: 'draft' | 'saved'
  group1Id: string
  group2Id: string
  typeId: string
  rowId: string
  field?: 'listing' | 'point'
}

/** Project an unfinished row without committing it to the stored calculation tree. */
export function buildEntryPreview(data: CalculationDataV2, target: EntryTarget | null, row: { listing: string; point: string } | null): CalculationDataV2 {
  if (!target || !row) return data
  const type = data.settingTypes.find((item) => item.id === target.typeId)
  if (!type) return data
  return { ...data, groups1: data.groups1.map((page) => page.id !== target.group1Id ? page : {
    ...page, groups2: page.groups2.map((group) => group.id !== target.group2Id ? group : {
      ...group, groups3: target.mode === 'saved'
        ? group.groups3.map((entry) => entry.id === target.rowId ? { ...entry, ...row } : entry)
        : row.listing.trim() ? [...group.groups3, createGroup3FromDefaults(type, `preview-${target.rowId}`, row.listing, row.point)] : group.groups3,
    }),
  }) }
}
