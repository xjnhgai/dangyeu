/** Only comma followed by a single group digit is a command in the 1–7 field. */
const command = /,([1-7])(?=\s|$)/g
const invalidCommaNumber = /,(?=\d)(?![1-7](?:\s|$))/
const widths: Record<string, number> = { '1': 5, '2': 5, '3': 5, '4': 4, '5': 4, '6': 3, '7': 2 }

export function resultSegments(text: string): { marker: string; body: string; width: number }[] {
  const matches = [...text.matchAll(command)]
  const segments = [{ marker: '', body: text.slice(0, matches[0]?.index ?? text.length), width: 0 }]
  matches.forEach((match, index) => {
    segments.push({ marker: match[0], width: widths[match[1]], body: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length) })
  })
  return segments
}

/** Keep commands visible for editing; only the payload is consumed by calculations. */
export function formatResultInput(text: string): string {
  if (invalidCommaNumber.test(text)) return text
  return resultSegments(text).map(({ marker, body, width }) => {
    if (!width) return body
    const formatted = body.replace(/\d+/g, (digits) => digits.match(new RegExp(`.{1,${width}}`, 'g'))!.join(' '))
    return marker + (formatted.startsWith(' ') || /^\s/.test(formatted) ? '' : ' ') + formatted
  }).join('')
}

export function resultNumbers(text: string): string[] {
  if (invalidCommaNumber.test(text)) throw new Error('Nhập sai số')
  return resultSegments(text).flatMap(({ body, width }) => {
    const tokens = body.trim().split(/[\s,]+/).filter(Boolean)
    if (!width) return tokens
    return tokens.flatMap((token) => {
      if (!/^\d+$/.test(token) || token.length % width !== 0) throw new Error('Nhập sai số')
      return token.match(new RegExp(`.{${width}}`, 'g')) ?? []
    })
  })
}
