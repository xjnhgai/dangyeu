// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
const appCss = readFileSync('src/App.css', 'utf8')
const paperCss = readFileSync('src/styles/A4PageV2.css', 'utf8')

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = '' })

it.each([[appCss, paperCss], [paperCss, appCss]])('keeps all three amount rows aligned regardless of CSS import order', (first, second) => {
  for (const css of [first, second]) {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
  }
  document.body.innerHTML = `<div class="a4-v2-section-results is-visible">${[
    ['point', 'Điểm:', '10'], ['d', 'Đánh:', '80'], ['t', 'Trúng:', '100'],
  ].map(([type, label, value]) => `<span class="a4-v2-result-${type}"><span class="a4-v2-result-label">${label}</span><b>${value}</b></span>`).join('')}</div>`
  for (const row of document.querySelectorAll('.a4-v2-section-results > span')) {
    const style = getComputedStyle(row)
    expect(style.display).toBe('grid')
    expect(style.gridColumn).toBe('1 / -1')
    expect(style.gridTemplateColumns).toBe('3em max-content')
    expect(getComputedStyle(row.querySelector('.a4-v2-result-label')!).width).toBe('auto')
    expect(getComputedStyle(row.querySelector('b')!).textAlign).toBe('left')
  }
})
