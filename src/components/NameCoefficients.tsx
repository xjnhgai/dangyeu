import { useRef, useState, type ReactNode } from 'react'
import { allConfig } from '../core/all-input'
import { resetSettingTypeToFactory } from '../core/coefficient-defaults'
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

export default function NameCoefficients({ name, types, onSave, onClose, catalog = false, sharedConfig }: {
  catalog?: boolean; sharedConfig?: ReactNode
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

  function resetCatalogType(id: string) {
    if (!catalog) return
    const current = saved.current.find(type => type.id === id)
    if (!current) return
    const restored = resetSettingTypeToFactory(current)
    const resetKey = restored.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
    if (saved.current.some(type => type.id !== id && type.name.trim().normalize('NFC').toLocaleLowerCase('vi-VN') === resetKey)) {
      setErrors(previous => ({ ...previous, [`${id}:metadata:name`]: 'Tên không được trống hoặc trùng.' }))
      return
    }
    // Only change the shared catalog type. Private per-name settings are NOT touched.
    const next = saved.current.map(type => type.id === id ? restored : type)
    saved.current = next
    setDraft(previous => previous.map(type => type.id === id ? restored : type))
    for (const [key, target] of dirty.current) if (target.id === id) dirty.current.delete(key)
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${id}:`))))
    onSave(next)
  }
  function metadata(id: string, field: 'name' | 'allAliases' | 'kepName' | 'kepAliases', value: string) {
    setDraft(current => current.map(type => type.id === id ? {...type, [field]: value} : type))
    const errorKey = `${id}:metadata:${field}`
    const key = value.trim().normalize('NFC').toLocaleLowerCase('vi')
    const invalidName = (field === 'name' || field === 'kepName') && (!key || saved.current.some(type => type.id !== id && [type.name, type.kepName].some(name => name?.trim().normalize('NFC').toLocaleLowerCase('vi') === key)))
    setErrors(current => { const next = {...current}; if (invalidName) next[errorKey] = 'Tên không được trống hoặc trùng.'; else delete next[errorKey]; return next })
    if (invalidName) return
    const next = saved.current.map(type => type.id === id ? {...type, [field]: value} : type)
    saved.current = next
    setDraft(current => current.map(type => type.id === id ? {...type, [field]: value} : type))
    onSave(next)
  }
  return <div className="management-modal-backdrop coefficient-settings-backdrop">
    <section className="management-modal name-coefficients-modal" role="dialog" aria-modal="true" aria-label={catalog ? 'Cài đặt nhóm thiết lập' : `Hệ số theo tên ${name}`}>
      <header className="sheet-header"><h2>{catalog ? 'Cài đặt nhóm thiết lập' : `Hệ số · ${name}`}</h2><button className="sheet-close" type="button" onPointerDown={event => event.preventDefault()} onClick={() => { if (save([...dirty.current.values()]) && !Object.keys(errors).some(key => key.includes(':metadata:'))) onClose() }} aria-label={catalog ? 'Đóng cửa sổ chỉnh sửa' : 'Đóng hệ số theo tên'}>×</button></header>
      <div className="sheet-content compact-form">
        {sharedConfig}
        {draft.map(type => {
          const keys: (ListingCountKey | undefined)[] = getCoefficientProfileKeys(type.formulaId)
          if (!keys.length) keys.push(undefined)
          const byDigits = type.formulaId === 'da' || type.formulaId === 'db'
          return <fieldset className="coefficient-type-section" key={type.id}><legend className="coefficient-type-title">{type.name}</legend>
            {catalog && <div className="catalog-metadata">
              <div className="catalog-rename-row">
                <label>Đổi tên<input aria-label={`Tên thiết lập ${type.formulaId}`} value={type.name} onChange={e=>metadata(type.id, 'name', e.target.value)} /></label>
                <button className="catalog-reset-button" type="button" aria-label={`Reset ${type.name}`} onClick={()=>resetCatalogType(type.id)}>Reset</button>
              </div>
              <label>Tên khác<input aria-label={`Tên khác ${type.formulaId}`} value={allConfig(type).aliases.replaceAll('%','&')} onChange={e=>metadata(type.id, 'allAliases', e.target.value)} /></label>
              {byDigits && <fieldset><legend>{type.formulaId === 'da' ? 'kép A' : 'kép B'}</legend>
                <label>Đổi tên<input aria-label={`Tên kép ${type.formulaId}`} value={type.kepName ?? `kép ${type.formulaId === 'da' ? 'a' : 'b'}`} onChange={e=>metadata(type.id, 'kepName', e.target.value)} /></label>
                <button type="button" onClick={()=>metadata(type.id, 'kepName', `kép ${type.formulaId === 'da' ? 'a' : 'b'}`)}>Reset tên kép</button>
                <label>Tên khác<input aria-label={`Tên khác kép ${type.formulaId}`} value={type.kepAliases ?? `kep ${type.formulaId === 'da' ? 'a' : 'b'}`} onChange={e=>metadata(type.id, 'kepAliases', e.target.value)} /></label>
              </fieldset>}
            </div>}
            {keys.map(key => {
            const suffix = key ? `${key} ${byDigits ? 'chữ số' : 'số'}` : ''
  return <div className="coefficient-fields" key={key ?? 'scalar'}>
              {key && <strong className="coefficient-profile-title">{suffix}</strong>}
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
