'use client'
import {useMemo,useState,type FormEvent} from 'react'
import {ArrowRight,Plus,Search,Send,ShieldCheck} from 'lucide-react'
import Link from 'next/link'
import {toast} from 'sonner'
import {useDemo} from '@/components/demo-provider'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector,Confirmation} from '@/components/foundation'
import {Panel} from '@/components/analytics-controls'
import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '@/components/ui/dialog'
import {currency,dateInIndia} from '@/lib/phase3-data'
import {transitionServiceTicket} from '@/lib/aftersales'
import type {ServiceActivity,ServiceStatus,ServiceTicket,WarrantyCoverage} from '@/lib/phase7-types'
import {AfterSalesMetrics,ActivityTimeline,PrototypeNote} from './common'
import {ServiceTicketDialog} from './service-ticket-dialog'

const openStatuses:ServiceStatus[]=['Open','Assigned','Scheduled','In Progress','Waiting for Parts','Escalated']
const statusOptions:ServiceStatus[]=['Open','Assigned','Scheduled','In Progress','Waiting for Parts','Escalated','Resolved','Closed','Cancelled']
const coverageOptions:WarrantyCoverage[]=['Covered','Chargeable','Pending review']
const today=()=>new Date().toISOString().slice(0,10)

function statusClass(status:string){return `p7-status p7-${status.toLowerCase().replace(/ /g,'-')}`}
function ticketLabel(ticket:ServiceTicket,data:ReturnType<typeof useDemo>['data']){
  const customer=data.customers.find(item=>item.id===ticket.customerId)
  const product=data.products.find(item=>item.id===ticket.productId)
  return {customer:customer?.name||ticket.customerId,product:product?.name||ticket.productId}
}

export function ServiceDashboard(){
  const {data}=useDemo()
  const tickets=data.serviceTickets
  const open=tickets.filter(item=>openStatuses.includes(item.status))
  const due=open.filter(item=>item.preferredVisitDate&&item.preferredVisitDate<=today())
  const escalated=tickets.filter(item=>item.status==='Escalated')
  const resolved=tickets.filter(item=>item.status==='Resolved'||item.status==='Closed')
  const resolutionTimes=resolved.flatMap(item=>item.resolutionAt?[Math.max(0,new Date(item.resolutionAt).getTime()-new Date(item.createdAt).getTime())/86400000]:[])
  const averageResolution=resolutionTimes.length?(resolutionTimes.reduce((sum,value)=>sum+value,0)/resolutionTimes.length).toFixed(1):'—'
  const categoryCounts=[...new Set(tickets.map(item=>item.category))].map(category=>({category,count:tickets.filter(item=>item.category===category).length})).sort((a,b)=>b.count-a.count)
  const queue=open.slice().sort((a,b)=>a.priority===b.priority?(a.preferredVisitDate||'9999').localeCompare(b.preferredVisitDate||'9999'):['Urgent','High','Normal','Low'].indexOf(a.priority)-['Urgent','High','Normal','Low'].indexOf(b.priority)).slice(0,8)
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Service desk" title="Service desk" description="Prioritize customer-reported issues, technician assignments and clear demo coverage classifications."/>
    <AfterSalesMetrics items={[
      {label:'Open requests',value:String(open.length),note:'Not resolved or closed',accent:'p7-metric-teal'},
      {label:'Visits due',value:String(due.length),note:'Visit date is today or earlier',accent:due.length?'p7-metric-amber':''},
      {label:'Escalated',value:String(escalated.length),note:'Needs a manager review',accent:escalated.length?'p7-metric-amber':''},
      {label:'Resolved / closed',value:String(resolved.length),note:'Local ticket history'},
      {label:'Avg. resolution time',value:averageResolution==='—'?'—':`${averageResolution} days`,note:'From recorded ticket timestamps'},
      {label:'Coverage review',value:String(tickets.filter(item=>item.warrantyCoverage==='Pending review').length),note:'Coverage requires verification'}
    ]}/>
    <div className="p7-overview-grid">
      <Panel title="Priority work queue" meta="Open service records" action={<Link className="p7-inline-link" href="/after-sales/service-tickets">Open service register <ArrowRight size={14}/></Link>}>
        {queue.length?<DataTable columns={['Ticket / customer','Reported issue','Assigned technician','Visit date','Status']} rows={queue.map(ticket=>{
          const label=ticketLabel(ticket,data)
          return [<div className="cellstack" key={ticket.id}><b>{ticket.ticketNumber}</b><small>{label.customer} · {label.product}</small></div>,
            <div className="cellstack" key={ticket.id+'issue'}><b>{ticket.category}</b><small>{ticket.issue}</small></div>,
            data.technicians.find(item=>item.id===ticket.assignedTechnicianId)?.name||'Unassigned',
            ticket.preferredVisitDate?dateInIndia(ticket.preferredVisitDate):'Not scheduled',
            <span className={statusClass(ticket.status)} key={ticket.id+'status'}>{ticket.status}</span>]
        })}/>:<EmptyState text="No open service tickets. Create a request from a customer, warranty or installation record."/>}
      </Panel>
      <Panel title="Reported issue categories" meta="Counts from shared service tickets">
        <div className="p7-bars">{categoryCounts.map(item=><div key={item.category}><span>{item.category}</span><strong>{item.count}</strong><progress max={Math.max(1,...categoryCounts.map(row=>row.count))} value={item.count}/></div>)}</div>
      </Panel>
    </div>
    <PrototypeNote>Coverage labels are local demo classifications only. No technician dispatch, OEM claim, external call, message or parts inventory movement is triggered by this service desk.</PrototypeNote>
  </div>
}

