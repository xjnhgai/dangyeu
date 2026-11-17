/** V2 domain model: exactly three levels in the calculation data tree. */

export type EntityId = string
export type NumericText = string

export interface DrawData {
  oneToSeven: string[]
  gdb: string
}

/** Stable formula identity, independent from editable display name and order. */
export type FormulaId = 'lb' | 'la' | 'da' | 'db' | 'ca' | 'cb' | 'xa' | 'xb'
export type ListingCountKey = '2' | '3' | '4' | '5'

export interface CoefficientPairText {
  coefficientD: NumericText | null
  coefficientT: NumericText | null
}

/** Global catalog definition; it is intentionally outside the three-level tree. */
export interface SettingTypeDefinition {
  id: EntityId
  allAliases?: string
  allPointMarkers?: string
  allSeparators?: string
  formulaId: FormulaId
  name: string
  defaultCoefficientD: NumericText | null
  defaultCoefficientT: NumericText | null
  /** XA/XB coefficient defaults keyed by the number of two-digit values in the listing. */
  defaultCoefficientsByCount?: Partial<Record<ListingCountKey, CoefficientPairText>>
}

/** One concrete setting entry. Group3 directly owns all entered values. */
export interface Group3 {
  allSourceId?: string
  kind: 'group3'
  id: EntityId
  settingTypeId: EntityId
  listing: string
  point: NumericText
  coefficientD: NumericText
  coefficientT: NumericText
  /** XA/XB per-list-length coefficient snapshot. */
  coefficientsByCount?: Partial<Record<ListingCountKey, { coefficientD: NumericText; coefficientT: NumericText }>>
}

/** Group2: a named group within one date. */
export interface Group2 {
  allEntries?: { id: string; text: string }[]
  kind: 'group2'
  id: EntityId
  name: string
  groups3: Group3[]
}

/** Group1: one date, its draw results and named groups. */
export interface Group1 {
  kind: 'group1'
  id: EntityId
  dateLabel: string
  drawData: DrawData
  groups2: Group2[]
}

/** The A4 view is either aggregated across all Group2 or isolated to one Group2. */
export type A4PageSelectionV2 =
  | { usePrivateCoefficients?: boolean
    mode: 'combined'; group1Id: EntityId }
  | { usePrivateCoefficients?: boolean
    mode: 'group2'; group1Id: EntityId; group2Id: EntityId }

export interface AllInputConfig { markers: string; separators: string }

export interface CalculationDataV2 {
  allInputConfig?: AllInputConfig
  nameCoefficientTypes?: Record<string, SettingTypeDefinition[]>
  schemaVersion: 2
  settingTypes: SettingTypeDefinition[]
  groups1: Group1[]
}

/* Legacy V1 models are retained only for migration. */
export interface LegacySettingV1 {
  kind: 'setting'
  id: EntityId
  name: string
  listing: string
  point: NumericText
  coefficientD: NumericText
  coefficientT: NumericText
}

export interface LegacyGroup2V1 {
  kind: 'group2'
  id: EntityId
  name: string
  isVisibleOnA4: boolean
  settings: LegacySettingV1[]
}

export interface LegacyGroup1V1 {
  kind: 'group1'
  id: EntityId
  dateLabel: string
  drawData: DrawData
  groups2: LegacyGroup2V1[]
}

export interface CalculationDataV1 {
  schemaVersion: 1
  groups1: LegacyGroup1V1[]
}
