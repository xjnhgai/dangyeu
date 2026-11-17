// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AllEditor from '../../src/components/AllEditor'
import { createCalculationDataV2 } from '../../src/core/tree-v2'
import type { Group2 } from '../../src/core/models-v2'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
function host(initial: Group2 = {kind:'group2',id:'g',name:'A',groups3:[]}) {
 const changes=vi.fn(), close=vi.fn()
 function Host(){
  const [group,setGroup]=useState(initial)
  return <AllEditor group={group} types={createCalculationDataV2().settingTypes} onClose={close} onChange={g=>{setGroup(g);changes(g)}}/>
 }
 render(<Host/>)
 return {changes,close,input:screen.getByLabelText('Dữ liệu Tin nhắn') as HTMLTextAreaElement}
}
it('groups the preview by type once and saves multiple messages independently',()=>{
 const {changes,input}=host()
 fireEvent.change(input,{target:{value:'lô b 11.22.10đ 44.55.5đ lô a 12.34.3đ'}})
 const preview=screen.getByLabelText('Dữ liệu đã phân nhóm')
 expect(preview.querySelectorAll('strong')).toHaveLength(2)
 expect(preview.textContent).toContain('LB:11, 22 | 10 Điểm44, 55 | 5 Điểm')
 fireEvent.blur(input)
 const firstId=changes.mock.lastCall![0].allEntries[0].id
 fireEvent.click(screen.getByRole('button',{name:'Thêm Tin nhắn'}))
 fireEvent.change(input,{target:{value:'KÉP b 2n'}})
 fireEvent.blur(input)
 expect(changes.mock.lastCall![0].groups3).toHaveLength(4)
 fireEvent.click(screen.getByRole('button',{name:'Tin 1'}))
 fireEvent.change(input,{target:{value:'lô b 070.5đ'}})
 fireEvent.blur(input)
 expect(changes.mock.lastCall![0].allEntries[0].id).toBe(firstId)
 expect(changes.mock.lastCall![0].groups3.map((r:{point:string})=>r.point)).toEqual(['2','5'])
 const confirmation=vi.spyOn(window,'confirm')
 fireEvent.click(screen.getByRole('button',{name:'Xóa Tin nhắn'}))
 expect(changes.mock.lastCall![0].groups3).toHaveLength(1)
 expect(confirmation).not.toHaveBeenCalled()
})
it('keeps invalid text on close, removes its old rows, and marks only the unknown word without a warning line',()=>{
 const {changes,input,close}=host()
 fireEvent.change(input,{target:{value:'lô b 11.5đ'}});fireEvent.blur(input)
 fireEvent.change(input,{target:{value:'hdhdhh 11 22 33 44 55'}})
 expect(document.querySelector('.all-text-highlight mark')?.textContent).toBe('hdhdhh')
 expect(screen.queryByRole('alert')).toBeNull()
 expect(screen.queryByText(/Kiểm tra:/)).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Đóng Tin nhắn'}))
 expect(close).toHaveBeenCalledOnce()
 expect(changes.mock.lastCall![0].groups3).toEqual([])
 expect(changes.mock.lastCall![0].allEntries[0].text).toBe('hdhdhh 11 22 33 44 55')
 fireEvent.change(input,{target:{value:'lô b 22.5đ'}});fireEvent.blur(input)
 expect(changes.mock.lastCall![0].groups3[0].listing).toBe('22')
})
it('deletes a message and all its generated rows when the input becomes empty',()=>{
 const {changes,input}=host()
 fireEvent.change(input,{target:{value:'lô b 11.5đ'}});fireEvent.blur(input)
 fireEvent.change(input,{target:{value:' \n '}});fireEvent.blur(input)
 expect(changes.mock.lastCall![0].allEntries).toEqual([])
 expect(changes.mock.lastCall![0].groups3).toEqual([])
})
