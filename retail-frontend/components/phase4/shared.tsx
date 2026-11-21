'use client'
import type {ChangeEvent} from 'react'
import {Input} from '../ui/input'
import {warehouseLocationId,warehouseLocationName} from '@/lib/phase4-data'
import {SearchableSelector} from '../foundation'

export function locationName(id:string,stores:{id:string;name:string}[]){
  if(!id)return '—'
  if(id===warehouseLocationId)return warehouseLocationName
  if(id.startsWith('T-'))return `In transit · ${id.slice(2,14)}`
  if(id==='SUPPLIER')return 'Supplier'
  return stores.find(item=>item.id===id)?.name||id
}

export function parsePaise(value:string){
  const clean=value.trim()
  if(!/^\d+(\.\d{1,2})?$/.test(clean))return NaN
  const [whole,fraction='']=clean.split('.')
  return Number(whole)*100+Number(fraction.padEnd(2,'0'))
}

export function formatDate(value:string){
  return value?new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'
}

export function Field({label,value,onChange,type='text',required=true,step,placeholder}:{label:string;value:string;onChange:(value:string)=>void;type?:string;required?:boolean;step?:string;placeholder?:string}){
  return <label className="crm-field">{label}{required&&<span aria-hidden="true"> *</span>}<Input aria-label={label} required={required} type={type} step={step} placeholder={placeholder} value={value} onChange={(event:ChangeEvent<HTMLInputElement>)=>onChange(event.target.value)}/></label>
}

export function SelectField({label,value,onChange,options,required=true}:{label:string;value:string;onChange:(value:string)=>void;options:{value:string;label:string}[];required?:boolean}){
  return <div className="crm-field"><SearchableSelector label={label} value={value} required={required} onChange={onChange} options={options.map(item=>({value:item.value,label:item.label}))}/></div>
}
