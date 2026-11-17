import { it, expect } from 'vitest'
import { paperSections } from '../../src/core/paper-sections'
import { createCalculationDataV2, createGroup3FromDefaults } from '../../src/core/tree-v2'
it('wraps long groups into new rows without losing entries or repeating points',()=>{
 const type=createCalculationDataV2().settingTypes[0]
 const values=Array.from({length:100},(_,i)=>String(i).padStart(2,'0'))
 const entry={group2Id:'g',settingType:type,group3:createGroup3FromDefaults(type,'long',values.join(' '),'5')}
 const sections=[{settingTypeId:type.id,title:'LB',entries:[entry]}]
 const chunks=paperSections(sections)
 expect(chunks.length).toBeGreaterThan(1)
 expect(chunks.every(c=>!c.newRow)).toBe(true)
 const slices=chunks.flatMap(c=>c.entries)
 expect(slices.flatMap(s=>values.slice(s.start,s.end))).toEqual(values)
 expect(slices.filter(s=>s.showPoint)).toHaveLength(1)
 expect(chunks.filter(c=>c.last)).toHaveLength(1)
 expect(chunks.at(-1)?.pointTotal).toBe(500)
 expect(entry.group3.listing).toBe(values.join(' '))
})

import { paperPages } from '../../src/core/paper-sections'
it('respects 90% height across phone sizes and keeps continuation columns within fixed sheets',()=>{
 const type=createCalculationDataV2().settingTypes[0]
 const values=Array.from({length:1800},(_,i)=>String(i%100).padStart(2,'0'))
 const entry={group2Id:'g',settingType:type,group3:createGroup3FromDefaults(type,'long',values.join(' '),'5')}
 for(const [width,height] of [[320,480],[390,640],[794,900],[390,300]]) {
  const top=82
  const layout=paperPages([{settingTypeId:type.id,title:'LB',entries:[entry]}],width,height,top)
  expect(layout.pages.length).toBeGreaterThan(1)
  for(const page of layout.pages) {
   expect(page.length).toBeLessThanOrEqual(layout.columns)
   for(const col of page) {
    expect(col.height).toBeLessThanOrEqual(layout.columnHeight)
    expect(top+col.height).toBeLessThanOrEqual(height*.9)
   }
  }
  const slices=layout.pages.flat().flatMap(col=>col.entries)
  expect(slices.flatMap(s=>values.slice(s.start,s.end))).toEqual(values)
  expect(slices.filter(s=>s.showPoint)).toHaveLength(1)
 }
})

it('reserves the measured height of wrapped setting titles',()=>{
 const type=createCalculationDataV2().settingTypes[0]
 const entry={group2Id:'g',settingType:type,group3:createGroup3FromDefaults(type,'long',Array.from({length:150},()=> '12').join(' '),'5')}
 const layout=paperPages([{settingTypeId:type.id,title:'Tên thiết lập dài',entries:[entry]}],390,640,82,{[type.id]:60})
 for(const column of layout.pages.flat()) expect(82+column.height).toBeLessThanOrEqual(640*.9)
})

it('counts expanded numbers times points for every formula, including shorthand',()=>{
 const types=createCalculationDataV2().settingTypes
 for(const [formula,listing,expected] of [['lb','070 12',15],['la','121',10],['da','kép',50],['db','KEP',50],['da','12 34',10],['xb','12 34 56',15],['xa','12 34',10],['ca','12 34',10],['cb','12 34',10]] as const){
  const type=types.find(t=>t.formulaId===formula)!
  const entry={group2Id:'g',settingType:type,group3:createGroup3FromDefaults(type,'r',listing,'5')}
  expect(paperSections([{settingTypeId:type.id,title:type.name,entries:[entry]}]).at(-1)?.pointTotal).toBe(expected)
 }
})
