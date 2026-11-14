import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import A4PageV2 from './components/A4PageV2'
import ListingInput from './components/ListingInput'
import { cleanListingInput } from './core/input-text'
import EntryDock from './components/EntryDock'
import PublisherPrompt from './components/PublisherPrompt'
import { buildEntryPreview, type EntryTarget } from './core/entry-preview'
import { initializeCoefficientDefaults } from './core/coefficient-defaults'
import { PinSettings, RetentionSettings } from './components/PrivacySettings'
import { applyRetention } from './core/app-preferences'
import { useAppPreferences } from './core/preferences-context'
import { moveGroup2Name, orderGroups2 } from './core/group2-order'
import {
  addGroup1V2,
  addGroup2V2,
  addGroup3V2,
  createCalculationDataV2,
  createGroup3FromDefaults,
  deleteGroup1V2,
  deleteGroup2V2,
  deleteGroup3V2,
  reorderSettingType,
  renameSettingType,
  updateGroup1DrawDataV2,
  updateGroup3V2,
  updateSettingTypeDefaults,
} from './core/tree-v2'
import { buildA4ProjectionV2 } from './core/a4-v2'
import { findExactDuplicates } from './core/calculation'
import {
  calculateWorkspaceForA4V2,
  parseCoefficientTextV2,
  parseOneToSevenTextV2,
  parsePointTextV2,
  parseSettingNumberListV2,
  splitSeparatedValuesV2,
  getCoefficientProfileKey,
  getCoefficientProfileKeys,
  isProfileCoefficientFormula,
} from './core/workspace-calculator-v2'
import { exportA4Images } from './core/export-a4-image'
import {
  createQuickSettingsSnapshot,
  loadCalculationWorkspace,
  loadQuickSettings,
  mergeQuickSettingsIntoCalculationData,
  normalizeGreetingSettings,
  saveCalculationWorkspace,
  saveQuickSettings,
} from './core/vault-storage'
import type { CalculationWorkspaceV2, QuickSettingsV2 } from './core/vault-storage'
import type {
  A4PageSelectionV2,
  CalculationDataV2,
  EntityId,
  Group1,
  Group2,
  Group3,
  ListingCountKey,
  CoefficientPairText,
  SettingTypeDefinition,
} from './core/models-v2'

import './App.css'

type ToolKey = 'view' | 'edit' | 'results'
type PanelKey = ToolKey | null
type ManagementPanelKey = 'date' | 'groups' | 'types' | null
type HomeSettingsSection = 'menu' | 'greeting' | 'pin' | 'retention'

type DraftRow = {
  id: string
  listing: string
  point: string
  coefficientD: string
  coefficientT: string
}

type SavedRowDraft = {
  listing: string
  point: string
  coefficientD: string
  coefficientT: string
}

type CountCoefficientDraft = Record<ListingCountKey, { coefficientD: string; coefficientT: string }>
const LISTING_COUNT_KEYS: ListingCountKey[] = ['2', '3', '4', '5']

function createCountCoefficientDraft(type: SettingTypeDefinition): CountCoefficientDraft {
  return Object.fromEntries(LISTING_COUNT_KEYS.map((key) => {
    const pair = type.defaultCoefficientsByCount?.[key]
    return [key, { coefficientD: pair?.coefficientD ?? '', coefficientT: pair?.coefficientT ?? '' }]
  })) as CountCoefficientDraft
}

const GREETING_ICON_OPTIONS = [
  '✨', '🌸', '🌷', '🌼', '🪷', '🦋', '🎀', '💖', '💕', '💗',
  '⭐', '🌙', '☁️', '🌈', '🍀', '🍓', '🐰', '🐻', '🐱', '🐣',
  '🧸', '🩷', '💫', '🕊️',
] as const

const TOOLS: { key: ToolKey | 'save'; label: string; icon: 'eye' | 'edit' | 'chart' | 'download' }[] = [
  { key: 'view', label: 'Xem', icon: 'eye' },
  { key: 'edit', label: 'Sửa', icon: 'edit' },
  { key: 'results', label: 'Kết Quả', icon: 'chart' },
  { key: 'save', label: 'Lưu', icon: 'download' },
]

const EMPTY_RESULTS = new Map<string, never>()

function makeId(): string {
  return crypto.randomUUID()
}

function todayInputValue(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateLabelFromInput(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function dateInputFromLabel(value: string): string {
  const [day, month, year] = value.split('/')
  if (!day || !month || !year) return todayInputValue()
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function formatLibraryAmount(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(value)
}


type SettingTypePickerProps = {
  types: readonly SettingTypeDefinition[]
  groups3: readonly Group3[]
  activeTypeId: EntityId | null
  onSelect: (typeId: EntityId) => void
  onReorder: (source: string, target: string) => void
  onEdit: () => void
}

/** One-line formula picker. Configured types are fitted first; overflow lives under +. */
function SettingTypePicker({ types, groups3, activeTypeId, onSelect, onReorder, onEdit }: SettingTypePickerProps) {
  const visibleRowRef = useRef<HTMLDivElement>(null)
  const measureRowRef = useRef<HTMLDivElement>(null)
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [overflowOpen, setOverflowOpen] = useState(false)
  const drag = useRef<{ source: string; target: string; x: number; y: number; moving: boolean } | null>(null)
  const suppress = useRef(false)
  const configuredIds = useMemo(() => new Set(groups3.map((item) => item.settingTypeId)), [groups3])
  const priorityTypes = useMemo(() => [
    ...types.filter((type) => type.id === activeTypeId),
    ...types.filter((type) => type.id !== activeTypeId && configuredIds.has(type.id)),
    ...types.filter((type) => type.id !== activeTypeId && !configuredIds.has(type.id)),
  ], [types, configuredIds, activeTypeId])

  useEffect(() => {
    const visibleRow = visibleRowRef.current
    const measureRow = measureRowRef.current
    if (!visibleRow || !measureRow) return

    const updateVisibleTypes = () => {
      const availableWidth = visibleRow.clientWidth
      if (!availableWidth) return
      const measured = new Map<string, number>()
      measureRow.querySelectorAll<HTMLElement>('[data-measure-type-id]').forEach((element) => {
        const id = element.dataset.measureTypeId
        if (id) measured.set(id, element.getBoundingClientRect().width)
      })
      const moreButton = measureRow.querySelector<HTMLElement>('[data-measure-more]')
      const moreWidth = moreButton?.getBoundingClientRect().width ?? 34
      const gap = 5
      const allWidth = types.reduce((sum, type, index) => sum + (measured.get(type.id) ?? 0) + (index > 0 ? gap : 0), 0)
      let nextIds: string[]

      if (allWidth <= availableWidth) {
        nextIds = types.map((type) => type.id)
      } else {
        const budget = Math.max(0, availableWidth - moreWidth - gap)
        let used = 0
        nextIds = []
        for (const type of priorityTypes) {
          const width = measured.get(type.id) ?? 0
          const need = width + (nextIds.length ? gap : 0)
          if (used + need <= budget) {
            nextIds.push(type.id)
            used += need
          }
        }
      }
      setVisibleIds((current) => current.length === nextIds.length && current.every((id, index) => id === nextIds[index]) ? current : nextIds)
    }

    updateVisibleTypes()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateVisibleTypes)
      return () => window.removeEventListener('resize', updateVisibleTypes)
    }
    const observer = new ResizeObserver(updateVisibleTypes)
    observer.observe(visibleRow)
    return () => observer.disconnect()
  }, [types, priorityTypes])

  const visibleIdSet = new Set(visibleIds)
  const visibleTypes = types.filter((type) => visibleIdSet.has(type.id))
  const overflowTypes = types.filter((type) => !visibleIdSet.has(type.id))

  const renderTypeButton = (type: SettingTypeDefinition, measuring = false) => {
    const configured = configuredIds.has(type.id)
    const selected = activeTypeId === type.id
    const stateClass = selected ? ' is-selected' : configured ? ' is-configured' : ' is-unconfigured'
    return (
      <button
        type="button"
        className={`choice-chip setting-type-chip${stateClass}`}
        key={type.id}
        data-measure-type-id={measuring ? type.id : undefined}
        data-drag-type={measuring ? undefined : type.id}
        onPointerDown={measuring ? undefined : (event) => { if (event.button !== 0) return; suppress.current = false; drag.current = { source: type.id, target: type.id, x: event.clientX, y: event.clientY, moving: false }; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={measuring ? undefined : (event) => { const current = drag.current; if (!current) return; if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7 && !current.moving) return; current.moving = true; event.preventDefault(); const id = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-drag-type]')?.dataset.dragType; if (id) current.target = id; if (document.elementFromPoint(event.clientX, event.clientY)?.closest('.type-overflow-trigger')) setOverflowOpen(true) }}
        onPointerUp={measuring ? undefined : () => { const current = drag.current; drag.current = null; if (current?.moving) { suppress.current = true; onReorder(current.source, current.target) } }}
        onPointerCancel={() => { drag.current = null }}
        onClick={measuring ? undefined : () => { if (suppress.current) { suppress.current = false; return }; onSelect(type.id); setOverflowOpen(false) }}
        aria-pressed={selected}
        tabIndex={measuring ? -1 : undefined}
      >{type.name}</button>
    )
  }

  return (
    <div className="setting-type-picker-wrap">
      <div className="setting-type-picker-row">
        <div className="compact-chip-list type-chip-list" ref={visibleRowRef}>
          {visibleTypes.map((type) => renderTypeButton(type))}
          {overflowTypes.length > 0 && (
            <button className="choice-chip add-chip type-overflow-trigger" type="button" onClick={() => setOverflowOpen((value) => !value)} aria-expanded={overflowOpen} aria-label="Danh sách nhóm thiết lập khác" title="Danh sách nhóm thiết lập khác"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg></button>
          )}
        </div>
        <button className="icon-button chip-edit-button" type="button" onClick={onEdit} aria-label="Sửa thiết lập">✎</button>
      </div>
      {overflowOpen && overflowTypes.length > 0 && (
        <div className="type-overflow-menu" aria-label="Các nhóm thiết lập còn lại">
          {overflowTypes.map((type) => renderTypeButton(type))}
        </div>
      )}
      <div className="type-chip-measure" ref={measureRowRef} aria-hidden="true">
        {types.map((type) => renderTypeButton(type, true))}
        <button className="choice-chip add-chip type-overflow-trigger" type="button" data-measure-more="true" tabIndex={-1}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg></button>
      </div>
    </div>
  )
}

type Group2NamePickerProps = {
  names: readonly string[]
  configuredNameKeys: ReadonlySet<string>
  activeNameKey: string
  onSelect: (name: string) => void
  onReorder: (source: string, target: string) => void
  onAdd: () => void
  onEdit: () => void
}

function group2NameKey(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
}

/** Keep configured names first, then fit quick names into the remaining row width. */
function Group2NamePicker({
  names,
  configuredNameKeys,
  activeNameKey,
  onSelect,
  onReorder,
  onAdd,
  onEdit,
}: Group2NamePickerProps) {
  const visibleRowRef = useRef<HTMLDivElement>(null)
  const measureRowRef = useRef<HTMLDivElement>(null)
  const [visibleNames, setVisibleNames] = useState<string[]>([])
  const [overflowOpen, setOverflowOpen] = useState(false)
  const dragRef = useRef<{ source: string; target: string; startX: number; startY: number; moving: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const [dragSource, setDragSource] = useState('')
  const [dragTarget, setDragTarget] = useState('')

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, name: string) {
    if (event.button !== 0 || !event.isPrimary) return
    suppressClickRef.current = false
    dragRef.current = { source: name, target: name, startX: event.clientX, startY: event.clientY, moving: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    if (!drag.moving && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return
    event.preventDefault()
    drag.moving = true
    setDragSource(group2NameKey(drag.source))
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-group2-drag-key]')
    const targetName = names.find((name) => group2NameKey(name) === target?.dataset.group2DragKey)
    if (targetName) { drag.target = targetName; setDragTarget(group2NameKey(targetName)) }
    // Holding a dragged chip over the list button reveals hidden drop targets.
    if (document.elementFromPoint(event.clientX, event.clientY)?.closest('.group2-overflow-trigger')) setOverflowOpen(true)
  }

  function finishDrag(cancelled = false) {
    const drag = dragRef.current
    dragRef.current = null
    setDragSource(''); setDragTarget('')
    if (!drag?.moving) return
    suppressClickRef.current = true
    if (!cancelled && drag.source !== drag.target) onReorder(drag.source, drag.target)
  }


  useEffect(() => {
    const visibleRow = visibleRowRef.current
    const measureRow = measureRowRef.current
    if (!visibleRow || !measureRow) return

    const updateVisibleNames = () => {
      const availableWidth = visibleRow.clientWidth
      if (!availableWidth) return

      const measured = new Map<number, number>()
      measureRow.querySelectorAll<HTMLElement>('[data-measure-group2-index]').forEach((element) => {
        const index = Number(element.dataset.measureGroup2Index)
        if (Number.isInteger(index)) measured.set(index, element.getBoundingClientRect().width)
      })
      const moreButton = measureRow.querySelector<HTMLElement>('[data-measure-group2-more]')
      const moreWidth = moreButton?.getBoundingClientRect().width ?? 24
      const gap = 5
      const allWidth = names.reduce((sum, _name, index) =>
        sum + (measured.get(index) ?? 0) + (index > 0 ? gap : 0), 0)

      let nextNames: string[]
      if (allWidth <= availableWidth) {
        nextNames = [...names]
      } else {
        const budget = Math.max(0, availableWidth - moreWidth - (names.length ? gap : 0))
        let used = 0
        nextNames = []
        names.forEach((name, index) => {
          const width = measured.get(index) ?? 0
          const required = width + (nextNames.length ? gap : 0)
          if (used + required <= budget) {
            nextNames.push(name)
            used += required
          }
        })
      }

      setVisibleNames((current) => current.length === nextNames.length
        && current.every((name, index) => name === nextNames[index])
        ? current
        : nextNames)
    }

    updateVisibleNames()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateVisibleNames)
      return () => window.removeEventListener('resize', updateVisibleNames)
    }
    const observer = new ResizeObserver(updateVisibleNames)
    observer.observe(visibleRow)
    return () => observer.disconnect()
  }, [names])

  const visibleNameKeys = new Set(visibleNames.map(group2NameKey))
  const overflowNames = names.filter((name) => !visibleNameKeys.has(group2NameKey(name)))

  const renderNameButton = (name: string, measuring = false, index?: number, inList = false) => {
    const key = group2NameKey(name)
    const configured = configuredNameKeys.has(key)
    const selected = activeNameKey === key
    const stateClass = selected ? ' is-selected' : configured ? ' is-configured' : ' is-quick'
    return (
      <button
        className={`choice-chip group2-draggable${stateClass}${dragSource === key ? ' is-dragging' : ''}${dragTarget === key && dragSource !== key ? ' is-drop-target' : ''}`}
        type="button"
        key={`${key}-${index ?? 'visible'}`}
        data-measure-group2-index={measuring ? index : undefined}
        data-group2-drag-key={measuring ? undefined : key}
        onPointerDown={measuring ? undefined : (event) => startDrag(event, name)}
        onPointerMove={measuring ? undefined : moveDrag}
        onPointerUp={measuring ? undefined : () => finishDrag()}
        onPointerCancel={measuring ? undefined : () => finishDrag(true)}
        onLostPointerCapture={measuring ? undefined : () => finishDrag(true)}
        onContextMenu={measuring ? undefined : (event) => event.preventDefault()}
        onKeyDown={measuring ? undefined : (event) => {
          if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
          event.preventDefault()
          const index = names.indexOf(name)
          const target = names[index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)]
          if (target) onReorder(name, target)
        }}
        title={measuring ? undefined : 'Kéo để sắp xếp; Alt + phím mũi tên khi dùng bàn phím'}
        onClick={measuring ? undefined : () => {
          if (suppressClickRef.current) { suppressClickRef.current = false; return }
          setOverflowOpen(false); onSelect(name)
        }}
        aria-pressed={selected}
        aria-roledescription={inList ? 'Tên nhóm' : undefined}
        tabIndex={measuring ? -1 : undefined}
      >{name}</button>
    )
  }

  const listIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </svg>
  )

  return (
    <div className="group2-name-picker-wrap">
      <div className="chip-edit-row group2-chip-row">
        <div className="compact-chip-list group2-name-chip-list" ref={visibleRowRef}>
          {visibleNames.map((name, index) => renderNameButton(name, false, index))}
          {overflowNames.length > 0 && (
            <button
              className="icon-button quick-group-list-trigger group2-overflow-trigger"
              type="button"
              onClick={() => setOverflowOpen((value) => !value)}
              aria-expanded={overflowOpen}
              aria-label="Danh sách tên nhóm còn lại"
              title="Danh sách tên nhóm còn lại"
            >{listIcon}</button>
          )}
        </div>
        <button className="choice-chip add-chip group2-add-trigger" type="button" onClick={() => { setOverflowOpen(false); onAdd() }} aria-label="Tạo tên nhóm mới" title="Tạo tên nhóm mới">＋</button>
        <button className="icon-button chip-edit-button" type="button" onClick={() => { setOverflowOpen(false); onEdit() }} aria-label="Quản lý tên nhóm">✎</button>
      </div>
      {overflowOpen && overflowNames.length > 0 && (
        <div className="quick-group-list group2-overflow-menu" role="list" aria-label="Tên nhóm còn lại">
          {overflowNames.map((name, index) => renderNameButton(name, false, index, true))}
        </div>
      )}
      <div className="type-chip-measure group2-chip-measure" ref={measureRowRef} aria-hidden="true">
        {names.map((name, index) => renderNameButton(name, true, index))}
        <button className="icon-button quick-group-list-trigger group2-overflow-trigger" type="button" data-measure-group2-more="true" tabIndex={-1}>{listIcon}</button>
      </div>
    </div>
  )
}

