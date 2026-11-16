/** Paint the laid-out paper at 2x resolution, using its actual text and border geometry. */
export async function exportPaper(page: HTMLElement, name: string): Promise<File[]> {
  await document.fonts.ready
  const rect = page.getBoundingClientRect()
  const width = page.offsetWidth
  if (!width || !rect.width) throw new Error('Trang giấy chưa sẵn sàng.')
  const zoom = rect.width / width
  const height = Math.ceil(rect.height / zoom)
  const scale = Math.min(2, 16000 / Math.max(width, height))
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width*scale); canvas.height = Math.ceil(height*scale)
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Không thể tạo ảnh.')
  ctx.scale(scale,scale); ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height)
  const visible = (el: HTMLElement) => !el.closest('button,[aria-hidden="true"]') && getComputedStyle(el).visibility!=='hidden' && getComputedStyle(el).display!=='none'
  // Include divider spans, which are decorative and aria-hidden.
  for (const el of page.querySelectorAll<HTMLElement>('*')) {
    if (el.closest('button')) continue
    const style=getComputedStyle(el); if(style.visibility==='hidden'||style.display==='none') continue
    const r=el.getBoundingClientRect(); const x=(r.left-rect.left)/zoom,y=(r.top-rect.top)/zoom,w=r.width/zoom,h=r.height/zoom
    if (style.backgroundColor!=='rgba(0, 0, 0, 0)' && style.backgroundColor!=='transparent') {ctx.fillStyle=style.backgroundColor;ctx.fillRect(x,y,w,h)}
    for (const side of ['Left','Right','Top','Bottom'] as const) {
      const size=parseFloat(style[`border${side}Width`]); if(!size) continue
      ctx.fillStyle=style[`border${side}Color`]
      ctx.fillRect(side==='Right'?x+w-size:x,side==='Bottom'?y+h-size:y,side==='Left'||side==='Right'?size:w,side==='Top'||side==='Bottom'?size:h)
    }
  }
  const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT)
  while(walker.nextNode()) {
    const node=walker.currentNode as Text; const parent=node.parentElement
    if(!parent||!visible(parent))continue
    const style=getComputedStyle(parent);ctx.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fillStyle=style.color;ctx.textBaseline='alphabetic'
    const range=document.createRange()
    // Grapheme ranges preserve accented Vietnamese and actual wrapping positions.
    for(const segment of new Intl.Segmenter('vi',{granularity:'grapheme'}).segment(node.data)) {
      if(!segment.segment.trim())continue
      range.setStart(node,segment.index);range.setEnd(node,segment.index+segment.segment.length)
      const r=range.getBoundingClientRect();if(!r.width||!r.height)continue
      const metrics=ctx.measureText(segment.segment)
      const descent=metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize)*.2
      ctx.fillText(segment.segment,(r.left-rect.left)/zoom,(r.bottom-rect.top)/zoom-descent)
    }
  }
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Không thể tạo JPG.')),'image/jpeg',.96))
  return [new File([blob],name,{type:'image/jpeg'})]
}
