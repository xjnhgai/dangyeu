import { describe,it,expect } from 'vitest'
import { parseAll, applyAll, deleteAll } from '../../src/core/all-input'
import { createCalculationDataV2, createGroup3FromDefaults } from '../../src/core/tree-v2'
import { parseSettingNumberListV2 } from '../../src/core/workspace-calculator-v2'
import type { Group2 } from '../../src/core/models-v2'
const types=createCalculationDataV2().settingTypes
const sample='Đề A 171.262.20n 121.676.10n .đề b 050.30n 00.55.10n .lô b 070.5đ 050.4đ 595.141.3đ xiên 14.07.05.40n 14.70.05.40n 14.50.70.30n 14.50.07.30n 14.59.05.30n 14.95.05.30n 07.05.59.30n 05.70.59.30n 95.05.70.30n 95.05.07.30n 59.50.07.20n 59.50.70.20n 95.50.70.20n 95.07.50.20n .07.05.30n 70.50.30n 70.05.30n 59.05.30n 95.05.30n 07.59.30n 70.59.30n 95.70.30n 07.95.30n 07.50.30n'
describe('All records',()=>{
 it('pinpoints a misspelled name after a valid group',()=>{
  expect(()=>parseAll('Đề A 171.262.20n 121.676.10n .đềjjyb 050.30n 00.55.10n .lô b 070.5đ',types)).toThrow(/^Kiểm tra: đềjjyb$/)
 })
 it('parses the full supplied sample and expands only LA/LB',()=>{
  const rows=parseAll(sample,types)
  expect(rows).toHaveLength(31)
  expect(rows[0].listing).toBe('171, 262')
  expect(rows[4].listing).toBe('07, 70')
  expect(rows[4].point).toBe('5')
  expect(rows[6].listing).toBe('59, 95, 14, 41')
  expect(parseAll(sample.toUpperCase(),types).map(r=>[r.typeId,r.listing,r.point])).toEqual(rows.map(r=>[r.typeId,r.listing,r.point]))
 })
 it('rejects duplicates, ambiguous names, unknown text, incomplete tails atomically',()=>{
  expect(()=>parseAll('lô b 070.5đ 111.5đ',types)).toThrow('lô b 111.5đ')
  expect(()=>parseAll('lô b 070.5đ xyz',types)).toThrow()
  expect(()=>parseAll('lô b 070',types)).toThrow()
  expect(()=>parseAll('lô b 070.5đ',types.map(t=>({...t,allAliases:'same'})))).toThrow('trùng')
 })
 it('reports unknown text and unconfigured separators without skipping them',()=>{
  for(const raw of ['abc lô b 070.5đ','lô b 070.5đ abc','lô b 07,70.5đ','abc']) expect(()=>parseAll(raw,types)).toThrow(/Kiểm tra:.*(?:abc|07,70)/)
 })
 it('supports configured aliases, markers and separators',()=>{
  const custom=types.map(t=>t.formulaId==='lb'?{...t,allAliases:'LBe%LBo%LB i',allPointMarkers:'p%đ',allSeparators:'-%.'}:t)
  expect(parseAll('lB    i 070-5P',custom)[0]).toMatchObject({listing:'07, 70',point:'5'})
 })
 it('adds multiple All records and only replaces/deletes its own generated rows',()=>{
  let sequence=0;const id=()=>String(++sequence)
  const manual=createGroup3FromDefaults(types[0],'manual','12','1')
  const group:Group2={kind:'group2',id:'g',name:'A',groups3:[manual]}
  const first=applyAll(group,types,'a','lô b 070.5đ',id)
  const second=applyAll(first,types,'b','lô b 050.4đ',id)
  const edited=applyAll(second,types,'a','lô b 595.3đ',id)
  expect(edited.groups3).toHaveLength(3)
  expect(edited.groups3[0]).toEqual(manual)
  expect(edited.groups3.find(r=>r.allSourceId==='b')?.listing).toBe('05, 50')
  expect(edited.allEntries).toHaveLength(2)
  expect(deleteAll(edited,'a').groups3).toHaveLength(2)
  expect(()=>applyAll(edited,types,'a','lô b 111.5đ',id)).toThrow()
  expect(edited.groups3).toHaveLength(3)
 })
 it('accepts mixed 2/3-digit shorthand only for LA/LB',()=>{
  for(const formula of ['la','lb'] as const) expect(parseSettingNumberListV2('12 070 595',formula)).toEqual(['12','07','70','59','95'])
  expect(()=>parseSettingNumberListV2('12 070','ca')).toThrow()
 })
})

