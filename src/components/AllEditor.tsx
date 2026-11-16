import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AllInputConfig, Group2, SettingTypeDefinition } from '../core/models-v2'
import { AllInputError, allErrorRange, applyAll, deleteAll, parseAll } from '../core/all-input'
import { useAutoHeight } from '../core/use-auto-height'
import AppIcon from './AppIcon'
export default function AllEditor({ group, types, config, onChange, onClose }: { group: Group2; types: SettingTypeDefinition[]; config?: AllInputConfig; onChange: (group: Group2)=>void; onClose: ()=>void }) {
  const [id,setId]=useState(group.allEntries?.[0]?.id??''); const [text,setText]=useState(group.allEntries?.[0]?.text??''); const [error,setError]=useState('')
  const currentId=useRef(id); const dirty=useRef(false); const latest=useRef(group)
  useLayoutEffect(()=>{latest.current=group},[group])
  const ref=useRef<HTMLTextAreaElement>(null); useAutoHeight(ref,text)
  const parsed=useMemo(()=>{if(!text.trim())return {rows:[],error:'',fragment:''};try{return {rows:parseAll(text,types,config),error:'',fragment:''}}catch(e){return {rows:[],error:(e as Error).message,fragment:e instanceof AllInputError ? e.fragment : ''}}},[text,types,config])
  const range=allErrorRange(text,parsed.fragment)
  const change=(v:string)=>{dirty.current=true;setText(v);setError('')}
  function save() {
    if(!dirty.current)return true
    if(!text.trim()||parsed.error){setError(parsed.error||'Nhập dữ liệu hoặc dùng thùng rác để xóa All.');return false}
    try {
      const key=currentId.current||crypto.randomUUID()
      const next=applyAll(latest.current,types,key,text,()=>crypto.randomUUID(),config)
      latest.current=next;currentId.current=key;dirty.current=false;setId(key);onChange(next);setError('');return true
    }catch(e){setError((e as Error).message);return false}
  }
  function select(key:string,value:string){if(!save())return;currentId.current=key;setId(key);setText(value);dirty.current=false;setError('')}
  function remove(){
    const next=deleteAll(latest.current,currentId.current)
    dirty.current=false;currentId.current='';setId('');setText('');setError('');latest.current=next;onChange(next)
  }
  return <section className="entry-dock all-editor" aria-label="Nhập All">
    <div className="entry-dock-heading"><strong>All · {group.name}</strong><button onPointerDown={e=>e.preventDefault()} onClick={()=>{if(save())onClose()}} aria-label="Đóng All">×</button></div>
    <div className="all-toolbar"><div className="all-records">{(group.allEntries??[]).map((entry,index)=><button key={entry.id} className={`choice-chip${id===entry.id?' is-selected':' is-configured'}`} aria-pressed={id===entry.id} onPointerDown={e=>e.preventDefault()} onClick={()=>select(entry.id,entry.text)}>All {index+1}</button>)}<button aria-label="Thêm All" onPointerDown={e=>e.preventDefault()} onClick={()=>{select('','');ref.current?.focus({preventScroll:true})}}><AppIcon name="plus" /></button></div>
    <div className="all-tools"><button aria-label="Dán All" onPointerDown={e=>e.preventDefault()} onClick={async()=>{try{change(await navigator.clipboard.readText());ref.current?.focus({preventScroll:true})}catch{setError('Chưa dán được. Hãy cho phép truy cập bộ nhớ tạm.')}}}><AppIcon name="clipboard" /></button><button aria-label="Xóa All" onPointerDown={e=>e.preventDefault()} onClick={remove}><AppIcon name="trash" /></button></div></div>
    <div className="all-text-editor">
      <div className="all-text-highlight" aria-hidden="true">{range ? <>{text.slice(0,range.start)}<mark>{text.slice(range.start,range.end)}</mark>{text.slice(range.end)}</> : text}{'\n'}</div>
      <textarea ref={ref} aria-label="Dữ liệu All" aria-invalid={!!parsed.error} value={text} onChange={e=>change(e.target.value)} onBlur={()=>save()} inputMode="text" autoComplete="off" spellCheck={false} rows={3}/>
    </div>
    {(error||parsed.error)&&<p role="alert" className="settings-error">{error||parsed.error}</p>}
    {!!parsed.rows.length&&<div className="all-preview">{parsed.rows.map((row,i)=><div key={i}><b>{types.find(t=>t.id===row.typeId)?.name}</b>: {row.listing} · Điểm {row.point}</div>)}</div>}
  </section>
}
