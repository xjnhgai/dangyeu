
/**
 * Core data models for Calculator App.
 *
 * Fixed hierarchy:
 * Group 1 (Date)
 *   └── Group 2 (Named group)
 *         └── Group 3 (Setting)
 *
 * Rules:
 * - Group 1: No name suggestions.
 * - Group 2: Unique name among siblings, has name suggestions.
 * - Group 3: Duplicate names are allowed, has name suggestions.
 * - Only Group 2 supports A4 visibility.
 * - Calculation Data and Quick Settings are separate.
 */

// ============================================================
// 1. COMMON TYPES
// ============================================================

export type EntityId = string

/**
 * Numeric input is stored as text.
 * This preserves leading zeros and the original input format.
 */
export type NumericText = string

// ============================================================
// 2. DRAW DATA: 1-7 AND GĐB
// ============================================================

export interface DrawData {
  /**
   * 1-7:
   * Maximum 26 entries.
   * Each entry contains 2, 3, 4 or 5 digits.
   */
  oneToSeven: string[]

  /**
   * GĐB:
   * Exactly one 5-digit number when provided.
   * Empty string means no GĐB data.
   */
  gdb: string
}

// ============================================================
// 3. GROUP 3: SETTING
// ============================================================

export interface Setting {
  kind: 'setting'

  id: EntityId

  /** Setting name. Duplicate names are allowed. */
  name: string

  /** Original listing text entered by the user. */
  listing: string

  /** Point value. */
  point: NumericText

  /** D coefficient. */
  coefficientD: NumericText

  /** T coefficient. */
  coefficientT: NumericText
}

/**
 * Group 3 is the setting level.
 */
export type Group3 = Setting

// ============================================================
// 4. GROUP 2: NAMED GROUP
// ============================================================

export interface Group2 {
  kind: 'group2'

  id: EntityId

  /** Group name. */
  name: string

  /**
   * Whether this group name is displayed on A4.
   *
   * false:
   * - Hide the group heading on A4.
   * - Flatten its settings into Group 1's A4 content.
   *
   * This does not change the actual tree structure.
   */
  isVisibleOnA4: boolean

  /** Settings belonging to this group. */
  settings: Group3[]
}

// ============================================================
// 5. GROUP 1: DATE GROUP
// ============================================================

export interface Group1 {
  kind: 'group1'

  id: EntityId

  /**
   * Date label displayed in the workspace and on A4.
   *
   * Stored as text to preserve the user's chosen date format.
   * Date validation/formatting will be implemented separately.
   */
  dateLabel: string

  /**
   * 1-7 and GĐB data belonging to this date group.
   * Shared by all Group 2 and Group 3 items inside it.
   */
  drawData: DrawData

  /** Group 2 children belonging to this date group. */
  groups2: Group2[]
}

// ============================================================
// 6. A4 SELECTION
// ============================================================

/**
 * Identifies which hierarchy level the user selects for A4.
 *
 * Level 1:
 * Display the date group, all Group 2 groups and their settings.
 *
 * Level 2:
 * Display only the selected Group 2 and its settings.
 *
 * Level 3:
 * Display only the selected setting.
 */
export type A4Selection =
  | {
      level: 1
      group1Id: EntityId
    }
  | {
      level: 2
      group1Id: EntityId
      group2Id: EntityId
    }
  | {
      level: 3
      group1Id: EntityId
      group2Id: EntityId
      settingId: EntityId
    }

// ============================================================
// 7. CALCULATION DATA
// ============================================================

export interface CalculationData {
  /**
   * Data schema version.
   * Used for future storage migrations.
   */
  schemaVersion: 1

  /**
   * All Group 1 entries are retained.
   * No date group is automatically excluded from archiving.
   */
  groups1: Group1[]
}

// ============================================================
// 8. QUICK SETTINGS: NAME SUGGESTIONS
// ============================================================

/**
 * An entry in an ordered name suggestion list.
 *
 * Each suggestion has its own ID so it can be:
 * - Added
 * - Deleted
 * - Reordered
 *
 * Suggestion IDs are independent of actual group/setting IDs.
 */
export interface NameSuggestion {
  id: EntityId

  name: string
}

/**
 * Quick Settings are stored separately from Calculation Data.
 *
 * Both lists are shared across all Group 1 date groups.
 * Their array order determines the suggestion display order.
 *
 * Group 1 date labels are intentionally not stored here.
 */
/**
 * Mẫu thiết lập nhanh.
 *
 * Chỉ lưu tên và hệ số D/T.
 * Không lưu listing và point.
 */
export interface QuickSettingTemplate {
  id: EntityId

  name: string

  coefficientD: NumericText

  coefficientT: NumericText
}

/**
 * Quick Settings được mã hóa và lưu trữ độc lập
 * với Calculation Data.
 */
export interface QuickSettingsData {
  /** Danh sách tên gợi ý cho Group 2. */
  group2NameSuggestions: NameSuggestion[]

  /** Danh sách tên gợi ý cho Group 3. */
  settingNameSuggestions: NameSuggestion[]

  /** Các mẫu thiết lập nhanh chứa hệ số D/T. */
  settingTemplates: QuickSettingTemplate[]
}
