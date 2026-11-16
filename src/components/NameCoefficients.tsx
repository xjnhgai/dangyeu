import { useRef, useState } from 'react'
import type { ListingCountKey, SettingTypeDefinition } from '../core/models-v2'
import { getCoefficientProfileKeys, parseCoefficientTextV2 } from '../core/workspace-calculator-v2'

type Field = 'coefficientD' | 'coefficientT'
type Target = { id: string; field: Field; key?: ListingCountKey }
const targetKey = ({ id, field, key }: Target) => `${id}:${key ?? 'scalar'}:${field}`
function readField(type: SettingTypeDefinition, { field, key }: Target) {
  return key ? type.defaultCoefficientsByCount?.[key]?.[field]
    : type[field === 'coefficientD' ? 'defaultCoefficientD' : 'defaultCoefficientT']
}
function writeField(types: SettingTypeDefinition[], { id, field, key }: Target, value: string) {
  return types.map(type => type.id !== id ? type : key ? {
    ...type, defaultCoefficientsByCount: {
      ...type.defaultCoefficientsByCount,
      [key]: { ...type.defaultCoefficientsByCount?.[key], [field]: value },
    },
  } : { ...type, [field === 'coefficientD' ? 'defaultCoefficientD' : 'defaultCoefficientT']: value })
}

export default function NameCoefficients({ name, types, onSave, onClose }: {
  name: string; types: SettingTypeDefinition[]
  onSave: (types: SettingTypeDefinition[]) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(() => structuredClone(types))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const saved = useRef(structuredClone(types))
  const dirty = useRef(new Map<string, Target>())

  function change(target: Target, value: string) {
    dirty.current.set(targetKey(target), target)
    setErrors(current => { const next = { ...current }; delete next[targetKey(target)]; return next })
    setDraft(current => writeField(current, target, value))
  }
  function save(targets: Target[]): boolean {
    const active = targets.filter(target => dirty.current.has(targetKey(target)))
    if (!active.length) return true
    const failures: Record<string, string> = {}
    let next = saved.current
    for (const target of active) {
      const type = draft.find(item => item.id === target.id)!
      const text = readField(type, target)?.trim() ?? ''
      try {
        parseCoefficientTextV2(text, `${type.name}: Hệ số ${target.field === 'coefficientD' ? 'Đánh' : 'Trúng'}${target.key ? ` (${target.key})` : ''}`)
        next = writeField(next, target, text)
      } catch (error) { failures[targetKey(target)] = (error as Error).message }
    }
    if (Object.keys(failures).length) { setErrors(current => ({ ...current, ...failures })); return false }
    saved.current = next
    for (const target of active) dirty.current.delete(targetKey(target))
    onSave(next)
    return true
  }

  return <div className="management-modal-backdrop">
    <section className="management-modal name-coefficients-modal" role="dialog" aria-modal="true" aria-label={`Hệ số theo tên ${name}`}>
      <header className="sheet-header"><h2>Hệ số · {name}</h2><button className="sheet-close" type="button" onPointerDown={event => event.preventDefault()} onClick={() => { if (save([...dirty.current.values()])) onClose() }} aria-label="Đóng hệ số theo tên">×</button></header>
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
                const target = { id: type.id, field, key }
                const label = index ? 'Hệ số Trúng' : 'Hệ số Đánh'
                return <label key={field}>{label}<input aria-label={`${type.name} ${label}${suffix ? ` (${suffix})` : ''}`} aria-invalid={Boolean(errors[targetKey(target)])} inputMode="decimal" value={readField(type, target) ?? ''} onChange={event => change(target, event.target.value)} onBlur={() => save([target])} /></label>
              })}
            </div>
          })}</fieldset>
        })}
        {Object.entries(errors).map(([key, message]) => <p key={key} className="settings-error" role="alert">{message}</p>)}
      </div>
    </section>
  </div>
}
