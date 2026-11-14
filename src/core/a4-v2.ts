import type {
  A4PageSelectionV2,
  CalculationDataV2,
  EntityId,
  Group1,
  Group2,
  Group3,
  SettingTypeDefinition,
} from './models-v2'

export type A4ProjectionV2ErrorCode =
  | 'GROUP1_NOT_FOUND'
  | 'GROUP2_NOT_FOUND'
  | 'TYPE_NOT_FOUND'

export class A4ProjectionV2Error extends Error {
  readonly code: A4ProjectionV2ErrorCode

  constructor(code: A4ProjectionV2ErrorCode, message: string) {
    super(message)
    this.name = 'A4ProjectionV2Error'
    this.code = code
  }
}

/** One concrete Group3 with source metadata; source group name is never rendered in combined mode. */
export interface A4EntryReferenceV2 {
  group2Id: EntityId
  group3: Readonly<Group3>
  settingType: Readonly<SettingTypeDefinition>
}

/** One A4 section groups all Group3 records that use the same setting type. */
export interface A4ProjectionSectionV2 {
  settingTypeId: EntityId
  title: string
  entries: A4EntryReferenceV2[]
}

export interface A4ProjectionV2 {
  mode: A4PageSelectionV2['mode']
  group1: Readonly<Group1>
  group2?: Readonly<Group2>
  sections: A4ProjectionSectionV2[]
  entries: A4EntryReferenceV2[]
}

function getGroup1(data: CalculationDataV2, id: EntityId): Group1 {
  const group1 = data.groups1.find((item) => item.id === id)
  if (!group1) throw new A4ProjectionV2Error('GROUP1_NOT_FOUND', `Không tìm thấy ngày: ${id}`)
  return group1
}

function getGroup2(group1: Group1, id: EntityId): Group2 {
  const group2 = group1.groups2.find((item) => item.id === id)
  if (!group2) throw new A4ProjectionV2Error('GROUP2_NOT_FOUND', `Không tìm thấy nhóm: ${id}`)
  return group2
}

function getType(data: CalculationDataV2, group3: Group3): SettingTypeDefinition {
  const type = data.settingTypes.find((item) => item.id === group3.settingTypeId)
  if (!type) throw new A4ProjectionV2Error('TYPE_NOT_FOUND', `Không tìm thấy loại thiết lập: ${group3.settingTypeId}`)
  return type
}

function collectEntries(data: CalculationDataV2, groups2: Group2[]): A4EntryReferenceV2[] {
  return groups2.flatMap((group2) => group2.groups3.map((group3) => ({
    group2Id: group2.id,
    group3: { ...group3 },
    settingType: getType(data, group3),
  })))
}

/**
 * Build one of the two supported A4 views:
 * - combined: flatten all Group2 and group entries by setting type, without displaying Group2 names.
 * - group2: include entries from exactly one selected Group2.
 */
export function buildA4ProjectionV2(
  data: CalculationDataV2,
  selection: A4PageSelectionV2,
): A4ProjectionV2 {
  const group1 = getGroup1(data, selection.group1Id)
  let selectedGroup2: Group2 | undefined
  let sourceGroups: Group2[]

  if (selection.mode === 'combined') {
    sourceGroups = group1.groups2
  } else {
    selectedGroup2 = getGroup2(group1, selection.group2Id)
    sourceGroups = [selectedGroup2]
  }

  const entries = collectEntries(data, sourceGroups)
  const entriesByType = new Map<EntityId, A4EntryReferenceV2[]>()

  for (const entry of entries) {
    const list = entriesByType.get(entry.settingType.id) ?? []
    list.push(entry)
    entriesByType.set(entry.settingType.id, list)
  }

  // Follow catalog order; preserve Group2 order and entry order within each type.
  const sections = data.settingTypes.flatMap((type) => {
    const typeEntries = entriesByType.get(type.id)
    if (!typeEntries?.length) return []
    return [{ settingTypeId: type.id, title: type.name, entries: typeEntries }]
  })

  return {
    mode: selection.mode,
    group1: structuredClone(group1),
    ...(selectedGroup2 ? { group2: structuredClone(selectedGroup2) } : {}),
    sections,
    entries,
  }
}
