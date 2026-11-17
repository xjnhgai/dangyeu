// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import NameCoefficients from '../../src/components/NameCoefficients'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
afterEach(cleanup)
it('places a compact catalog Reset alongside rename and restores factory name and both coefficients', () => {
  const types = createCalculationDataV2().settingTypes
  const da = types.find(type => type.formulaId === 'da')!
  da.name = 'Đề đã đổi'
  da.defaultCoefficientsByCount!['3'] = { coefficientD: '5', coefficientT: '999' }
  const save = vi.fn()
  render(<NameCoefficients catalog name="" types={types} onSave={save} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Reset Đề đã đổi' }))
  const latest = save.mock.lastCall![0].find((type: typeof da) => type.id === da.id)
  expect(latest.name).toBe('ĐA')
  expect(latest.defaultCoefficientsByCount['3']).toEqual({ coefficientD: '0,74', coefficientT: '400' })
  expect(screen.getByLabelText('Tên thiết lập da')).toHaveProperty('value', 'ĐA')
})
it('does not show shared Reset controls when editing private name coefficients', () => {
  render(<NameCoefficients name="Lan" types={createCalculationDataV2().settingTypes} onSave={() => {}} onClose={() => {}} />)
  expect(screen.queryByRole('button', { name: /Reset LB/i })).toBeNull()
})
