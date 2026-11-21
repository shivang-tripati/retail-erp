'use client'
import {useState,type FormEvent} from 'react'
import Link from 'next/link'
import {ArrowRight,CalendarCheck2,Check,ClipboardCheck,Plus,Printer,RotateCcw} from 'lucide-react'
import {toast} from 'sonner'
import {useDemo} from '@/components/demo-provider'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector,Confirmation} from '@/components/foundation'
import {Panel} from '@/components/analytics-controls'
import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '@/components/ui/dialog'
import {dateInIndia} from '@/lib/phase3-data'
import {getInstallationEligibility,installationCategoryRequiresService,installationStatusLabel,validateInstallationCompletion} from '@/lib/aftersales'
import type {Installation,InstallationActivity,InstallationChecklistItem,InstallationStatus,Technician} from '@/lib/phase7-types'
import {AfterSalesMetrics,ActivityTimeline,PrototypeNote} from './common'
import {ServiceTicketDialog} from './service-ticket-dialog'

const slots=['09:00–12:00','12:00–15:00','15:00–18:00']
const checklistLabels=['Product and serial verified','Installation area checked','Product installed and levelled','Power-on and function test passed','Customer usage explained']
const activeStatuses:InstallationStatus[]=['Pending','Scheduled','Assigned','In Progress','Rescheduled','Awaiting scheduling']

function installStatus(status:InstallationStatus){return installationStatusLabel(status)}
function rowMatches(row:{product:string;customer:string;invoice:string;serial:string},query:string){
  return `${row.product} ${row.customer} ${row.invoice} ${row.serial}`.toLowerCase().includes(query.trim().toLowerCase())
}

export function InstallationDashboard(){
  const {data}=useDemo()
  const items=data.installations,active=items.filter(item=>activeStatuses.includes(item.status)),today=new Date().toISOString().slice(0,10)
  const scheduledToday=active.filter(item=>item.scheduledDate===today)
  const overdue=active.filter(item=>item.scheduledDate&&item.scheduledDate<today)
  const completed=items.filter(item=>item.status==='Completed').length
  const failed=items.filter(item=>item.status==='Failed').length
  const rates=items.length?Math.round(completed/items.length*100):0
  const queue=active.slice().sort((a,b)=>(a.scheduledDate||'9999').localeCompare(b.scheduledDate||'9999')).slice(0,8)
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Installation" title="Installation operations" description="Move delivered appliances and televisions from the delivery record into a scheduled, technician-owned installation."/>
    <AfterSalesMetrics items={[
      {label:'Eligible for installation',value:String(getInstallationEligibility(data).reduce((sum,item)=>sum+item.availableQuantity,0)),note:'Delivered units without an active booking'},
      {label:'Open bookings',value:String(active.length),note:'Pending through in progress',accent:'p7-metric-teal'},
      {label:'Scheduled today',value:String(scheduledToday.length),note:dateInIndia(today)},
      {label:'Overdue bookings',value:String(overdue.length),note:'Past scheduled date',accent:overdue.length?'p7-metric-amber':''},
      {label:'Completed',value:String(completed),note:`${rates}% of recorded installations`},
      {label:'Failed / revisit',value:String(failed),note:'Requires a follow-up action',accent:failed?'p7-metric-amber':''}
    ]}/>
    <div className="p7-overview-grid">
      <Panel title="Installation work queue" meta="Next appointments and items awaiting a date" action={<Link className="p7-inline-link" href="/after-sales/installation-worklist">Open worklist <ArrowRight size={14}/></Link>}>
        {queue.length?<DataTable columns={['Product / customer','Appointment','Technician','Status']} rows={queue.map(item=>{
          const customer=data.customers.find(record=>record.id===item.customerId)
          const tech=data.technicians.find(record=>record.id===item.technicianId)
          return [<div className="cellstack" key={item.id}><b>{item.product}</b><small>{customer?.name||item.customerId} · {item.serials?.join(', ')||`${item.quantity||1} unit(s)`}</small></div>,
            item.scheduledDate?`${dateInIndia(item.scheduledDate)} · ${item.timeSlot||'Time not set'}`:'Awaiting appointment',
            tech?.name||'Not assigned',<span className={`p7-status p7-${installStatus(item.status).toLowerCase().replace(/ /g,'-')}`} key={item.id+'status'}>{installStatus(item.status)}</span>]
        })}/>:<EmptyState text="No installation bookings are waiting. Review delivered-product eligibility to create the next booking."/>}
      </Panel>
      <Panel title="Technician coverage" meta="Active technicians by availability">
        <div className="p7-coverage-list">{data.technicians.filter(item=>item.status==='Active').map(item=>{
          const assigned=active.filter(install=>install.technicianId===item.id).length
          return <div key={item.id}><span className={`p7-availability is-${item.availability.toLowerCase()}`}/><div><b>{item.name}</b><small>{item.serviceArea} · {item.skills.slice(0,2).join(', ')}</small></div><strong>{assigned}</strong></div>
        })}</div>
      </Panel>
    </div>
    <PrototypeNote>Counts are calculated from completed demo deliveries and local installation records. They do not represent an external technician network or a manufacturer service commitment.</PrototypeNote>
  </div>
}

