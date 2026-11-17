import { describe, expect, it } from 'vitest'
import { createCalculationDataV2, createGroup3FromDefaults, addGroup3V2 } from '../../src/core/tree-v2'
import { calculateWorkspaceForA4V2 } from '../../src/core/workspace-calculator-v2'
import { coefficientTypesForName } from '../../src/core/coefficient-settings'
import type { CalculationDataV2, FormulaId } from '../../src/core/models-v2'

function sample(formula: FormulaId = 'lb', listing = '12', point = '5'): CalculationDataV2 {
  const data = createCalculationDataV2()
  for (const type of data.settingTypes) {
    type.defaultCoefficientD = '2'; type.defaultCoefficientT = '3'
    for (const pair of Object.values(type.defaultCoefficientsByCount ?? {})) {
      pair!.coefficientD = '2'; pair!.coefficientT = '3'
    }
  }
  const type = data.settingTypes.find(t => t.formulaId === formula)!
  const row = createGroup3FromDefaults(type, 'row', listing, point)
  // Deliberately wrong legacy snapshots must never control current results.
  row.coefficientD = '99'; row.coefficientT = '99'
  row.coefficientsByCount = { '2': {coefficientD:'99',coefficientT:'99'} }
  data.groups1 = [{kind:'group1', id:'date', dateLabel:'today', drawData:{
    oneToSeven:['12070','07012','59595','14141',...Array.from({length:22},()=> '88999')], gdb:'12170',
  }, groups2:[{kind:'group2',id:'group',name:'Mai',groups3:[row]}]}]
  data.nameCoefficientTypes = { mai: data.settingTypes.map(t => ({
    ...structuredClone(t), defaultCoefficientD:'7', defaultCoefficientT:'11',
    ...(t.defaultCoefficientsByCount ? {defaultCoefficientsByCount:Object.fromEntries(Object.keys(t.defaultCoefficientsByCount).map(key=>[key,{coefficientD:'7',coefficientT:'11'}]))} : {}),
  })) }
  return data
}
function totals(data: CalculationDataV2, mode: 'combined' | 'group2') {
  return calculateWorkspaceForA4V2(data, mode === 'combined' ? {mode,group1Id:'date'} : {mode,group1Id:'date',group2Id:'group',usePrivateCoefficients:true}).summary.totals
}

