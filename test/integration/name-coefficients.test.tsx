// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import NameCoefficients from '../../src/components/NameCoefficients'
import { createCalculationDataV2 } from '../../src/core/tree-v2'

afterEach(cleanup)
it('autosaves each valid field on blur, keeping zero/decimals and previously saved values when another field is invalid',()=>{
  const types=createCalculationDataV2().settingTypes
  const da=types.find(t=>t.formulaId==='da')!
  da.defaultCoefficientD=null;da.defaultCoefficientT=null
  const save=vi.fn();const close=vi.fn()
  render(<NameCoefficients name="Lan" types={types} onSave={save} onClose={close} />)
  const edit=(label:string,value:string)=>{const input=screen.getByLabelText(label);fireEvent.change(input,{target:{value}});fireEvent.blur(input)}
  edit('ĐA Hệ số Đánh (2 chữ số)','0')
  edit('ĐA Hệ số Trúng (2 chữ số)','0')
  expect(save).toHaveBeenCalledTimes(2)
  edit('XA Hệ số Trúng (4 số)','')
  expect(save).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('alert').textContent).toContain('XA')
  edit('XA Hệ số Đánh (4 số)','1,5')
  expect(save).toHaveBeenCalledTimes(3)
  expect(save.mock.lastCall![0].find((t:typeof da)=>t.formulaId==='xa').defaultCoefficientsByCount['4']).toEqual({coefficientD:'1,5',coefficientT:'1'})
  fireEvent.click(screen.getByRole('button',{name:'Đóng hệ số theo tên'}))
  expect(close).not.toHaveBeenCalled()
  edit('XA Hệ số Trúng (4 số)','2.5')
  expect(save).toHaveBeenCalledTimes(4)
  const saved=save.mock.lastCall![0]
  expect(saved.find((t: typeof da)=>t.id===da.id).defaultCoefficientsByCount['2']).toEqual({coefficientD:'0',coefficientT:'0'})
  expect(types.find(t=>t.id===da.id)!.defaultCoefficientsByCount!['2']!.coefficientD).toBe('1')
  fireEvent.blur(screen.getByLabelText('XA Hệ số Trúng (4 số)'))
  expect(save).toHaveBeenCalledTimes(4)
  fireEvent.click(screen.getByRole('button',{name:'Đóng hệ số theo tên'}))
  expect(close).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button',{name:'Lưu hệ số'})).toBeNull()
})
it('flushes the last focused valid input when closing',()=>{
  const save=vi.fn();const close=vi.fn()
  render(<NameCoefficients name="Mai" types={createCalculationDataV2().settingTypes} onSave={save} onClose={close} />)
  fireEvent.change(screen.getByLabelText('LB Hệ số Đánh'),{target:{value:'4'}})
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Đóng hệ số theo tên'}))
  expect(save.mock.lastCall![0][0].defaultCoefficientD).toBe('4')
  expect(close).toHaveBeenCalledOnce()
})
