import { useState } from 'react'
import type { ListingCountKey, SettingTypeDefinition } from '../core/models-v2'
import { getCoefficientProfileKeys, parseCoefficientTextV2 } from '../core/workspace-calculator-v2'

type Field = 'coefficientD' | 'coefficientT'

export default function NameCoefficients({ name, types, onSave, onClose }: {
  name: string
  types: SettingTypeDefinition[]
  onSave: (types: SettingTypeDefinition[]) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => structuredClone(types))
  const [error, setError] = useState('')

  function change(id: string, field: Field, value: string, key?: ListingCountKey) {
    setError('')
    setDraft(current => current.map(type => type.id !== id ? type : key ? {
      ...type,
      defaultCoefficientsByCount: {
        ...type.defaultCoefficientsByCount,
        [key]: { ...type.defaultCoefficientsByCount?.[key], [field]: value },
      },
    } : { ...type, [field === 'coefficientD' ? 'defaultCoefficientD' : 'defaultCoefficientT']: value }))
  }

  function save() {
    try {
      const normalized = draft.map(type => {
        const keys = getCoefficientProfileKeys(type.formulaId)
        const read = (value: string | null | undefined, label: string) => {
          const text = value?.trim() ?? ''
          parseCoefficientTextV2(text, `${type.name}: ${label}`)
          return text
        }
        if (!keys.length) return {
          ...type,
          defaultCoefficientD: read(type.defaultCoefficientD, 'Hệ số Đánh'),
          defaultCoefficientT: read(type.defaultCoefficientT, 'Hệ số Trúng'),
        }
        // Profile formulas do not display/use scalar fields. Validate only
        // the visible 2/3-digit or 2–5-number coefficient pairs.
        return { ...type, defaultCoefficientsByCount: Object.fromEntries(keys.map(key => [key, {
          coefficientD: read(type.defaultCoefficientsByCount?.[key]?.coefficientD, `Hệ số Đánh (${key})`),
          coefficientT: read(type.defaultCoefficientsByCount?.[key]?.coefficientT, `Hệ số Trúng (${key})`),
        }])) }
      })
      onSave(normalized)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Hệ số không hợp lệ.') }
  }

  return <div className="management-modal-backdrop">
    <section className="management-modal" role="dialog" aria-modal="true" aria-label={`Hệ số theo tên ${name}`}>
      <header className="sheet-header"><h2>Hệ số · {name}</h2><button type="button" onClick={onClose} aria-label="Đóng hệ số theo tên">×</button></header>
      <div className="sheet-content compact-form">
        {draft.map(type => {
          const keys: (ListingCountKey | undefined)[] = getCoefficientProfileKeys(type.formulaId)
          if (!keys.length) keys.push(undefined)
          const byDigits = type.formulaId === 'da' || type.formulaId === 'db'
          return <fieldset key={type.id}><legend>{type.name}</legend>{keys.map(key => {
            const suffix = key ? `${key} ${byDigits ? 'chữ số' : 'số'}` : ''
            return <div className="coefficient-fields" key={key ?? 'scalar'}>
              {key && <strong>{suffix}</strong>}
              {(['coefficientD', 'coefficientT'] as const).map((field, index) => {
                const label = index ? 'Hệ số Trúng' : 'Hệ số Đánh'
                const value = key ? type.defaultCoefficientsByCount?.[key]?.[field]
                  : type[field === 'coefficientD' ? 'defaultCoefficientD' : 'defaultCoefficientT']
                return <label key={field}>{label}<input aria-label={`${type.name} ${label}${suffix ? ` (${suffix})` : ''}`} inputMode="decimal" value={value ?? ''} onChange={event => change(type.id, field, event.target.value, key)} /></label>
              })}
            </div>
          })}</fieldset>
        })}
        {error && <p className="settings-error" role="alert">{error}</p>}
        <button className="button-primary" type="button" onClick={save}>Lưu hệ số</button>
      </div>
    </section>
  </div>
}