it('uses one explicit configuration for every type, overriding legacy per-type settings',()=>{
 const legacy=types.map(t=>({...t,allPointMarkers:'n',allSeparators:'.'}))
 const config={markers:'p%đ',separators:'-'}
 const rows=parseAll('lô b 070-5p đề a 12-20p đề b 34-7đ',legacy,config)
 expect(rows.map(r=>[r.listing,r.point])).toEqual([['07, 70','5'],['12','20'],['34','7']])
 expect(()=>parseAll('đề a 12.20n',legacy,config)).toThrow()
 expect(()=>parseAll('lô b 070-5p',legacy,{markers:'',separators:'-'})).toThrow()
})
it.each([
 'hdhdhh 11 22 33 44 55',
 'hdhdhh 11 22 lô b 070.5đ',
 'lô b 070.5đ hdhdhh 11 22 33',
 'lô b 070.5đ hdhdhh 11.22.5đ',
])('reports only the unknown word and never accepts partial rows: %s', text=>{
 expect(()=>parseAll(text,types)).toThrow(/^Kiểm tra: hdhdhh$/)
 const group:Group2={kind:'group2',id:'g',name:'A',groups3:[]}
 expect(()=>applyAll(group,types,'a',text,()=> 'row')).toThrow()
 expect(group.groups3).toEqual([])
})

import { saveMessage } from '../../src/core/all-input'
it.each(['kep','kép','KEP','KÉP','Kép'])('rejects bare %s but accepts standalone A/B shorthand', word=>{
 for(const formula of ['da','db'] as const) expect(()=>parseSettingNumberListV2(word,formula)).toThrow()
 expect(()=>parseAll(`đề a ${word}.10n`,types)).toThrow()
 const rows=parseAll(`${word} a 10điểm ${word} b 5đ`,types)
 expect(rows.map(r=>[r.specialListing,r.listing.split(', ').length,r.point])).toEqual([['kep',10,'10'],['kep',10,'5']])
 expect(()=>parseAll(`LA ${word} a 10đ`,types)).toThrow()
})
it('retains invalid messages without stale results and restores results only after correction',()=>{
 let i=0;const next=()=>String(++i)
 const group:Group2={kind:'group2',id:'g',name:'A',groups3:[createGroup3FromDefaults(types[0],'manual','00','2')]}
 const a=saveMessage(group,types,'a','lô b 070.5đ',next)
 const b=saveMessage(a,types,'b','kép b 10n',next)
 const invalid=saveMessage(b,types,'a','lô b jjy 070.5đ',next)
 expect(invalid.groups3.map(row=>row.id)).toEqual([b.groups3[0].id,b.groups3[2].id])
 expect(invalid.allEntries?.map(row=>row.id)).toEqual(['a','b'])
 expect(invalid.allEntries?.[0].text).toBe('lô b jjy 070.5đ')
 const fixed=saveMessage(invalid,types,'a','lô b 12.3đ',next)
 expect(fixed.groups3).toHaveLength(3)
 expect(fixed.groups3.at(-1)?.point).toBe('3')
 const empty=saveMessage(fixed,types,'a',' \n ',next)
 expect(empty.groups3).toHaveLength(2)
 expect(empty.allEntries?.map(row=>row.id)).toEqual(['b'])
})
