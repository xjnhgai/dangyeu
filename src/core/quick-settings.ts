
import type {
  EntityId,
  NameSuggestion,
  QuickSettingTemplate,
  QuickSettingsData,
} from './models'

// ============================================================
// 1. ERRORS
// ============================================================

export type QuickSettingsErrorCode =
  | 'INVALID_ID'
  | 'INVALID_NAME'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_SUGGESTION'
  | 'SUGGESTION_NOT_FOUND'
  | 'DUPLICATE_TEMPLATE'
  | 'TEMPLATE_NOT_FOUND'
  | 'INVALID_INDEX'

export class QuickSettingsError extends Error {
  readonly code: QuickSettingsErrorCode

  constructor(
    code: QuickSettingsErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'QuickSettingsError'
    this.code = code
  }
}

// ============================================================
// 2. BASIC VALIDATION
// ============================================================

function validateId(id: EntityId): void {
  if (!id.trim()) {
    throw new QuickSettingsError(
      'INVALID_ID',
      'ID không được để trống.',
    )
  }
}

function normalizeName(name: string): string {
  const cleaned = name.trim().normalize('NFC')

  if (!cleaned) {
    throw new QuickSettingsError(
      'INVALID_NAME',
      'Tên không được để trống.',
    )
  }

  return cleaned
}

function nameKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase('vi-VN')
}

// ============================================================
// 3. QUICK SETTINGS FACTORY
// ============================================================

export function createQuickSettingsData(): QuickSettingsData {
  return {
    group2NameSuggestions: [],
    settingNameSuggestions: [],
    settingTemplates: [],
  }
}

// ============================================================
// 4. ID VALIDATION
// ============================================================

function collectQuickSettingsIds(
  data: QuickSettingsData,
): Set<EntityId> {
  const ids = new Set<EntityId>()

  const register = (id: EntityId) => {
    validateId(id)

    if (ids.has(id)) {
      throw new QuickSettingsError(
        'DUPLICATE_ID',
        `ID "${id}" đã tồn tại trong Quick Settings.`,
      )
    }

    ids.add(id)
  }

  for (const item of data.group2NameSuggestions) {
    register(item.id)
  }

  for (const item of data.settingNameSuggestions) {
    register(item.id)
  }

  for (const item of data.settingTemplates) {
    register(item.id)
  }

  return ids
}

function assertNewIdAvailable(
  data: QuickSettingsData,
  id: EntityId,
): void {
  validateId(id)

  const existingIds = collectQuickSettingsIds(data)

  if (existingIds.has(id)) {
    throw new QuickSettingsError(
      'DUPLICATE_ID',
      `ID "${id}" đã tồn tại trong Quick Settings.`,
    )
  }
}

// ============================================================
// 5. GENERIC SUGGESTION OPERATIONS
// ============================================================

type SuggestionListKey =
  | 'group2NameSuggestions'
  | 'settingNameSuggestions'

function addSuggestion(
  data: QuickSettingsData,
  key: SuggestionListKey,
  id: EntityId,
  name: string,
): QuickSettingsData {
  const cleanedName = normalizeName(name)

  assertNewIdAvailable(data, id)

  const list = data[key]

  const duplicate = list.some(
    (item) => nameKey(item.name) === nameKey(cleanedName),
  )

  if (duplicate) {
    throw new QuickSettingsError(
      'DUPLICATE_SUGGESTION',
      'Tên này đã có trong danh sách gợi ý.',
    )
  }

  const suggestion: NameSuggestion = {
    id,
    name: cleanedName,
  }

  return {
    ...data,
    [key]: [...list, suggestion],
  }
}

function renameSuggestion(
  data: QuickSettingsData,
  key: SuggestionListKey,
  id: EntityId,
  newName: string,
): QuickSettingsData {
  const cleanedName = normalizeName(newName)
  const list = data[key]

  const index = list.findIndex((item) => item.id === id)

  if (index === -1) {
    throw new QuickSettingsError(
      'SUGGESTION_NOT_FOUND',
      `Không tìm thấy tên gợi ý "${id}".`,
    )
  }

  const duplicate = list.some(
    (item) =>
      item.id !== id
      && nameKey(item.name) === nameKey(cleanedName),
  )

  if (duplicate) {
    throw new QuickSettingsError(
      'DUPLICATE_SUGGESTION',
      'Tên này đã có trong danh sách gợi ý.',
    )
  }

  const nextList = [...list]

  nextList[index] = {
    ...nextList[index],
    name: cleanedName,
  }

  return {
    ...data,
    [key]: nextList,
  }
}

