
import { useState, type FormEvent } from 'react'

import type {
  EntityId,
  Group2,
  NameSuggestion,
  QuickSettingTemplate,
} from '../core/models'

import type {
  SettingCalculationResult,
} from '../core/calculation'

import {
  parseCoefficientText,
  parseListingText,
  parsePointText,
} from '../core/workspace-calculator'

import './Group3Panel.css'

// ============================================================
// 1. TYPES
// ============================================================

export interface SettingDraft {
  id: EntityId | null
  name: string
  listing: string
  point: string
  coefficientD: string
  coefficientT: string
}

export interface SettingTemplateDraft {
  name: string
  coefficientD: string
  coefficientT: string
}

export interface Group3PanelProps {
  group: Group2 | null

  suggestions: readonly NameSuggestion[]

  templates: readonly QuickSettingTemplate[]

  selectedSettingId: EntityId | null

  results: ReadonlyMap<EntityId, SettingCalculationResult>

  onSelectSetting: (settingId: EntityId) => void

  onSaveSetting: (draft: SettingDraft) => void

  /**
   * Returns true if a new template was added.
   * Returns false if an exact duplicate already exists.
   */
  onSaveTemplate: (template: SettingTemplateDraft) => boolean
}

function createEmptyDraft(): SettingDraft {
  return {
    id: null,
    name: '',
    listing: '',
    point: '',
    coefficientD: '',
    coefficientT: '',
  }
}

// ============================================================
// 2. NUMBER FORMATTING
// ============================================================

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }

  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 4,
  }).format(value)
}

// ============================================================
// 3. SETTING CARD
// ============================================================

interface SettingCardProps {
  setting: Group2['settings'][number]

  result?: SettingCalculationResult

  isSelected: boolean

  onSelect: () => void

  onEdit: () => void
}

function SettingCard({
  setting,
  result,
  isSelected,
  onSelect,
  onEdit,
}: SettingCardProps) {
 const listing = (() => {
  try {
    return parseListingText(setting.listing)
  } catch {
    return []
  }
})()

  return (
    <article
      className={
        isSelected
          ? 'setting3-card setting3-card--selected'
          : 'setting3-card'
      }
    >
      <button
        type="button"
        className="setting3-card-main"
        onClick={onSelect}
        aria-pressed={isSelected}
      >
        <strong>{setting.name}</strong>

        <span className="setting3-card-listing">
          {listing.map((number, index) => (
            <span
              key={`${setting.id}-${index}`}
              className={
                result?.listingMatchFlags[index]
                  ? 'setting3-number setting3-number--matched'
                  : 'setting3-number'
              }
            >
              {number}
            </span>
          ))}

          {listing.length === 0 && (
            <span className="setting3-muted">Chưa có danh sách</span>
          )}
        </span>

        <span className="setting3-card-point">
          Điểm: {setting.point}
        </span>

        <span className="setting3-card-results">
          <span>
            Đ <strong>{formatNumber(result?.d)}</strong>
          </span>

          <span>
            T <strong>{formatNumber(result?.t)}</strong>
          </span>
        </span>
      </button>

      <button
        type="button"
        className="setting3-edit-button"
        onClick={onEdit}
        aria-label={`Sửa ${setting.name}`}
      >
        Sửa
      </button>
    </article>
  )
}

// ============================================================
// 4. SETTING EDITOR
// ============================================================

interface SettingEditorProps {
  draft: SettingDraft

  onDraftChange: (draft: SettingDraft) => void

  onSave: (event: FormEvent<HTMLFormElement>) => void

  onCancel: () => void

  onSaveTemplate: () => void

  coefficientsOpen: boolean

  onToggleCoefficients: () => void

  errorMessage: string

  statusMessage: string
}

