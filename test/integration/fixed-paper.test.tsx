// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import A4PageV2 from '../../src/components/A4PageV2'
import { buildA4ProjectionV2 } from '../../src/core/a4-v2'
import { createCalculationDataV2, createGroup3FromDefaults } from '../../src/core/tree-v2'
import type { A4SummaryV2 } from '../../src/core/summary-v2'

afterEach(()=>{cleanup();vi.restoreAllMocks()})
function projection(count:number) {
  const data=createCalculationDataV2()
  data.groups1=[{kind:'group1',id:'a4',dateLabel:'16/11/2026',drawData:{oneToSeven:[],gdb:''},groups2:[{kind:'group2',id:'g',name:'Lan',groups3:[createGroup3FromDefaults(data.settingTypes[0],'row',Array.from({length:count},(_,i)=>String(i%100).padStart(2,'0')).join(' '),'10')]}]}]
  return buildA4ProjectionV2(data,{mode:'group2',group1Id:'a4',group2Id:'g'})
}
it('adds fixed sheets rather than growing a sheet or losing long listings',()=>{
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390)
  const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(640)
  const short=projection(1), long=projection(1000)
  const {rerender}=render(<A4PageV2 projection={short} results={new Map()} showCalculation={false}/>)
  expect(document.querySelectorAll('.a4-v2-page')).toHaveLength(1)
  expect((document.querySelector('.a4-v2-page') as HTMLElement).style.height).toBe('640px')
  height.mockReturnValue(280)
  rerender(<A4PageV2 projection={long} results={new Map()} showCalculation={false}/>)
  fireEvent(window,new Event('resize'))
  const pages=[...document.querySelectorAll<HTMLElement>('.a4-v2-page')]
  expect(pages.length).toBeGreaterThan(1)
  expect(pages.every(page=>page.style.width==='390px' && page.style.height==='640px')).toBe(true)
  expect([...document.querySelectorAll('.a4-v2-number')].map(node=>node.textContent)).toEqual(Array.from({length:1000},(_,i)=>String(i%100).padStart(2,'0')))
  expect([...document.querySelectorAll('.a4-v2-point')].map(node=>node.textContent).filter(Boolean)).toEqual(['10'])
  expect(document.querySelectorAll('.a4-v2-total-area')).toHaveLength(1)
  expect((document.querySelector('.a4-v2-zoom-frame') as HTMLElement).style.height).toBe(`${pages.length*652-12}px`)
})
it('renders Point, D and T as three distinct label/value pairs without duplicating totals on continuations',()=>{
  const p=projection(200)
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390)
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(640)
  const summary:A4SummaryV2={mode:'group2',sections:[{settingTypeId:p.sections[0].settingTypeId,title:'LB',totals:{settingCount:1,d:80,t:100,difference:20}}],totals:{settingCount:1,d:80,t:100,difference:20}}
  render(<A4PageV2 projection={p} results={new Map()} summary={summary}/>)
  const totals=document.querySelectorAll('.a4-v2-section-results.is-visible')
  expect(totals).toHaveLength(1)
  expect([...totals[0].children].map(node=>[node.querySelector('.a4-v2-result-label')?.textContent,node.querySelector('b')?.textContent])).toEqual([['Điểm:','10'],['Đánh:','80'],['Trúng:','100']])
})
