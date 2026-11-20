'use client'
import {Selector} from '../foundation'
import {currency} from '@/lib/phase3-data'

export const financeDateRanges=['All dates','Last 7 days','Last 30 days','Last 90 days']
export const financePaymentModes=['Cash','UPI','Debit/Credit Card','Bank Transfer','Financing / EMI']
export const financeStatuses=['All statuses','Recorded','Matched','Needs review','Reversed']

export function storeLabel(id:string,stores:{id:string;name:string}[]){
  return stores.find(item=>item.id===id)?.name||id||'Unassigned'
}
export function dateLabel(value:string){
  return value?new Date(value).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'}):'—'
}
export function dateTimeLabel(value:string){
  return value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'
}
export function toDemoDate(value:string){
  return value?new Date(`${value.slice(0,10)}T12:00:00+05:30`).toISOString():''
}
export function parseAmountPaise(value:string){
  if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return 0
  const [whole,fraction='']=value.trim().split('.')
  const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'))
  return Number.isSafeInteger(amount)?amount:0
}
export function normalizeMode(mode:string){
  if(mode==='Card'||mode==='Debit/Credit Card')return 'Debit/Credit Card'
  if(mode==='Bank transfer'||mode==='Bank Transfer')return 'Bank Transfer'
  return mode
}
export function modeGroup(mode:string){
  if(mode==='Financing / EMI')return 'EMI / financing'
  return normalizeMode(mode)
}
export function paymentReferenceRequired(mode:string){
  return mode==='UPI'||mode==='Debit/Credit Card'||mode==='Bank Transfer'||mode==='Financing / EMI'
}
export function makeFinanceId(prefix:string){
  return `${prefix}-${crypto.randomUUID()}`
}

export function FinanceFilters({range,store,mode,status,stores,onRange,onStore,onMode,onStatus}:{range:string;store:string;mode:string;status:string;stores:{id:string;name:string}[];onRange:(value:string)=>void;onStore:(value:string)=>void;onMode:(value:string)=>void;onStatus:(value:string)=>void}){
  return <div className="crm-toolbar finance-toolbar">
    <Selector label="Filter by date" value={range} options={financeDateRanges} onChange={onRange}/>
    <Selector label="Filter by store" value={store==='All stores'?'All stores':storeLabel(store,stores)} options={['All stores',...stores.map(item=>item.name)]} onChange={value=>onStore(stores.find(item=>item.name===value)?.id||'All stores')}/>
    <Selector label="Filter by payment mode" value={mode} options={['All modes',...financePaymentModes]} onChange={onMode}/>
    <Selector label="Filter by payment status" value={status} options={financeStatuses} onChange={onStatus}/>
  </div>
}

export function FinanceMetrics({items}:{items:Array<{label:string;value:string;note?:string}>}){
  return <div className="p4-metrics finance-metrics">{items.map(item=><article key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.note&&<small>{item.note}</small>}</article>)}</div>
}