export function ServiceTickets(){
  const {data,transact}=useDemo()
  const [query,setQuery]=useState(''),[status,setStatus]=useState('All statuses'),[priority,setPriority]=useState('All priorities')
  const [selectedId,setSelectedId]=useState(''),[createOpen,setCreateOpen]=useState(false),[assignment,setAssignment]=useState(''),[visitDate,setVisitDate]=useState('')
  const [diagnosis,setDiagnosis]=useState(''),[work,setWork]=useState(''),[parts,setParts]=useState(''),[resolution,setResolution]=useState('')
  const [feedback,setFeedback]=useState(''),[coverage,setCoverage]=useState<WarrantyCoverage>('Pending review'),[charge,setCharge]=useState('0'),[error,setError]=useState('')
  const selected=data.serviceTickets.find(item=>item.id===selectedId)
  const rows=data.serviceTickets.filter(ticket=>(status==='All statuses'||ticket.status===status)&&(priority==='All priorities'||ticket.priority===priority)&&
    `${ticket.ticketNumber} ${ticket.invoiceNumber} ${ticket.issue} ${ticket.serial} ${ticketLabel(ticket,data).customer} ${ticketLabel(ticket,data).product}`.toLowerCase().includes(query.trim().toLowerCase()))
  const selectedHistory=data.serviceActivities.filter(item=>item.ticketId===selected?.id)
  const serviceTechs=data.technicians.filter(item=>item.status==='Active'&&(item.availability==='Available'||item.id===selected?.assignedTechnicianId))
  function openTicket(ticket:ServiceTicket){
    setSelectedId(ticket.id);setAssignment(ticket.assignedTechnicianId);setVisitDate(ticket.preferredVisitDate)
    setDiagnosis(ticket.diagnosis);setWork(ticket.workPerformed);setParts(ticket.partsUsed);setResolution(ticket.resolution)
    setFeedback(ticket.customerFeedback);setCoverage(ticket.warrantyCoverage);setCharge((ticket.serviceChargePaise/100).toFixed(2));setError('')
  }
  function act(ticketId:string,action:ServiceActivity['action'],notes:string,change:(ticket:ServiceTicket)=>ServiceTicket){
    const now=new Date().toISOString()
    transact(current=>{
      const currentTicket=current.serviceTickets.find(item=>item.id===ticketId)
      if(!currentTicket)throw new Error('Service ticket is no longer available.')
      const updated={...change(currentTicket),updatedAt:now}
      return {...current,serviceTickets:current.serviceTickets.map(item=>item.id===ticketId?updated:item),
        serviceActivities:[...current.serviceActivities,{id:crypto.randomUUID(),ticketId,action,date:now,actor:'Aarav Sharma',notes}]}
    })
  }
  function assign(){
    if(!selected)return
    const technician=data.technicians.find(item=>item.id===assignment&&item.status==='Active'&&(item.availability==='Available'||item.id===selected.assignedTechnicianId))
    if(!technician){setError('Select an available active technician.');return}
    const conflict=selected.preferredVisitDate&&(data.installations.some(item=>item.technicianId===technician.id&&item.scheduledDate===selected.preferredVisitDate&&['Pending','Scheduled','Assigned','In Progress','Rescheduled'].includes(item.status))||
      data.serviceTickets.some(item=>item.id!==selected.id&&item.assignedTechnicianId===technician.id&&item.preferredVisitDate===selected.preferredVisitDate&&openStatuses.includes(item.status)))
    if(conflict){setError('The selected technician already has an appointment on this date.');return}
    try{act(selected.id,'Assigned',`Assigned to ${technician.name}.`,ticket=>({...ticket,assignedTechnicianId:technician.id,status:ticket.status==='Open'?'Assigned':ticket.status}));toast.success('Service ticket assigned');setError('')}
    catch(cause){setError(cause instanceof Error?cause.message:'Assignment could not be saved.')}
  }
  function saveVisit(){
    if(!selected||!visitDate){setError('Choose a visit date.');return}
    const conflict=selected.assignedTechnicianId&&(data.serviceTickets.some(item=>item.id!==selected.id&&item.assignedTechnicianId===selected.assignedTechnicianId&&item.preferredVisitDate===visitDate&&openStatuses.includes(item.status))||
      data.installations.some(item=>item.technicianId===selected.assignedTechnicianId&&item.scheduledDate===visitDate&&['Pending','Scheduled','Assigned','In Progress','Rescheduled'].includes(item.status)))
    if(conflict){setError('The assigned technician already has work recorded on this date.');return}
    try{act(selected.id,'Visit scheduled',`On-site / workshop visit scheduled for ${visitDate}.`,ticket=>({...ticket,preferredVisitDate:visitDate,status:ticket.status==='Open'?'Scheduled':ticket.status}));toast.success('Service visit date saved');setError('')}
    catch(cause){setError(cause instanceof Error?cause.message:'Visit date could not be saved.')}
  }
  function saveWork(){
    if(!selected)return
    if(!diagnosis.trim()&&!work.trim()&&!parts.trim()&&coverage===selected.warrantyCoverage&&Math.round(Number(charge)*100)===selected.serviceChargePaise){setError('Add a diagnosis, work note, parts note or a changed coverage/charge value.');return}
    const amount=Math.round(Number(charge)*100)
    if(!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(amount)){setError('Enter a non-negative service amount with at most two decimal places.');return}
    try{
      const action:ServiceActivity['action']=coverage!==selected.warrantyCoverage?'Coverage updated':'Diagnosis recorded'
      const notes=[diagnosis.trim(),work.trim(),parts.trim(),coverage!==selected.warrantyCoverage?`Coverage classification changed to ${coverage}.`:'' ].filter(Boolean).join(' · ')||'Service work notes updated.'
      act(selected.id,action,notes,ticket=>({...ticket,diagnosis:diagnosis.trim(),workPerformed:work.trim(),partsUsed:parts.trim(),warrantyCoverage:coverage,serviceChargePaise:amount}))
      toast.success('Service notes and demo coverage saved');setError('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Service notes could not be saved.')}
  }
  function transition(next:ServiceStatus){
    if(!selected)return
    if(next==='Resolved'&&!resolution.trim()){setError('Record a resolution summary before resolving the ticket.');return}
    if(next==='Closed'&&selected.status!=='Resolved'){setError('Resolve the ticket before closing it.');return}
    if(next==='In Progress'&&!selected.assignedTechnicianId){setError('Assign an active technician before starting work.');return}
    const from=selected.status,now=new Date().toISOString()
    try{
      act(selected.id,next==='Closed'?'Ticket closed':'Status changed',`${from} → ${next}${next==='Resolved'?`: ${resolution.trim()}`:''}.`,ticket=>({
        ...transitionServiceTicket(ticket,next,resolution),resolutionAt:next==='Resolved'?now:ticket.resolutionAt
      }))
      toast.success(`Service ticket ${next.toLowerCase()}`);setError('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Status could not be updated.')}
  }
  const selectedLabel=selected&&ticketLabel(selected,data)
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Service register" title="Service tickets" description="Create, assign, classify and resolve customer issues against their completed sale and product."/>
    <Panel title="Service register" meta={`${rows.length} matching ticket(s)`} action={<Button onClick={()=>setCreateOpen(true)}><Plus size={15}/>Create service ticket</Button>}>
      <div className="crm-toolbar"><SearchBar label="Search ticket, invoice, customer, issue or serial" value={query} onChange={setQuery}/><Selector label="Filter ticket status" value={status} options={['All statuses',...statusOptions]} onChange={setStatus}/><Selector label="Filter priority" value={priority} options={['All priorities','Low','Normal','High','Urgent']} onChange={setPriority}/></div>
      {rows.length?<DataTable columns={['Ticket','Customer / product','Issue','Assigned technician','Visit date','Coverage','Priority / status','Actions']} rows={rows.map(ticket=>{
        const label=ticketLabel(ticket,data)
        return [<button className="crm-customer-link" key={ticket.id} onClick={()=>openTicket(ticket)}><b>{ticket.ticketNumber}</b><small>{ticket.invoiceNumber}</small></button>,
          <div className="cellstack" key={ticket.id+'customer'}><b>{label.customer}</b><small>{label.product} · {ticket.serial||'No serial recorded'}</small></div>,
          <div className="cellstack" key={ticket.id+'issue'}><b>{ticket.category}</b><small>{ticket.issue}</small></div>,
          data.technicians.find(item=>item.id===ticket.assignedTechnicianId)?.name||'Unassigned',ticket.preferredVisitDate?dateInIndia(ticket.preferredVisitDate):'Not scheduled',
          <span className={`p7-status ${ticket.warrantyCoverage==='Covered'?'p7-completed':ticket.warrantyCoverage==='Chargeable'?'p7-expired':'p7-pending-review'}`} key={ticket.id+'coverage'}>{ticket.warrantyCoverage}</span>,
          <div className="cellstack" key={ticket.id+'status'}><span className={`p7-priority is-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span><span className={statusClass(ticket.status)}>{ticket.status}</span></div>,
          <Button key={ticket.id+'open'} size="sm" variant="outline" onClick={()=>openTicket(ticket)}>Manage</Button>]
      })}/>:<EmptyState text="No tickets match these filters. Create one from the service desk, customer profile, warranty or installation record."/>}
    </Panel>
    <DetailDrawer open={!!selected} title={selected?.ticketNumber||'Service ticket'} onClose={()=>setSelectedId('')}>
      {selected&&<div className="p7-drawer">
        <div className="p7-drawer-intro"><span className={statusClass(selected.status)}>{selected.status}</span><p>{selectedLabel?.customer} · {selectedLabel?.product}</p><small>{selected.invoiceNumber} · {selected.serial||'No serial recorded'}</small></div>
        <dl className="facts">{[['Reported issue',selected.issue],['Category / priority',`${selected.category} · ${selected.priority}`],['Service type',selected.serviceType],['Store',data.stores.find(item=>item.id===selected.storeId)?.name||selected.storeId],['Created',dateInIndia(selected.createdAt)],['Warranty classification',selected.warrantyCoverage]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <section className="p7-work-section"><h3>Assign and schedule</h3><div className="p7-action-row"><label className="crm-field">Technician<select value={assignment} onChange={event=>setAssignment(event.target.value)}><option value="">Select technician</option>{serviceTechs.map(item=><option key={item.id} value={item.id}>{item.name} · {item.serviceArea}</option>)}</select></label><Button variant="outline" onClick={assign}>Assign technician</Button><label className="crm-field">Visit date<input type="date" value={visitDate} onChange={event=>setVisitDate(event.target.value)}/></label><Button variant="outline" onClick={saveVisit}>Save visit date</Button></div></section>
        <section className="p7-work-section"><h3>Diagnosis and demo coverage</h3><div className="crm-form-grid">
          <label className="crm-field">Coverage classification<select value={coverage} onChange={event=>setCoverage(event.target.value as WarrantyCoverage)}>{coverageOptions.map(item=><option key={item}>{item}</option>)}</select></label>
          <label className="crm-field">Demo service charge (INR)<input type="number" min="0" step="0.01" value={charge} onChange={event=>setCharge(event.target.value)}/></label>
          <label className="crm-field crm-field-wide">Diagnosis<textarea rows={2} value={diagnosis} onChange={event=>setDiagnosis(event.target.value)}/></label>
          <label className="crm-field">Work performed<textarea rows={2} value={work} onChange={event=>setWork(event.target.value)}/></label>
          <label className="crm-field">Parts noted<textarea rows={2} value={parts} onChange={event=>setParts(event.target.value)}/></label>
        </div><Button variant="outline" onClick={saveWork}><ShieldCheck size={14}/>Save service notes</Button>
          <p className="p7-muted">Parts are notes only; inventory is not changed. Coverage can be reviewed by a demo user and is not an approved OEM claim.</p>
        </section>
        <section className="p7-work-section"><h3>Ticket status</h3><div className="p7-status-actions">
          {selected.status==='Open'&&<Button size="sm" variant="outline" onClick={()=>transition('Assigned')} disabled={!selected.assignedTechnicianId}>Mark assigned</Button>}
          {['Open','Assigned','Scheduled'].includes(selected.status)&&<Button size="sm" onClick={()=>transition('In Progress')} disabled={!selected.assignedTechnicianId}>Start service</Button>}
          {['Assigned','In Progress'].includes(selected.status)&&<Button size="sm" variant="outline" onClick={()=>transition('Waiting for Parts')}>Waiting for parts</Button>}
          {selected.status!=='Escalated'&&openStatuses.includes(selected.status)&&<Button size="sm" variant="outline" onClick={()=>transition('Escalated')}>Escalate</Button>}
          {['Assigned','Scheduled','In Progress','Waiting for Parts','Escalated'].includes(selected.status)&&<Button size="sm" onClick={()=>transition('Resolved')}>Resolve ticket</Button>}
          {selected.status==='Resolved'&&<Button size="sm" onClick={()=>transition('Closed')}>Close ticket</Button>}
        </div><label className="crm-field">Resolution summary<textarea rows={2} value={resolution} onChange={event=>setResolution(event.target.value)} placeholder="Required before resolving"/></label><label className="crm-field">Customer feedback<textarea rows={2} value={feedback} onChange={event=>setFeedback(event.target.value)} onBlur={()=>{if(feedback!==selected.customerFeedback){try{act(selected.id,'Note added','Customer feedback note updated.',ticket=>({...ticket,customerFeedback:feedback.trim()}))}catch(cause){toast.error(cause instanceof Error?cause.message:'Feedback could not be saved.')}}}}/></label>
        </section>
        {error&&<p role="alert" className="crm-error">{error}</p>}
        <section className="p7-work-section"><h3>Activity history</h3><ActivityTimeline items={selectedHistory}/></section>
      </div>}
    </DetailDrawer>
    <ServiceTicketDialog open={createOpen} onOpenChange={setCreateOpen}/>
  </div>
}

export function ServiceEscalations(){
  const {data,transact}=useDemo()
  const [query,setQuery]=useState(''),[selectedId,setSelectedId]=useState(''),[reason,setReason]=useState(''),[notes,setNotes]=useState(''),[date,setDate]=useState(''),[error,setError]=useState('')
  const todayValue=today()
  const repeats=useMemo(()=>{
    const map=new Map<string,number>()
    for(const ticket of data.serviceTickets){const key=`${ticket.customerId}|${ticket.productId}|${ticket.category}`;map.set(key,(map.get(key)||0)+1)}
    return map
  },[data.serviceTickets])
  const candidates=data.serviceTickets.filter(ticket=>{
    const repeated=(repeats.get(`${ticket.customerId}|${ticket.productId}|${ticket.category}`)||0)>1
    const due=!!ticket.preferredVisitDate&&ticket.preferredVisitDate<todayValue&&openStatuses.includes(ticket.status)
    return ticket.status==='Escalated'||ticket.priority==='Urgent'||ticket.priority==='High'||due||repeated
  })
  const matches=candidates.filter(ticket=>`${ticket.ticketNumber} ${ticket.issue} ${ticket.serial} ${ticketLabel(ticket,data).customer}`.toLowerCase().includes(query.trim().toLowerCase()))
  const selected=data.serviceTickets.find(item=>item.id===selectedId)
  function saveEscalation(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!selected){setError('Select a service ticket.');return}
    if(reason.trim().length<8||notes.trim().length<8){setError('Enter an escalation reason and review notes with at least 8 characters each.');return}
    const now=new Date().toISOString()
    try{
      transact(current=>{
        const ticket=current.serviceTickets.find(item=>item.id===selected.id)
        if(!ticket||!openStatuses.includes(ticket.status))throw new Error('Only open service tickets can be escalated.')
        const update={...ticket,status:'Escalated' as const,escalationReason:reason.trim(),escalationNotes:notes.trim(),followUpDate:date,updatedAt:now}
        return {...current,serviceTickets:current.serviceTickets.map(item=>item.id===ticket.id?update:item),
          serviceActivities:[...current.serviceActivities,{id:crypto.randomUUID(),ticketId:ticket.id,action:'Escalated',date:now,actor:'Aarav Sharma',
            notes:`${reason.trim()} Review: ${notes.trim()}${date?` Follow-up: ${date}.`:''}`,fromStatus:ticket.status,toStatus:'Escalated'}]}
      })
      toast.success(`${selected.ticketNumber} escalated for demo review`);setSelectedId('');setReason('');setNotes('');setDate('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Escalation could not be recorded.')}
  }
  function clearEscalation(ticket:ServiceTicket){
    const now=new Date().toISOString()
    const nextStatus:ServiceStatus=ticket.assignedTechnicianId?'Assigned':'Open'
    try{
      transact(current=>({...current,serviceTickets:current.serviceTickets.map(item=>item.id===ticket.id?{...item,status:nextStatus,updatedAt:now}:item),
        serviceActivities:[...current.serviceActivities,{id:crypto.randomUUID(),ticketId:ticket.id,action:'Status changed',date:now,actor:'Aarav Sharma',
          notes:'Escalation review completed; returned to the service queue.',fromStatus:ticket.status,toStatus:nextStatus}]}))
      toast.success('Ticket returned to assigned work')
    }catch(cause){toast.error(cause instanceof Error?cause.message:'Escalation status could not be updated.')}
  }
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Service review" title="Service escalations" description="Review overdue visits, repeated complaints and high-priority tickets. This register records work only; it does not contact customers."/>
    <Panel title="Review queue" meta={`${matches.length} potential review item(s)`}>
      <div className="crm-toolbar"><SearchBar label="Search ticket, customer or serial" value={query} onChange={setQuery}/></div>
      {matches.length?<DataTable columns={['Ticket / customer','Product / issue','Review signal','Visit date','Status','Action']} rows={matches.map(ticket=>{
        const repeated=(repeats.get(`${ticket.customerId}|${ticket.productId}|${ticket.category}`)||0)>1
        const overdue=!!ticket.preferredVisitDate&&ticket.preferredVisitDate<todayValue&&openStatuses.includes(ticket.status)
        return [<div className="cellstack" key={ticket.id}><b>{ticket.ticketNumber}</b><small>{ticketLabel(ticket,data).customer}</small></div>,
          <div className="cellstack" key={ticket.id+'issue'}><b>{ticketLabel(ticket,data).product}</b><small>{ticket.issue}</small></div>,
          [ticket.priority==='Urgent'||ticket.priority==='High'?`${ticket.priority} priority`:null,overdue?'Visit date passed':null,repeated?'Repeat product issue':null,ticket.status==='Escalated'?'Escalated':null].filter(Boolean).join(' · '),
          ticket.preferredVisitDate?dateInIndia(ticket.preferredVisitDate):'No visit date',
          <span className={statusClass(ticket.status)} key={ticket.id+'status'}>{ticket.status}</span>,
          ticket.status==='Escalated'?<Button key={ticket.id+'clear'} size="sm" variant="outline" onClick={()=>clearEscalation(ticket)}>Return to work</Button>:<Button key={ticket.id+'review'} size="sm" onClick={()=>{setSelectedId(ticket.id);setError('')}}>Review / escalate</Button>]
      })}/>:<EmptyState text="No tickets meet the current escalation signals."/>}
    </Panel>
    <Dialog open={!!selected} onOpenChange={open=>!open&&setSelectedId('')}><DialogContent className="p7-dialog"><DialogTitle>Escalate {selected?.ticketNumber}</DialogTitle><DialogDescription>Record a reason, review note and optional follow-up date. No message is sent.</DialogDescription><form className="crm-form" onSubmit={saveEscalation} noValidate>
      <div className="crm-form-grid"><label className="crm-field crm-field-wide">Escalation reason<span>*</span><textarea rows={2} minLength={8} required value={reason} onChange={event=>setReason(event.target.value)}/></label><label className="crm-field crm-field-wide">Manager review notes<span>*</span><textarea rows={3} minLength={8} required value={notes} onChange={event=>setNotes(event.target.value)}/></label><label className="crm-field">Follow-up date<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label></div>
      {error&&<p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={()=>setSelectedId('')}>Cancel</Button><Button type="submit">Save escalation</Button></DialogFooter>
    </form></DialogContent></Dialog>
    <PrototypeNote>Escalation is an internal demo record. It does not initiate a phone call, SMS, WhatsApp message or external service request.</PrototypeNote>
  </div>
}
