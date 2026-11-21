'use client'
import {useMemo,useRef,useState,type FormEvent} from 'react'
import {Check,MapPin,RotateCcw} from 'lucide-react'
import {toast} from 'sonner'
import {Button} from '../ui/button'
import {PageHeader,DataTable,EmptyState,SearchBar,Selector,StatusBadge,Confirmation} from '../foundation'
import {Panel} from '../analytics-controls'
import {useDemo} from '../demo-provider'
import {appendDeliveryActivity,deliveryExceptionReasons,deliveryStoreLabel,deliveryStatuses,localDateTime,recordDemoProof} from '@/lib/fulfilment'
import {DeliveryDetailDrawer} from './shared'
import type {Delivery,DeliveryExceptionReason,DeliveryStatus} from '@/lib/phase6-types'

const actor='Aarav Sharma'
const terminal=new Set<DeliveryStatus>(['Delivered','Cancelled'])
const nextStatuses=(status:DeliveryStatus):DeliveryStatus[]=>{
  if(status==='Dispatched')return ['In Transit','Out for Delivery','Failed']
  if(status==='In Transit')return ['Out for Delivery','Failed']
  if(status==='Out for Delivery')return ['In Transit','Failed']
  return []
}
const nowLocal=()=>{const date=new Date(),offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,16)}

