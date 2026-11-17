#!/usr/bin/env python3
"""Apply a narrowly scoped Tin nhan error-highlight precision patch to dangyeu.

Only src/core/all-input.ts and src/components/AllEditor.tsx are touched.
The existing parser, calculations, saved data and JSX/CSS layout remain unchanged.
Run from the project root: python fix_message_error_highlight.py
"""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path.cwd()
CORE = ROOT / 'src/core/all-input.ts'
UI = ROOT / 'src/components/AllEditor.tsx'


def swap(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    if count != 1:
        raise ValueError(f'{label}: expected exactly one anchor, found {count}. No files changed.')
    return src.replace(old, new, 1)


def patch_core(s: str) -> str:
    s = swap(s,
        '''  fragment: string
  constructor(fragment: string) {
    super(`Kiểm tra: ${fragment.length > 60 ? fragment.slice(0, 60) + '…' : fragment}`)
    this.fragment = fragment
  }''',
        '''  fragment: string
  readonly range?: { start: number; end: number }
  constructor(fragment: string, range?: { start: number; end: number }) {
    super(`Kiểm tra: ${fragment.length > 60 ? fragment.slice(0, 60) + '…' : fragment}`)
    this.fragment = fragment
    this.range = range
  }''', 'AllInputError')

    s = swap(s,
        '''function invalid(fragment: string): never {
  // Unknown words are actionable without repeating the following numeric payload.
  const word = fragment.match(/[\\p{L}][\\p{L}\\p{M}]*/u)?.[0]
  throw new AllInputError(word ?? fragment.trim().split(/\\s+/)[0] ?? '')
}''',
        '''// Map positions in the parser's NFC/whitespace-normalized text back to the
// original textarea string (including line breaks and decomposed accents).
// Called only for invalid input; normal parsing is untouched.
function originalOffset(text: string, normalizedIndex: number): number {
  let low = 0, high = text.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const length = text.slice(0, mid).normalize('NFC').replace(/\\s+/g, ' ').length
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
  const word = fragment.match(/[\\p{L}][\\p{L}\\p{M}]*/u)?.[0]
  const token = word ?? fragment.trim().split(/\\s+/)[0] ?? ''
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
}''', 'error position helpers')

    s = swap(s, 'if (!matches.length) invalid(source)', 'if (!matches.length) invalid(source, 0, text)', 'no aliases')
    s = swap(s, 'if (prefix.split(prefixPattern).filter(Boolean).length) invalid(prefix)', 'if (prefix.split(prefixPattern).filter(Boolean).length) invalid(prefix, 0, text)', 'bad prefix')
    s = swap(s,
        '''    const body = source.slice(match.index!+match[0].length, matches[i+1]?.index ?? source.length)''',
        '''    const bodyStart = match.index! + match[0].length
    const body = source.slice(bodyStart, matches[i+1]?.index ?? source.length)''', 'body offset')
    s = swap(s,
        '''      if (unknown) invalid(unknown)''',
        '''      if (unknown) {
        const firstWord = unknown.match(/[\\p{L}][\\p{L}\\p{M}]*/u)?.[0] ?? unknown
        const rawList = body.slice(cursor, pointMatch.index!)
        invalid(unknown, bodyStart + cursor + Math.max(0, rawList.indexOf(firstWord)), text)
      }''', 'unknown word')
    s = swap(s,
        '''      } catch { throw new AllInputError(fragment) }
      cursor=pointMatch.index!+pointMatch[0].length''',
        '''      } catch {
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
      cursor=pointMatch.index!+pointMatch[0].length''', 'validation catch')
    s = swap(s,
        '''    if (!found || body.slice(cursor).split(split).filter(Boolean).length) invalid(body.slice(cursor).trim() || match[0])''',
        '''    if (!found || body.slice(cursor).split(split).filter(Boolean).length) {
      const tail = body.slice(cursor)
      const trimmed = tail.trim()
      invalid(trimmed || match[0], trimmed
        ? bodyStart + cursor + tail.indexOf(trimmed)
        : match.index!, text)
    }''', 'trailing input')
    return s


def patch_ui(s: str) -> str:
    s = swap(s,
        "if(!text.trim()) return {rows:[],error:'',fragment:''}",
        "if(!text.trim()) return {rows:[],error:'',fragment:'',range:null}",
        'empty message')
    s = swap(s,
        "try { return {rows:parseAll(text,types,config),error:'',fragment:''} }",
        "try { return {rows:parseAll(text,types,config),error:'',fragment:'',range:null} }",
        'valid message')
    s = swap(s,
        "catch(e) { return {rows:[],error:(e as Error).message,fragment:e instanceof AllInputError ? e.fragment : ''} }",
        "catch(e) { return {rows:[],error:(e as Error).message,fragment:e instanceof AllInputError ? e.fragment : '',range:e instanceof AllInputError ? (e.range ?? null) : null} }",
        'invalid message')
    s = swap(s,
        'const range=allErrorRange(text,parsed.fragment)',
        'const range=parsed.range ?? allErrorRange(text,parsed.fragment)',
        'highlight rendering')
    return s


def main() -> None:
    if not CORE.is_file() or not UI.is_file():
        raise FileNotFoundError('Run from the dangyeu-github repository root (src/core/all-input.ts not found).')
    core_raw, ui_raw = CORE.read_bytes(), UI.read_bytes()
    core_eol = '\r\n' if b'\r\n' in core_raw else '\n'
    ui_eol = '\r\n' if b'\r\n' in ui_raw else '\n'
    current_core = core_raw.decode('utf-8').replace('\r\n', '\n')
    current_ui = ui_raw.decode('utf-8').replace('\r\n', '\n')
    # Stage both transforms before writing anything; no half-applied patch.
    updated_core = patch_core(current_core)
    updated_ui = patch_ui(current_ui)
    CORE.write_bytes(updated_core.replace('\n', core_eol).encode('utf-8'))
    UI.write_bytes(updated_ui.replace('\n', ui_eol).encode('utf-8'))
    print('OK: updated error highlighting only:')
    print('  src/core/all-input.ts')
    print('  src/components/AllEditor.tsx')
    print('Run: npm.cmd test; npm.cmd run lint; npm.cmd run build')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Patch not applied: {exc}', file=sys.stderr)
        sys.exit(1)
