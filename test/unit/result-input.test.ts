import { describe, expect, it } from 'vitest'
import { formatResultInput, resultNumbers } from '../../src/core/result-input'
import { parseOneToSevenTextV2 } from '../../src/core/workspace-calculator-v2'

describe('result commands', () => {
  const cases = [
    ['1', '0012312345', '00123 12345'],
    ['2', '1131251790', '11312 51790'],
    ['3', '446263233434538303774026528940', '44626 32334 34538 30377 40265 28940'],
    ['4', '8890251416206160', '8890 2514 1620 6160'],
    ['5', '455643768015404868788916', '4556 4376 8015 4048 6878 8916'],
    ['6', '111198517', '111 198 517'],
    ['7', '31287348', '31 28 73 48'],
  ]
  for (const [group, digits, expected] of cases) {
    it(`splits group ${group} with digit then comma`, () => {
      for (const marker of [`${group},`]) {
        const formatted = formatResultInput(`${marker}\t${digits}`)
        expect(formatted).toBe(`${marker}\t${expected}`)
        expect(formatResultInput(formatted)).toBe(formatted)
        expect(resultNumbers(formatted)).toEqual(expected.split(' '))
      }
    })
  }
  it('excludes commands from all 26 calculation values', () => {
    const text = '1, 12345\n' + cases.slice(1).map(([group, digits]) => `${group}, ${digits}`).join('\n')
    const numbers = parseOneToSevenTextV2(text)
    expect(numbers).toHaveLength(26)
    expect(numbers[0]).toBe('12345')
    expect(numbers.at(-1)).toBe('48')
  })
  it('does not treat comma before digit as a command', () => {
    expect(formatResultInput(',2 1131251790')).toBe(',2 1131251790')
    expect(() => parseOneToSevenTextV2(',2 1131251790')).toThrow()
  })
  it('preserves ordinary comma-separated lists and leading zeros', () => {
    expect(resultNumbers('11,22,33,44,05')).toEqual(['11','22','33','44','05'])
    expect(formatResultInput('11,22,33')).toBe('11,22,33')
  })
  it('rejects incomplete groups without dropping any digits', () => {
    expect(formatResultInput('4, 123456')).toBe('4, 1234 56')
    expect(() => resultNumbers('4, 123456')).toThrow()
  })
  it('supports sequential typing and switching commands', () => {
    let value = ''
    for (const key of '2,1131251790\n7,31287348') value = formatResultInput(value + key)
    expect(value).toBe('2, 11312 51790\n7, 31 28 73 48')
  })
})
