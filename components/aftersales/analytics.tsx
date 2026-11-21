'use client'
import {useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowRight} from 'lucide-react'
import {PageHeader,DataTable,EmptyState,Selector} from '@/components/foundation'
import {Panel} from '@/components/analytics-controls'
import {useDemo} from '@/components/demo-provider'
import {dateInIndia} from '@/lib/phase3-data'
import {AfterSalesMetrics,PrototypeNote} from './common'
import {getInstallationEligibility} from '@/lib/aftersales'

function rangeStart(value:string){
  if(value==='All dates')return ''
  const days=value==='Last 30 days'?30:90
  const date=new Date()
  date.setDate(date.getDate()-days)
  return date.toISOString().slice(0,10)
}

function Bars({items}:{items:Array<{label:string;value:number}>}){
  const maximum=Math.max(1,...items.map(item=>item.value))
  return items.length?<div className="p7-bars">{items.map(item=><div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><progress max={maximum} value={item.value}/></div>)}</div>:<EmptyState text="No records in this range."/>
}

export function AfterSalesDashboard(){
  const {data}=useDemo()
  const today=new Date().toISOString().slice(0,10)
  const eligible=getInstallationEligibility(data).reduce((sum,item)=>sum+item.availableQuantity,0)
  const openInstallations=data.installations.filter(item=>['Pending','Scheduled','Assigned','In Progress','Rescheduled','Awaiting scheduling'].includes(item.status))
  const activeTickets=data.serviceTickets.filter(item=>openStatuses(item.status))
  const dueTickets=activeTickets.filter(item=>item.preferredVisitDate&&item.preferredVisitDate<=today)
  const openFollowUps=activeTickets.filter(item=>item.followUpDate&&item.followUpDate<=today)
  const currentWarranty=data.warranties.filter(item=>item.status!=='Cancelled'&&item.startDate<=today&&item.endDate>=today)
  const recent=[
    ...data.installationActivities.map(item=>({id:item.id,date:item.date,action:item.action,reference:data.installations.find(record=>record.id===item.installationId)?.product||item.installationId,actor:item.actor,notes:item.notes})),
    ...data.serviceActivities.map(item=>({id:item.id,date:item.date,action:item.action,reference:data.serviceTickets.find(record=>record.id===item.ticketId)?.ticketNumber||item.ticketId,actor:item.actor,notes:item.notes}))
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8)
  const links=[
    {title:'Installation eligibility',description:`${eligible} delivered unit(s) ready to book`,href:'/after-sales/installation-eligibility'},
    {title:'Installation worklist',description:`${openInstallations.length} active installation record(s)`,href:'/after-sales/installation-worklist'},
    {title:'Warranty registrations',description:`${currentWarranty.length} active retailer registration(s)`,href:'/after-sales/warranty-registration'},
    {title:'Service desk',description:`${activeTickets.length} open ticket(s) · ${dueTickets.length} visit(s) due`,href:'/after-sales/service-tickets'},
    {title:'Service escalations',description:`${openFollowUps.length} follow-up(s) due today`,href:'/after-sales/service-escalations'}
  ]
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Overview" title="Customer care operations" description="A single view across delivered installations, retailer coverage and customer service records."/>
    <AfterSalesMetrics items={[
      {label:'Installation units ready',value:String(eligible),note:'Derived from confirmed delivery quantities',accent:'p7-metric-teal'},
      {label:'Active installations',value:String(openInstallations.length),note:'Pending through in-progress'},
      {label:'Active retailer cover',value:String(currentWarranty.length),note:'Manufacturer term is listed separately'},
      {label:'Open service tickets',value:String(activeTickets.length),note:'No external messages or calls'},
      {label:'Visits due',value:String(dueTickets.length),note:'Today or earlier',accent:dueTickets.length?'p7-metric-amber':''},
      {label:'Service follow-ups due',value:String(openFollowUps.length),note:'Recorded internal reminders'}
    ]}/>
    <div className="p7-overview-grid">
      <Panel title="After-sales queues" meta="Open each register to continue the customer journey">
        <div className="p7-dashboard-links">{links.map(item=><Link key={item.href} href={item.href}><span><b>{item.title}</b><small>{item.description}</small></span><ArrowRight size={15}/></Link>)}</div>
      </Panel>
      <Panel title="Customer care signals" meta="Derived from shared client-side records">
        <Bars items={[
          {label:'Installation work',value:openInstallations.length},
          {label:'Delivered units awaiting installation',value:eligible},
          {label:'Service tickets to resolve',value:activeTickets.length},
          {label:'Service escalation records',value:data.serviceTickets.filter(item=>item.status==='Escalated').length},
          {label:'Expired retailer coverage',value:data.warranties.filter(item=>item.status!=='Cancelled'&&item.endDate<today).length}
        ]}/>
      </Panel>
    </div>
    <Panel title="Recent after-sales history" meta="Installation and service activity; newest first">
      {recent.length?<DataTable columns={['Date','Record','Activity','Details','Responsible user']} rows={recent.map(item=>[
        dateInIndia(item.date),item.reference,item.action,<div className="cellstack" key={item.id+'notes'}><small>{item.notes}</small></div>,item.actor
      ])}/>:<EmptyState text="No after-sales activity has been recorded."/>}
    </Panel>
    <PrototypeNote>Dashboard values use shared demo delivery, installation, warranty and service records. Warranty states and operational follow-ups are illustrative, not OEM decisions or production service commitments.</PrototypeNote>
  </div>
}