function SettingEditor({
  draft,
  onDraftChange,
  onSave,
  onCancel,
  onSaveTemplate,
  coefficientsOpen,
  onToggleCoefficients,
  errorMessage,
  statusMessage,
}: SettingEditorProps) {
  function updateField<K extends keyof SettingDraft>(
    key: K,
    value: SettingDraft[K],
  ) {
    onDraftChange({
      ...draft,
      [key]: value,
    })
  }

  return (
    <form className="setting3-editor" onSubmit={onSave}>
      <div className="setting3-editor-header">
        <div>
          <p className="setting3-eyebrow">
            {draft.id ? 'CHỈNH SỬA' : 'THIẾT LẬP MỚI'}
          </p>

          <h3>
            {draft.id ? 'Sửa thiết lập' : 'Thêm thiết lập'}
          </h3>
        </div>

        <button
          type="button"
          className={
            coefficientsOpen
              ? 'setting3-coefficient-button setting3-coefficient-button--active'
              : 'setting3-coefficient-button'
          }
          aria-expanded={coefficientsOpen}
          onClick={onToggleCoefficients}
        >
          D / T
        </button>
      </div>

      <label className="setting3-field">
        <span>Tên thiết lập</span>

        <input
          type="text"
          value={draft.name}
          maxLength={100}
          placeholder="Tên thiết lập"
          onChange={(event) =>
            updateField('name', event.target.value)
          }
          required
        />
      </label>

      <div className="setting3-input-row">
        <label className="setting3-field setting3-listing-field">
          <span>Danh sách số</span>

          <textarea
            value={draft.listing}
            rows={2}
            placeholder="Ví dụ: 12, 23, 00128"
            onChange={(event) =>
              updateField('listing', event.target.value)
            }
            required
          />
        </label>

        <label className="setting3-field setting3-point-field">
          <span>Điểm</span>

          <input
            type="text"
            inputMode="numeric"
            value={draft.point}
            maxLength={4}
            placeholder="0"
            onChange={(event) =>
              updateField(
                'point',
                event.target.value.replace(/\D/g, '').slice(0, 4),
              )
            }
            required
          />
        </label>
      </div>

      {coefficientsOpen && (
        <div className="setting3-coefficients">
          <label className="setting3-field">
            <span>Hệ số Đ</span>

            <input
              type="text"
              inputMode="decimal"
              value={draft.coefficientD}
              placeholder="Hệ số Đ"
              onChange={(event) =>
                updateField('coefficientD', event.target.value)
              }
              required
            />
          </label>

          <label className="setting3-field">
            <span>Hệ số T</span>

            <input
              type="text"
              inputMode="decimal"
              value={draft.coefficientT}
              placeholder="Hệ số T"
              onChange={(event) =>
                updateField('coefficientT', event.target.value)
              }
              required
            />
          </label>
        </div>
      )}

      {errorMessage && (
        <p className="setting3-error" role="alert">
          {errorMessage}
        </p>
      )}

      {statusMessage && (
        <p className="setting3-status" role="status">
          {statusMessage}
        </p>
      )}

      <div className="setting3-editor-actions">
        <button type="submit" className="setting3-save-button">
          Lưu thiết lập
        </button>

        <button
          type="button"
          className="setting3-template-button"
          onClick={onSaveTemplate}
        >
          Lưu mẫu
        </button>

        <button
          type="button"
          className="setting3-cancel-button"
          onClick={onCancel}
        >
          Hủy
        </button>
      </div>
    </form>
  )
}

// ============================================================
// 5. GROUP 3 PANEL
// ============================================================

