'use client'

import {useState,type FormEvent} from 'react'
import {Plus} from 'lucide-react'
import {toast} from 'sonner'
import {useDemo} from './demo-provider'
import {PageHeader,SearchBar,Selector,DataTable,DetailDrawer,Confirmation,EmptyState} from './foundation'
import {Panel} from './analytics-controls'
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogFooter} from './ui/dialog'
import {Button} from './ui/button'
import {Input} from './ui/input'
import {roles} from '@/lib/retail'
import {directories} from '@/lib/directories'
import {categories,type Directory,type Row} from '@/lib/demo-data'
import {citiesForState,indianStates} from '@/lib/india-locations'

export default function AdminDirectory({kind}:{kind:Directory}){
  const {data,update}=useDemo()
  const config=directories[kind],rows=data[kind]
  const [draft,edit]=useState<Row|null>(null)
  const [detail,view]=useState<Row|null>(null)
  const [target,confirm]=useState<Row|null>(null)
  const [query,search]=useState('')
  const [status,filter]=useState('All statuses')
  const [extra,choose]=useState('All')
  const [sort,order]=useState('Name A–Z')
  const [error,fail]=useState('')
  const storeName=(id:string)=>data.stores.find(item=>item.id===id)?.name||'Unassigned'
  const display=(row:Row,key:string)=>key==='store'?storeName(row.store):row[key]
  const extraKey=kind==='users'?'role':kind==='stores'?'city':'categories'
  const matches=rows.filter(row=>
    (status==='All statuses'||status===row.status)&&
    (extra==='All'||row[extraKey].split(', ').includes(extra))&&
    config.fields.some(([key])=>display(row,key)?.toLowerCase().includes(query.trim().toLowerCase()))
  ).sort((a,b)=>(sort==='Name A–Z'?1:-1)*a.name.localeCompare(b.name))
  const fields=[...config.fields,...(kind==='users'?[['lastActive','Last active'] as [string,string]]:[]),['status','Status'] as [string,string]]

  function start(row?:Row){
    fail('')
    edit(row?{...row}:{
      id:'',name:'',status:'Active',role:roles[0],store:data.stores[0]?.id||'',lastActive:'Never',
      state:kind==='stores'?'Delhi':'',city:kind==='stores'?'New Delhi':'',categories:'',products:'0'
    })
  }

  function save(event:FormEvent){
    event.preventDefault()
    if(!draft)return
    const clean={...draft}
    for(const [key,label] of config.fields){
      clean[key]=(clean[key]||'').trim()
      if(!clean[key]){
        fail(`${label} is required.`)
        return
      }
    }
    const key=kind==='users'?'email':'code'
    if(rows.some(row=>row.id!==clean.id&&(row[key].toLowerCase()===clean[key].toLowerCase()||(kind!=='users'&&row.name.toLowerCase()===clean.name.toLowerCase())))){
      fail('That name, code or email is already in use.')
      return
    }
    update(kind,clean.id?rows.map(row=>row.id===clean.id?clean:row):[...rows,{...clean,id:crypto.randomUUID()}])
    toast.success(`${config.unit[0].toUpperCase()+config.unit.slice(1)} ${clean.id?'updated':'added'}`)
    edit(null)
  }

  function toggle(row:Row){
    const next=row.status==='Active'?'Inactive':'Active'
    update(kind,rows.map(item=>item.id===row.id?{...item,status:next}:item))
    confirm(null)
    toast.success(`${row.name} is now ${next.toLowerCase()}`)
  }

  return <div className="phase">
    <PageHeader eyebrow="Administration / Directory" title={config.title} description={config.description}/>
    <Panel title={kind==='users'?'Team directory':kind==='stores'?'Branch network':'Brand portfolio'} meta={`${matches.length} of ${rows.length} records`} action={<Button onClick={()=>start()}><Plus/>Add {config.unit}</Button>}>
      <div className="scopebar">
        <SearchBar value={query} onChange={search} label={`Search ${kind}`}/>
        <Selector label="Status filter" value={status} options={['All statuses','Active','Inactive']} onChange={filter}/>
        <Selector label={'Filter by '+extraKey} value={extra} options={['All',...new Set(rows.flatMap(row=>row[extraKey].split(', ')))]} onChange={choose}/>
        <Selector label="Sort directory" value={sort} options={['Name A–Z','Name Z–A']} onChange={order}/>
      </div>
      {matches.length?<DataTable
        columns={[...fields.map(([,label])=>label),'Actions']}
        rows={matches.map(row=>[
          ...fields.map(([key])=>key==='name'
            ?<button className="textlink" key={key} onClick={()=>view(row)}>{row.name}</button>
            :key==='status'?<span key={key} className={'signal '+row.status}>{row.status}</span>:display(row,key)),
          <div key="actions" className="rowlinks">
            <button onClick={()=>start(row)}>Edit</button>
            <button onClick={()=>row.status==='Active'?confirm(row):toggle(row)}>{row.status==='Active'?'Deactivate':'Activate'}</button>
          </div>
        ])}
      />:<EmptyState text="No matching records. Adjust the search or filters."/>}
    </Panel>
    <DetailDrawer open={!!detail} title={detail?.name||'Details'} onClose={()=>view(null)}>
      {detail&&<dl className="facts">{fields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{display(detail,key)}</dd></div>)}</dl>}
    </DetailDrawer>
    <Dialog open={!!draft} onOpenChange={open=>!open&&edit(null)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{draft?.id?'Edit':'Add'} {config.unit}</DialogTitle>
        <DialogDescription>Required fields · Changes apply only to this demo session.</DialogDescription>
        {draft&&<form onSubmit={save} className="adminform">
          {config.fields.map(([key,label])=>{
            if(key==='categories')return <fieldset key={key}><legend>{label}</legend><div className="checks">{categories.map(category=><label key={category}><input type="checkbox" checked={draft.categories.split(', ').includes(category)} onChange={event=>edit({...draft,categories:categories.filter(value=>value===category?event.target.checked:draft.categories.split(', ').includes(value)).join(', ')})}/>{category}</label>)}</div></fieldset>
            if(key==='role'||key==='store')return <label key={key}>{label}<select aria-label={label} required value={draft[key]} onChange={event=>edit({...draft,[key]:event.target.value})}>{(key==='role'?roles.map(value=>({id:value,name:value})):data.stores).map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
            if(kind==='stores'&&key==='state')return <label key={key}>{label}<select aria-label={label} required value={draft.state||''} onChange={event=>{const state=event.target.value;edit({...draft,state,city:citiesForState(state).includes(draft.city)?draft.city:''})}}><option value="">Select state</option>{indianStates.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
            if(kind==='stores'&&key==='city'){const cities=citiesForState(draft.state||'');return <label key={key}>{label}<select aria-label={label} required value={draft.city||''} disabled={!draft.state} onChange={event=>edit({...draft,city:event.target.value})}><option value="">{draft.state?'Select city':'Select a state first'}</option>{cities.map(value=><option key={value} value={value}>{value}</option>)}{draft.city&&!cities.includes(draft.city)&&<option value={draft.city}>{draft.city}</option>}</select></label>}
            return <label key={key}>{label}<Input required type={key==='email'?'email':key==='products'?'number':key==='phone'?'tel':'text'} pattern={key==='phone'?'[0-9]{10,12}':undefined} min={key==='products'?0:undefined} step={key==='products'?1:undefined} value={draft[key]||''} onChange={event=>edit({...draft,[key]:event.target.value})}/></label>
          })}
          {error&&<p role="alert">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={()=>edit(null)}>Cancel</Button><Button type="submit">Save {config.unit}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
    <Confirmation open={!!target} onClose={()=>confirm(null)} title={`Deactivate ${target?.name}?`} text="The record will remain available for historical reports and can be reactivated." onConfirm={()=>target&&toggle(target)}/>
  </div>
}