function deleteSuggestion(
  data: QuickSettingsData,
  key: SuggestionListKey,
  id: EntityId,
): QuickSettingsData {
  const list = data[key]

  const exists = list.some((item) => item.id === id)

  if (!exists) {
    throw new QuickSettingsError(
      'SUGGESTION_NOT_FOUND',
      `Không tìm thấy tên gợi ý "${id}".`,
    )
  }

  return {
    ...data,
    [key]: list.filter((item) => item.id !== id),
  }
}

function reorderSuggestions(
  data: QuickSettingsData,
  key: SuggestionListKey,
  id: EntityId,
  newIndex: number,
): QuickSettingsData {
  const list = data[key]

  if (
    !Number.isInteger(newIndex)
    || newIndex < 0
    || newIndex >= list.length
  ) {
    throw new QuickSettingsError(
      'INVALID_INDEX',
      'Vị trí sắp xếp tên gợi ý không hợp lệ.',
    )
  }

  const oldIndex = list.findIndex((item) => item.id === id)

  if (oldIndex === -1) {
    throw new QuickSettingsError(
      'SUGGESTION_NOT_FOUND',
      `Không tìm thấy tên gợi ý "${id}".`,
    )
  }

  if (oldIndex === newIndex) {
    return data
  }

  const nextList = [...list]
  const [movedItem] = nextList.splice(oldIndex, 1)

  nextList.splice(newIndex, 0, movedItem)

  return {
    ...data,
    [key]: nextList,
  }
}

// ============================================================
// 6. GROUP 2 NAME SUGGESTIONS
// ============================================================

export function addGroup2NameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
  name: string,
): QuickSettingsData {
  return addSuggestion(
    data,
    'group2NameSuggestions',
    id,
    name,
  )
}

export function renameGroup2NameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
  newName: string,
): QuickSettingsData {
  return renameSuggestion(
    data,
    'group2NameSuggestions',
    id,
    newName,
  )
}

export function deleteGroup2NameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
): QuickSettingsData {
  return deleteSuggestion(
    data,
    'group2NameSuggestions',
    id,
  )
}

export function reorderGroup2NameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
  newIndex: number,
): QuickSettingsData {
  return reorderSuggestions(
    data,
    'group2NameSuggestions',
    id,
    newIndex,
  )
}

/**
 * Automatically remember a Group 2 name.
 *
 * Existing names are not inserted twice.
 * This function does not modify Calculation Data.
 */
export function rememberGroup2Name(
  data: QuickSettingsData,
  id: EntityId,
  name: string,
): QuickSettingsData {
  const cleanedName = normalizeName(name)

  const exists = data.group2NameSuggestions.some(
    (item) => nameKey(item.name) === nameKey(cleanedName),
  )

  if (exists) {
    return data
  }

  return addGroup2NameSuggestion(data, id, cleanedName)
}

// ============================================================
// 7. GROUP 3 SETTING NAME SUGGESTIONS
// ============================================================

export function addSettingNameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
  name: string,
): QuickSettingsData {
  return addSuggestion(
    data,
    'settingNameSuggestions',
    id,
    name,
  )
}

export function renameSettingNameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
  newName: string,
): QuickSettingsData {
  return renameSuggestion(
    data,
    'settingNameSuggestions',
    id,
    newName,
  )
}

export function deleteSettingNameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
): QuickSettingsData {
  return deleteSuggestion(
    data,
    'settingNameSuggestions',
    id,
  )
}

export function reorderSettingNameSuggestion(
  data: QuickSettingsData,
  id: EntityId,
  newIndex: number,
): QuickSettingsData {
  return reorderSuggestions(
    data,
    'settingNameSuggestions',
    id,
    newIndex,
  )
}

/**
 * Automatically remember a Group 3 setting name.
 *
 * Existing names are not inserted twice.
 * This function does not modify Calculation Data.
 */
export function rememberSettingName(
  data: QuickSettingsData,
  id: EntityId,
  name: string,
): QuickSettingsData {
  const cleanedName = normalizeName(name)

  const exists = data.settingNameSuggestions.some(
    (item) => nameKey(item.name) === nameKey(cleanedName),
  )

  if (exists) {
    return data
  }

  return addSettingNameSuggestion(data, id, cleanedName)
}

// ============================================================
// 8. SETTING TEMPLATE VALIDATION
// ============================================================