export function InstallationEligibility(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[store,setStore]=useState('All stores')
  const eligible=getInstallationEligibility(data).filter(row=>
    (store==='All stores'||row.storeId===data.stores.find(item=>item.name===store)?.id)&&
    rowMatches({product:row.product.name,customer:row.customer.name,invoice:row.sale.invoiceNumber,serial:row.availableSerials.join(' ')},query))
  const notRequired=data.deliveries.flatMap(delivery=>{
    const sale=data.sales.find(item=>item.id===delivery.saleId)
    if(!sale||sale.status!=='Completed')return []
    return delivery.items.flatMap(item=>{
      const product=data.products.find(record=>record.id===item.productId)
      const delivered=item.deliveredQuantity
      return product&&delivered>0&&!installationCategoryRequiresService(product)?[{delivery,item,product,customer:data.customers.find(record=>record.id===delivery.customerId),sale}]:[]
    })
  })
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Eligibility" title="Delivered products" description="Only units confirmed as delivered can enter the installation queue. Product and serial details remain linked to the source invoice."/>
    <Panel title="Ready for installation" meta={`${eligible.reduce((sum,row)=>sum+row.availableQuantity,0)} eligible unit(s)`} action={<Link className="p7-inline-link" href="/after-sales/installation-bookings">Book an installation <ArrowRight size={14}/></Link>}>
      <div className="crm-toolbar"><SearchBar label="Search customer, product, invoice or serial" value={query} onChange={setQuery}/><Selector label="Filter by store" value={store} options={['All stores',...data.stores.map(item=>item.name)]} onChange={setStore}/></div>
      {eligible.length?<DataTable columns={['Product','Customer / invoice','Store','Delivered balance','Serial numbers','Delivery']} rows={eligible.map(row=>[
        <div className="cellstack" key={row.item.id}><b>{row.product.name}</b><small>{row.product.category} · {row.product.sku}</small></div>,
        <div className="cellstack" key={row.sale.id}><b>{row.customer.name}</b><small>{row.sale.invoiceNumber}</small></div>,
        data.stores.find(item=>item.id===row.storeId)?.name||row.storeId,
        `${row.availableQuantity} unit(s)`,
        row.availableSerials.length?row.availableSerials.join(', '):'Not serial-controlled',
        <Link key={row.delivery.id} className="p7-inline-link" href="/fulfilment/delivery-orders">{row.delivery.orderNumber}<ArrowRight size={13}/></Link>
      ])}/>:<EmptyState text="No delivered products are currently eligible. Record proof of delivery or adjust the search and store filter."/>}
    </Panel>
    <Panel title="Delivered products without installation requirement" meta="Visible for clarity; these products are not bookable in this module">
      {notRequired.length?<DataTable columns={['Product','Customer','Invoice','Delivered','Reason']} rows={notRequired.map(({item,product,customer,sale})=>[
        product.name,customer?.name||'Customer record unavailable',sale.invoiceNumber,`${item.deliveredQuantity} unit(s)`,'Category does not require demo installation'
      ])}/>:<EmptyState text="No delivered quantity-based products need this clarification."/>}
    </Panel>
  </div>
}

