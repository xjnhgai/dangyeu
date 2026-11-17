import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AllInputConfig, Group2, SettingTypeDefinition } from '../core/models-v2'
import { AllInputError, allErrorRange, saveMessage, deleteAll, parseAll } from '../core/all-input'
import { useAutoHeight } from '../core/use-auto-height'
import AppIcon from './AppIcon'

export default function AllEditor({ group, types, config, onChange, onClose }: { group: Group2; types: SettingTypeDefinition[]; config?: AllInputConfig; onChange: (group: Group2)=>void; onClose: ()=>void }) {
  const [id,setId]=useState(group.allEntries?.[0]?.id??'')
  const [text,setText]=useState(group.allEntries?.[0]?.text??'')
  const [error,setError]=useState('')
  const currentId=useRef(id), dirty=useRef(false), latest=useRef(group)
  useLayoutEffect(()=>{latest.current=group},[group])
  const ref=useRef<HTMLTextAreaElement>(null)
  useAutoHeight(ref,text)
  const parsed=useMemo(()=>{
    if(!text.trim()) return {rows:[],error:'',fragment:''}
    try { return {rows:parseAll(text,types,config),error:'',fragment:''} }
    catch(e) { return {rows:[],error:(e as Error).message,fragment:e instanceof AllInputError ? e.fragment : ''} }
  },[text,types,config])
  const range=allErrorRange(text,parsed.fragment)
  const change=(value:string)=>{dirty.current=true;setText(value);setError('')}
  function save() {
    if(!dirty.current) return
    const key=currentId.current || crypto.randomUUID()
    const next=saveMessage(latest.current,types,key,text,()=>crypto.randomUUID(),config)
    latest.current=next; dirty.current=false
    currentId.current=text.trim()?key:'';setId(currentId.current)
    onChange(next)
  }
  function select(key:string,value:string){save();currentId.current=key;setId(key);setText(value);dirty.current=false;setError('')}
  function remove(){
    const next=deleteAll(latest.current,currentId.current)
    dirty.current=false;currentId.current='';setId('');setText('');setError('');latest.current=next;onChange(next)
  }
  return <section className="entry-dock all-editor message-editor" role="dialog" aria-modal="true" aria-label="Tin nhắn">
    <div className="entry-dock-heading"><strong>Tin nhắn · {group.name}</strong><button onPointerDown={e=>e.preventDefault()} onClick={()=>{save();onClose()}} aria-label="Đóng Tin nhắn">×</button></div>
    <div className="all-toolbar"><div className="all-records">{(group.allEntries??[]).map((entry,index)=><button key={entry.id} className={`choice-chip${id===entry.id?' is-selected':' is-configured'}`} aria-pressed={id===entry.id} onPointerDown={e=>e.preventDefault()} onClick={()=>select(entry.id,entry.text)}>Tin {index+1}</button>)}<button aria-label="Thêm Tin nhắn" onPointerDown={e=>e.preventDefault()} onClick={()=>{select('','');ref.current?.focus({preventScroll:true})}}><AppIcon name="plus" /></button></div>
    <div className="all-tools"><button aria-label="Dán Tin nhắn" onPointerDown={e=>e.preventDefault()} onClick={async()=>{try{change(await navigator.clipboard.readText());ref.current?.focus({preventScroll:true})}catch{setError('Chưa dán được. Hãy cho phép truy cập bộ nhớ tạm.')}}}><AppIcon name="clipboard" /></button><button aria-label="Xóa Tin nhắn" onPointerDown={e=>e.preventDefault()} onClick={remove}><AppIcon name="trash" /></button></div></div>
    <div className="all-text-editor">
      <div className={`all-text-highlight${parsed.error && !range ? ' is-invalid' : ''}`} aria-hidden="true">{range ? <>{text.slice(0,range.start)}<mark>{text.slice(range.start,range.end)}</mark>{text.slice(range.end)}</> : text}{'\n'}</div>
      <textarea ref={ref} aria-label="Dữ liệu Tin nhắn" aria-invalid={!!parsed.error} value={text} onChange={e=>change(e.target.value)} onBlur={save} inputMode="text" autoComplete="off" spellCheck={false} rows={3}/>
    </div>
    {error&&<p role="status">{error}</p>}
    {!!parsed.rows.length&&<div className="all-preview" aria-label="Dữ liệu đã phân nhóm">{types.map(type=>{
      const rows=parsed.rows.filter(row=>row.typeId===type.id)
      return rows.length ? <div key={type.id} className="message-preview-group"><strong>{type.name}:</strong><div>{rows.map((row,i)=><div className="message-data-row" key={i}><span>{row.listing}</span><span> | {row.point} Điểm</span></div>)}</div></div> : null
    })}</div>}
  </section>
}