function cleanTemplate(
  template: QuickSettingTemplate,
): QuickSettingTemplate {
  validateId(template.id)

  return {
    id: template.id,
    name: normalizeName(template.name),
    coefficientD: template.coefficientD,
    coefficientT: template.coefficientT,
  }
}

/**
 * Exact duplicate:
 * same normalized name + same D text + same T text.
 *
 * Different D/T coefficients remain separate templates,
 * even when their names are identical.
 */
function isSameTemplate(
  first: QuickSettingTemplate,
  second: QuickSettingTemplate,
): boolean {
  return (
    nameKey(first.name) === nameKey(second.name)
    && first.coefficientD === second.coefficientD
    && first.coefficientT === second.coefficientT
  )
}

// ============================================================
// 9. ADD SETTING TEMPLATE
// ============================================================

/**
 * Exact duplicate template:
 * return the existing data without adding another entry.
 *
 * Same name but different coefficients:
 * allowed.
 */
export function addSettingTemplate(
  data: QuickSettingsData,
  template: QuickSettingTemplate,
): QuickSettingsData {
  const cleaned = cleanTemplate(template)

  const duplicate = data.settingTemplates.some(
    (item) => isSameTemplate(item, cleaned),
  )

  if (duplicate) {
    return data
  }

  assertNewIdAvailable(data, cleaned.id)

  return {
    ...data,
    settingTemplates: [
      ...data.settingTemplates,
      cleaned,
    ],
  }
}

// ============================================================
// 10. UPDATE SETTING TEMPLATE
// ============================================================

export type SettingTemplateUpdate = Partial<
  Pick<
    QuickSettingTemplate,
    'name' | 'coefficientD' | 'coefficientT'
  >
>

export function updateSettingTemplate(
  data: QuickSettingsData,
  templateId: EntityId,
  patch: SettingTemplateUpdate,
): QuickSettingsData {
  const index = data.settingTemplates.findIndex(
    (item) => item.id === templateId,
  )

  if (index === -1) {
    throw new QuickSettingsError(
      'TEMPLATE_NOT_FOUND',
      `Không tìm thấy mẫu thiết lập "${templateId}".`,
    )
  }

  const current = data.settingTemplates[index]

  const updated = cleanTemplate({
    ...current,
    ...patch,
  })

  const duplicate = data.settingTemplates.some(
    (item) =>
      item.id !== templateId
      && isSameTemplate(item, updated),
  )

  if (duplicate) {
    throw new QuickSettingsError(
      'DUPLICATE_TEMPLATE',
      'Mẫu thiết lập giống hệt một mẫu đã tồn tại.',
    )
  }

  const nextTemplates = [...data.settingTemplates]
  nextTemplates[index] = updated

  return {
    ...data,
    settingTemplates: nextTemplates,
  }
}

// ============================================================
// 11. DELETE SETTING TEMPLATE
// ============================================================

export function deleteSettingTemplate(
  data: QuickSettingsData,
  templateId: EntityId,
): QuickSettingsData {
  const exists = data.settingTemplates.some(
    (item) => item.id === templateId,
  )

  if (!exists) {
    throw new QuickSettingsError(
      'TEMPLATE_NOT_FOUND',
      `Không tìm thấy mẫu thiết lập "${templateId}".`,
    )
  }

  return {
    ...data,
    settingTemplates: data.settingTemplates.filter(
      (item) => item.id !== templateId,
    ),
  }
}

// ============================================================
// 12. REORDER SETTING TEMPLATES
// ============================================================

export function reorderSettingTemplate(
  data: QuickSettingsData,
  templateId: EntityId,
  newIndex: number,
): QuickSettingsData {
  const list = data.settingTemplates

  if (
    !Number.isInteger(newIndex)
    || newIndex < 0
    || newIndex >= list.length
  ) {
    throw new QuickSettingsError(
      'INVALID_INDEX',
      'Vị trí sắp xếp mẫu thiết lập không hợp lệ.',
    )
  }

  const oldIndex = list.findIndex(
    (item) => item.id === templateId,
  )

  if (oldIndex === -1) {
    throw new QuickSettingsError(
      'TEMPLATE_NOT_FOUND',
      `Không tìm thấy mẫu thiết lập "${templateId}".`,
    )
  }

  if (oldIndex === newIndex) {
    return data
  }

  const nextTemplates = [...list]
  const [movedTemplate] = nextTemplates.splice(oldIndex, 1)

  nextTemplates.splice(newIndex, 0, movedTemplate)

  return {
    ...data,
    settingTemplates: nextTemplates,
  }
}