export function InstallationBookings(){
  const {data,transact}=useDemo()
  const [query,setQuery]=useState(''),[store,setStore]=useState('All stores')
  const [candidate,setCandidate]=useState<ReturnType<typeof getInstallationEligibility>[number]|null>(null)
  const [quantity,setQuantity]=useState('1'),[serials,setSerials]=useState<string[]>([]),[date,setDate]=useState(''),[slot,setSlot]=useState(slots[0])
  const [technicianId,setTechnicianId]=useState(''),[instructions,setInstructions]=useState(''),[error,setError]=useState('')
  const eligible=getInstallationEligibility(data).filter(row=>
    (store==='All stores'||row.storeId===data.stores.find(item=>item.name===store)?.id)&&
    rowMatches({product:row.product.name,customer:row.customer.name,invoice:row.sale.invoiceNumber,serial:row.availableSerials.join(' ')},query))
  const activeTechnicians=data.technicians.filter(item=>item.status==='Active'&&item.availability==='Available')
  const scheduledSlotAvailable=(tech:Technician,dateValue:string,slotValue:string)=>{
    if(!candidate)return false
    const bookedInstallation=data.installations.some(item=>item.technicianId===tech.id&&item.scheduledDate===dateValue&&item.timeSlot===slotValue&&activeStatuses.includes(item.status))
    const bookedService=data.serviceTickets.some(item=>item.assignedTechnicianId===tech.id&&item.preferredVisitDate===dateValue&&['Assigned','Scheduled','In Progress','Waiting for Parts','Escalated'].includes(item.status))
    return !bookedInstallation&&!bookedService
  }
  const eligibleTechnicians=activeTechnicians.filter(item=>candidate?.product&&item.skills.includes(candidate.product.category)&&(!date||scheduledSlotAvailable(item,date,slot)))
  const active=data.installations.filter(item=>activeStatuses.includes(item.status))
  function openBooking(row:typeof eligible[number]){
    setCandidate(row);setQuantity('1');setSerials(row.product.serialRequired?row.availableSerials.slice(0,1):[])
    setDate('');setSlot(slots[0]);setTechnicianId('');setInstructions('');setError('')
  }
  function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!candidate){setError('Select an eligible delivery item.');return}
    const count=candidate.product.serialRequired?serials.length:Number(quantity)
    if(!date||! /^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())||date<new Date().toISOString().slice(0,10)||!slot||
      !Number.isInteger(count)||count<1||count>candidate.availableQuantity){setError('Choose a valid future appointment and whole-unit quantity within the delivered balance.');return}
    if(candidate.product.serialRequired&&(serials.length!==count||serials.some(serial=>!candidate.availableSerials.includes(serial)))){setError('Select exactly one eligible delivered serial for every booked unit.');return}
    const selectedTech=data.technicians.find(item=>item.id===technicianId&&item.status==='Active'&&item.availability==='Available')
    if(!selectedTech||!selectedTech.skills.includes(candidate.product.category)||!scheduledSlotAvailable(selectedTech,date,slot)){setError('Choose an available technician with the required product skill and no overlapping demo appointment.');return}
    try{
      const now=new Date().toISOString()
      transact(current=>{
        const fresh=getInstallationEligibility(current).find(item=>item.delivery.id===candidate.delivery.id&&item.item.id===candidate.item.id)
        if(!fresh||count>fresh.availableQuantity||serials.some(serial=>!fresh.availableSerials.includes(serial)))throw new Error('This eligibility changed. Refresh the list and choose from the remaining delivered units.')
        const stillAvailable=current.technicians.some(item=>item.id===selectedTech.id&&item.status==='Active'&&item.availability==='Available')
        const conflict=current.installations.some(item=>item.technicianId===selectedTech.id&&item.scheduledDate===date&&item.timeSlot===slot&&activeStatuses.includes(item.status))||
          current.serviceTickets.some(item=>item.assignedTechnicianId===selectedTech.id&&item.preferredVisitDate===date&&['Assigned','Scheduled','In Progress','Waiting for Parts','Escalated'].includes(item.status))
        if(!stillAvailable||conflict)throw new Error('The technician is no longer available for this appointment slot.')
        const installationId=crypto.randomUUID()
        const record:Installation={
          id:installationId,saleId:fresh.sale.id,customerId:fresh.customer.id,product:fresh.product.name,productId:fresh.product.id,
          storeId:fresh.storeId,deliveryId:fresh.delivery.id,deliveryItemId:fresh.item.id,serials:[...serials],quantity:count,
          scheduledDate:date,status:'Scheduled',address:fresh.delivery.deliveryAddress,preferredDate:date,timeSlot:slot,
          technicianId:selectedTech.id,serviceType:'On-site',instructions:instructions.trim(),createdAt:now,updatedAt:now,
          checklist:checklistLabels.map((label,index)=>({id:`CHECK-${installationId}-${index+1}`,label,checked:false})),
          customerConfirmed:false,reportReference:''
        }
        const activity:InstallationActivity[]=[
          {id:crypto.randomUUID(),installationId,action:'Booking created',date:now,actor:'Aarav Sharma',notes:`${count} delivered unit(s) booked from ${fresh.sale.invoiceNumber}.`},
          {id:crypto.randomUUID(),installationId,action:'Scheduled',date:now,actor:'Aarav Sharma',notes:`Appointment ${date} · ${slot}.`},
          {id:crypto.randomUUID(),installationId,action:'Assigned',date:now,actor:'Aarav Sharma',notes:`Assigned to ${selectedTech.name}.`}
        ]
        return {...current,installations:[...current.installations,record],installationActivities:[...current.installationActivities,...activity]}
      })
      toast.success('Installation appointment booked')
      setCandidate(null)
    }catch(cause){setError(cause instanceof Error?cause.message:'Installation booking could not be saved. No records were changed.')}
  }
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Booking" title="Installation bookings" description="Schedule eligible delivered units with a skilled technician and a clear appointment window."/>
    <Panel title="Delivered units to book" meta={`${eligible.reduce((sum,item)=>sum+item.availableQuantity,0)} unit(s) available`}>
      <div className="crm-toolbar"><SearchBar label="Search customer, product, invoice or serial" value={query} onChange={setQuery}/><Selector label="Filter by store" value={store} options={['All stores',...data.stores.map(item=>item.name)]} onChange={setStore}/></div>
      {eligible.length?<DataTable columns={['Product / customer','Invoice','Available','Serials','Actions']} rows={eligible.map(row=>[
        <div className="cellstack" key={row.item.id}><b>{row.product.name}</b><small>{row.customer.name} · {data.stores.find(item=>item.id===row.storeId)?.name||row.storeId}</small></div>,
        row.sale.invoiceNumber,`${row.availableQuantity} unit(s)`,row.availableSerials.join(', ')||'Quantity tracked',
        <Button key={row.item.id+'book'} size="sm" onClick={()=>openBooking(row)}><CalendarCheck2 size={14}/>Book</Button>
      ])}/>:<EmptyState text="No units are ready for a new appointment."/>}
    </Panel>
    <Panel title="Current appointments" meta={`${active.length} active booking(s)`}>
      {active.length?<DataTable columns={['Product','Customer','Appointment','Technician','Status']} rows={active.map(item=>[
        item.product,data.customers.find(record=>record.id===item.customerId)?.name||item.customerId,
        item.scheduledDate?`${dateInIndia(item.scheduledDate)} · ${item.timeSlot||'Time not set'}`:'Date to be arranged',
        data.technicians.find(record=>record.id===item.technicianId)?.name||'Unassigned',installStatus(item.status)
      ])}/>:<EmptyState text="No active installation appointments."/>}
    </Panel>
    <Dialog open={!!candidate} onOpenChange={open=>!open&&setCandidate(null)}><DialogContent className="p7-dialog">
      <DialogTitle>Book {candidate?.product.name||'installation'}</DialogTitle><DialogDescription>{candidate?.customer.name} · {candidate?.sale.invoiceNumber} · {candidate?.availableQuantity} delivered unit(s) available.</DialogDescription>
      {candidate&&<form className="crm-form" onSubmit={save} noValidate><div className="crm-form-grid">
        {!candidate.product.serialRequired&&<label className="crm-field">Quantity<span>*</span><input type="number" min="1" max={candidate.availableQuantity} step="1" required value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>}
        {candidate.product.serialRequired&&<fieldset className="p7-serial-field"><legend>Delivered serials<span>*</span></legend>{candidate.availableSerials.map(serial=><label key={serial}><input type="checkbox" checked={serials.includes(serial)} onChange={event=>setSerials(current=>event.target.checked?[...current,serial]:current.filter(item=>item!==serial))}/>{serial}</label>)}</fieldset>}
        <label className="crm-field">Appointment date<span>*</span><input type="date" min={new Date().toISOString().slice(0,10)} required value={date} onChange={event=>setDate(event.target.value)}/></label>
        <label className="crm-field">Time slot<span>*</span><select value={slot} onChange={event=>setSlot(event.target.value)}>{slots.map(item=><option key={item}>{item}</option>)}</select></label>
        <label className="crm-field">Technician<span>*</span><select required value={technicianId} onChange={event=>setTechnicianId(event.target.value)}><option value="">Select a skilled technician</option>{eligibleTechnicians.map(item=><option key={item.id} value={item.id}>{item.name} · {item.serviceArea}</option>)}</select></label>
        <label className="crm-field crm-field-wide">Installation instructions<textarea rows={3} value={instructions} onChange={event=>setInstructions(event.target.value)} placeholder="Access notes or customer preferences"/></label>
      </div>{!eligibleTechnicians.length&&<p role="status" className="p7-muted">No available active technician is listed for this product category.</p>}{error&&<p role="alert" className="crm-error">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={()=>setCandidate(null)}>Cancel</Button><Button type="submit" disabled={!eligibleTechnicians.length}>Confirm appointment</Button></DialogFooter></form>}
    </DialogContent></Dialog>
  </div>
}

