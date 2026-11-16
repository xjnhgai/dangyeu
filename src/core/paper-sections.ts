import type { A4ProjectionSectionV2 } from './a4-v2'
import { splitSeparatedValuesV2 } from './workspace-calculator-v2'
/** Split display only; source entries and calculations remain untouched. */
export function paperSections(sections: A4ProjectionSectionV2[]) {
  const groups=sections.map(section=>{
    const chunks: { entries: { entry: A4ProjectionSectionV2['entries'][number]; start:number; end:number; showPoint:boolean }[] }[]=[{entries:[]}]
    let used=0
    for(const entry of section.entries){
      const count=Math.max(1,splitSeparatedValuesV2(entry.group3.listing).length)
      const entryHeight=count*9.5+8
      if(used && entryHeight<=240 && used+entryHeight>240){chunks.push({entries:[]});used=0}
      for(let start=0;start<count;){
        if(used+18>240){chunks.push({entries:[]});used=0}
        const end=Math.min(count,start+Math.max(1,Math.floor((240-used-8)/9.5)))
        chunks.at(-1)!.entries.push({entry,start,end,showPoint:(count-1)/2>=start&&(count-1)/2<end})
        used+=(end-start)*9.5+8;start=end
      }
    }
    return chunks.map((chunk,index)=>({...section,...chunk,index,last:index===chunks.length-1,pointTotal:section.entries.reduce((sum,e)=>sum+(Number(e.group3.point)||0),0)}))
  })
  return groups.flatMap(g=>g.map(chunk=>({...chunk,newRow:false})))
}
