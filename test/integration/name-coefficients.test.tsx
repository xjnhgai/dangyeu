// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import NameCoefficients from '../../src/components/NameCoefficients'
import { createCalculationDataV2 } from '../../src/core/tree-v2'

afterEach(cleanup)
it('validates only displayed profiles, preserves zero, and rejects missing visible coefficients',()=>{
  const types=createCalculationDataV2().settingTypes
  const da=types.find(t=>t.formulaId==='da')!
  da.defaultCoefficientD=null;da.defaultCoefficientT=null // hidden legacy scalar fields
  const save=vi.fn()
  render(<NameCoefficients name="Lan" types={types} onSave={save} onClose={()=>{}} />)
  fireEvent.change(screen.getByLabelText('ĐA Hệ số Đánh (2 chữ số)'),{target:{value:'0'}})
  fireEvent.change(screen.getByLabelText('ĐA Hệ số Trúng (2 chữ số)'),{target:{value:'0'}})
  fireEvent.change(screen.getByLabelText('XA Hệ số Đánh (4 số)'),{target:{value:'1,5'}})
  fireEvent.change(screen.getByLabelText('XA Hệ số Trúng (4 số)'),{target:{value:''}})
  fireEvent.click(screen.getByRole('button',{name:'Lưu hệ số'}))
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toContain('XA')
  fireEvent.change(screen.getByLabelText('XA Hệ số Trúng (4 số)'),{target:{value:'2.5'}})
  fireEvent.click(screen.getByRole('button',{name:'Lưu hệ số'}))
  expect(save).toHaveBeenCalledTimes(1)
  const saved=save.mock.calls[0][0]
  expect(saved.find((t: typeof da)=>t.id===da.id).defaultCoefficientsByCount['2']).toEqual({coefficientD:'0',coefficientT:'0'})
  expect(types.find(t=>t.id===da.id)!.defaultCoefficientsByCount!['2']!.coefficientD).toBe('1')
})