export function TechnicianDirectory(){
  const {data,update}=useDemo()
  const skillOptions=[...new Set(data.products.map(item=>item.category))]
  const [query,setQuery]=useState(''),[availability,setAvailability]=useState('All availability')
  const [draft,setDraft]=useState<Technician|null>(null),[confirm,setConfirm]=useState<Technician|null>(null),[error,setError]=useState('')
  const matches=data.technicians.filter(item=>(availability==='All availability'||item.availability===availability)&&`${item.name} ${item.technicianId} ${item.serviceArea} ${item.skills.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  function start(item?:Technician){
    setError('')
    setDraft(item?{...item,skills:[...item.skills]}:{id:'',technicianId:`SE-T${String(200+data.technicians.length+1)}`,name:'',mobile:'',skills:[],serviceArea:'',availability:'Available',status:'Active',createdAt:'',updatedAt:''})
  }
  function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!draft)return
    const name=draft.name.trim(),mobile=draft.mobile.trim(),serviceArea=draft.serviceArea.trim()
    if(!name||!draft.technicianId.trim()||!/^\d{10}$/.test(mobile)||!serviceArea||!draft.skills.length){setError('Enter the technician ID, name, 10-digit mobile, service area and at least one skill.');return}
    if(data.technicians.some(item=>item.id!==draft.id&&(item.mobile===mobile||item.technicianId.toLowerCase()===draft.technicianId.toLowerCase()))){setError('That mobile number or technician ID is already in use.');return}
    const now=new Date().toISOString()
    const record:Technician={...draft,name,mobile,serviceArea,technicianId:draft.technicianId.trim(),updatedAt:now,createdAt:draft.createdAt||now}
    update('technicians',draft.id?data.technicians.map(item=>item.id===draft.id?record:item):[...data.technicians,{...record,id:crypto.randomUUID()}])
    toast.success(draft.id?'Technician updated':'Technician added')
    setDraft(null)
  }
  function toggle(item:Technician){
    const status:Technician['status']=item.status==='Active'?'Inactive':'Active'
    update('technicians',data.technicians.map(record=>record.id===item.id?{...record,status,updatedAt:new Date().toISOString()}:record))
    setConfirm(null);toast.success(`${item.name} is now ${status.toLowerCase()}`)
  }
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Team" title="Technician directory" description="Maintain the fictional installation and service team, skills, availability and active status."/>
    <Panel title="Technicians" meta={`${matches.length} of ${data.technicians.length} team members`} action={<Button onClick={()=>start()}><Plus size={15}/>Add technician</Button>}>
      <div className="crm-toolbar"><SearchBar label="Search technician, area or skill" value={query} onChange={setQuery}/><Selector label="Filter by availability" value={availability} options={['All availability','Available','Busy','Unavailable']} onChange={setAvailability}/></div>
      {matches.length?<DataTable columns={['Technician','Service area','Skills','Availability','Workload','Status','Actions']} rows={matches.map(item=>{
        const workload=data.installations.filter(record=>record.technicianId===item.id&&activeStatuses.includes(record.status)).length+
          data.serviceTickets.filter(record=>record.assignedTechnicianId===item.id&&!['Closed','Cancelled','Resolved'].includes(record.status)).length
        return [<div className="cellstack" key={item.id}><b>{item.name}</b><small>{item.technicianId} · {item.mobile}</small></div>,
          item.serviceArea,item.skills.join(', '),<span className={`p7-availability-label is-${item.availability.toLowerCase()}`} key={item.id+'availability'}>{item.availability}</span>,
          `${workload} open item(s)`,<span className={`p7-status ${item.status==='Active'?'p7-completed':'p7-cancelled'}`} key={item.id+'status'}>{item.status}</span>,
          <div className="p7-actions" key={item.id+'actions'}><Button size="sm" variant="outline" onClick={()=>start(item)}>Edit</Button><Button size="sm" variant="outline" onClick={()=>item.status==='Active'?setConfirm(item):toggle(item)}>{item.status==='Active'?'Deactivate':'Activate'}</Button></div>]
      })}/>:<EmptyState text="No technicians match the current search or availability filter."/>}
    </Panel>
    <Dialog open={!!draft} onOpenChange={open=>!open&&setDraft(null)}><DialogContent className="p7-dialog"><DialogTitle>{draft?.id?'Edit':'Add'} technician</DialogTitle><DialogDescription>Team details are fictional and remain in this demo session.</DialogDescription>{draft&&<form className="crm-form" onSubmit={save} noValidate>
      <div className="crm-form-grid">
        <label className="crm-field">Name<span>*</span><input required value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
        <label className="crm-field">Technician ID<span>*</span><input required value={draft.technicianId} onChange={event=>setDraft({...draft,technicianId:event.target.value})}/></label>
        <label className="crm-field">Mobile<span>*</span><input required inputMode="numeric" maxLength={10} value={draft.mobile} onChange={event=>setDraft({...draft,mobile:event.target.value.replace(/\D/g,'')})}/></label>
        <label className="crm-field">Service area<span>*</span><input required value={draft.serviceArea} onChange={event=>setDraft({...draft,serviceArea:event.target.value})}/></label>
        <label className="crm-field">Availability<select value={draft.availability} onChange={event=>setDraft({...draft,availability:event.target.value as Technician['availability']})}><option>Available</option><option>Busy</option><option>Unavailable</option></select></label>
        <fieldset className="p7-serial-field"><legend>Product skills<span>*</span></legend>{skillOptions.map(skill=><label key={skill}><input type="checkbox" checked={draft.skills.includes(skill)} onChange={event=>setDraft({...draft,skills:event.target.checked?[...draft.skills,skill]:draft.skills.filter(item=>item!==skill)})}/>{skill}</label>)}</fieldset>
      </div>{error&&<p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={()=>setDraft(null)}>Cancel</Button><Button type="submit">Save technician</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
    <Confirmation open={!!confirm} onClose={()=>setConfirm(null)} title={`Deactivate ${confirm?.name}?`} text="Existing work history stays available. This technician will not be available for new assignments." onConfirm={()=>confirm&&toggle(confirm)}/>
  </div>
}

export function InstallationWorklist(){
  const {data,transact}=useDemo()
  const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState('Active work'),[techFilter,setTechFilter]=useState('All technicians')
  const [selectedId,setSelectedId]=useState(''),[assignmentChoice,setAssignmentChoice]=useState(''),[ticketOpen,setTicketOpen]=useState(false),[failureReason,setFailureReason]=useState(''),[newDate,setNewDate]=useState(''),[cancelReason,setCancelReason]=useState(''),[confirmCancel,setConfirmCancel]=useState(false)
  const selected=data.installations.find(item=>item.id===selectedId)
  const technicianName=(id:string|undefined)=>data.technicians.find(item=>item.id===id)?.name||'Unassigned'
  const statuses=['Pending','Scheduled','Assigned','In Progress','Completed','Failed','Rescheduled','Cancelled']
  const matches=data.installations.filter(item=>{
    const status=installStatus(item.status)
    const customer=data.customers.find(record=>record.id===item.customerId)
    return (statusFilter==='All statuses'||(statusFilter==='Active work'?activeStatuses.includes(item.status):status===statusFilter))&&
      (techFilter==='All technicians'||item.technicianId===techFilter)&&
      `${item.product} ${customer?.name||''} ${item.serials?.join(' ')||''} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  function updateInstallation(id:string,change:(record:Installation)=>Installation,action:InstallationActivity['action'],notes:string){
    const now=new Date().toISOString()
    transact(current=>{
      const record=current.installations.find(item=>item.id===id)
      if(!record)throw new Error('Installation record is no longer available.')
      const updated={...change(record),updatedAt:now}
      return {...current,installations:current.installations.map(item=>item.id===id?updated:item),
        installationActivities:[...current.installationActivities,{id:crypto.randomUUID(),installationId:id,action,date:now,actor:'Aarav Sharma',notes}]}
    })
  }
  function assignTechnician(id:string){
    const current=data.installations.find(item=>item.id===id)
    if(!current)return
    const tech=data.technicians.find(item=>item.id===assignmentChoice&&item.status==='Active'&&(item.availability==='Available'||item.id===current.technicianId)&&item.skills.includes(data.products.find(product=>product.id===current.productId)?.category||''))
    if(!tech){toast.error('Choose an active technician with the required product skill.');return}
    try{updateInstallation(id,record=>({...record,technicianId:tech.id,status:record.status==='Pending'?'Assigned':record.status}), 'Assigned',`Assigned to ${tech.name}.`);toast.success('Technician assignment recorded')}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Technician assignment failed.')}
  }
  function startWork(id:string){
    try{updateInstallation(id,record=>{if(!['Scheduled','Assigned','Rescheduled'].includes(record.status))throw new Error('Only a scheduled or assigned installation can start.');return {...record,status:'In Progress'}},'Started','Technician started the installation visit.');toast.success('Installation visit started')}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Installation could not be started.')}
  }
  function recordArrival(id:string){
    try{updateInstallation(id,record=>{if(record.status!=='In Progress')throw new Error('Start the installation visit before recording arrival.');return {...record,arrivedAt:new Date().toISOString()}},'Arrived','Technician arrival recorded in the demo work history.');toast.success('Arrival recorded')}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Arrival could not be recorded.')}
  }
  function toggleChecklist(record:Installation,itemId:string,checked:boolean){
    const checklist=record.checklist?.length?record.checklist:checklistLabels.map((label,index)=>({id:`CHECK-${record.id}-${index+1}`,label,checked:false}))
    const item=checklist.find(value=>value.id===itemId)
    if(!item)return
    try{updateInstallation(record.id,value=>({...value,checklist:checklist.map(entry=>entry.id===itemId?{...entry,checked,checkedAt:checked?new Date().toISOString():'',checkedBy:checked?technicianName(value.technicianId):''}:entry)}),
      'Checklist updated',`${item.label}: ${checked?'complete':'not complete'}.`)}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Checklist update failed.')}
  }
  function complete(record:Installation){
    try{validateInstallationCompletion(record);updateInstallation(record.id,value=>({...value,status:'Completed',completedAt:new Date().toISOString(),reportReference:`INSTALL-${value.id.slice(0,8).toUpperCase()}`}),
      'Completed',`Installation completed for ${record.quantity||1} unit(s). Customer confirmation recorded; no signature collected.`);toast.success('Installation completed and report reference recorded')}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Installation could not be completed.')}
  }
  function fail(record:Installation){
    if(failureReason.trim().length<8){toast.error('Enter a failure reason with at least 8 characters.');return}
    try{updateInstallation(record.id,value=>({...value,status:'Failed',failureReason:failureReason.trim()}),'Failed',failureReason.trim());setFailureReason('');toast.success('Installation exception recorded')}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Failure could not be recorded.')}
  }
  function reschedule(record:Installation){
    if(!newDate){toast.error('Choose a new appointment date.');return}
    try{updateInstallation(record.id,value=>({...value,status:'Rescheduled',scheduledDate:newDate,preferredDate:newDate}),'Rescheduled',`Revisit / new appointment scheduled for ${newDate}.`);setNewDate('');toast.success('Installation rescheduled')}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Installation could not be rescheduled.')}
  }
  function cancel(record:Installation){
    if(cancelReason.trim().length<8){toast.error('Enter a cancellation reason with at least 8 characters.');return}
    try{updateInstallation(record.id,value=>({...value,status:'Cancelled',cancellationReason:cancelReason.trim()}),'Cancelled',cancelReason.trim());setCancelReason('');setConfirmCancel(false);toast.success('Installation booking cancelled with history retained')}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Installation could not be cancelled.')}
  }
  const selectedCustomer=selected&&data.customers.find(item=>item.id===selected.customerId)
  const selectedHistory=data.installationActivities.filter(item=>item.installationId===selected?.id)
  const checklist=selected?.checklist?.length?selected.checklist:checklistLabels.map((label,index)=>({id:`CHECK-${selected?.id}-${index+1}`,label,checked:false}))
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Field work" title="Installation worklist" description="Technician assignment, arrival, checklist completion, failure and revisit history in one record."/>
    <Panel title="Installation records" meta={`${matches.length} records`}>
      <div className="crm-toolbar"><SearchBar label="Search product, customer or serial" value={query} onChange={setQuery}/><Selector label="Filter installation status" value={statusFilter} options={['Active work','All statuses',...statuses]} onChange={setStatusFilter}/><Selector label="Filter technician" value={techFilter} options={['All technicians',...data.technicians.map(item=>item.id)]} onChange={setTechFilter}/></div>
      {matches.length?<DataTable columns={['Installation','Invoice / customer','Appointment','Technician','Status','Actions']} rows={matches.map(item=>[
        <div className="cellstack" key={item.id}><b>{item.product}</b><small>{item.serials?.join(', ')||`${item.quantity||1} unit(s)`}</small></div>,
        <div className="cellstack" key={item.id+'sale'}><b>{data.sales.find(sale=>sale.id===item.saleId)?.invoiceNumber||'Invoice unavailable'}</b><small>{data.customers.find(customer=>customer.id===item.customerId)?.name||item.customerId}</small></div>,
        item.scheduledDate?`${dateInIndia(item.scheduledDate)} · ${item.timeSlot||'Time not set'}`:'Not scheduled',technicianName(item.technicianId),
        <span className={`p7-status p7-${installStatus(item.status).toLowerCase().replace(/ /g,'-')}`} key={item.id+'status'}>{installStatus(item.status)}</span>,
        <Button key={item.id+'details'} size="sm" variant="outline" onClick={()=>{setSelectedId(item.id);setAssignmentChoice(item.technicianId||'');setFailureReason('');setNewDate('')}}>Open record</Button>
      ])}/>:<EmptyState text="No installation records match these filters."/>}
    </Panel>
    <DetailDrawer open={!!selected} title={selected?.product||'Installation details'} onClose={()=>setSelectedId('')}>
      {selected&&<div className="p7-drawer">
        <div className="p7-drawer-intro"><span className={`p7-status p7-${installStatus(selected.status).toLowerCase().replace(/ /g,'-')}`}>{installStatus(selected.status)}</span><p>{selectedCustomer?.name||selected.customerId} · {data.sales.find(item=>item.id===selected.saleId)?.invoiceNumber||'Invoice unavailable'}</p><small>{selected.serials?.join(', ')||`${selected.quantity||1} quantity-tracked unit(s)`}</small></div>
        <dl className="facts">{[['Appointment',selected.scheduledDate?`${dateInIndia(selected.scheduledDate)} · ${selected.timeSlot||''}`:'Not scheduled'],['Technician',technicianName(selected.technicianId)],['Store',data.stores.find(item=>item.id===selected.storeId)?.name||selected.storeId||'Not recorded'],['Address',selected.address||'Not recorded'],['Instructions',selected.instructions||'None']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <section className="p7-work-section"><h3>Technician assignment</h3><div className="p7-action-row"><select aria-label="Assign technician" disabled={selected.status==='Completed'||selected.status==='Cancelled'} value={assignmentChoice} onChange={event=>setAssignmentChoice(event.target.value)}><option value="">Select technician</option>{data.technicians.filter(item=>item.status==='Active'&&(item.availability==='Available'||item.id===selected.technicianId)&&item.skills.includes(data.products.find(product=>product.id===selected.productId)?.category||'')).map(item=><option key={item.id} value={item.id}>{item.name} · {item.availability}</option>)}</select><Button variant="outline" disabled={selected.status==='Completed'||selected.status==='Cancelled'} onClick={()=>assignTechnician(selected.id)}>Confirm assignment</Button></div></section>
        <section className="p7-work-section"><h3>Visit and completion checklist</h3><div className="p7-action-row"><Button size="sm" onClick={()=>startWork(selected.id)} disabled={!['Scheduled','Assigned','Rescheduled'].includes(selected.status)}><Check size={14}/>Start visit</Button><Button size="sm" variant="outline" onClick={()=>recordArrival(selected.id)} disabled={selected.status!=='In Progress'||!!selected.arrivedAt}>Record arrival</Button>{selected.arrivedAt&&<span className="p7-muted">Arrived {dateInIndia(selected.arrivedAt)}</span>}</div>
          <div className="p7-checklist">{checklist.map(item=><label key={item.id}><input type="checkbox" checked={item.checked} disabled={selected.status!=='In Progress'||!selected.arrivedAt} onChange={event=>toggleChecklist(selected,item.id,event.target.checked)}/>{item.label}</label>)}</div>
          <label className="p7-confirm"><input type="checkbox" checked={!!selected.customerConfirmed} disabled={selected.status!=='In Progress'||!selected.arrivedAt} onChange={event=>{try{updateInstallation(selected.id,record=>({...record,customerConfirmed:event.target.checked}),'Note added',`Customer completion confirmation ${event.target.checked?'recorded':'removed'}. No signature is collected.`)}catch(cause){toast.error(cause instanceof Error?cause.message:'Confirmation could not be saved.')}}}/>Customer confirms the installation visit is complete. No signature is collected.</label>
          <div className="p7-action-row"><Button onClick={()=>complete(selected)} disabled={selected.status!=='In Progress'}><ClipboardCheck size={14}/>Complete installation</Button>{selected.status==='Completed'&&<Button variant="outline" onClick={()=>window.print()}><Printer size={14}/>Print completion report</Button>}</div>
        </section>
        {selected.status==='Completed'&&<section className="p7-print-sheet"><header><b>Sharma Electronics</b><span>Installation completion report · demo</span></header><h2>{selected.reportReference||'Installation report'}</h2><p>{selected.product} · {selected.serials?.join(', ')||`${selected.quantity||1} unit(s)`}</p><p>{selectedCustomer?.name} · {selected.address}</p><p>Completed {selected.completedAt?dateInIndia(selected.completedAt):'—'} by {technicianName(selected.technicianId)}</p><p>Customer confirmation noted for demo only. No signature was captured.</p></section>}
        {['Pending','Scheduled','Assigned','In Progress','Rescheduled'].includes(selected.status)&&<section className="p7-work-section"><h3>Reschedule or record an exception</h3><div className="p7-action-row"><label className="crm-field">New appointment date<input type="date" min={new Date().toISOString().slice(0,10)} value={newDate} onChange={event=>setNewDate(event.target.value)}/></label><Button variant="outline" onClick={()=>reschedule(selected)}><RotateCcw size={14}/>Reschedule</Button></div><label className="crm-field">Failure reason<textarea rows={2} value={failureReason} onChange={event=>setFailureReason(event.target.value)} placeholder="Describe an issue that prevented completion"/></label><Button variant="outline" onClick={()=>fail(selected)}>Record failed visit</Button></section>}
        {selected.status==='Failed'&&<section className="p7-work-section"><h3>Schedule a revisit</h3><div className="p7-action-row"><label className="crm-field">Revisit date<input type="date" value={newDate} onChange={event=>setNewDate(event.target.value)}/></label><Button variant="outline" onClick={()=>reschedule(selected)}>Schedule revisit</Button></div></section>}
        {['Pending','Scheduled','Assigned','Rescheduled'].includes(selected.status)&&<section className="p7-work-section"><h3>Cancel appointment</h3><label className="crm-field">Reason<span>*</span><textarea rows={2} value={cancelReason} onChange={event=>setCancelReason(event.target.value)}/></label><Button variant="destructive" onClick={()=>setConfirmCancel(true)}>Cancel booking</Button></section>}
        <section className="p7-work-section"><h3>Linked after-sales service</h3><Button variant="outline" onClick={()=>setTicketOpen(true)}><Plus size={14}/>Create service ticket</Button><ServiceTicketDialog open={ticketOpen} onOpenChange={setTicketOpen} source={{customerId:selected.customerId,saleId:selected.saleId,productId:selected.productId,serial:selected.serials?.[0],installationId:selected.id}}/></section>
        <section className="p7-work-section"><h3>Installation history</h3><ActivityTimeline items={selectedHistory}/></section>
      </div>}
    </DetailDrawer>
    <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}><DialogContent><DialogTitle>Cancel this installation booking?</DialogTitle><DialogDescription>The appointment will remain in the record with the reason and actor.</DialogDescription>{selected&&<DialogFooter><Button variant="outline" onClick={()=>setConfirmCancel(false)}>Keep booking</Button><Button variant="destructive" onClick={()=>cancel(selected)}>Confirm cancellation</Button></DialogFooter>}</DialogContent></Dialog>
  </div>
}
