import type { AllInputConfig, Group2, SettingTypeDefinition } from './models-v2'
import { parseSettingNumberListV2, parsePointTextV2, getCoefficientProfileKey, isProfileCoefficientFormula } from './workspace-calculator-v2'
import { createGroup3FromDefaults } from './tree-v2'
const defaults: Record<string, string> = { la: 'lô a', lb: 'lô b', da: 'đề a', db: 'đề b', xa: 'xiên a', xb: 'xiên b&xiên', ca: 'càng a', cb: 'càng b' }
export const allConfig = (type: SettingTypeDefinition) => ({ aliases: type.allAliases ?? defaults[type.formulaId] ?? '', markers: type.allPointMarkers ?? 'n&đ&điểm', separators: type.allSeparators ?? '.' })
const parts = (s: string) => s.split(/[&%]/).map(v => v.trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase('vi')).filter(Boolean)
// Existing per-type settings are combined once as a compatible shared fallback.
export function sharedAllConfig(types: readonly SettingTypeDefinition[], config?: AllInputConfig): AllInputConfig {
  if (config) return { markers: config.markers.replaceAll('%', '&'), separators: config.separators.replaceAll('%', '&') }
  return {
    markers: [...new Set(types.flatMap(t => parts(allConfig(t).markers)))].join('&'),
    separators: [...new Set(types.flatMap(t => parts(allConfig(t).separators)))].join('&'),
  }
}
export class AllInputError extends Error {
  fragment: string
  readonly range?: { start: number; end: number }
  constructor(fragment: string, range?: { start: number; end: number }) {
    super(`Kiểm tra: ${fragment.length > 60 ? fragment.slice(0, 60) + '…' : fragment}`)
    this.fragment = fragment
    this.range = range
  }
}
// Map positions in the parser's NFC/whitespace-normalized text back to the
// original textarea string (including line breaks and decomposed accents).
// Called only for invalid input; normal parsing is untouched.
function originalOffset(text: string, normalizedIndex: number): number {
  let low = 0, high = text.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const length = text.slice(0, mid).normalize('NFC').replace(/\s+/g, ' ').length
    if (length <= normalizedIndex) low = mid
    else high = mid - 1
  }
  return low
}
function inputRange(text: string, start: number, end: number): { start: number; end: number } {
  return { start: originalOffset(text, start), end: originalOffset(text, end) }
}
function invalid(fragment: string, sourceIndex?: number, text?: string): never {
  // Keep existing error messages. Add a precise location when available.
  const word = fragment.match(/[\p{L}][\p{L}\p{M}]*/u)?.[0]
  const token = word ?? fragment.trim().split(/\s+/)[0] ?? ''
  const at = fragment.indexOf(token)
  const range = text !== undefined && sourceIndex !== undefined && token && at >= 0
    ? inputRange(text, sourceIndex + at, sourceIndex + at + token.length)
    : undefined
  throw new AllInputError(token, range)
}

