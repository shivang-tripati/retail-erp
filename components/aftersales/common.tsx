'use client'
import type {ReactNode} from 'react'
import {dateInIndia} from '@/lib/phase3-data'
import type {InstallationActivity,ServiceActivity} from '@/lib/phase7-types'

export function AfterSalesMetrics({items}:{items:Array<{label:string;value:string;note?:string;accent?:string}>}){
  return <div className="p7-metrics">{items.map(item=><article key={item.label} className={item.accent||''}><span>{item.label}</span><strong>{item.value}</strong>{item.note&&<small>{item.note}</small>}</article>)}</div>
}

export function ActivityTimeline({items}:{items:Array<InstallationActivity|ServiceActivity>}){
  const sorted=[...items].sort((a,b)=>b.date.localeCompare(a.date))
  return sorted.length?<ol className="p7-timeline">{sorted.map(item=><li key={item.id}><span className="p7-timeline-mark"/><div><header><b>{item.action}</b><time>{dateInIndia(item.date)}</time></header><p>{item.notes}</p><small>{item.actor}</small></div></li>)}</ol>:<p className="p7-muted">No activity has been recorded yet.</p>
}

export function LifecycleRail({active}:{active:'delivery'|'installation'|'warranty'|'service'}){
  const stages=['delivery','installation','warranty','service'] as const
  const names:Record<typeof stages[number],string>={delivery:'Delivered',installation:'Installed',warranty:'Covered',service:'Service'}
  return <ol className="p7-lifecycle" aria-label="After-sales lifecycle">{stages.map((stage,index)=><li className={stage===active?'is-current':stages.indexOf(active)>index?'is-complete':''} key={stage}><span>{names[stage]}</span></li>)}</ol>
}

export function PrototypeNote({children}:{children:ReactNode}){
  return <p className="p7-prototype-note">{children}</p>
}