export default function Group3Panel({
  group,
  suggestions,
  templates,
  selectedSettingId,
  results,
  onSelectSetting,
  onSaveSetting,
  onSaveTemplate,
}: Group3PanelProps) {
  const [draft, setDraft] = useState<SettingDraft | null>(null)

  const [coefficientsOpen, setCoefficientsOpen] = useState(false)

  const [errorMessage, setErrorMessage] = useState('')

  const [statusMessage, setStatusMessage] = useState('')

  function openNewSetting() {
    setDraft(createEmptyDraft())
    setCoefficientsOpen(false)
    setErrorMessage('')
    setStatusMessage('')
  }

  function openEditSetting(
    setting: Group2['settings'][number],
  ) {
    setDraft({
      id: setting.id,
      name: setting.name,
      listing: setting.listing,
      point: setting.point,
      coefficientD: setting.coefficientD,
      coefficientT: setting.coefficientT,
    })

    setCoefficientsOpen(false)
    setErrorMessage('')
    setStatusMessage('')
  }

  function updateDraft(nextDraft: SettingDraft) {
    setDraft(nextDraft)
    setErrorMessage('')
    setStatusMessage('')
  }

  function handleSaveSetting(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!draft) {
      return
    }

    try {
      const name = draft.name.trim()

      if (!name) {
        throw new Error('Vui lòng nhập tên thiết lập.')
      }

      const listing = parseListingText(draft.listing)

      if (listing.length === 0) {
        throw new Error('Vui lòng nhập ít nhất một số.')
      }

      parsePointText(draft.point)

      parseCoefficientText(draft.coefficientD, 'Hệ số Đ')

      parseCoefficientText(draft.coefficientT, 'Hệ số T')

      onSaveSetting({
        ...draft,
        name,
        listing: listing.join(', '),
        point: draft.point.trim(),
        coefficientD: draft.coefficientD.trim(),
        coefficientT: draft.coefficientT.trim(),
      })

      setDraft(createEmptyDraft())
      setCoefficientsOpen(false)
      setErrorMessage('')
      setStatusMessage('')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể lưu thiết lập.',
      )
    }
  }

  function handleSaveTemplate() {
    if (!draft) {
      return
    }

    try {
      const name = draft.name.trim()

      if (!name) {
        throw new Error('Vui lòng nhập tên thiết lập.')
      }

      parseCoefficientText(draft.coefficientD, 'Hệ số Đ')

      parseCoefficientText(draft.coefficientT, 'Hệ số T')

      const added = onSaveTemplate({
        name,
        coefficientD: draft.coefficientD.trim(),
        coefficientT: draft.coefficientT.trim(),
      })

      setErrorMessage('')

      setStatusMessage(
        added
          ? 'Đã lưu mẫu thiết lập.'
          : 'Mẫu có cùng tên và hệ số đã tồn tại.',
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể lưu mẫu.',
      )

      setStatusMessage('')
    }
  }

  if (!group) {
    return null
  }

  return (
    <section className="group3-panel">
      <header className="group3-panel-header">
        <div>
          <p className="setting3-eyebrow">CẤP 3</p>
          <h2>Thiết lập</h2>
        </div>

        <button
          type="button"
          className="group3-add-button"
          onClick={openNewSetting}
        >
          + Thêm
        </button>
      </header>

      {suggestions.length > 0 && (
        <div className="setting3-suggestion-section">
          <p className="setting3-section-label">
            Tên gợi ý
          </p>

          <div className="setting3-chips">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => {
                  setDraft((current) => ({
                    ...(current ?? createEmptyDraft()),
                    name: suggestion.name,
                  }))

                  setErrorMessage('')
                  setStatusMessage('')
                }}
              >
                {suggestion.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <div className="setting3-suggestion-section">
          <p className="setting3-section-label">
            Mẫu thiết lập
          </p>

          <div className="setting3-chips">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  setDraft({
                    id: null,
                    name: template.name,
                    listing: '',
                    point: '',
                    coefficientD: template.coefficientD,
                    coefficientT: template.coefficientT,
                  })

                  setCoefficientsOpen(false)
                  setErrorMessage('')
                  setStatusMessage('')
                }}
              >
                {template.name} · D{template.coefficientD}
                {' '}
                T{template.coefficientT}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="setting3-list-heading">
        <span>Thiết lập trong nhóm</span>
        <span>{group.settings.length}</span>
      </div>

      {group.settings.length === 0 ? (
        <p className="setting3-empty">
          Chưa có thiết lập.
        </p>
      ) : (
        <div className="setting3-list">
          {group.settings.map((setting) => (
            <SettingCard
              key={setting.id}
              setting={setting}
              result={results.get(setting.id)}
              isSelected={setting.id === selectedSettingId}
              onSelect={() => onSelectSetting(setting.id)}
              onEdit={() => openEditSetting(setting)}
            />
          ))}
        </div>
      )}

      {draft && (
        <SettingEditor
          draft={draft}
          onDraftChange={updateDraft}
          onSave={handleSaveSetting}
          onCancel={() => {
            setDraft(null)
            setErrorMessage('')
            setStatusMessage('')
          }}
          onSaveTemplate={handleSaveTemplate}
          coefficientsOpen={coefficientsOpen}
          onToggleCoefficients={() =>
            setCoefficientsOpen((current) => !current)
          }
          errorMessage={errorMessage}
          statusMessage={statusMessage}
        />
      )}
    </section>
  )
}