function dateSortValue(label: string): number {
  const text = label.trim()
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (local) {
    const [, day, month, year] = local
    return Number(`${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`) || 0
  }
  if (iso) return Number(`${iso[1]}${iso[2]}${iso[3]}`) || 0
  return 0
}

function countDelimitedValues(text: string): number {
  return splitSeparatedValuesV2(text).length
}

function getOneToSevenDraftError(text: string): string {
  try {
    parseOneToSevenTextV2(text)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : 'Dữ liệu 1–7 không hợp lệ.'
  }
}

function isOneToSevenDraftValid(text: string): boolean {
  return getOneToSevenDraftError(text) === ''
}

function defaultSettingTypeName(type: SettingTypeDefinition): string {
  switch (type.formulaId) {
    case 'lb': return 'LB'
    case 'la': return 'LA'
    case 'da': return 'ĐA'
    case 'db': return 'ĐB'
    case 'ca': return 'CA'
    case 'cb': return 'CB'
    case 'xa': return 'XA'
    case 'xb': return 'XB'
  }
}

function createDraftRow(type: SettingTypeDefinition): DraftRow {
  return {
    id: makeId(),
    listing: '',
    point: '',
    coefficientD: type.defaultCoefficientD ?? '',
    coefficientT: type.defaultCoefficientT ?? '',
  }
}

function isDraftComplete(row: DraftRow, type: SettingTypeDefinition): boolean {
  if (!row.listing.trim() || !row.point.trim()) return false

  try {
    const listing = parseSettingNumberListV2(row.listing, type.formulaId)
    parsePointTextV2(row.point)

    if (isProfileCoefficientFormula(type.formulaId)) {
      const profileKey = getCoefficientProfileKey(type.formulaId, listing)
      if (!profileKey) return false
      const pair = type.defaultCoefficientsByCount?.[profileKey]
      if (!pair?.coefficientD || !pair.coefficientT) return false
      parseCoefficientTextV2(pair.coefficientD, 'Hệ số Đánh')
      parseCoefficientTextV2(pair.coefficientT, 'Hệ số Trúng')
      return true
    }

    if (!row.coefficientD.trim() || !row.coefficientT.trim()) return false
    parseCoefficientTextV2(row.coefficientD, 'Hệ số Đánh')
    parseCoefficientTextV2(row.coefficientT, 'Hệ số Trúng')
    return true
  } catch {
    return false
  }
}

function ToolbarIcon({ name }: { name: 'eye' | 'edit' | 'chart' | 'download' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'eye') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>
  if (name === 'edit') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m4 16.8-.8 4 4-.8L19.6 7.6a2.1 2.1 0 0 0-3-3L4 16.8Z"/><path d="m14.9 6.3 3 3"/></svg>
  if (name === 'chart') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4 19.5V4.5M4 19.5h16"/><path d="m7 15 3.5-4 3 2 4.5-6"/><path d="M16 7h2v2"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 16v4h16v-4"/></svg>
}