// Diagnostic-only token localization. Never changes which input is accepted.
function invalidListingRange(
  text: string,
  raw: string,
  split: RegExp,
  formulaId: SettingTypeDefinition['formulaId'],
  shortcut: boolean,
  absoluteStart: number,
): { start: number; end: number } | undefined {
  let searchFrom = 0
  const tokens = raw.split(split).filter(Boolean).map(value => {
    const start = raw.indexOf(value, searchFrom)
    searchFrom = start + value.length
    return { value, start: absoluteStart + start }
  })
  const locate = (token: { value: string; start: number }) =>
    inputRange(text, token.start, token.start + token.value.length)

  for (const token of tokens) {
    try { parseSettingNumberListV2(token.value, formulaId) }
    catch { return locate(token) }
  }
  if (shortcut && tokens.length) return locate(tokens[0])

  if (formulaId === 'da' || formulaId === 'db') {
    const mismatch = tokens.find(token => token.value.length !== tokens[0]?.value.length)
    if (mismatch) return locate(mismatch)
  }

  const seen = new Set<string>()
  for (const token of tokens) {
    const expanded = parseSettingNumberListV2(token.value, formulaId)
    if (expanded.some(value => seen.has(value)) || new Set(expanded).size !== expanded.length) return locate(token)
    expanded.forEach(value => seen.add(value))
  }

  if ((formulaId === 'xa' || formulaId === 'xb') && tokens.length > 4) return locate(tokens[4])
  if ((formulaId === 'xa' || formulaId === 'xb') && tokens.length === 1) return locate(tokens[0])
  return undefined
}
export function allErrorRange(text: string, fragment: string): { start: number; end: number } | null {
  if (!fragment) return null
  const pattern = new RegExp(fragment.split(/\s+/).map(esc).join('\\s+'), 'iu')
  const match = pattern.exec(text)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export interface AllRow { typeId: string; listing: string; point: string; source: string; specialListing?: 'kep' }
export function parseAll(text: string, types: readonly SettingTypeDefinition[], shared?: AllInputConfig): AllRow[] {
  const config = sharedAllConfig(types, shared)
  const names = new Map<string, SettingTypeDefinition & { shortcut?: boolean }>()
  for (const type of types) for (const name of parts(`${type.name}%${allConfig(type).aliases}`)) {
    if (names.has(name) && names.get(name)!.id !== type.id) throw new Error(`Tên khác bị trùng: ${name}`)
    names.set(name, type)
  }
  for (const type of types.filter(t => t.formulaId === 'da' || t.formulaId === 'db')) {
    const suffix = type.formulaId === 'da' ? 'a' : 'b'
    for (const name of parts(`${type.kepName ?? `kép ${suffix}`}&${type.kepAliases ?? `kep ${suffix}`}`)) {
      if (names.has(name)) throw new Error(`Tên khác bị trùng: ${name}`)
      names.set(name, {...type, shortcut: true})
    }
  }
  const source = text.normalize('NFC').replace(/\s+/g, ' ')
  const pattern = new RegExp(`(?<![\\p{L}\\d])(?:${[...names.keys()].sort((a,b) => b.length-a.length).map(esc).join('|')})(?!\\p{L})`, 'giu')
  const matches = [...source.matchAll(pattern)]
  if (!matches.length) invalid(source, 0, text)
  const prefixSeparators = parts(config.separators).map(esc)
  const prefixPattern = new RegExp(`(?:\\s${prefixSeparators.length ? '|' + prefixSeparators.join('|') : ''})+`, 'u')
  const prefix = source.slice(0, matches[0].index)
  if (prefix.split(prefixPattern).filter(Boolean).length) invalid(prefix, 0, text)
  const rows: AllRow[] = []
  for (let i=0; i<matches.length; i++) {
    const match = matches[i]; const type = names.get(match[0].toLocaleLowerCase('vi'))!
    const markers = parts(config.markers)
    const separators = parts(config.separators)
    if (!markers.length || !separators.length) throw new Error(`Hãy cài ký tự điểm và phân tách cho ${type.name}.`)
    if ([...markers, ...separators].some(v => /\d/.test(v)) || markers.some(v => separators.includes(v))) throw new Error(`Ký tự điểm/phân tách không hợp lệ: ${type.name}`)
    const bodyStart = match.index! + match[0].length
    const body = source.slice(bodyStart, matches[i+1]?.index ?? source.length)
    const pointPattern = new RegExp(`(\\d+)(${markers.sort((a,b)=>b.length-a.length).map(esc).join('|')})(?!\\p{L})`, 'giu')
    const split = new RegExp(`(?:\\s|${separators.sort((a,b)=>b.length-a.length).map(esc).join('|')})+`, 'u')
    let cursor=0; let found=false
    for (const pointMatch of body.matchAll(pointPattern)) {
      found=true
      const raw = body.slice(cursor, pointMatch.index!+pointMatch[0].length).trim()
      const fragment = `${match[0]} ${raw}`
      const listText = body.slice(cursor, pointMatch.index).split(split).filter(Boolean).join(' ')
      const checkedText = listText
      const unknown = checkedText.match(/[\p{L}][\p{L}\s]*/u)?.[0].trim()
      if (unknown) {
        const firstWord = unknown.match(/[\p{L}][\p{L}\p{M}]*/u)?.[0] ?? unknown
        const rawList = body.slice(cursor, pointMatch.index!)
        invalid(unknown, bodyStart + cursor + Math.max(0, rawList.indexOf(firstWord)), text)
      }
      try {
        if (checkedText.split(' ').filter(Boolean).some(token=>!/^\d+$/.test(token))) throw new Error('Ký tự không được cấu hình')
        if (type.shortcut && listText) throw new Error('Kép chỉ nhận điểm')
        const listing = type.shortcut ? Array.from({length: 10}, (_,i) => `${i}${i}`) : parseSettingNumberListV2(listText, type.formulaId)
        if (!listing.length || new Set(listing).size !== listing.length) throw new Error('Số trùng hoặc thiếu liệt kê')
        parsePointTextV2(pointMatch[1])
        if (isProfileCoefficientFormula(type.formulaId) && !getCoefficientProfileKey(type.formulaId, listing)) throw new Error('Sai độ dài')
        rows.push({ typeId: type.id, listing: listing.join(', '), point: pointMatch[1], source: fragment, ...(type.shortcut ? {specialListing: 'kep' as const} : {}) })
      } catch {
        const rawList = body.slice(cursor, pointMatch.index!)
        const tokenRange = invalidListingRange(text, rawList, split, type.formulaId, !!type.shortcut, bodyStart + cursor)
        const pointStart = bodyStart + pointMatch.index!
        const pointRange = pointMatch[1].length > 4
          ? inputRange(text, pointStart, pointStart + pointMatch[1].length)
          : undefined
        // Exact offending number first; otherwise highlight only the current
        // item, never the full message or a distant group heading.
        throw new AllInputError(fragment, tokenRange ?? pointRange ??
          inputRange(text, bodyStart + cursor, pointStart + pointMatch[0].length))
      }
      cursor=pointMatch.index!+pointMatch[0].length
    }
    if (!found || body.slice(cursor).split(split).filter(Boolean).length) {
      const tail = body.slice(cursor)
      const trimmed = tail.trim()
      invalid(trimmed || match[0], trimmed
        ? bodyStart + cursor + tail.indexOf(trimmed)
        : match.index!, text)
    }
  }
  return rows
}
export function applyAll(group: Group2, types: readonly SettingTypeDefinition[], id: string, text: string, makeId: () => string, shared?: AllInputConfig): Group2 {
  const rows = parseAll(text, types, shared)
  const generated = rows.map(row => ({ ...createGroup3FromDefaults(types.find(t=>t.id===row.typeId)!, makeId(), row.listing, row.point), allSourceId: id, ...(row.specialListing ? {specialListing: row.specialListing} : {}) }))
  return { ...group, groups3: [...group.groups3.filter(row=>row.allSourceId!==id), ...generated], allEntries: upsertMessage(group, id, text) }
}
export function deleteAll(group: Group2, id: string): Group2 {
  return {...group, groups3: group.groups3.filter(row=>row.allSourceId!==id), allEntries: (group.allEntries??[]).filter(row=>row.id!==id)}
}

function upsertMessage(group: Group2, id: string, text: string) {
  const entries = group.allEntries ?? []
  return entries.some(entry => entry.id === id) ? entries.map(entry => entry.id === id ? {id,text} : entry) : [...entries, {id,text}]
}
/** Invalid messages remain editable, but contribute no generated rows. */
export function saveMessage(group: Group2, types: readonly SettingTypeDefinition[], id: string, text: string, makeId: () => string, config?: AllInputConfig): Group2 {
  if (!text.trim()) return deleteAll(group, id)
  try { return applyAll(group, types, id, text, makeId, config) }
  catch { return {...deleteAll(group, id), allEntries: upsertMessage(group, id, text)} }
}