export function AfterSalesAnalytics(){
  const {data}=useDemo()
  const [range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[technician,setTechnician]=useState('All technicians')
  const start=rangeStart(range)
  const storeId=store==='All stores'?'All stores':data.stores.find(item=>item.name===store)?.id||'All stores'
  const installations=data.installations.filter(item=>(!start||(item.createdAt||'').slice(0,10)>=start)&&(storeId==='All stores'||item.storeId===storeId)&&
    (technician==='All technicians'||item.technicianId===technician))
  const tickets=data.serviceTickets.filter(item=>(!start||item.createdAt.slice(0,10)>=start)&&(storeId==='All stores'||item.storeId===storeId)&&
    (technician==='All technicians'||item.assignedTechnicianId===technician))
  const complete=installations.filter(item=>item.status==='Completed')
  const failed=installations.filter(item=>item.status==='Failed')
  const active=installations.filter(item=>['Pending','Scheduled','Assigned','In Progress','Rescheduled','Awaiting scheduling'].includes(item.status))
  const onTime=complete.filter(item=>item.scheduledDate&&item.completedAt&&item.completedAt.slice(0,10)<=item.scheduledDate)
  const installCycles=complete.flatMap(item=>item.completedAt&&item.createdAt?[(new Date(item.completedAt).getTime()-new Date(item.createdAt).getTime())/86400000]:[])
  const averageInstall=installCycles.length?(installCycles.reduce((sum,value)=>sum+value,0)/installCycles.length).toFixed(1):'—'
  const onTimePct=complete.length&&complete.some(item=>item.scheduledDate)?Math.round(onTime.length/complete.filter(item=>item.scheduledDate).length*100):0
  const successBase=complete.length+failed.length
  const failurePct=successBase?Math.round(failed.length/successBase*100):0
  const agingToday=new Date()
  const installationAging=active.filter(item=>item.createdAt&&(agingToday.getTime()-new Date(item.createdAt).getTime())/86400000>7).length
  const technicianRows=useMemo(()=>data.technicians.filter(item=>technician==='All technicians'||item.id===technician).map(item=>{
    const assigned=installations.filter(record=>record.technicianId===item.id)
    const done=assigned.filter(record=>record.status==='Completed')
    const failedCount=assigned.filter(record=>record.status==='Failed').length
    const rate=assigned.length?Math.round(done.length/assigned.length*100):0
    const services=tickets.filter(ticket=>ticket.assignedTechnicianId===item.id)
    return [item.name,item.serviceArea,assigned.length,done.length,`${rate}%`,failedCount,services.length]
  }),[data.technicians,technician,installations,tickets])
  const serviceResolved=tickets.filter(item=>item.status==='Resolved'||item.status==='Closed')
  const resolutionTimes=serviceResolved.flatMap(item=>item.resolutionAt?[(new Date(item.resolutionAt).getTime()-new Date(item.createdAt).getTime())/86400000]:[])
  const averageResolution=resolutionTimes.length?(resolutionTimes.reduce((sum,value)=>sum+value,0)/resolutionTimes.length).toFixed(1):'—'
  const serviceAging=[
    {label:'0–3 days',value:tickets.filter(item=>openStatuses(item.status)&&age(item.createdAt)<=3).length},
    {label:'4–7 days',value:tickets.filter(item=>openStatuses(item.status)&&age(item.createdAt)>3&&age(item.createdAt)<=7).length},
    {label:'8–14 days',value:tickets.filter(item=>openStatuses(item.status)&&age(item.createdAt)>7&&age(item.createdAt)<=14).length},
    {label:'Over 14 days',value:tickets.filter(item=>openStatuses(item.status)&&age(item.createdAt)>14).length}
  ]
  const covered=tickets.filter(item=>item.warrantyCoverage==='Covered').length
  const chargeable=tickets.filter(item=>item.warrantyCoverage==='Chargeable').length
  const pendingReview=tickets.filter(item=>item.warrantyCoverage==='Pending review').length
  const repeats=new Map<string,number>()
  for(const ticket of tickets){const key=`${ticket.customerId}|${ticket.productId}|${ticket.category}`;repeats.set(key,(repeats.get(key)||0)+1)}
  const repeatedTickets=[...repeats.values()].filter(count=>count>1).reduce((sum,count)=>sum+count,0)
  const serviceCategories=[...new Set(tickets.map(item=>item.category))].map(category=>({label:category,value:tickets.filter(item=>item.category===category).length})).sort((a,b)=>b.value-a.value)
  const statusSummary=['Open','Assigned','Scheduled','In Progress','Waiting for Parts','Escalated','Resolved','Closed','Cancelled'].map(status=>({label:status,value:tickets.filter(item=>item.status===status).length}))
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Performance" title="After-sales analytics" description="Review installation completion, service resolution and recorded coverage classifications from the shared demo history."/>
    <div className="crm-toolbar"><Selector label="Filter by date range" value={range} options={['All dates','Last 30 days','Last 90 days']} onChange={setRange}/><Selector label="Filter by store" value={store} options={['All stores',...data.stores.map(item=>item.name)]} onChange={setStore}/><Selector label="Filter by technician" value={technician} options={['All technicians',...data.technicians.map(item=>item.name)]} onChange={value=>setTechnician(data.technicians.find(item=>item.name===value)?.id||'All technicians')}/></div>
    <h2 className="p7-section-title">Installation performance</h2>
    <AfterSalesMetrics items={[
      {label:'Eligible / active work',value:String(active.length),note:'Current pending and in-progress records',accent:'p7-metric-teal'},
      {label:'Completed',value:String(complete.length),note:`${installations.length?Math.round(complete.length/installations.length*100):0}% of installation records`},
      {label:'On-time completion',value:complete.some(item=>item.scheduledDate)?`${onTimePct}%`:'—',note:'Completed on or before scheduled date'},
      {label:'Average installation cycle',value:averageInstall==='—'?'—':`${averageInstall} days`,note:'Recorded creation through completion'},
      {label:'Failed visit rate',value:`${failurePct}%`,note:`${failed.length} failed of ${successBase} completed / failed`,accent:failurePct?'p7-metric-amber':''},
      {label:'Older than 7 days',value:String(installationAging),note:'Active installation work'}
    ]}/>
    <div className="p7-overview-grid">
      <Panel title="Installation outcomes" meta="Installations created within selected filters"><Bars items={[
        {label:'Pending / scheduled / assigned',value:active.length},{label:'Completed',value:complete.length},{label:'Failed',value:failed.length},
        {label:'Cancelled',value:installations.filter(item=>item.status==='Cancelled').length}
      ]}/></Panel>
      <Panel title="Technician performance" meta="Completed / assigned installation records">
        {technicianRows.length?<DataTable columns={['Technician','Service area','Assigned','Completed','Completion','Failed','Service tickets']} rows={technicianRows}/>:<EmptyState text="No technician records match this filter."/>}
      </Panel>
    </div>
    <h2 className="p7-section-title">Service desk performance</h2>
    <AfterSalesMetrics items={[
      {label:'Tickets in range',value:String(tickets.length),note:'Created during selected period'},
      {label:'Resolved / closed',value:String(serviceResolved.length),note:`${tickets.length?Math.round(serviceResolved.length/tickets.length*100):0}% of tickets`},
      {label:'Average resolution time',value:averageResolution==='—'?'—':`${averageResolution} days`,note:'Recorded ticket creation through resolution'},
      {label:'Repeat issue records',value:String(repeatedTickets),note:'Same customer, product and category',accent:repeatedTickets?'p7-metric-amber':''},
      {label:'Covered classification',value:String(covered),note:'Demo status only'},
      {label:'Chargeable / pending review',value:`${chargeable} / ${pendingReview}`,note:'Not an approved claim or final quote'}
    ]}/>
    <div className="p7-overview-grid">
      <Panel title="Service ticket aging" meta="Aging starts at ticket creation">
        <Bars items={serviceAging}/>
      </Panel>
      <Panel title="Ticket status distribution" meta="Shared service desk records">
        <Bars items={statusSummary.filter(item=>item.value>0)}/>
      </Panel>
      <Panel title="Issue categories" meta="Ticket count by reported category">
        <Bars items={serviceCategories}/>
      </Panel>
      <Panel title="Coverage classification" meta="Demo review results—not warranty claim decisions">
        <Bars items={[{label:'Covered',value:covered},{label:'Chargeable',value:chargeable},{label:'Pending review',value:pendingReview}]}/>
      </Panel>
    </div>
    <PrototypeNote>On-time installation means the completion calendar date is on or before the scheduled date. Cycle time is completion timestamp minus record creation timestamp. Ticket aging is current date minus creation date. Repeat issues share customer, product and category; all measures use fictional client-side data and are not accounting, OEM or service-SLA metrics.</PrototypeNote>
  </div>
}

function openStatuses(status:string){return !['Resolved','Closed','Cancelled'].includes(status)}
function age(date:string){return Math.max(0,(new Date().getTime()-new Date(date).getTime())/86400000)}
