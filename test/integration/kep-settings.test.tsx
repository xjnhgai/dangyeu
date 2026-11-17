// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import { saveMessage, parseAll } from '../../src/core/all-input'
import { calculateWorkspaceForA4V2, getCoefficientProfileKey } from '../../src/core/workspace-calculator-v2'
import { calculateSetting } from '../../src/core/calculation'
import { paperSections } from '../../src/core/paper-sections'
import A4PageV2 from '../../src/components/A4PageV2'
import NameCoefficients from '../../src/components/NameCoefficients'
import AllEditor from '../../src/components/AllEditor'
import type { Group2 } from '../../src/core/models-v2'
afterEach(()=>{cleanup(); document.head.innerHTML='';vi.restoreAllMocks()})
function sample(text:string,gdb:string) {
 const data=createCalculationDataV2();let i=0
 const group:Group2={kind:'group2',id:'g',name:'Mai',groups3:[]}
 data.groups1=[{kind:'group1',id:'d',dateLabel:'17/11/2026',drawData:{gdb,oneToSeven:[]},groups2:[saveMessage(group,data.settingTypes,'m',text,()=>`r${++i}`)]}]
 return data
}
it.each([['kép a','11002','kép A','da'],['KÉP B','12399','kép B','db']])('calculates and renders %s as one matched row, with 10 times its points', (text,gdb,label,formula)=>{
 const data=sample(`${text} 10điểm`,gdb)
 const result=calculateWorkspaceForA4V2(data,{mode:'combined',group1Id:'d',usePrivateCoefficients:true})
 expect(result.projection.sections[0].entries[0].settingType.formulaId).toBe(formula)
 expect(result.summary.totals.d).toBeCloseTo(7.4)
 expect(result.summary.totals.t).toBe(700)
 expect(paperSections(result.projection.sections)[0].pointTotal).toBe(100)
 render(<A4PageV2 projection={result.projection} results={result.settingResults} summary={result.summary}/>)
 const listing=document.querySelectorAll('.a4-v2-number')
 expect(listing).toHaveLength(1);expect(listing[0].textContent).toBe(label);expect(listing[0].classList.contains('is-matched')).toBe(true)
 expect(document.querySelector('.a4-v2-point')?.textContent).toBe('10')
 expect(document.querySelector('.a4-v2-result-point b')?.textContent).toBe('100')
})
it('matches only the appropriate end of GDB and never 1–7 for doubles',()=>{
 const data=sample('kép a 5đ kép b 7đ','12344')
 data.groups1[0].drawData.oneToSeven=['11000']
 const r=calculateWorkspaceForA4V2(data,{mode:'combined',group1Id:'d'})
 expect([...r.settingResults.values()].map(v=>v.t)).toEqual([0,490])
 data.groups1[0].drawData.gdb=''
 expect([...calculateWorkspaceForA4V2(data,{mode:'combined',group1Id:'d'}).settingResults.values()].every(r=>r.t===null)).toBe(true)
})
it('supports renamed standalone shortcuts and ampersand aliases after serialization',()=>{
 const data=createCalculationDataV2();const da=data.settingTypes.find(t=>t.formulaId==='da')!
 da.kepName='đôi A';da.kepAliases='doi a&double a'
 const types=JSON.parse(JSON.stringify(data.settingTypes))
 for(const name of ['đôi A','DOI A','double a']) expect(parseAll(`${name} 10điểm`,types)[0]).toMatchObject({typeId:da.id,specialListing:'kep',point:'10'})
 expect(()=>parseAll('ĐA đôi A 10đ',types)).toThrow()
 expect(()=>parseAll('đôi A 11 10đ',types)).toThrow()
})
it.each(['xa','xb'] as const)('rejects five-number %s input in parser and calculation',formula=>{
 const types=createCalculationDataV2().settingTypes
 expect(()=>parseAll(`${formula} 11 22 33 44 55 10đ`,types)).toThrow()
 expect(getCoefficientProfileKey(formula,['11','22','33','44','55'])).toBeNull()
 expect(()=>calculateSetting({formulaId:formula,listing:['11','22','33','44','55'],point:10,coefficientD:1,coefficientT:1,oneToSeven:[]})).toThrow()
})
it('keeps metadata edits and autosaved coefficient edits together',()=>{
 const save=vi.fn(),close=vi.fn();const types=createCalculationDataV2().settingTypes
 render(<NameCoefficients catalog name="" types={types} onSave={save} onClose={close}/>)
 fireEvent.change(screen.getByLabelText('LB Hệ số Đánh'),{target:{value:'9'}})
 fireEvent.blur(screen.getByLabelText('LB Hệ số Đánh'))
 fireEvent.change(screen.getByLabelText('Tên thiết lập lb'),{target:{value:'Lo B'}})
 fireEvent.change(screen.getByLabelText('Tên kép da'),{target:{value:'Đôi A'}})
 fireEvent.change(screen.getByLabelText('Tên khác kép da'),{target:{value:'doi a&double a'}})
 fireEvent.click(screen.getByRole('button',{name:'Đóng cửa sổ chỉnh sửa'}))
 expect(close).toHaveBeenCalledOnce()
 expect(save.mock.lastCall![0][0]).toMatchObject({name:'Lo B',defaultCoefficientD:'9'})
 expect(parseAll('double a 10đ',save.mock.lastCall![0])[0].specialListing).toBe('kep')
})
it('pastes plain text using identical input/highlight font metrics with either CSS order',async()=>{
 const css=['src/App.css','src/refresh.css'].map(file=>readFileSync(file,'utf8'))
 const readText=vi.fn().mockResolvedValue('LB 11 22 10đ')
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText}})
 render(<AllEditor group={{kind:'group2',id:'g',name:'Mai',groups3:[]}} types={createCalculationDataV2().settingTypes} onChange={()=>{}} onClose={()=>{}}/>)
 fireEvent.click(screen.getByRole('button',{name:'Dán Tin nhắn'}))
 await vi.waitFor(()=>expect((screen.getByLabelText('Dữ liệu Tin nhắn') as HTMLTextAreaElement).value).toBe('LB 11 22 10đ'))
 for(const order of [css,[...css].reverse()]) {
  document.head.innerHTML='';for(const text of order){const style=document.createElement('style');style.textContent=text;document.head.append(style)}
  const input=getComputedStyle(screen.getByLabelText('Dữ liệu Tin nhắn'))
  const layer=getComputedStyle(document.querySelector('.all-text-highlight')!)
  expect(input.fontFamily).toBe(layer.fontFamily);expect(input.fontFamily).toContain('Arial')
  expect(input.fontSize).toBe(layer.fontSize);expect(input.lineHeight).toBe(layer.lineHeight)
 }
})
