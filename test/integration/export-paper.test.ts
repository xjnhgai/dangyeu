// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { exportPaper } from '../../src/core/export-paper'
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks()})
it('exports the rendered phone paper geometry independent of pinch zoom and excludes controls',async()=>{
 Object.defineProperty(document,'fonts',{configurable:true,value:{ready:Promise.resolve()}})
 const page=document.createElement('article');page.innerHTML='<button>Back</button><span style="font-size:10px;color:rgb(10, 20, 30)">12</span>';document.body.append(page)
 Object.defineProperty(page,'offsetWidth',{value:390})
 vi.spyOn(page,'getBoundingClientRect').mockReturnValue({left:10,top:20,width:780,height:1400,right:790,bottom:1420,x:10,y:20,toJSON(){}})
 const text=page.querySelector('span')!
 vi.spyOn(text,'getBoundingClientRect').mockReturnValue({left:30,top:40,width:24,height:20,right:54,bottom:60,x:30,y:40,toJSON(){}})
 Object.defineProperty(Range.prototype,'getBoundingClientRect',{configurable:true,value:()=>({left:30,top:40,width:12,height:20,right:42,bottom:60})})
 const ctx={scale:vi.fn(),fillRect:vi.fn(),fillText:vi.fn(),measureText:()=>({fontBoundingBoxDescent:2}),font:'',fillStyle:'',textBaseline:''}
 const contextSpy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
 vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(new Blob(['jpeg'],{type:'image/jpeg'})))
 const files=await exportPaper(page,'test.jpg')
 const canvas=contextSpy.mock.contexts[0] as HTMLCanvasElement
 expect(canvas.width).toBe(780);expect(canvas.height).toBe(1400)
 expect(ctx.fillText.mock.calls.map(c=>c[0])).toEqual(['1','2'])
 expect(ctx.fillText).toHaveBeenCalledWith('1',10,18)
 expect(files[0].type).toBe('image/jpeg')
})