function App() {
  const { preferences } = useAppPreferences()
  const [retentionBusy, setRetentionBusy] = useState(false)
  const retentionRunningRef = useRef(false)
  const retentionPreferencesRef = useRef(preferences)
  useEffect(() => { retentionPreferencesRef.current = preferences }, [preferences])
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service Worker registration failed:', error)
    },
  })

  const [data, setData] = useState<CalculationDataV2>(() => createCalculationDataV2())
  const [quickGroup2Suggestions, setQuickGroup2Suggestions] = useState<string[]>([])
  const [storageHydrating, setStorageHydrating] = useState(true)
  const [persistenceReady, setPersistenceReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [screen, setScreen] = useState<'home' | 'page'>('home')
  const [selectedGroup1Id, setSelectedGroup1Id] = useState<EntityId | null>(null)
  const [selectedGroup2Id, setSelectedGroup2Id] = useState<EntityId | null>(null)
  const [a4Mode, setA4Mode] = useState<A4PageSelectionV2['mode']>('combined')
  const [toolbarVisible, setToolbarVisible] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelKey>(null)
  const [managementPanel, setManagementPanel] = useState<ManagementPanelKey>(null)
  const [calculationEnabled, setCalculationEnabled] = useState(false)
  const [activeSettingTypeId, setActiveSettingTypeId] = useState<EntityId | null>(null)
  const [draftRowsByType, setDraftRowsByType] = useState<Record<string, DraftRow[]>>({})
  const [savedRowDrafts, setSavedRowDrafts] = useState<Record<string, SavedRowDraft>>({})
  const draftListingInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [draftListingFocusToken, setDraftListingFocusToken] = useState(0)
  const [pageFitMode, setPageFitMode] = useState<'width' | 'page'>('width')
  const [zoom, setZoom] = useState(1)
  const [paperFitRequest, setPaperFitRequest] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [greeting, setGreeting] = useState('Hello')
  const [homeSettingsOpen, setHomeSettingsOpen] = useState(false)
  const [homeSettingsSection, setHomeSettingsSection] = useState<HomeSettingsSection>('menu')
  const [greetingFontSize, setGreetingFontSize] = useState('16')
  const [greetingFontFamily, setGreetingFontFamily] = useState('Arial, Helvetica, sans-serif')
  const [greetingColor, setGreetingColor] = useState('#34475e')
  const greetingInputRef = useRef<HTMLInputElement | null>(null)

  const [dateDraft, setDateDraft] = useState(todayInputValue())
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)

  const [drawOneToSeven, setDrawOneToSeven] = useState('')
  const [drawGdb, setDrawGdb] = useState('')
  const [drawDraftGroup1Id, setDrawDraftGroup1Id] = useState<EntityId | null>(null)

  const [editingTypeId, setEditingTypeId] = useState('')
  const [editingTypeName, setEditingTypeName] = useState('')
  const [editingTypeD, setEditingTypeD] = useState('')
  const [editingTypeT, setEditingTypeT] = useState('')
  const [editingTypeCoefficientsByCount, setEditingTypeCoefficientsByCount] = useState<CountCoefficientDraft>({
    '2': { coefficientD: '', coefficientT: '' },
    '3': { coefficientD: '', coefficientT: '' },
    '4': { coefficientD: '', coefficientT: '' },
    '5': { coefficientD: '', coefficientT: '' },
  })
  const [typeSettingsOpen, setTypeSettingsOpen] = useState(false)
  const [publisherPromptOpen, setPublisherPromptOpen] = useState(false)
  const [publisherAuthorized, setPublisherAuthorized] = useState(false)
  const [entryDock, setEntryDock] = useState<EntryTarget | null>(null)
  const groupDragRef = useRef<{ source: string; target: string } | null>(null)
  const [draggingGroupName, setDraggingGroupName] = useState('')
  const [dropGroupName, setDropGroupName] = useState('')
  const [draggingTypeId, setDraggingTypeId] = useState<EntityId | null>(null)
  const [typeDropTargetId, setTypeDropTargetId] = useState<EntityId | null>(null)
  useEffect(() => {
    const closePrivatePanels = () => { setPublisherAuthorized(false); setTypeSettingsOpen(false); setPublisherPromptOpen(false); setEntryDock(null) }
    const onHidden = () => { if (document.visibilityState === 'hidden') closePrivatePanels() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', closePrivatePanels)
    return () => { document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('pagehide', closePrivatePanels) }
  }, [])
  const lastWorkspaceSnapshotSignatureRef = useRef('')
  const workspaceSaveRevisionRef = useRef(0)
  const lastQuickSettingsSignatureRef = useRef('')

  useEffect(() => {
    // React StrictMode intentionally runs effects as setup -> cleanup -> setup in development.
    // A cancelled first setup must not prevent the second setup from hydrating.
    let cancelled = false
    let hydrationTimeout: number | undefined
    void (async () => {
      try {
        const loadPromise = Promise.allSettled([loadQuickSettings(), loadCalculationWorkspace()])
        const timeoutPromise = new Promise<never>((_, reject) => {
          hydrationTimeout = window.setTimeout(() => {
            reject(new Error('Mở kho dữ liệu đã mã hóa quá thời gian cho phép. Hãy kiểm tra IndexedDB/quyền lưu trữ của trình duyệt rồi thử tải lại.'))
          }, 15000)
        })
        const [quickSettled, workspaceSettled] = await Promise.race([loadPromise, timeoutPromise])
        if (cancelled) return

        const loadErrors: string[] = []
        if (quickSettled.status === 'rejected') {
          loadErrors.push(quickSettled.reason instanceof Error ? quickSettled.reason.message : 'Không thể đọc Quick Settings.')
        }
        if (workspaceSettled.status === 'rejected') {
          loadErrors.push(workspaceSettled.reason instanceof Error ? workspaceSettled.reason.message : 'Không thể đọc A4 Workspace.')
        }

        const quickResult = quickSettled.status === 'fulfilled' ? quickSettled.value : null
        const workspaceResult = workspaceSettled.status === 'fulfilled' ? workspaceSettled.value : null
        const quickValue = quickResult?.value
        if (quickResult && (
          quickValue?.schemaVersion !== 1
          || !Array.isArray(quickValue.group2NameSuggestions)
          || !Array.isArray(quickValue.settingTypes)
          || !quickValue.greeting
        )) {
          loadErrors.push('Quick Settings có phiên bản hoặc cấu trúc không được hỗ trợ.')
        }

        const loadedQuickSettings: QuickSettingsV2 | null = quickResult
          && quickValue?.schemaVersion === 1
          && Array.isArray(quickValue.group2NameSuggestions)
          && Array.isArray(quickValue.settingTypes)
          && Boolean(quickValue.greeting)
          ? quickValue
          : null
        let workspace = workspaceResult?.value ?? null
        if (workspace && loadErrors.length === 0) {
          const retained = applyRetention(workspace, retentionPreferencesRef.current)
          if (retained.removedCount > 0) {
            await saveCalculationWorkspace(retained.workspace)
            if (cancelled) return
            workspace = retained.workspace
          }
        }
        const baseData = workspace?.data ?? createCalculationDataV2()
        const mergedData = initializeCoefficientDefaults(mergeQuickSettingsIntoCalculationData(baseData, loadedQuickSettings))
        const editor = workspace?.editorState

        if (loadErrors.length) {
          setStorageError(`${loadErrors.join(' ')} Đã khóa thao tác ghi để bảo vệ dữ liệu cũ.`)
          setStorageAvailable(false)
        }

        setData(mergedData)
        if (editor) {
          const validGroup1Id = editor.selectedGroup1Id && mergedData.groups1.some((item) => item.id === editor.selectedGroup1Id)
            ? editor.selectedGroup1Id
            : null
          const validGroup2Id = validGroup1Id && editor.selectedGroup2Id
            && mergedData.groups1.find((item) => item.id === validGroup1Id)?.groups2.some((item) => item.id === editor.selectedGroup2Id)
            ? editor.selectedGroup2Id
            : null
          setSelectedGroup1Id(validGroup1Id)
          setSelectedGroup2Id(validGroup2Id)
          setA4Mode(validGroup2Id && editor.a4Mode === 'group2' ? 'group2' : 'combined')
          setActiveSettingTypeId(editor.activeSettingTypeId)
          setDraftRowsByType(editor.draftRowsByType)
          setSavedRowDrafts(editor.savedRowDrafts)
          setDrawOneToSeven(editor.drawOneToSeven)
          setDrawGdb(editor.drawGdb)
          setDrawDraftGroup1Id(validGroup1Id)
          setDateDraft(editor.dateDraft || todayInputValue())
          setNewGroupName(editor.newGroupName)
          setShowNewGroupInput(editor.showNewGroupInput)
          setCalculationEnabled(editor.calculationEnabled)
          setActivePanel(editor.activePanel)
          setManagementPanel(editor.managementPanel)
        }
        setScreen('home')
        setToolbarVisible(false)

        if (loadedQuickSettings) {
          setQuickGroup2Suggestions(loadedQuickSettings.group2NameSuggestions)
          const migratedGreeting = normalizeGreetingSettings(loadedQuickSettings.greeting)
          setGreeting(migratedGreeting.text)
          setGreetingFontSize(migratedGreeting.fontSize)
          setGreetingFontFamily(migratedGreeting.fontFamily)
          setGreetingColor(migratedGreeting.color)
        } else {
          setQuickGroup2Suggestions(mergedData.groups1.flatMap((group1) => group1.groups2.map((group2) => group2.name)))
        }
        setPersistenceReady(true)
      } catch (error) {
        if (!cancelled) {
          setStorageError(error instanceof Error ? error.message : 'Không thể mở kho dữ liệu an toàn.')
          setStorageAvailable(false)
          setPersistenceReady(true)
        }
      } finally {
        if (hydrationTimeout !== undefined) window.clearTimeout(hydrationTimeout)
        if (!cancelled) setStorageHydrating(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const draggedTypeIdRef = useRef<EntityId | null>(null)
  const typeDropTargetRef = useRef<EntityId | null>(null)

  const selectedGroup1 = data.groups1.find((item) => item.id === selectedGroup1Id) ?? null
  const selectedGroup2 = selectedGroup1?.groups2.find((item) => item.id === selectedGroup2Id) ?? null
  const activeSettingType = data.settingTypes.find((item) => item.id === activeSettingTypeId) ?? null
  const editingType = data.settingTypes.find((item) => item.id === editingTypeId) ?? null

  const groupNameSuggestions = useMemo(() => {
    const names = new Map<string, string>()
    const addName = (rawName: string) => {
      const name = rawName.trim().normalize('NFC')
      const key = name.toLocaleLowerCase('vi-VN')
      if (name && !names.has(key)) names.set(key, name)
    }
    // Persisted suggestions are kept in recency order: newest names first.
    for (const rawName of quickGroup2Suggestions) addName(rawName)
    // Include every name currently present in every A4, without duplicating it.
    for (const group1 of data.groups1) {
      for (const group2 of group1.groups2) addName(group2.name)
    }
    return [...names.values()]
  }, [data.groups1, quickGroup2Suggestions])

  const configuredGroup2NameKeys = useMemo(() => new Set(data.groups1.flatMap((group1) => group1.groups2
    .filter((group2) => group2.groups3.length > 0)
    .map((group2) => group2NameKey(group2.name)))), [data.groups1])
  // User drag order takes priority; colors still identify configured names.
  const group2PickerNames = groupNameSuggestions
  const selectedGroup2NameKey = selectedGroup2 ? group2NameKey(selectedGroup2.name) : ''

  const drawOneToSevenCount = countDelimitedValues(drawOneToSeven)
  const drawOneToSevenValid = isOneToSevenDraftValid(drawOneToSeven)
  const drawGdbValid = !drawGdb.trim() || /^\d{5}$/.test(drawGdb.trim())
  const drawDraftError = getOneToSevenDraftError(drawOneToSeven)
    || (!drawGdbValid ? 'GĐB phải gồm đúng 5 chữ số.' : '')

  const a4Selection = useMemo<A4PageSelectionV2 | null>(() => {
    if (!selectedGroup1Id) return null
    if (a4Mode === 'group2') {
      if (!selectedGroup2Id) return null
      return { mode: 'group2', group1Id: selectedGroup1Id, group2Id: selectedGroup2Id }
    }
    return { mode: 'combined', group1Id: selectedGroup1Id }
  }, [a4Mode, selectedGroup1Id, selectedGroup2Id])

  const entryDockGroup = entryDock ? data.groups1.find((page) => page.id === entryDock.group1Id)?.groups2.find((group) => group.id === entryDock.group2Id) : null
  const entryDockType = entryDock ? data.settingTypes.find((type) => type.id === entryDock.typeId) : null
  const entryDockSaved = entryDock?.mode === 'saved' ? entryDockGroup?.groups3.find((row) => row.id === entryDock.rowId) : null
  const entryDockRow = entryDock?.mode === 'draft'
    ? draftRowsByType[`${entryDock.group2Id}:${entryDock.typeId}`]?.find((row) => row.id === entryDock.rowId) ?? null
    : entryDockSaved ? savedRowDrafts[entryDockSaved.id] ?? entryDockSaved : null
  const previewData = useMemo(() => buildEntryPreview(data, entryDock, entryDockRow ? { listing: entryDockRow.listing, point: entryDockRow.point } : null), [data, entryDock, entryDockRow])

  const projectionState = useMemo(() => {
    if (!a4Selection) return { projection: null, error: '' }
    try {
      return { projection: buildA4ProjectionV2(previewData, a4Selection), error: '' }
    } catch (error) {
      return {
        projection: null,
        error: error instanceof Error ? error.message : 'Không thể tạo A4.',
      }
    }
  }, [a4Selection, previewData])

  const calculationState = useMemo(() => {
    if (!calculationEnabled || !a4Selection) return { workspace: null, error: '' }
    // When the user has opened the result editor for this A4, never calculate
    // from stale persisted results while the current input draft is invalid.
    if (drawDraftGroup1Id === a4Selection.group1Id && drawDraftError) {
      return { workspace: null, error: drawDraftError }
    }
    try {
      return { workspace: calculateWorkspaceForA4V2(data, a4Selection), error: '' }
    } catch (error) {
      return {
        workspace: null,
        error: error instanceof Error ? error.message : 'Không thể tính toán.',
      }
    }
  }, [a4Selection, calculationEnabled, data, drawDraftGroup1Id, drawDraftError])

  const sortedDates = useMemo(
    () => data.groups1
      .map((group1, index) => ({ group1, index }))
      .sort((a, b) => dateSortValue(b.group1.dateLabel) - dateSortValue(a.group1.dateLabel) || b.index - a.index)
      .map(({ group1 }) => group1),
    [data.groups1],
  )

  const librarySummaryByGroup1Id = useMemo(() => {
    const summaries = new Map<EntityId, { d: number; t: number | null; difference: number | null } | null>()
    for (const group1 of data.groups1) {
      try {
        const workspace = calculateWorkspaceForA4V2(data, { mode: 'combined', group1Id: group1.id })
        summaries.set(group1.id, workspace.summary.totals)
      } catch {
        // Keep the A4 card visible even when one of its entries is incomplete.
        summaries.set(group1.id, null)
      }
    }
    return summaries
  }, [data])

  const quickSettingsSnapshot = useMemo(() => createQuickSettingsSnapshot(
    data,
    quickGroup2Suggestions,
    { text: greeting, fontSize: greetingFontSize, fontFamily: greetingFontFamily, color: greetingColor, icons: [] },
  ), [data, quickGroup2Suggestions, greeting, greetingFontSize, greetingFontFamily, greetingColor])

  const currentWorkspaceSnapshot = useMemo<CalculationWorkspaceV2>(() => ({
    schemaVersion: 2,
    data,
    editorState: {
      selectedGroup1Id,
      selectedGroup2Id,
      a4Mode,
      activeSettingTypeId,
      draftRowsByType,
      savedRowDrafts,
      drawOneToSeven,
      drawGdb,
      dateDraft,
      newGroupName,
      showNewGroupInput,
      calculationEnabled,
      activePanel,
      managementPanel,
    },
    updatedAt: 0,
  }), [data, selectedGroup1Id, selectedGroup2Id, a4Mode, activeSettingTypeId, draftRowsByType, savedRowDrafts, drawOneToSeven, drawGdb, dateDraft, newGroupName, showNewGroupInput, calculationEnabled, activePanel, managementPanel])
  const currentWorkspaceSignature = JSON.stringify(currentWorkspaceSnapshot)

  useEffect(() => {
    if (!persistenceReady || !storageAvailable || retentionBusy) return
    const signature = JSON.stringify(quickSettingsSnapshot)
    if (signature === lastQuickSettingsSignatureRef.current) return
    const timeout = window.setTimeout(() => {
      void saveQuickSettings(quickSettingsSnapshot).then(() => {
        lastQuickSettingsSignatureRef.current = signature
      }).catch((error: unknown) => {
        setStorageError(error instanceof Error ? error.message : 'Không thể lưu Quick Settings.')
      })
    }, 600)
    return () => window.clearTimeout(timeout)
  }, [persistenceReady, storageAvailable, retentionBusy, quickSettingsSnapshot])

  useEffect(() => {
    if (!persistenceReady || !storageAvailable || retentionBusy) return
    if (currentWorkspaceSignature === lastWorkspaceSnapshotSignatureRef.current) return
    const revision = ++workspaceSaveRevisionRef.current
    const timeout = window.setTimeout(() => {
      void saveCalculationWorkspace({ ...currentWorkspaceSnapshot, updatedAt: Date.now() }).then(() => {
        if (revision !== workspaceSaveRevisionRef.current) return
        lastWorkspaceSnapshotSignatureRef.current = currentWorkspaceSignature
        setStorageError('')
      }).catch((error: unknown) => {
        if (revision !== workspaceSaveRevisionRef.current) return
        setStorageError(error instanceof Error ? error.message : 'Không thể tự động lưu A4 Workspace.')
      })
    }, 600)
    return () => window.clearTimeout(timeout)
  }, [persistenceReady, storageAvailable, retentionBusy, currentWorkspaceSnapshot, currentWorkspaceSignature])

  useEffect(() => {
    if (!persistenceReady || !storageAvailable || retentionBusy) return
    const flushWorkspace = () => {
      if (currentWorkspaceSignature === lastWorkspaceSnapshotSignatureRef.current) return
      const revision = ++workspaceSaveRevisionRef.current
      void saveCalculationWorkspace({ ...currentWorkspaceSnapshot, updatedAt: Date.now() }).then(() => {
        if (revision !== workspaceSaveRevisionRef.current) return
        lastWorkspaceSnapshotSignatureRef.current = currentWorkspaceSignature
        setStorageError('')
      }).catch((error: unknown) => {
        if (revision !== workspaceSaveRevisionRef.current) return
        setStorageError(error instanceof Error ? error.message : 'Không thể lưu A4 Workspace khi ứng dụng chuyển nền.')
      })
    }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flushWorkspace() }
    window.addEventListener('pagehide', flushWorkspace)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushWorkspace)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [persistenceReady, storageAvailable, retentionBusy, currentWorkspaceSnapshot, currentWorkspaceSignature])

  useEffect(() => {
    if (!persistenceReady || !storageAvailable || retentionBusy) return
    const signature = JSON.stringify(quickSettingsSnapshot)
    const flushQuickSettings = () => {
      if (signature === lastQuickSettingsSignatureRef.current) return
      void saveQuickSettings(quickSettingsSnapshot).then(() => {
        lastQuickSettingsSignatureRef.current = signature
      }).catch((error: unknown) => {
        setStorageError(error instanceof Error ? error.message : 'Không thể lưu Quick Settings khi ứng dụng chuyển nền.')
      })
    }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flushQuickSettings() }
    window.addEventListener('pagehide', flushQuickSettings)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushQuickSettings)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [persistenceReady, storageAvailable, retentionBusy, quickSettingsSnapshot])

  const activeDraftKey = selectedGroup2 && activeSettingType
    ? `${selectedGroup2.id}:${activeSettingType.id}`
    : ''
  const selectedDraftRows = activeDraftKey ? (draftRowsByType[activeDraftKey] ?? []) : []
  const savedEntriesForType = selectedGroup2 && activeSettingType
    ? selectedGroup2.groups3.filter((item) => item.settingTypeId === activeSettingType.id)
    : []

  useEffect(() => {
    if (!persistenceReady || !storageAvailable || !preferences.retention.enabled) return
    let disposed = false
    const prune = async () => {
      if (disposed || retentionRunningRef.current) return
      const retained = applyRetention(currentWorkspaceSnapshot, preferences)
      if (!retained.removedCount) return
      retentionRunningRef.current = true
      setRetentionBusy(true)
      try {
        await saveCalculationWorkspace(retained.workspace)
        if (disposed) return
        setData(retained.workspace.data)
        setDraftRowsByType(retained.workspace.editorState.draftRowsByType)
        setSavedRowDrafts(retained.workspace.editorState.savedRowDrafts)
        if (currentWorkspaceSnapshot.editorState.selectedGroup1Id && !retained.workspace.editorState.selectedGroup1Id) {
          setEntryDock(null)
          setSelectedGroup1Id(null); setSelectedGroup2Id(null); setActiveSettingTypeId(null)
          setA4Mode('combined'); setDrawOneToSeven(''); setDrawGdb(''); setDrawDraftGroup1Id(null)
          setDateDraft(todayInputValue()); setNewGroupName(''); setShowNewGroupInput(false)
          setCalculationEnabled(false); setActivePanel(null); setManagementPanel(null)
          setScreen('home'); setToolbarVisible(false)
        }
      } catch (error) {
        if (!disposed) setStorageError(error instanceof Error ? error.message : 'Không thể dọn A4 hết hạn.')
      } finally {
        retentionRunningRef.current = false
        setRetentionBusy(false)
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void prune() }
    void prune()
    const timer = window.setInterval(() => void prune(), 60000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [currentWorkspaceSnapshot, preferences, persistenceReady, storageAvailable])

  useEffect(() => {
    if (draftListingFocusToken === 0 || !activeSettingTypeId || !selectedGroup2Id) return
    const frame = window.requestAnimationFrame(() => {
      const input = draftListingInputRef.current
      if (!input) return
      input.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [draftListingFocusToken, activeSettingTypeId, selectedGroup2Id, selectedDraftRows.length])

  function returnToLibrary() {
    setEntryDock(null)
    if (activePanel === 'results' && !persistDrawDataDraft()) return
    // Keep the current A4 and editor state. The library view is only a screen
    // change; it must never delete an empty or unfinished A4 record.
    setScreen('home')
    setToolbarVisible(false)
  }

  function handlePageBack() {
    setEntryDock(null)
    // Back from an individual Group2 view returns to the same A4 in combined mode.
    if (screen === 'page' && a4Mode === 'group2') {
      setA4Mode('combined')
      setSelectedGroup2Id(null)
      setToolbarVisible(true)
      setActivePanel(null)
      setManagementPanel(null)
      clearFeedback()
      return
    }
    returnToLibrary()
  }

  function applyPageFit(mode: 'width' | 'page') {
    setPageFitMode('width')
    setZoom(1)
    if (mode === 'page') setPaperFitRequest((value) => value + 1)
  }

  function resetPageToWidthFit() { applyPageFit('width') }

  function deleteA4Record(group1: Group1) {
    if (!window.confirm(`Xóa toàn bộ dữ liệu A4 ngày ${group1.dateLabel}? Thao tác này không thể hoàn tác.`)) return
    runAction(() => {
      setData((current) => deleteGroup1V2(current, group1.id))
      if (selectedGroup1Id === group1.id) {
        setSelectedGroup1Id(null)
        setSelectedGroup2Id(null)
        setActiveSettingTypeId(null)
        setDraftRowsByType({})
        setSavedRowDrafts({})
        setDrawOneToSeven('')
        setDrawGdb('')
        setDrawDraftGroup1Id(null)
        setDateDraft(todayInputValue())
        setNewGroupName('')
        setShowNewGroupInput(false)
        setCalculationEnabled(false)
        setActivePanel(null)
        setManagementPanel(null)
      }
    })
  }

  function insertGreetingIcon(icon: string) {
    const input = greetingInputRef.current
    const start = input?.selectionStart ?? greeting.length
    const end = input?.selectionEnd ?? greeting.length
    const nextGreeting = `${greeting.slice(0, start)}${icon}${greeting.slice(end)}`
    setGreeting(nextGreeting)
    window.requestAnimationFrame(() => {
      const caret = start + icon.length
      input?.focus()
      input?.setSelectionRange(caret, caret)
    })
  }

  function clearFeedback() {
    setErrorMessage('')
    setSuccessMessage('')
  }

  function runAction(action: () => void): boolean {
    clearFeedback()
    try {
      action()
      return true
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.')
      return false
    }
  }

  function openDate(group1Id: EntityId) {
    const resumeSameA4 = selectedGroup1Id === group1Id
    resetPageToWidthFit()
    setSelectedGroup1Id(group1Id)
    if (!resumeSameA4) {
      setSelectedGroup2Id(null)
      setDrawDraftGroup1Id(null)
      setA4Mode('combined')
      setCalculationEnabled(false)
      setActivePanel(null)
      setManagementPanel(null)
      setActiveSettingTypeId(null)
      setDrawOneToSeven('')
      setDrawGdb('')
      setDateDraft(todayInputValue())
      setNewGroupName('')
      setShowNewGroupInput(false)
    }
    setScreen('page')
    setToolbarVisible(true)
    clearFeedback()
  }

  function createTodayA4() {
    runAction(() => {
      resetPageToWidthFit()
      const today = todayInputValue()
      const label = dateLabelFromInput(today)
      const group1: Group1 = {
        kind: 'group1',
        id: makeId(),
        dateLabel: label,
        drawData: { oneToSeven: [], gdb: '' },
        groups2: [],
      }
      setData(addGroup1V2(data, group1))
      setSelectedGroup1Id(group1.id)
      setSelectedGroup2Id(null)
      setDrawDraftGroup1Id(null)
      setManagementPanel(null)
      setA4Mode('combined')
      setCalculationEnabled(false)
      setDateDraft(today)
      setScreen('page')
      setToolbarVisible(true)
      setActivePanel('edit')
      setShowNewGroupInput(false)
      setNewGroupName('')
      setActiveSettingTypeId(null)
      setSuccessMessage('')
    })
  }

  function enterEditMode() {
    if (!selectedGroup1) return
    setToolbarVisible(true)
    setActivePanel('edit')
    setManagementPanel(null)
    setDateDraft(dateInputFromLabel(selectedGroup1.dateLabel))
    setShowNewGroupInput(false)
    clearFeedback()
  }

  function chooseView(mode: 'combined' | 'group2', group2Id?: EntityId) {
    if (mode === 'group2' && !group2Id) return
    setEntryDock(null)
    // Entering a view (including a specific Group2) always starts at fit-width.
    resetPageToWidthFit()
    setA4Mode(mode)
    if (group2Id) setSelectedGroup2Id(group2Id)
    setToolbarVisible(false)
    setActivePanel(null)
    setManagementPanel(null)
    clearFeedback()
  }

  function reorderGroup2Names(source: string, target: string) {
    const names = moveGroup2Name(groupNameSuggestions, source, target)
    setQuickGroup2Suggestions(names)
    setData((current) => orderGroups2(current, names))
  }

  function chooseGroup2ByName(name: string) {
    runAction(() => {
      if (!selectedGroup1) throw new Error('Không tìm thấy ngày đang mở.')
      const normalized = name.trim().normalize('NFC')
      if (!normalized) throw new Error('Tên nhóm không được để trống.')
      const key = normalized.toLocaleLowerCase('vi-VN')
      const existsAnywhere = data.groups1.some((group1) => group1.groups2.some((group2) =>
        group2.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === key,
      ))
      const alreadySuggested = quickGroup2Suggestions.some((item) =>
        item.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === key,
      )
      if (!existsAnywhere && !alreadySuggested) {
        setQuickGroup2Suggestions((current) => [normalized, ...current])
      }

      const existing = selectedGroup1.groups2.find(
        (item) => item.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === key,
      )
      if (existing) {
        setSelectedGroup2Id(existing.id)
      } else {
        const group2: Group2 = { kind: 'group2', id: makeId(), name: normalized, groups3: [] }
        setData(addGroup2V2(data, selectedGroup1.id, group2))
        setSelectedGroup2Id(group2.id)
      }
      setActiveSettingTypeId(null)
    })
  }

  function addNewGroup2(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const normalizedName = newGroupName.trim()
    setNewGroupName('')
    setShowNewGroupInput(false)
    if (!normalizedName) return
    chooseGroup2ByName(normalizedName)
  }

  function group2NameHasSettings(name: string): boolean {
    const key = name.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
    return data.groups1.some((group1) => group1.groups2.some((group2) =>
      group2.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === key && group2.groups3.length > 0,
    ))
  }

  function group2NameHasUncommittedInput(name: string): boolean {
    const key = name.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
    const matchingIds = new Set(data.groups1.flatMap((group1) => group1.groups2
      .filter((group2) => group2.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === key)
      .map((group2) => group2.id)))
    return Object.entries(draftRowsByType).some(([draftKey, rows]) => {
      const [group2Id, typeId] = draftKey.split(':', 2)
      if (!matchingIds.has(group2Id)) return false
      const type = data.settingTypes.find((item) => item.id === typeId)
      const defaultD = type?.defaultCoefficientD ?? ''
      const defaultT = type?.defaultCoefficientT ?? ''
      return rows.some((row) =>
        Boolean(row.listing.trim() || row.point.trim()
          || row.coefficientD !== defaultD || row.coefficientT !== defaultT),
      )
    })
  }

  function removeGroup2NameFromAllA4(name: string) {
    const normalized = name.trim().normalize('NFC')
    const key = normalized.toLocaleLowerCase('vi-VN')
    if (!key) return
    if (group2NameHasSettings(normalized)) return
    if (group2NameHasUncommittedInput(normalized)) {
      setErrorMessage('Tên này còn nội dung đang nhập dở nên chưa thể xóa.')
      return
    }

    const matchingIds = new Set(data.groups1.flatMap((group1) => group1.groups2
      .filter((group2) => group2.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === key)
      .map((group2) => group2.id)))

    runAction(() => {
      let nextData = data
      for (const group1 of data.groups1) {
        for (const group2 of group1.groups2) {
          if (group2.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === key && group2.groups3.length === 0) {
            nextData = deleteGroup2V2(nextData, group1.id, group2.id)
          }
        }
      }
      setData(nextData)
      setQuickGroup2Suggestions((current) => current.filter((item) =>
        item.trim().normalize('NFC').toLocaleLowerCase('vi-VN') !== key,
      ))
      setDraftRowsByType((current) => Object.fromEntries(Object.entries(current).filter(([draftKey]) => {
        const group2Id = draftKey.slice(0, draftKey.indexOf(':'))
        return !matchingIds.has(group2Id)
      })))
      if (selectedGroup2Id && matchingIds.has(selectedGroup2Id)) {
        setSelectedGroup2Id(null)
        setActiveSettingTypeId(null)
      }
    })
  }

  function startGroupNameDrag(event: ReactPointerEvent<HTMLButtonElement>, name: string) {
    if (event.button !== 0) return
    event.preventDefault()
    groupDragRef.current = { source: name, target: name }
    setDraggingGroupName(name); setDropGroupName(name)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function trackGroupNameDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!groupDragRef.current) return
    const name = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sort-group-name]')?.dataset.sortGroupName
    if (name) { groupDragRef.current.target = name; setDropGroupName(name) }
  }

  function finishGroupNameDrag(cancelled = false) {
    const drag = groupDragRef.current
    groupDragRef.current = null; setDraggingGroupName(''); setDropGroupName('')
    if (drag && !cancelled) reorderGroup2Names(drag.source, drag.target)
  }

  function startSettingTypeDrag(event: ReactPointerEvent<HTMLButtonElement>, typeId: EntityId) {
    if (event.button !== 0) return
    event.preventDefault()
    draggedTypeIdRef.current = typeId
    typeDropTargetRef.current = typeId
    setDraggingTypeId(typeId)
    setTypeDropTargetId(typeId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function trackSettingTypeDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggedTypeIdRef.current) return
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sort-type]')
    const targetId = target?.dataset.sortType ?? null
    if (targetId && data.settingTypes.some((item) => item.id === targetId)) {
      typeDropTargetRef.current = targetId
      setTypeDropTargetId(targetId)
    }
  }

  function finishSettingTypeDrag() {
    const sourceId = draggedTypeIdRef.current
    const targetId = typeDropTargetRef.current
    if (sourceId && targetId && sourceId !== targetId) {
      const targetIndex = data.settingTypes.findIndex((item) => item.id === targetId)
      if (targetIndex >= 0) runAction(() => setData(reorderSettingType(data, sourceId, targetIndex)))
    }
    draggedTypeIdRef.current = null
    typeDropTargetRef.current = null
    setDraggingTypeId(null)
    setTypeDropTargetId(null)
  }

  function cancelSettingTypeDrag() {
    draggedTypeIdRef.current = null
    typeDropTargetRef.current = null
    setDraggingTypeId(null)
    setTypeDropTargetId(null)
  }

  function ensureOneDraftRow(rows: DraftRow[], type: SettingTypeDefinition): DraftRow[] {
    return rows.length ? rows : [createDraftRow(type)]
  }

  function selectSettingType(typeId: EntityId) {
    const type = data.settingTypes.find((item) => item.id === typeId)
    if (!type || !selectedGroup2) return
    setActiveSettingTypeId(typeId)
    const draftKey = `${selectedGroup2.id}:${typeId}`
    setDraftRowsByType((current) => {
      if (current[draftKey]?.length) return current
      return { ...current, [draftKey]: [createDraftRow(type)] }
    })
    setDraftListingFocusToken((current) => current + 1)
    clearFeedback()
  }


  function updateDraftField(typeId: EntityId, rowId: string, field: keyof Omit<DraftRow, 'id'>, value: string) {
    if (!selectedGroup2) return
    const type = data.settingTypes.find((item) => item.id === typeId)
    if (!type) return
    const draftKey = `${selectedGroup2.id}:${typeId}`
    const currentRows = draftRowsByType[draftKey] ?? [createDraftRow(type)]
    const updatedRows = currentRows.map((item) => item.id === rowId ? { ...item, [field]: value } : item)
    setDraftRowsByType((current) => ({
      ...current,
      [draftKey]: ensureOneDraftRow(updatedRows, type),
    }))
  }

  function normalizeDraftListing(typeId: EntityId, rowId: string, value: string) {
    try {
      const type = data.settingTypes.find((item) => item.id === typeId)
      const normalized = parseSettingNumberListV2(value, type?.formulaId).join(', ')
      updateDraftField(typeId, rowId, 'listing', normalized)
    } catch {
      // Keep invalid input visible; the Add action will explain the validation error.
    }
  }

  function commitDraftRow(typeId: EntityId, rowId: string) {
    if (!selectedGroup1 || !selectedGroup2) return
    const type = data.settingTypes.find((item) => item.id === typeId)
    if (!type) return
    const draftKey = `${selectedGroup2.id}:${typeId}`
    const row = (draftRowsByType[draftKey] ?? []).find((item) => item.id === rowId)
    if (!row) return
    try { parseSettingNumberListV2(row.listing, type.formulaId); parsePointTextV2(row.point) } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Dữ liệu chưa hợp lệ.'); return }
    if (!isDraftComplete(row, type)) {
      setErrorMessage(type.formulaId === 'xa' || type.formulaId === 'xb'
        ? 'XA/XB cần 2–5 số, Điểm và đủ hệ số theo số lượng số trong danh sách.'
        : type.formulaId === 'da' || type.formulaId === 'db'
          ? 'ĐA/ĐB cần danh sách toàn số 2 chữ số hoặc toàn số 3 chữ số, Điểm và đủ hệ số tương ứng.'
          : 'Hãy nhập danh sách, điểm và cấu hình hệ số Đánh/Trúng cho thiết lập này.')
      return
    }

    const listingValues = parseSettingNumberListV2(row.listing, type.formulaId)
    const duplicates = findExactDuplicates(listingValues)
    if (duplicates.length && !window.confirm(`Danh sách có số bị lặp: ${duplicates.join(', ')}. Bạn có chắc chắn muốn thêm các số trùng này không?`)) return

    runAction(() => {
      const normalizedListing = listingValues.join(', ')
      const group3 = createGroup3FromDefaults(type, makeId(), normalizedListing, row.point.trim())
      if (!isProfileCoefficientFormula(type.formulaId)) {
        group3.coefficientD = row.coefficientD.trim()
        group3.coefficientT = row.coefficientT.trim()
      }
      const nextData = addGroup3V2(data, selectedGroup1.id, selectedGroup2.id, group3)
      setData(nextData)
      const nextType = nextData.settingTypes.find((item) => item.id === typeId) ?? type
      const nextDraft = createDraftRow(nextType)
      setDraftRowsByType((current) => ({ ...current, [draftKey]: [nextDraft] }))
      if (entryDock?.mode === 'draft') setEntryDock({ ...entryDock, rowId: nextDraft.id, field: 'listing' })
      else setDraftListingFocusToken((current) => current + 1)
      setSuccessMessage('')
    })
  }

  function updateSavedGroup3(group3: Group3, field: keyof SavedRowDraft, value: string) {
    const previous = savedRowDrafts[group3.id] ?? {
      listing: group3.listing,
      point: group3.point,
      coefficientD: group3.coefficientD,
      coefficientT: group3.coefficientT,
    }
    setSavedRowDrafts((current) => ({ ...current, [group3.id]: { ...previous, [field]: value } }))
  }

  function commitSavedGroup3(group3: Group3) {
    if (!selectedGroup1 || !selectedGroup2) return false
    const draft = savedRowDrafts[group3.id]
    if (!draft) return true

    let committed = false
    runAction(() => {
      const type = data.settingTypes.find((item) => item.id === group3.settingTypeId)
      if (!type) throw new Error('Không tìm thấy nhóm thiết lập của bản ghi này.')
      const listingValues = parseSettingNumberListV2(draft.listing, type.formulaId)
      const listing = listingValues.join(', ')
      parsePointTextV2(draft.point)
      const usesProfileCoefficients = isProfileCoefficientFormula(type.formulaId)
      const duplicates = findExactDuplicates(listingValues)
      if (duplicates.length && !window.confirm(`Danh sách có số bị lặp: ${duplicates.join(', ')}. Bạn có chắc chắn muốn lưu các số trùng này không?`)) return
      if (usesProfileCoefficients) {
        const profileKey = getCoefficientProfileKey(type.formulaId, listingValues)
        if (!profileKey) throw new Error(type.formulaId === 'da' || type.formulaId === 'db'
          ? 'ĐA/ĐB chỉ nhận danh sách toàn số 2 chữ số hoặc toàn số 3 chữ số.'
          : 'XA/XB yêu cầu đúng 2, 3, 4 hoặc 5 số trong ô Liệt kê.')
        const rowPair = group3.coefficientsByCount?.[profileKey]
        const defaultPair = type.defaultCoefficientsByCount?.[profileKey]
        const coefficientD = rowPair?.coefficientD || defaultPair?.coefficientD || ''
        const coefficientT = rowPair?.coefficientT || defaultPair?.coefficientT || ''
        if (!coefficientD || !coefficientT) {
          const label = type.formulaId === 'da' || type.formulaId === 'db' ? `${profileKey} chữ số` : `${profileKey} số`
          throw new Error(`Chưa cài đủ hệ số Đánh/Trúng cho danh sách ${label} trong ${type.name}.`)
        }
        parseCoefficientTextV2(coefficientD, 'Hệ số Đánh')
        parseCoefficientTextV2(coefficientT, 'Hệ số Trúng')
      } else {
        parseCoefficientTextV2(draft.coefficientD, 'Hệ số Đánh')
        parseCoefficientTextV2(draft.coefficientT, 'Hệ số Trúng')
      }
      setData(updateGroup3V2(data, selectedGroup1.id, selectedGroup2.id, group3.id, {
        listing,
        point: draft.point.trim(),
        ...(usesProfileCoefficients ? {} : {
          coefficientD: draft.coefficientD.trim(),
          coefficientT: draft.coefficientT.trim(),
        }),
      }))
      committed = true
      setSavedRowDrafts((current) => {
        const next = { ...current }
        delete next[group3.id]
        return next
      })
    })
    return committed
  }

  function removeGroup3(group3Id: EntityId) {
    if (!selectedGroup1 || !selectedGroup2) return
    runAction(() => setData(deleteGroup3V2(data, selectedGroup1.id, selectedGroup2.id, group3Id)))
  }

  function persistDateDraft(): boolean {
    if (!selectedGroup1) return true
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDraft)) {
      setErrorMessage('Hãy chọn ngày hợp lệ trước khi đóng cửa sổ.')
      return false
    }
    const label = dateLabelFromInput(dateDraft)
    setData((current) => ({
      ...current,
      groups1: current.groups1.map((item) => item.id === selectedGroup1.id ? { ...item, dateLabel: label } : item),
    }))
    setErrorMessage('')
    return true
  }

  function openResultsPanel() {
    if (selectedGroup1 && drawDraftGroup1Id !== selectedGroup1.id) {
      setDrawOneToSeven(selectedGroup1.drawData.oneToSeven.join(', '))
      setDrawGdb(selectedGroup1.drawData.gdb)
      setDrawDraftGroup1Id(selectedGroup1.id)
    }
    setActivePanel('results')
    clearFeedback()
  }

  function persistOneToSevenDraft(): boolean {
    if (!selectedGroup1) return true
    try {
      const oneToSeven = parseOneToSevenTextV2(drawOneToSeven)
      setDrawOneToSeven(oneToSeven.join(', '))
      setData((current) => {
        const group1 = current.groups1.find((item) => item.id === selectedGroup1.id)
        if (!group1) return current
        return updateGroup1DrawDataV2(current, selectedGroup1.id, {
          oneToSeven,
          gdb: group1.drawData.gdb,
        })
      })
      setErrorMessage('')
      return true
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Dữ liệu 1–7 không hợp lệ.')
      return false
    }
  }

  function persistGdbDraft(): boolean {
    if (!selectedGroup1) return true
    const gdb = drawGdb.trim()
    if (gdb && !/^\d{5}$/.test(gdb)) {
      setErrorMessage('GĐB phải gồm đúng 5 chữ số.')
      return false
    }
    setDrawGdb(gdb)
    setData((current) => {
      const group1 = current.groups1.find((item) => item.id === selectedGroup1.id)
      if (!group1) return current
      return updateGroup1DrawDataV2(current, selectedGroup1.id, {
        oneToSeven: group1.drawData.oneToSeven,
        gdb,
      })
    })
    setErrorMessage('')
    return true
  }

  function persistDrawDataDraft(): boolean {
    if (!selectedGroup1) return true
    try {
      const oneToSeven = parseOneToSevenTextV2(drawOneToSeven)
      const gdb = drawGdb.trim()
      if (gdb && !/^\d{5}$/.test(gdb)) throw new Error('GĐB phải gồm đúng 5 chữ số.')
      setDrawOneToSeven(oneToSeven.join(', '))
      setDrawGdb(gdb)
      setData((current) => updateGroup1DrawDataV2(current, selectedGroup1.id, { oneToSeven, gdb }))
      setErrorMessage('')
      return true
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Dữ liệu kết quả không hợp lệ.')
      // Do not commit malformed values, but let the user leave the panel.
      // calculationState keeps results suppressed for this A4 until corrected.
      return true
    }
  }

  function closeActivePanel(): boolean {
    if (activePanel === 'results' && !persistDrawDataDraft()) return false
    setActivePanel(null)
    setManagementPanel(null)
    return true
  }

  function openTypesManagement() {
    setTypeSettingsOpen(false)
    setPublisherAuthorized(false)
    setPublisherPromptOpen(false)
    const first = data.settingTypes[0]
    if (first) {
      setEditingTypeId(first.id)
      setEditingTypeName(first.name)
      setEditingTypeD(first.defaultCoefficientD ?? '')
      setEditingTypeT(first.defaultCoefficientT ?? '')
      setEditingTypeCoefficientsByCount(createCountCoefficientDraft(first))
    }
    setManagementPanel('types')
  }

  function persistEditingType(): boolean {
    if (!editingType) return true
    const nextName = editingTypeName.trim()
    const nextD = editingTypeD.trim()
    const nextT = editingTypeT.trim()
    const currentD = editingType.defaultCoefficientD ?? ''
    const currentT = editingType.defaultCoefficientT ?? ''
    const nameChanged = nextName !== editingType.name
    const usesProfileCoefficients = isProfileCoefficientFormula(editingType.formulaId)
    const profileKeys = getCoefficientProfileKeys(editingType.formulaId)
    const nextCoefficientMap: Partial<Record<ListingCountKey, CoefficientPairText>> = {}
    let countCoefficientsChanged = false

    if (usesProfileCoefficients) {
      for (const key of profileKeys) {
        const nextPair = editingTypeCoefficientsByCount[key]
        const nextCountD = nextPair.coefficientD.trim()
        const nextCountT = nextPair.coefficientT.trim()
        const currentPair = editingType.defaultCoefficientsByCount?.[key]
        const currentCountD = currentPair?.coefficientD ?? ''
        const currentCountT = currentPair?.coefficientT ?? ''

        if ((nextCountD === '') !== (nextCountT === '')) {
          const profileLabel = editingType.formulaId === 'da' || editingType.formulaId === 'db' ? `${key} chữ số` : `${key} số trong danh sách`
          setErrorMessage(`Hãy nhập đủ hệ số Đánh và Trúng cho loại ${profileLabel}.`)
          return false
        }
        if (nextCountD) {
          try {
            const profileLabel = editingType.formulaId === 'da' || editingType.formulaId === 'db' ? `${key} chữ số` : `${key} số`
            parseCoefficientTextV2(nextCountD, `Hệ số Đánh (${profileLabel})`)
            parseCoefficientTextV2(nextCountT, `Hệ số Trúng (${profileLabel})`)
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : `Hệ số cho danh sách ${key} số không hợp lệ.`)
            return false
          }
        }
        if (nextCountD !== currentCountD || nextCountT !== currentCountT) countCoefficientsChanged = true
        nextCoefficientMap[key] = {
          coefficientD: nextCountD || null,
          coefficientT: nextCountT || null,
        }
      }
    }

    const coefficientChanged = usesProfileCoefficients
      ? countCoefficientsChanged
      : nextD !== currentD || nextT !== currentT
    if (!nameChanged && !coefficientChanged) return true
    if (coefficientChanged && !publisherAuthorized) { setErrorMessage('Cần PIN nhà phát hành để thay hệ số.'); return false }

    try {
      let updated = renameSettingType(data, editingType.id, nextName)
      if (usesProfileCoefficients && countCoefficientsChanged) {
        updated = updateSettingTypeDefaults(updated, editingType.id, { coefficientsByCount: nextCoefficientMap })
        const savedCountMap = Object.fromEntries(profileKeys.map((key) => {
          const pair = nextCoefficientMap[key]
          return [key, {
            coefficientD: pair?.coefficientD ?? '',
            coefficientT: pair?.coefficientT ?? '',
          }]
        }))
        updated = {
          ...updated,
          groups1: updated.groups1.map((group1) => ({
            ...group1,
            groups2: group1.groups2.map((group2) => ({
              ...group2,
              groups3: group2.groups3.map((group3) => group3.settingTypeId === editingType.id
                ? { ...group3, coefficientsByCount: savedCountMap }
                : group3),
            })),
          })),
        }
      } else if (!usesProfileCoefficients && coefficientChanged) {
        if (!nextD || !nextT) {
          throw new Error('Hãy nhập đủ hệ số Đánh và Trúng trước khi chuyển sang thiết lập khác.')
        }
        parseCoefficientTextV2(nextD, 'Hệ số Đánh')
        parseCoefficientTextV2(nextT, 'Hệ số Trúng')
        updated = updateSettingTypeDefaults(updated, editingType.id, {
          coefficientD: nextD,
          coefficientT: nextT,
        })
        updated = {
          ...updated,
          groups1: updated.groups1.map((group1) => ({
            ...group1,
            groups2: group1.groups2.map((group2) => ({
              ...group2,
              groups3: group2.groups3.map((group3) => group3.settingTypeId === editingType.id
                ? { ...group3, coefficientD: nextD, coefficientT: nextT }
                : group3),
            })),
          })),
        }
        setDraftRowsByType((current) => Object.fromEntries(
          Object.entries(current).map(([key, rows]) => [
            key,
            key.endsWith(`:${editingType.id}`)
              ? rows.map((row) => ({ ...row, coefficientD: nextD, coefficientT: nextT }))
              : rows,
          ]),
        ))
        const affectedGroup3Ids = updated.groups1.flatMap((group1) => group1.groups2.flatMap((group2) => (
          group2.groups3.filter((group3) => group3.settingTypeId === editingType.id).map((group3) => group3.id)
        )))
        setSavedRowDrafts((current) => {
          const next = { ...current }
          affectedGroup3Ids.forEach((id) => {
            const draft = next[id]
            if (draft) next[id] = { ...draft, coefficientD: nextD, coefficientT: nextT }
          })
          return next
        })
      }
      setData(updated)
      setErrorMessage('')
      return true
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu thiết lập.')
      return false
    }
  }

  function resetSettingTypeName() {
    if (!publisherAuthorized) { setPublisherPromptOpen(true); return }
    const currentEditingType = data.settingTypes.find((item) => item.id === editingTypeId)
    if (!currentEditingType) return

    const defaultName = defaultSettingTypeName(currentEditingType)
    try {
      const updated = renameSettingType(data, currentEditingType.id, defaultName)
      setData(updated)
      setEditingTypeName(defaultName)
      setSuccessMessage(`Đã khôi phục tên ${defaultName}.`)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể khôi phục tên mặc định.')
    }
  }

  function selectTypeForEditing(type: SettingTypeDefinition) {
    if (type.id === editingTypeId || !persistEditingType()) return
    setEditingTypeId(type.id)
    setEditingTypeName(type.name)
    setEditingTypeD(type.defaultCoefficientD ?? '')
    setEditingTypeT(type.defaultCoefficientT ?? '')
    setEditingTypeCoefficientsByCount(createCountCoefficientDraft(type))
  }

  function updateCountCoefficient(key: ListingCountKey, field: 'coefficientD' | 'coefficientT', value: string) {
    setEditingTypeCoefficientsByCount((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }))
  }

  function closeTypeSettings() {
    if (!persistEditingType()) return
    setTypeSettingsOpen(false)
    setPublisherAuthorized(false)
  }

  function closeManagementPanel() {
    if (managementPanel === 'types' && !persistEditingType()) return
    if (managementPanel === 'date' && !persistDateDraft()) return
    setTypeSettingsOpen(false)
    setPublisherAuthorized(false)
    setPublisherPromptOpen(false)
    setManagementPanel(null)
  }

  async function saveA4AsImage() {
    if (!a4Selection) {
      setErrorMessage('Không có trang A4 hợp lệ để xuất ảnh.')
      return
    }
    try {
      // If the result editor is open, commit its current values before rendering
      // so the exported image reflects exactly what is visible in the inputs.
      let exportData = data
      let exportCalculationEnabled = calculationEnabled
      if (activePanel === 'results' && selectedGroup1) {
        try {
          const oneToSeven = parseOneToSevenTextV2(drawOneToSeven)
          const gdb = drawGdb.trim()
          if (gdb && !/^\d{5}$/.test(gdb)) throw new Error('GĐB phải gồm đúng 5 chữ số.')
          setDrawOneToSeven(oneToSeven.join(', '))
          setDrawGdb(gdb)
          exportData = updateGroup1DrawDataV2(data, selectedGroup1.id, { oneToSeven, gdb })
          setData(exportData)
        } catch (error) {
          exportCalculationEnabled = false
          setErrorMessage(error instanceof Error ? error.message : 'Dữ liệu kết quả không hợp lệ; ảnh sẽ không kèm kết quả tính toán.')
        }
      }
      if (drawDraftGroup1Id === selectedGroup1?.id && drawDraftError) exportCalculationEnabled = false

      const exportProjection = buildA4ProjectionV2(exportData, a4Selection)
      const exportWorkspace = exportCalculationEnabled
        ? calculateWorkspaceForA4V2(exportData, a4Selection)
        : undefined
      const files = await exportA4Images(
        exportProjection,
        exportWorkspace?.summary,
        exportWorkspace?.settingResults ?? EMPTY_RESULTS,
        exportCalculationEnabled,
      )
      const shareData = { files, title: `A4-${selectedGroup1?.dateLabel ?? 'export'}` }
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        files.forEach((file, index) => {
          window.setTimeout(() => {
            const url = URL.createObjectURL(file)
            const link = document.createElement('a')
            link.href = url
            link.download = file.name
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.setTimeout(() => URL.revokeObjectURL(url), 5000)
          }, index * 250)
        })
      }
      setSuccessMessage(`Đã tạo ${files.length} ảnh A4 để lưu hoặc chia sẻ.`)
      setErrorMessage('')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setErrorMessage(error instanceof Error ? error.message : 'Không thể xuất ảnh A4.')
    }
  }

  function openEntryDock(mode: 'saved' | 'draft', rowId: string, typeId: string, field: 'listing' | 'point' = 'listing') {
    if (!selectedGroup1 || !selectedGroup2) return
    clearFeedback()
    setPaperFitRequest((value) => value + 1)
    setEntryDock({ mode, rowId, typeId, group1Id: selectedGroup1.id, group2Id: selectedGroup2.id, field })
  }

  function updateEntryDock(field: 'listing' | 'point', value: string) {
    if (!entryDock) return
    if (entryDock.mode === 'draft') updateDraftField(entryDock.typeId, entryDock.rowId, field, value)
    else if (entryDockSaved) updateSavedGroup3(entryDockSaved, field, value)
  }

  function commitEntryDock() {
    if (!entryDock || !entryDockRow || !entryDockType) return
    try {
      const values = parseSettingNumberListV2(entryDockRow.listing, entryDockType.formulaId)
      if (!values.length) throw new Error('empty')
      if (['xa', 'xb'].includes(entryDockType.formulaId) && (values.length < 2 || values.length > 5)) throw new Error('count')
    } catch { window.alert('Nhập sai số'); return }
    try { parsePointTextV2(entryDockRow.point) } catch { window.alert('Điểm phải là số nguyên từ 0 đến 9999.'); return }
    if (entryDock.mode === 'draft') commitDraftRow(entryDock.typeId, entryDock.rowId)
    else if (entryDockSaved && commitSavedGroup3(entryDockSaved)) setEntryDock(null)
  }

  function closeNotice() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <main onFocusCapture={(event) => { const input = event.target; if (input instanceof HTMLTextAreaElement || (input instanceof HTMLInputElement && ['text', 'password'].includes(input.type))) requestAnimationFrame(() => { if (document.activeElement === input) input.setSelectionRange(input.value.length, input.value.length) }) }} className={`${screen === 'page' ? 'app-shell app-shell-page' : 'app-shell'}${entryDock ? ' is-entry-docked' : ''}`}>
      {publisherPromptOpen && <PublisherPrompt onClose={() => setPublisherPromptOpen(false)} onUnlock={() => { setPublisherPromptOpen(false); setPublisherAuthorized(true); setTypeSettingsOpen(true) }} />}
      {screen === 'page' && (
        <>
          <header className="app-header page-desktop-header">
            <button className="back-link" type="button" onClick={handlePageBack} aria-label="Quay lại">←</button>
          </header>
          <nav className="mobile-page-controls" aria-label="Điều khiển trang A4">
            <button className="mobile-page-control mobile-back-control" type="button" onClick={handlePageBack} aria-label="Quay lại">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6" /></svg>
            </button>

          </nav>
        </>
      )}

      {screen === 'page' && storageError && <div className="storage-global-error" role="status">{storageError}</div>}

      {screen === 'home' ? (
        <section className="home-screen">
          <div className="home-heading">
            <button
              className="icon-button home-settings-button"
              type="button"
              onClick={() => { setHomeSettingsSection('menu'); setHomeSettingsOpen(true) }}
              aria-label="Mở cài đặt"
              aria-expanded={homeSettingsOpen}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="home-greeting" style={{ fontSize: `${greetingFontSize}px`, fontFamily: greetingFontFamily, color: greetingColor }}>
              <span>{greeting}</span>
            </div>
            <div className="home-actions">
              <button className="button-primary create-a4-button" type="button" onClick={createTodayA4} aria-label="Tạo A4 mới">＋</button>
            </div>
          </div>
          {storageError && <div className="storage-global-error" role="status">{storageError}</div>}
          {homeSettingsOpen && (
            <div
              className="management-modal-backdrop home-settings-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setHomeSettingsOpen(false)
              }}
            >
              <section className="management-modal home-settings-modal" role="dialog" aria-modal="true" aria-label="Cài đặt ứng dụng">
                <div className="sheet-header">
                  <div className="home-settings-title-row">
                    {homeSettingsSection !== 'menu' && (
                      <button className="home-settings-back" type="button" onClick={() => setHomeSettingsSection('menu')} aria-label="Quay lại danh sách cài đặt">←</button>
                    )}
                    <h2>{homeSettingsSection === 'menu' ? 'Cài đặt' : homeSettingsSection === 'greeting' ? 'Lời chào' : homeSettingsSection === 'pin' ? 'PIN' : 'Lưu trữ'}</h2>
                  </div>
                  <button className="sheet-close" type="button" onClick={() => setHomeSettingsOpen(false)} aria-label="Đóng cài đặt">×</button>
                </div>

                {homeSettingsSection === 'menu' && (
                  <nav className="home-settings-menu" aria-label="Danh mục cài đặt">
                    <button className="home-settings-menu-item" type="button" onClick={() => setHomeSettingsSection('greeting')}>
                      <span className="home-settings-menu-icon greeting-menu-icon">Aa</span>
                      <span><strong>Lời chào</strong><small>Chỉnh nội dung và kiểu chữ</small></span>
                      <span className="home-settings-chevron">›</span>
                    </button>
                    <button className="home-settings-menu-item" type="button" onClick={() => setHomeSettingsSection('pin')}>
                      <span className="home-settings-menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>
                      <span><strong>PIN</strong><small>Thiết lập mã PIN</small></span>
                      <span className="home-settings-chevron">›</span>
                    </button>
                    <button className="home-settings-menu-item" type="button" onClick={() => setHomeSettingsSection('retention')}>
                      <span className="home-settings-menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7 3v4m10-4v4M4 9.5h16"/></svg></span>
                      <span><strong>Lưu trữ</strong><small>Điều chỉnh số ngày lưu trữ</small></span>
                      <span className="home-settings-chevron">›</span>
                    </button>
                  </nav>
                )}

                {homeSettingsSection === 'greeting' && (
                  <div className="sheet-content compact-form home-settings-detail">
                    <label>Nội dung lời chào<input ref={greetingInputRef} value={greeting} onChange={(event) => setGreeting(event.target.value)} /></label>
                    <div className="greeting-style-fields">
                      <label>Cỡ chữ<select value={greetingFontSize} onChange={(event) => setGreetingFontSize(event.target.value)}><option value="14">14 px</option><option value="16">16 px</option><option value="18">18 px</option><option value="20">20 px</option><option value="22">22 px</option><option value="24">24 px</option><option value="28">28 px</option></select></label>
                      <label>Font chữ
                        <select value={greetingFontFamily} onChange={(event) => setGreetingFontFamily(event.target.value)}>
                          <optgroup label="Cơ bản">
                            <option value="Arial, Helvetica, sans-serif">Arial</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                            <option value="'Palatino Linotype', Palatino, serif">Palatino</option>
                            <option value="'Times New Roman', serif">Times New Roman</option>
                            <option value="Verdana, sans-serif">Verdana</option>
                          </optgroup>
                          <optgroup label="Calligraphy & Swash">
                            <option value="'Snell Roundhand', 'Segoe Script', cursive">Calligraphy thanh lịch</option>
                            <option value="'Apple Chancery', 'Monotype Corsiva', cursive">Chancery Swash</option>
                            <option value="Zapfino, Gabriola, cursive">Swash bay bướm</option>
                            <option value="'Brush Script MT', 'Brush Script Std', cursive">Brush Script</option>
                            <option value="'Lucida Handwriting', 'Segoe Script', cursive">Handwritten mềm mại</option>
                            <option value="'URW Chancery L', 'Palatino Linotype', cursive">Chancery cổ điển</option>
                          </optgroup>
                        </select>
                      </label>
                      <label className="color-setting-label">Màu chữ<input type="color" value={greetingColor} onChange={(event) => setGreetingColor(event.target.value)} /></label>
                    </div>
                    <div className="greeting-icon-picker">
                      <div className="greeting-icon-picker-heading">
                        <strong>Chèn icon vào nội dung</strong>
                      </div>
                      <div className="greeting-icon-options" aria-label="Chèn icon vào lời chào">
                        {GREETING_ICON_OPTIONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            className="greeting-icon-option"
                            aria-label={`Chèn icon ${icon}`}
                            title={`Chèn ${icon}`}
                            onClick={() => insertGreetingIcon(icon)}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                      <small className="greeting-icon-hint">Chọn icon để chèn tại vị trí con trỏ trong ô nội dung lời chào.</small>
                    </div>
                    <div className="greeting-preview" style={{ fontSize: `${greetingFontSize}px`, fontFamily: greetingFontFamily, color: greetingColor }}>
                      {greeting || 'Xem trước lời chào'}
                    </div>
                  </div>
                )}

                {homeSettingsSection === 'pin' && <PinSettings />}

                {homeSettingsSection === 'retention' && <RetentionSettings data={data} />}
              </section>
            </div>
          )}
          {sortedDates.length === 0 ? (
            <div className="empty-library">Chưa có A4</div>
          ) : (
            <div className="a4-library-grid">
              {sortedDates.map((group1) => {
                const typeNames = data.settingTypes
                  .filter((type) => group1.groups2.some((group2) => group2.groups3.some((group3) => group3.settingTypeId === type.id)))
                  .map((type) => type.name)
                const totals = librarySummaryByGroup1Id.get(group1.id)
                return (
                  <article className="a4-library-card" key={group1.id}>
                    <button className="a4-card-open" type="button" onClick={() => openDate(group1.id)} aria-label={`Mở A4 ngày ${group1.dateLabel}`}>
                      <div className="mini-a4-paper">
                        <div className="mini-a4-title">{group1.dateLabel}</div>
                        <div className="mini-a4-lines">
                          {typeNames.slice(0, 6).map((name, index) => (
                            <div className="mini-a4-section" key={`${name}-${index}`}><b>{name}</b><i /><i /></div>
                          ))}
                        </div>
                      </div>
                    </button>
                    <div className="library-card-footer">
                      <button className="library-card-title" type="button" onClick={() => openDate(group1.id)}>{group1.dateLabel}</button>
                      <button className="icon-button danger-icon library-card-delete" type="button" onClick={() => deleteA4Record(group1)} aria-label={`Xóa A4 ngày ${group1.dateLabel}`} title="Xóa A4"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" /></svg></button>
                    </div>
                    <div className="library-card-calculation" aria-label={`Đánh ${formatLibraryAmount(totals?.d ?? null)}, Trúng ${formatLibraryAmount(totals?.t ?? null)}, Trúng trừ Đánh ${formatLibraryAmount(totals?.difference ?? null)}`}>
                      <span>Đánh <b>{formatLibraryAmount(totals?.d ?? null)}</b></span>
                      <span>Trúng <b>{formatLibraryAmount(totals?.t ?? null)}</b></span>
                      <strong>{formatLibraryAmount(totals?.difference ?? null)}</strong>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : selectedGroup1 ? (
        <section className="page-screen">
          <div className="page-topline desktop-zoom-line">
            <div className="zoom-controls" aria-label="Thu phóng A4">
              <button type="button" onClick={() => setZoom((current) => Math.max(0.35, Number((current - 0.08).toFixed(2))))} aria-label="Thu nhỏ">−</button>
              <button type="button" onClick={() => applyPageFit('page')} aria-label="Vừa trang">Vừa trang</button>
              <button type="button" onClick={() => applyPageFit('width')} aria-label="Vừa chiều ngang">Vừa ngang</button>
              <button type="button" onClick={() => setZoom((current) => Math.min(1, Number((current + 0.08).toFixed(2))))} aria-label="Phóng to">＋</button>
            </div>
          </div>

          <div className={`document-stage${pageFitMode === 'page' ? ' is-fit-page' : ''}`}>
            <div className={`document-paper-wrap${pageFitMode === 'page' ? ' is-fit-page' : ''}`}>
              {projectionState.projection ? (
                <A4PageV2
                  projection={projectionState.projection}
                  fitRequest={paperFitRequest}
                  centerInViewport={pageFitMode === 'page'}
                  summary={entryDock ? undefined : calculationState.workspace?.summary}
                  results={entryDock ? EMPTY_RESULTS : calculationState.workspace?.settingResults ?? EMPTY_RESULTS}
                  showCalculation={calculationEnabled && !entryDock}
                  zoom={zoom}
                  onZoomChange={setZoom}
                />
              ) : (
                <div className="paper-error">{projectionState.error || 'Không thể hiển thị A4.'}</div>
              )}
            </div>
          </div>

          {toolbarVisible && activePanel && (
            <aside className="editor-sheet" hidden={Boolean(entryDock)} aria-label="Bảng công cụ">
              <div className="sheet-header">
                <h2>{activePanel === 'edit' ? 'Sửa' : activePanel === 'results' ? 'Kết quả' : 'Xem'}</h2>
                <button className="sheet-close" type="button" onClick={closeActivePanel} aria-label="Đóng">×</button>
              </div>

              {activePanel === 'edit' && (
                <div className="sheet-content edit-flow">
                  <div className="compact-date-row">
                    <strong>{selectedGroup1.dateLabel}</strong>
                    <button className="icon-button trailing-edit-icon" type="button" onClick={() => { setDateDraft(dateInputFromLabel(selectedGroup1.dateLabel)); setManagementPanel('date') }} aria-label="Sửa ngày">✎</button>
                  </div>

                  <div className="compact-section group2-chip-area">
                    <Group2NamePicker
                      names={group2PickerNames}
                      configuredNameKeys={configuredGroup2NameKeys}
                      activeNameKey={selectedGroup2NameKey}
                      onSelect={chooseGroup2ByName}
                      onReorder={reorderGroup2Names}
                      onAdd={() => setShowNewGroupInput((value) => !value)}
                      onEdit={() => setManagementPanel('groups')}
                    />
                    {showNewGroupInput && (
                      <form className="inline-edit-form" onSubmit={addNewGroup2}>
                        <input
                          autoFocus
                          value={newGroupName}
                          onChange={(event) => setNewGroupName(event.target.value)}
                          onBlur={() => addNewGroup2()}
                          placeholder="Tên nhóm"
                          aria-label="Tên nhóm mới"
                        />
                      </form>
                    )}
                  </div>

                  {selectedGroup2 && (
                    <>
                      <div className="compact-section">
                        <SettingTypePicker
                          types={data.settingTypes}
                          groups3={selectedGroup2.groups3}
                          activeTypeId={activeSettingTypeId}
                          onSelect={selectSettingType}
                          onReorder={(source, target) => { const index = data.settingTypes.findIndex((type) => type.id === target); if (index >= 0) setData((current) => reorderSettingType(current, source, index)) }}
                          onEdit={openTypesManagement}
                        />
                      </div>

                      {activeSettingType && (
                        <div className="setting-entry-editor">
                          {savedEntriesForType.map((group3) => {
                            const currentDraft = savedRowDrafts[group3.id] ?? {
                              listing: group3.listing,
                              point: group3.point,
                              coefficientD: group3.coefficientD,
                              coefficientT: group3.coefficientT,
                            }
                            return (
                              <div
                                className="setting-row"
                                key={group3.id}
                                onBlur={(event) => {
                                  if (entryDock) return
                                  const nextTarget = event.relatedTarget as Node | null
                                  if (!nextTarget || !event.currentTarget.contains(nextTarget)) commitSavedGroup3(group3)
                                }}
                              >
                                <div className="setting-line">
                                <ListingInput onFocus={() => openEntryDock('saved', group3.id, activeSettingType.id)} value={currentDraft.listing} onChange={(value) => updateSavedGroup3(group3, 'listing', value)} onBlur={() => { try { const savedType = data.settingTypes.find((item) => item.id === group3.settingTypeId); updateSavedGroup3(group3, 'listing', parseSettingNumberListV2(currentDraft.listing, savedType?.formulaId).join(', ')) } catch { /* Keep invalid input visible. */ } }} label="Liệt kê" />
                                  <input onFocus={() => openEntryDock('saved', group3.id, activeSettingType.id, 'point')} className="point-input" value={currentDraft.point} onChange={(event) => updateSavedGroup3(group3, 'point', event.target.value)} placeholder="Điểm" aria-label="Điểm" inputMode="numeric" />
                                  <button className="icon-button danger-icon" type="button" onClick={() => removeGroup3(group3.id)} aria-label="Xóa thiết lập">×</button>
                                </div>
                              </div>
                            )
                          })}

                          {selectedDraftRows.map((row) => (
                            <div className="setting-row draft-setting-row" key={row.id}>
                              <div className="setting-line draft-setting-line">
                                <ListingInput onFocus={() => openEntryDock('draft', row.id, activeSettingType.id)} inputRef={draftListingInputRef} value={row.listing} onChange={(value) => updateDraftField(activeSettingType.id, row.id, 'listing', value)} onBlur={() => normalizeDraftListing(activeSettingType.id, row.id, row.listing)} label="Danh sách thiết lập" />
                                <span className="point-label">Điểm</span>
                                <input onFocus={() => openEntryDock('draft', row.id, activeSettingType.id, 'point')} className="point-input" value={row.point} onChange={(event) => updateDraftField(activeSettingType.id, row.id, 'point', event.target.value)} aria-label="Điểm" inputMode="numeric" />
                                <button className="button-primary add-setting-button" type="button" onClick={() => commitDraftRow(activeSettingType.id, row.id)}>Thêm</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activePanel === 'results' && (
                <div className="sheet-content compact-form">
                  <label>1–7<textarea rows={3} inputMode="decimal" value={drawOneToSeven} onChange={(event) => setDrawOneToSeven(cleanListingInput(event.target.value))} onBlur={persistOneToSevenDraft} aria-invalid={!drawOneToSevenValid} /></label>
                  <div className={`draw-count-status${drawOneToSevenValid ? '' : ' is-invalid'}`}>
                    <span>{drawOneToSevenCount}/26 số</span>
                    <strong>{!drawOneToSeven.trim() ? 'Chưa nhập' : drawOneToSevenValid ? 'Hợp lệ' : 'Không hợp lệ'}</strong>
                  </div>
                  <label>GĐB<input value={drawGdb} onChange={(event) => setDrawGdb(event.target.value)} onBlur={persistGdbDraft} inputMode="numeric" maxLength={5} aria-invalid={!drawGdbValid} /></label>
                  {!drawGdbValid && <div className="draw-count-status is-invalid"><strong>GĐB phải gồm đúng 5 chữ số.</strong></div>}
                  <div className="results-footer">
                    <button className={calculationEnabled ? 'calculation-toggle is-on' : 'calculation-toggle'} type="button" onClick={() => setCalculationEnabled((value) => !value)} aria-pressed={calculationEnabled}>
                      Tính Toán
                    </button>
                  </div>
                </div>
              )}

              {activePanel === 'view' && (
                <div className="sheet-content view-options">
                  <button className={a4Mode === 'combined' ? 'view-option is-active' : 'view-option'} type="button" onClick={() => chooseView('combined')}>Toàn bộ</button>
                  {selectedGroup1.groups2.map((group2) => (
                    <button className={a4Mode === 'group2' && selectedGroup2Id === group2.id ? 'view-option is-active' : 'view-option'} type="button" key={group2.id} onClick={() => chooseView('group2', group2.id)}>{group2.name}</button>
                  ))}
                </div>
              )}
            </aside>
          )}

          {toolbarVisible && activePanel === 'edit' && managementPanel && (
            <div className="management-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeManagementPanel() }}>
              <section className="management-modal" role="dialog" aria-modal="true" aria-label="Chỉnh sửa">
                <div className="sheet-header">
                  <div className="sheet-header-title-row">
                    <h2>{managementPanel === 'date' ? 'Chỉnh sửa ngày' : managementPanel === 'groups' ? 'Tên nhóm' : 'Sửa thiết lập'}</h2>
                  </div>
                  <button className="sheet-close" type="button" onClick={closeManagementPanel} aria-label="Đóng cửa sổ chỉnh sửa">×</button>
                </div>

                {managementPanel === 'date' && (
                  <div className="sheet-content compact-form">
                    <label>Ngày A4<input type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} /></label>
                    <p className="management-hint">Ngày sẽ tự động cập nhật khi đóng cửa sổ này.</p>
                  </div>
                )}

                {managementPanel === 'groups' && (
                  <div className="sheet-content management-list quick-group-management-list">
                    {groupNameSuggestions.map((name) => {
                      const hasSettings = group2NameHasSettings(name)
                      const hasDraft = group2NameHasUncommittedInput(name)
                      const canDelete = !hasSettings && !hasDraft
                      return (
                        <div className={`management-item quick-group-management-item draggable-group-row${draggingGroupName === name ? ' is-dragging' : ''}${dropGroupName === name && draggingGroupName ? ' is-drop-target' : ''}`} data-sort-group-name={name} key={name}>
                          <button className="drag-handle" type="button" onPointerDown={(event) => startGroupNameDrag(event, name)} onPointerMove={trackGroupNameDrag} onPointerUp={() => finishGroupNameDrag()} onPointerCancel={() => finishGroupNameDrag(true)} aria-label={`Kéo để sắp xếp tên ${name}`} title="Kéo để sắp xếp"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6" r="1.4"/><circle cx="16" cy="6" r="1.4"/><circle cx="8" cy="12" r="1.4"/><circle cx="16" cy="12" r="1.4"/><circle cx="8" cy="18" r="1.4"/><circle cx="16" cy="18" r="1.4"/></svg></button>
                          <span>{name}</span>
                          <button
                            className="icon-button danger-icon"
                            type="button"
                            disabled={!canDelete}
                            onClick={() => {
                              if (canDelete && window.confirm(`Xóa tên “${name}” khỏi danh sách nhập nhanh và các nhóm trống cùng tên trong A4?`)) {
                                removeGroup2NameFromAllA4(name)
                              }
                            }}
                            aria-label={canDelete ? `Xóa tên ${name}` : `Không thể xóa ${name} vì đang có dữ liệu`}
                            title={hasSettings ? 'Tên đang có thiết lập trong A4' : hasDraft ? 'Tên đang có nội dung nhập dở' : 'Xóa tên nhập nhanh'}
                          >×</button>
                        </div>
                      )
                    })}
                    {groupNameSuggestions.length === 0 && <p className="management-empty">Chưa có tên nhóm.</p>}
                  </div>
                )}

                {managementPanel === 'types' && (
                  <div className="sheet-content compact-form">
                    {editingType && (
                      <div className="type-editor">
                        <div className="type-name-row">
                          <input className="type-name-input" aria-label="Tên thiết lập" value={editingTypeName} onChange={(event) => setEditingTypeName(event.target.value)} />
                          <button
                            className="icon-button type-settings-button"
                            type="button"
                            onClick={() => { setPublisherAuthorized(false); setPublisherPromptOpen(true) }}
                            aria-label={`Cài đặt ${editingType.name}`}
                            title="Cài đặt hệ số và tên mặc định"
                          >⚙</button>
                        </div>
                      </div>
                    )}
                    <div className="type-catalog-list">
                      {data.settingTypes.map((type) => (
                        <div
                          className={`type-catalog-row draggable-type-row${editingTypeId === type.id ? ' is-active' : ''}${draggingTypeId === type.id ? ' is-dragging' : ''}${typeDropTargetId === type.id && draggingTypeId ? ' is-drop-target' : ''}`}
                          key={type.id}
                          data-sort-type={type.id}
                        >
                          <button
                            className="drag-handle"
                            type="button"
                            onPointerDown={(event) => startSettingTypeDrag(event, type.id)}
                            onPointerMove={trackSettingTypeDrag}
                            onPointerUp={finishSettingTypeDrag}
                            onPointerCancel={cancelSettingTypeDrag}
                            aria-label={`Kéo để sắp xếp ${type.name}`}
                            title="Kéo để sắp xếp"
                          ><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6" r="1.4"/><circle cx="16" cy="6" r="1.4"/><circle cx="8" cy="12" r="1.4"/><circle cx="16" cy="12" r="1.4"/><circle cx="8" cy="18" r="1.4"/><circle cx="16" cy="18" r="1.4"/></svg></button>
                          <button type="button" className={`catalog-type${editingTypeId === type.id ? ' is-active' : ''}`} onClick={() => selectTypeForEditing(type)}>{type.name}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {managementPanel === 'types' && typeSettingsOpen && publisherAuthorized && editingType && (
                  <div className="type-settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTypeSettings() }}>
                    <section className="type-settings-window" role="dialog" aria-modal="true" aria-label={`Cài đặt ${editingType.name}`}>
                      <div className="sheet-header">
                        <div className="sheet-header-title-row">
                          <h2>Cài đặt {editingType.name}</h2>
                        </div>
                        <button className="sheet-close" type="button" onClick={closeTypeSettings} aria-label="Đóng cài đặt">×</button>
                      </div>
                      <div className="sheet-content compact-form type-settings-content">
                        {isProfileCoefficientFormula(editingType.formulaId) ? (
                          <div className="count-coefficient-settings">
                            <p>{editingType.formulaId === 'da' || editingType.formulaId === 'db' ? 'Hệ số áp dụng theo độ dài chữ số trong ô Liệt kê.' : 'Hệ số áp dụng theo số lượng số trong ô Liệt kê.'}</p>
                            {getCoefficientProfileKeys(editingType.formulaId).map((key) => (
                              <div className="count-coefficient-row" key={key}>
                                <strong>{editingType.formulaId === 'da' || editingType.formulaId === 'db' ? `${key} chữ số` : `${key} số`}</strong>
                                <label>Hệ số Đánh<input value={editingTypeCoefficientsByCount[key].coefficientD} onChange={(event) => updateCountCoefficient(key, 'coefficientD', event.target.value)} inputMode="decimal" /></label>
                                <label>Hệ số Trúng<input value={editingTypeCoefficientsByCount[key].coefficientT} onChange={(event) => updateCountCoefficient(key, 'coefficientT', event.target.value)} inputMode="decimal" /></label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="coefficient-fields">
                            <label>Hệ số Đánh<input value={editingTypeD} onChange={(event) => setEditingTypeD(event.target.value)} inputMode="decimal" /></label>
                            <label>Hệ số Trúng<input value={editingTypeT} onChange={(event) => setEditingTypeT(event.target.value)} inputMode="decimal" /></label>
                          </div>
                        )}
                        <button className="button-secondary type-reset-name-button" type="button" onClick={resetSettingTypeName}>Reset tên thiết lập này</button>
                      </div>
                    </section>
                  </div>
                )}
              </section>
            </div>
          )}

          {toolbarVisible && (
            <nav className="bottom-toolbar" aria-label="Công cụ A4">
              {TOOLS.map((tool) => (
                <button
                  type="button"
                  key={tool.key}
                  className={activePanel === tool.key ? 'is-active' : ''}
                  aria-pressed={tool.key === 'save' ? undefined : activePanel === tool.key}
                  onClick={() => {
                    if (tool.key === 'save') {
                      void saveA4AsImage()
                      return
                    }
                    const nextPanel = tool.key
                    if (activePanel === 'results' && nextPanel !== 'results' && !persistDrawDataDraft()) return
                    if (nextPanel === 'results') {
                      if (activePanel === 'results') {
                        if (!closeActivePanel()) return
                      }
                      else openResultsPanel()
                    } else if (nextPanel === 'edit') {
                      if (activePanel === 'edit') { setActivePanel(null); setManagementPanel(null) }
                      else enterEditMode()
                    } else {
                      setManagementPanel(null)
                      setActivePanel(activePanel === nextPanel ? null : nextPanel)
                    }
                    clearFeedback()
                  }}
                >
                  <span className="toolbar-icon"><ToolbarIcon name={tool.icon} /></span>
                  <small>{tool.label}</small>
                </button>
              ))}
            </nav>
          )}

          {(errorMessage || successMessage || calculationState.error) && (
            <div className={errorMessage || calculationState.error ? 'feedback is-error' : 'feedback is-success'} role="status">
              <span>{errorMessage || calculationState.error || successMessage}</span>
              <button type="button" onClick={clearFeedback} aria-label="Đóng thông báo">×</button>
            </div>
          )}
        </section>
      ) : (
        <section className="home-screen"><p>Không tìm thấy A4.</p></section>
      )}

      {entryDock && entryDockRow && entryDockType && screen === 'page' && <EntryDock
        onListingTap={() => setPaperFitRequest((value) => value + 1)} formulaId={entryDockType.formulaId} rowId={entryDock.rowId} initialField={entryDock.field}
        title={`${entryDockGroup?.name ?? ''} · ${entryDockType.name}`}
        listing={entryDockRow.listing} point={entryDockRow.point} saved={entryDock.mode === 'saved'}
        onListing={(value) => updateEntryDock('listing', value)} onPoint={(value) => updateEntryDock('point', value)}
        onCommit={commitEntryDock} onClose={() => setEntryDock(null)}
      />}

      {(storageHydrating || retentionBusy) && (
        <div className="vault-loading-backdrop" role="status" aria-live="polite">
          <section className="vault-prompt"><span className="vault-spinner" /><strong>{retentionBusy ? 'Đang dọn A4 hết hạn…' : 'Đang mở dữ liệu đã mã hóa…'}</strong></section>
        </div>
      )}

      {(offlineReady || needRefresh) && (
        <section className="pwa-notice" role="status" aria-live="polite">
          <h2>{needRefresh ? 'Có phiên bản mới' : 'Đã sẵn sàng ngoại tuyến'}</h2>
          <p>{needRefresh ? 'Phiên bản mới đã sẵn sàng để cập nhật.' : 'Ứng dụng đã lưu các tài nguyên cần thiết để chạy ngoại tuyến.'}</p>
          <div className="notice-actions">
            {needRefresh && <button className="button-primary" type="button" onClick={() => void updateServiceWorker(true)}>Cập nhật ngay</button>}
            <button className="button-secondary" type="button" onClick={closeNotice}>Đóng</button>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