export function DeliveryTracking(){
  const {data,transact}=useDemo()
  const [query,setQuery]=useState(''),[status,setStatus]=useState('All statuses'),[store,setStore]=useState('All stores'),[selected,setSelected]=useState<Delivery|null>(null),[detail,setDetail]=useState<Delivery|null>(null),[nextStatus,setNextStatus]=useState<DeliveryStatus>('In Transit'),[notes,setNotes]=useState(''),[reason,setReason]=useState<DeliveryExceptionReason>('Customer unavailable'),[error,setError]=useState(''),[confirm,setConfirm]=useState(false)
  const filtered=useMemo(()=>data.deliveries.filter(order=>{
    const sale=data.sales.find(item=>item.id===order.saleId),customer=data.customers.find(item=>item.id===order.customerId)
    return (status==='All statuses'||order.status===status)&&(store==='All stores'||order.storeId===store)&&
      (!query||`${order.orderNumber} ${sale?.invoiceNumber||''} ${customer?.name||''} ${customer?.mobile||''}`.toLowerCase().includes(query.toLowerCase()))
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[data,query,status,store])
  const allowed=selected?nextStatuses(selected.status):[]
  function recordUpdate(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!selected||!allowed.includes(nextStatus)){setError('Select a valid next status for this delivery.');return}
    if(notes.trim().length<5){setError('Add a short tracking note (at least 5 characters).');return}
    setConfirm(true)
  }
  function confirmUpdate(){
    if(!selected)return
    try{
      transact(current=>{
        const order=current.deliveries.find(item=>item.id===selected.id)
        if(!order||!nextStatuses(order.status).includes(nextStatus))throw new Error('The delivery status changed before confirmation.')
        const now=new Date().toISOString(),updated={...order,status:nextStatus,updatedAt:now}
        const activity=appendDeliveryActivity(updated,nextStatus==='Failed'?'Exception recorded':'Status updated',nextStatus,actor,notes.trim())
        const exceptions=nextStatus==='Failed'?[...current.deliveryExceptions,{id:crypto.randomUUID(),deliveryId:order.id,reason,notes:notes.trim(),date:now,actor,followUpDate:'',status:'Open' as const}]:current.deliveryExceptions
        return {...current,deliveries:current.deliveries.map(item=>item.id===order.id?updated:item),
          deliveryActivities:[...current.deliveryActivities,activity],deliveryExceptions:exceptions}
      })
      toast.success(`Delivery status updated to ${nextStatus}.`)
      setConfirm(false);setNotes('');setError('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Tracking update could not be saved.');setConfirm(false)}
  }
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Tracking" title="Delivery tracking" description="Record demo status updates and exception notes. This register has no live GPS, driver app or external communications."/>
    <div className="p6-ops-grid">
      <Panel title="Delivery register" meta="Each update is timestamped and appended to the delivery timeline">
        <div className="crm-toolbar p6-toolbar"><SearchBar label="Search delivery, invoice, customer or mobile" value={query} onChange={setQuery}/>
          <Selector label="Filter by delivery status" value={status} options={['All statuses',...deliveryStatuses]} onChange={setStatus}/>
          <Selector label="Filter by store" value={store==='All stores'?'All stores':deliveryStoreLabel(store,data)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/>
        </div>
        {filtered.length?<DataTable columns={['Order / invoice','Customer','Store','Schedule','Team / vehicle','Status','Last update','Open']} rows={filtered.map(order=>{
          const sale=data.sales.find(item=>item.id===order.saleId),customer=data.customers.find(item=>item.id===order.customerId),team=data.deliveryTeams.find(item=>item.id===order.deliveryTeamId),vehicle=data.deliveryVehicles.find(item=>item.id===order.vehicleId)
          return [<button className="crm-customer-link" key={order.id} onClick={()=>setDetail(order)}><b>{order.orderNumber}</b><small>{sale?.invoiceNumber}</small></button>,
            <span key={order.id+'customer'}>{customer?.name}<small className="p4-sub">{customer?.mobile}</small></span>,deliveryStoreLabel(order.storeId,data),
            order.scheduledDate?`${order.scheduledDate} · ${order.timeSlot}`:'Not scheduled',`${team?.name||'Unassigned'} · ${vehicle?.registration||'No vehicle'}`,
            <StatusBadge key={order.id+'status'}>{order.status}</StatusBadge>,localDateTime(order.updatedAt),
            <Button key={order.id+'select'} variant="outline" size="sm" onClick={()=>{setSelected(order);setNextStatus(nextStatuses(order.status)[0]||'In Transit');setError('')}} disabled={terminal.has(order.status)||!nextStatuses(order.status).length}>Update</Button>]
        })}/>:<EmptyState text="No delivery records match these filters."/>}
      </Panel>
      <Panel title="Record a status update" meta="Updates are activities only; no external communication is sent">
        {selected?<form className="crm-form" onSubmit={recordUpdate} noValidate>
          <div className="p6-selected"><b>{selected.orderNumber}</b><StatusBadge>{selected.status}</StatusBadge><small>{data.customers.find(item=>item.id===selected.customerId)?.name}</small></div>
          <label className="crm-field">Next status<span>*</span><select value={nextStatus} onChange={event=>setNextStatus(event.target.value as DeliveryStatus)}>{allowed.map(item=><option key={item}>{item}</option>)}</select></label>
          {nextStatus==='Failed'&&<label className="crm-field">Exception reason<span>*</span><select value={reason} onChange={event=>setReason(event.target.value as DeliveryExceptionReason)}>{deliveryExceptionReasons.map(item=><option key={item}>{item}</option>)}</select></label>}
          <label className="crm-field">Tracking note<span>*</span><textarea rows={4} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Record the delivery status or exception in the demo register."/></label>
          {error&&<p role="alert" className="crm-error">{error}</p>}
          <Button type="submit"><MapPin size={15}/>Review status update</Button>
        </form>:<EmptyState text="Choose an in-transit or dispatched order to record a tracking update."/>}
      </Panel>
    </div>
    <Panel title="Chronological tracking timeline" meta="Most recent activity first">
      {filtered.length?<div className="p6-timeline-grid">{filtered.slice(0,6).map(order=><article key={order.id}><header><button className="crm-customer-link" onClick={()=>setDetail(order)}><b>{order.orderNumber}</b></button><StatusBadge>{order.status}</StatusBadge></header>
        {data.deliveryActivities.filter(item=>item.deliveryId===order.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(activity=><div className="p6-activity-line" key={activity.id}><span/><div><b>{activity.type}</b><p>{activity.notes}</p><small>{localDateTime(activity.date)} · {activity.actor}</small></div></div>)}
      </article>)}</div>:<EmptyState text="No timeline records."/>}
    </Panel>
    <DeliveryDetailDrawer order={detail} open={!!detail} onClose={()=>setDetail(null)}/>
    <Confirmation open={confirm} title="Save tracking update?" text={`Append “${nextStatus}” to ${selected?.orderNumber||'this delivery'} and record it in the activity history?`} onClose={()=>setConfirm(false)} onConfirm={confirmUpdate}/>
  </div>
}

export function DeliveryExceptions(){
  const {data,transact}=useDemo()
  const [exceptionId,setExceptionId]=useState(''),[date,setDate]=useState(''),[followUpDate,setFollowUpDate]=useState(''),[team,setTeam]=useState(''),[vehicle,setVehicle]=useState(''),[contactMethod,setContactMethod]=useState<'Call'|'Visit'>('Call'),[contactNotes,setContactNotes]=useState(''),[error,setError]=useState('')
  const exceptions=[...data.deliveryExceptions].sort((a,b)=>b.date.localeCompare(a.date))
  const selected=data.deliveryExceptions.find(item=>item.id===exceptionId)
  const order=selected?data.deliveries.find(item=>item.id===selected.deliveryId):undefined
  function resolve(){
    if(!selected)return
    try{
      transact(current=>({...current,deliveryExceptions:current.deliveryExceptions.map(item=>item.id===selected.id?{...item,status:'Resolved'}:item)}))
      toast.success('Delivery exception marked resolved.');setExceptionId('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Exception could not be resolved.')}
  }
  function escalate(){
    if(!selected)return
    try{
      const now=new Date().toISOString()
      transact(current=>({...current,deliveryExceptions:current.deliveryExceptions.map(item=>item.id===selected.id?{...item,status:'Escalated'}:item),
        deliveryActivities:[...current.deliveryActivities,{id:crypto.randomUUID(),deliveryId:selected.deliveryId,type:'Exception recorded',date:now,actor,status:order?.status||'Failed',notes:`Exception escalated: ${selected.reason}. ${selected.notes}`,exceptionId:selected.id}]}))
      toast.success('Exception escalated in the demo activity log.')
    }catch(cause){setError(cause instanceof Error?cause.message:'Exception could not be escalated.')}
  }
  function recordFollowUp(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!selected||!order||contactNotes.trim().length<5){setError('Select an exception and add follow-up notes with at least 5 characters.');return}
    try{
      const now=new Date().toISOString()
      transact(current=>({...current,deliveryExceptions:current.deliveryExceptions.map(item=>item.id===selected.id
        ?{...item,followUpDate:followUpDate||item.followUpDate}:item),
        deliveryActivities:[...current.deliveryActivities,{id:crypto.randomUUID(),deliveryId:order.id,type:'Contact recorded',date:now,actor,
          status:order.status,contactMethod,notes:`${contactMethod} follow-up recorded in demo only. ${contactNotes.trim()}${followUpDate?` Next follow-up: ${followUpDate}.`:''}`,exceptionId:selected.id}]}))
      toast.success(`${contactMethod} follow-up note recorded; no external communication was sent.`)
      setContactNotes('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Follow-up note could not be saved.')}
  }
  function reschedule(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!selected||!order||!date||!team||!vehicle){setError('Choose an open exception, date, available team and vehicle.');return}
    try{
      transact(current=>{
        const currentOrder=current.deliveries.find(item=>item.id===order.id)
        const currentException=current.deliveryExceptions.find(item=>item.id===selected.id&&item.status!=='Resolved')
        if(!currentOrder||!currentException)throw new Error('This exception or order is no longer available.')
        if(!['Failed','Pending','Scheduled','Rescheduled'].includes(currentOrder.status))throw new Error('Only an undelivered exception can be rescheduled.')
        if(!current.deliveryTeams.some(item=>item.id===team&&item.status==='Available')||!current.deliveryVehicles.some(item=>item.id===vehicle&&item.status==='Available'))throw new Error('Select available delivery resources.')
        const conflict=current.deliveries.find(item=>item.id!==order.id&&item.scheduledDate===date&&item.timeSlot===order.timeSlot&&activeScheduleStatuses.includes(item.status)&&(item.deliveryTeamId===team||item.vehicleId===vehicle))
        if(conflict)throw new Error(`The selected team or vehicle overlaps ${conflict.orderNumber}.`)
        const now=new Date().toISOString(),updated={...currentOrder,status:'Rescheduled' as const,scheduledDate:date,deliveryTeamId:team,vehicleId:vehicle,updatedAt:now}
        const note=`Rescheduled for ${date} · ${order.timeSlot||'time to confirm'} after ${selected.reason}.`
        return {...current,deliveries:current.deliveries.map(item=>item.id===order.id?updated:item),
          deliveryExceptions:current.deliveryExceptions.map(item=>item.id===selected.id?{...item,followUpDate:followUpDate||date,status:'Resolved'}:item),
          deliveryActivities:[...current.deliveryActivities,appendDeliveryActivity(updated,'Rescheduled','Rescheduled',actor,note)]}
      })
      toast.success('Delivery rescheduled; original schedule remains in the activity history.')
      setExceptionId('');setDate('');setFollowUpDate('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Delivery could not be rescheduled.')}
  }
  const activeScheduleStatuses=['Scheduled','Rescheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery']
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Exceptions" title="Delivery exceptions" description="Keep failed delivery reasons, follow-up dates, team changes and escalations in the shared fulfilment history."/>
    <Panel title="Exception register" meta="Open, resolved and escalated delivery exceptions">
      {exceptions.length?<DataTable columns={['Order','Reason','Notes','Recorded','Follow-up','Status','Actions']} rows={exceptions.map(item=>{
        const delivery=data.deliveries.find(order=>order.id===item.deliveryId),customer=delivery&&data.customers.find(record=>record.id===delivery.customerId)
        return [<button className="crm-customer-link" key={item.id} onClick={()=>setExceptionId(item.id)}><b>{delivery?.orderNumber||item.deliveryId}</b><small>{customer?.name||'Customer'}</small></button>,item.reason,item.notes,localDateTime(item.date),item.followUpDate||'Not scheduled',
          <StatusBadge key={item.id+'status'}>{item.status}</StatusBadge>,<div className="p6-inline-actions" key={item.id+'actions'}><Button variant="outline" size="sm" onClick={()=>{setExceptionId(item.id);setError('')}}>Manage</Button></div>]
      })}/>:<EmptyState text="No delivery exceptions have been recorded."/>}
    </Panel>
    {selected&&order&&<Panel title={`Manage ${order.orderNumber}`} meta={`${data.customers.find(item=>item.id===order.customerId)?.name||order.customerId} · ${selected.reason}`}>
      <div className="p6-exception-workflow">
        <div className="p6-exception-notes"><b>{selected.reason}</b><p>{selected.notes}</p><small>Recorded {localDateTime(selected.date)} · {selected.actor}</small><div className="p6-inline-actions"><Button variant="outline" onClick={resolve} disabled={selected.status==='Resolved'}><Check size={14}/>Mark resolved</Button><Button variant="outline" onClick={escalate} disabled={selected.status==='Escalated'}>Escalate</Button></div>
          <form className="p6-contact-entry" onSubmit={recordFollowUp} noValidate><h3>Record a follow-up</h3>
            <label className="crm-field">Activity type<select value={contactMethod} onChange={event=>setContactMethod(event.target.value as 'Call'|'Visit')}><option>Call</option><option>Visit</option></select></label>
            <label className="crm-field">Follow-up notes<span>*</span><textarea rows={3} value={contactNotes} onChange={event=>setContactNotes(event.target.value)} placeholder="Record the outcome; no call or visit is initiated."/></label>
            <label className="crm-field">Next follow-up date<input type="date" value={followUpDate} onChange={event=>setFollowUpDate(event.target.value)}/></label>
            <Button type="submit" variant="outline">Save follow-up note</Button>
          </form>
        </div>
        <form className="crm-form" onSubmit={reschedule} noValidate><h3>Reschedule or reassign</h3><div className="crm-form-grid">
          <label className="crm-field">New delivery date<span>*</span><input type="date" required value={date} onChange={event=>setDate(event.target.value)}/></label>
          <label className="crm-field">Delivery team<span>*</span><select value={team} onChange={event=>setTeam(event.target.value)}><option value="">Select team</option>{data.deliveryTeams.filter(item=>item.status==='Available').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="crm-field">Vehicle<span>*</span><select value={vehicle} onChange={event=>setVehicle(event.target.value)}><option value="">Select vehicle</option>{data.deliveryVehicles.filter(item=>item.status==='Available').map(item=><option key={item.id} value={item.id}>{item.registration}</option>)}</select></label>
          <label className="crm-field">Follow-up date<input type="date" value={followUpDate} onChange={event=>setFollowUpDate(event.target.value)}/></label>
        </div>{error&&<p role="alert" className="crm-error">{error}</p>}<Button type="submit"><RotateCcw size={15}/>Save reschedule</Button></form>
      </div>
    </Panel>}
    <p className="p6-caption">Recording an exception, assignment or follow-up does not place calls, send SMS or message customers.</p>
  </div>
}

export function ProofOfDelivery(){
  const {data,transact}=useDemo()
  const submitLock=useRef(false)
  const [deliveryId,setDeliveryId]=useState(''),[recipient,setRecipient]=useState(''),[mobile,setMobile]=useState(''),[date,setDate]=useState(nowLocal()),[notes,setNotes]=useState(''),[condition,setCondition]=useState(false),[quantities,setQuantities]=useState<Record<string,string>>({}),[serials,setSerials]=useState<Record<string,string[]>>({}),[error,setError]=useState('')
  const eligible=data.deliveries.filter(order=>['Dispatched','In Transit','Out for Delivery'].includes(order.status)&&order.items.some(item=>item.dispatchedQuantity>item.deliveredQuantity))
  const order=eligible.find(item=>item.id===deliveryId)
  const chosen=order?.items.map(item=>({item,product:data.products.find(product=>product.id===item.productId),available:Math.max(0,item.dispatchedQuantity-item.deliveredQuantity)}))||[]
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!order){setError('Select a dispatched order with remaining quantities.');return}
    if(!recipient.trim()||!/^\d{10}$/.test(mobile.trim())){setError('Enter the recipient name and a valid 10-digit mobile number.');return}
    if(!date||Number.isNaN(new Date(date).getTime())||!condition){setError('Confirm delivery time and product condition before saving proof.');return}
    if(!notes.trim()){setError('Add a delivery note.');return}
    const enteredLines=chosen.map(({item,product,available})=>({item,product,available,quantity:Number(quantities[item.id]||0),serials:serials[item.id]||[]}))
    const invalidQuantity=enteredLines.find(line=>!Number.isInteger(line.quantity)||line.quantity<0||line.quantity>line.available)
    if(invalidQuantity){setError(`${invalidQuantity.item.name}: delivered quantity must be a whole number within the dispatched balance.`);return}
    const proofLines=enteredLines.filter(line=>line.quantity>0)
    if(!proofLines.length){setError('Enter at least one delivered quantity to record partial or complete delivery.');return}
    if(enteredLines.some(line=>line.quantity===0&&line.serials.length>0)){setError('Remove serial selections for products with a zero delivered quantity.');return}
    if(proofLines.some(line=>!line.product)){setError('A product record is missing from this delivery order.');return}
    if(submitLock.current)return
    submitLock.current=true
    try{
      transact(current=>({...current,...recordDemoProof(current,order.id,{date,actor,recipientName:recipient,recipientMobile:mobile,notes,conditionConfirmed:condition,
        lines:proofLines.map(line=>({deliveryItemId:line.item.id,quantity:line.quantity,serials:line.serials}))})}))
      toast.success('Proof of delivery recorded in the demo history.')
      setDeliveryId('');setRecipient('');setMobile('');setNotes('');setCondition(false);setQuantities({});setSerials({});setDate(nowLocal())
    }catch(cause){setError(cause instanceof Error?cause.message:'Proof of delivery could not be saved. No records were changed.')}
    finally{submitLock.current=false}
  }
  function toggleSerial(itemId:string,serial:string,checked:boolean){setSerials(current=>({...current,[itemId]:checked?[...(current[itemId]||[]),serial]:(current[itemId]||[]).filter(value=>value!==serial)}))}
  return <div className="p6-pod">
    <Panel title="Proof of delivery" meta="Record a demo recipient confirmation; no signature or photograph is collected">
      <form className="crm-form" onSubmit={submit} noValidate>
        <label className="crm-field">Dispatched delivery order<span>*</span><select required value={deliveryId} onChange={event=>{setDeliveryId(event.target.value);setQuantities({});setSerials({});setError('')}}><option value="">Select an order</option>{eligible.map(item=><option key={item.id} value={item.id}>{item.orderNumber} · {data.customers.find(customer=>customer.id===item.customerId)?.name}</option>)}</select></label>
        {order&&<div className="p6-pod-lines">{chosen.map(({item,product,available})=><section key={item.id}><header><b>{item.name}</b><small>{available} dispatched unit(s) remaining</small></header>
          <label className="crm-field">Delivered quantity<input type="number" min="0" max={available} value={quantities[item.id]||''} onChange={event=>setQuantities(current=>({...current,[item.id]:event.target.value}))}/></label>
          {product?.serialRequired&&<div className="p6-serial-checks"><b>Delivered serial numbers</b>{item.dispatchedSerials.filter(serial=>!item.deliveredSerials.includes(serial)).map(serial=><label key={serial}><input type="checkbox" checked={(serials[item.id]||[]).includes(serial)} onChange={event=>toggleSerial(item.id,serial,event.target.checked)}/>{serial}</label>)}</div>}
        </section>)}</div>}
        <div className="crm-form-grid">
          <label className="crm-field">Recipient name<span>*</span><input required value={recipient} onChange={event=>setRecipient(event.target.value)}/></label>
          <label className="crm-field">Recipient mobile<span>*</span><input required inputMode="numeric" maxLength={10} value={mobile} onChange={event=>setMobile(event.target.value.replace(/\D/g,''))}/></label>
          <label className="crm-field">Delivery date and time<span>*</span><input required type="datetime-local" value={date} onChange={event=>setDate(event.target.value)}/></label>
          <label className="crm-field crm-field-wide">Delivery notes<span>*</span><textarea rows={3} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Demo confirmation notes"/></label>
          <label className="p6-check"><input type="checkbox" checked={condition} onChange={event=>setCondition(event.target.checked)}/> Recipient confirmed delivered product condition.</label>
        </div>
        {error&&<p role="alert" className="crm-error">{error}</p>}
        <Button type="submit" disabled={!order}><Check size={15}/>Record delivery confirmation</Button>
      </form>
    </Panel>
    <p className="p6-caption">Partial deliveries leave the remaining dispatched units open. Fully delivered appliance or TV orders create an installation handoff in the existing after-sales state.</p>
  </div>
}
