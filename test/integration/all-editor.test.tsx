// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AllEditor from '../../src/components/AllEditor'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import type { Group2 } from '../../src/core/models-v2'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('previews, saves and edits one linked All without changing another',()=>{
 const changes=vi.fn()
 function Host(){
  const [group,setGroup]=useState<Group2>({kind:'group2',id:'g',name:'A',groups3:[]})
  return <AllEditor group={group} types={createCalculationDataV2().settingTypes} onClose={()=>{}} onChange={g=>{setGroup(g);changes(g)}}/>
 }
 render(<Host/> )
 const input=screen.getByLabelText('Dữ liệu All')
 fireEvent.change(input,{target:{value:'lô b 070.5đ'}})
 expect(screen.getByText(/07, 70 · Điểm 5/)).toBeTruthy()
 fireEvent.blur(input)
 expect(changes.mock.lastCall![0].groups3[0].allSourceId).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Thêm All'}))
 fireEvent.change(input,{target:{value:'lô b 050.4đ'}})
 fireEvent.blur(input)
 expect(changes.mock.lastCall![0].groups3).toHaveLength(2)
 fireEvent.click(screen.getByText('All 1'))
 fireEvent.change(input,{target:{value:'lô b 111.5đ'}})
 expect(screen.getByRole('alert').textContent).toContain('lô b 111.5đ')
 fireEvent.blur(input)
 expect(changes).toHaveBeenCalledTimes(2)
 fireEvent.change(input,{target:{value:'lô b 595.3đ'}})
 fireEvent.blur(input)
 expect(changes.mock.lastCall![0].groups3).toHaveLength(2)
 expect(changes.mock.lastCall![0].groups3.map((r:{listing:string})=>r.listing)).toEqual(['05, 50','59, 95'])
 fireEvent.blur(input)
 expect(changes).toHaveBeenCalledTimes(3)
 const confirmation=vi.spyOn(window,'confirm')
 fireEvent.click(screen.getByRole('button',{name:'Xóa All'}))
 expect(changes.mock.lastCall![0].groups3.map((r:{listing:string})=>r.listing)).toEqual(['05, 50'])
 expect(changes.mock.lastCall![0].allEntries).toHaveLength(1)
 expect(confirmation).not.toHaveBeenCalled()
 expect(screen.queryByText('Xem trước')).toBeNull()
 expect(screen.queryByText('Lưu All')).toBeNull()
})

it('highlights only the unknown word, retains input, and does not save invalid text',()=>{
 const onChange=vi.fn()
 render(<AllEditor group={{kind:'group2',id:'g',name:'A',groups3:[]}} types={createCalculationDataV2().settingTypes} onChange={onChange} onClose={()=>{}} config={{markers:'p',separators:'-'}} />)
 const input=screen.getByLabelText('Dữ liệu All') as HTMLTextAreaElement
 fireEvent.change(input,{target:{value:'hdhdhh 11 22 33 44 55'}})
 expect(screen.getByRole('alert').textContent).toBe('Kiểm tra: hdhdhh')
 expect(document.querySelector('.all-text-highlight mark')?.textContent).toBe('hdhdhh')
 expect(input.value).toBe('hdhdhh 11 22 33 44 55')
 fireEvent.blur(input)
 expect(onChange).not.toHaveBeenCalled()
 fireEvent.change(input,{target:{value:'lô b 070-5p đề a 12-20p'}})
 expect(screen.queryByRole('alert')).toBeNull()
 expect(document.querySelector('.all-text-highlight mark')).toBeNull()
 fireEvent.blur(input)
 expect(onChange.mock.lastCall![0].groups3.map((r:{point:string})=>r.point)).toEqual(['5','20'])
})