// Expected values below are hand-calculated from the supplied rules and draw.
// No production calculator is used to generate the expected D/T results.
const cases: [FormulaId, string, number, number, number, number][] = [
  ['lb','070',20,30,70,110], ['la','121',20,30,70,110],
  ['ca','21',10,15,35,55], ['cb','17',10,15,35,55],
  ['da','12 99',10,15,35,55], ['da','121 999',10,15,35,55],
  ['db','70 99',10,15,35,55], ['db','170 999',10,15,35,55],
  ['xa','12 07',10,15,35,55], ['xa','12 07 59',10,15,35,55],
  ['xa','12 07 59 14',10,15,35,55], ['xa','12 07 59 14 88',10,15,35,55],
  ['xb','70 12',10,15,35,55], ['xb','70 12 95',10,15,35,55],
  ['xb','70 12 95 41',10,15,35,55], ['xb','70 12 95 41 99',10,15,35,55],
]
describe('coefficient sources and hand-calculated results', () => {
  it.each(cases)('%s listing %s uses the right scope and coefficients', (formula,listing,d,t,ownD,ownT) => {
    const data=sample(formula,listing)
    const original=structuredClone(data)
    expect(totals(data,'combined')).toMatchObject({d,t,difference:t-d})
    expect(totals(data,'group2')).toMatchObject({d:ownD,t:ownT,difference:ownT-ownD})
    expect(data).toEqual(original)
  })
  it('keeps global edits separate from saved name settings', () => {
    const data=sample('lb','070')
    data.settingTypes[0].defaultCoefficientD='4'; data.settingTypes[0].defaultCoefficientT='6'
    expect(totals(data,'combined')).toMatchObject({d:40,t:60})
    expect(totals(data,'group2')).toMatchObject({d:70,t:110})
  })
  it('falls back to current global settings only for a name or type not configured yet', () => {
    const data=sample('lb','070')
    delete data.nameCoefficientTypes!.mai
    expect(totals(data,'group2')).toMatchObject({d:20,t:30})
    data.nameCoefficientTypes!.mai=[data.settingTypes[1]]
    expect(totals(data,'group2')).toMatchObject({d:20,t:30})
  })
  it('rejects an incomplete name profile instead of borrowing the global one', () => {
    const data=sample('xb','70 12')
    data.nameCoefficientTypes!.mai.find(t=>t.formulaId==='xb')!.defaultCoefficientsByCount={}
    expect(totals(data,'combined')).toMatchObject({d:10,t:15})
    expect(()=>totals(data,'group2')).toThrow(/hệ số Đánh/i)
  })
  it('accepts zero and comma/point decimals in both scopes', () => {
    const data=sample('lb','070')
    data.settingTypes[0].defaultCoefficientD='1,5';data.settingTypes[0].defaultCoefficientT='2.5'
    data.nameCoefficientTypes!.mai[0].defaultCoefficientD='0';data.nameCoefficientTypes!.mai[0].defaultCoefficientT='0'
    expect(totals(data,'combined')).toMatchObject({d:15,t:25})
    expect(totals(data,'group2')).toMatchObject({d:0,t:0})
    const profile=sample('xb','70 12')
    profile.nameCoefficientTypes!.mai.find(t=>t.formulaId==='xb')!.defaultCoefficientsByCount!['2']={coefficientD:'0',coefficientT:'0'}
    expect(totals(profile,'group2')).toMatchObject({d:0,t:0})
  })
  it('does not show partial T when GĐB-only formulas have no GĐB', () => {
    const data=sample('da','12')
    data.groups1[0].drawData.gdb=''
    expect(totals(data,'combined')).toMatchObject({d:10,t:null,difference:null})
    expect(totals(data,'group2')).toMatchObject({d:35,t:null,difference:null})
  })
  it('reports invalid active coefficients and ignores obsolete row snapshots', () => {
    const data=sample('lb','070')
    data.groups1[0].groups2[0].groups3[0].coefficientD='-1'
    expect(totals(data,'group2')).toMatchObject({d:70,t:110})
    for(const value of ['-1','NaN','Infinity','abc','', '9'.repeat(400)]) {
      data.nameCoefficientTypes!.mai[0].defaultCoefficientD=value
      expect(()=>totals(data,'group2')).toThrow(/hệ số Đánh/i)
    }
  })
  it('shares name settings across dates and normalizes case/NFC without changing formula identity', () => {
    const data=sample('lb','070')
    data.groups1[0].groups2[0].name='  MAI '
    data.nameCoefficientTypes!.mai[0].formulaId='la'
    data.nameCoefficientTypes!.mai[0].name='old name'
    expect(coefficientTypesForName(data,'Mai')[0]).toMatchObject({formulaId:'lb',name:'LB'})
    expect(totals(data,'group2')).toMatchObject({d:70,t:110})
    const another=structuredClone(data.groups1[0]);another.id='other-date';another.groups2[0].id='other-group'
    data.groups1.push(another)
    expect(calculateWorkspaceForA4V2(data,{mode:'group2',usePrivateCoefficients:true,group1Id:'other-date',group2Id:'other-group'}).summary.totals).toMatchObject({d:70,t:110})
  })
  it('keeps each name separate and uses the global rate for the combined sum', () => {
    const data=sample('lb','070')
    data.groups1[0].groups2.push({...structuredClone(data.groups1[0].groups2[0]),id:'other',name:'Lan'})
    data.nameCoefficientTypes!.lan=data.settingTypes.map(type=>({...type,defaultCoefficientD:'13',defaultCoefficientT:'17'}))
    expect(totals(data,'combined')).toMatchObject({d:40,t:60})
    expect(totals(data,'group2')).toMatchObject({d:70,t:110})
    expect(calculateWorkspaceForA4V2(data,{mode:'group2',usePrivateCoefficients:true,group1Id:'date',group2Id:'other'}).summary.totals).toMatchObject({d:130,t:170})
  })
  it('adding stale rows cannot overwrite global or per-name scalar/profile coefficients', () => {
    const data=sample('xb','70 12')
    const row={...data.groups1[0].groups2[0].groups3[0],id:'new'}
    const updated=addGroup3V2(data,'date','group',row)
    expect(updated.settingTypes).toEqual(data.settingTypes)
    expect(updated.nameCoefficientTypes).toEqual(data.nameCoefficientTypes)
    expect(totals(updated,'combined')).toMatchObject({d:20,t:30})
    expect(totals(updated,'group2')).toMatchObject({d:70,t:110})
  })
})

it('defaults to shared rates in either view and applies each name separately when opted in',()=>{
 const data=sample('lb','070')
 const second=structuredClone(data.groups1[0].groups2[0]); second.id='other'; second.name='Lan';second.groups3[0].id='other-row'
 data.groups1[0].groups2.push(second)
 data.nameCoefficientTypes!.lan=data.settingTypes.map(t=>({...t,defaultCoefficientD:'13',defaultCoefficientT:'17'}))
 const calc=(privateRates:boolean, group2Id?:string)=>calculateWorkspaceForA4V2(data,group2Id?{mode:'group2',group1Id:'date',group2Id,usePrivateCoefficients:privateRates}:{mode:'combined',group1Id:'date',usePrivateCoefficients:privateRates}).summary.totals
 expect(calc(false,'group')).toMatchObject({d:20,t:30})
 expect(calc(false,'other')).toMatchObject({d:20,t:30})
 expect(calc(false)).toMatchObject({d:40,t:60})
 expect(calc(true,'group')).toMatchObject({d:70,t:110})
 expect(calc(true,'other')).toMatchObject({d:130,t:170})
 expect(calc(true)).toMatchObject({d:200,t:280})
 expect(calc(false)).toMatchObject({d:40,t:60})
})
