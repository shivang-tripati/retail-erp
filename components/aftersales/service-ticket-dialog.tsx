'use client'
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react'
import {toast} from 'sonner'
import {useDemo} from '@/components/demo-provider'
import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '@/components/ui/dialog'
import {Selector} from '@/components/foundation'
import {getWarrantyCoverage,validateServiceSource} from '@/lib/aftersales'
import type {ServiceCategory,ServicePriority,ServiceTicket} from '@/lib/phase7-types'

export type TicketSource={customerId?:string;saleId?:string;productId?:string;serial?:string;warrantyId?:string;installationId?:string}
const categories:ServiceCategory[]=['Installation issue','Product malfunction','Physical damage','Electrical issue','Cooling/heating issue','Display issue','Other']

export function ServiceTicketDialog({open,onOpenChange,source={}}:{open:boolean;onOpenChange:(open:boolean)=>void;source?:TicketSource}){
  const {data,transact}=useDemo(),lock=useRef(false)
  const [customerId,setCustomerId]=useState(source.customerId||'')
  const [saleId,setSaleId]=useState(source.saleId||'')
  const [productId,setProductId]=useState(source.productId||'')
  const [serial,setSerial]=useState(source.serial||'')
  const [category,setCategory]=useState<ServiceCategory>('Product malfunction')
  const [priority,setPriority]=useState<ServicePriority>('Normal')
  const [serviceType,setServiceType]=useState<'On-site'|'Workshop'>('On-site')
  const [visitDate,setVisitDate]=useState('')
  const [issue,setIssue]=useState('')
  const [error,setError]=useState('')
  const availableSales=data.sales.filter(sale=>sale.status==='Completed'&&(!customerId||sale.customerId===customerId))
  const selectedSale=availableSales.find(sale=>sale.id===saleId)
  const selectedLine=selectedSale?.lines.find(line=>line.productId===productId)
  const selectedProduct=data.products.find(item=>item.id===productId)
  const serialOptions=useMemo(()=>selectedLine?.serials.filter(value=>{
    const record=data.serials.find(item=>item.serial===value)
    return !!record&&record.status==='Sold'&&record.invoiceId===selectedSale?.invoiceNumber
  })||[],[selectedLine,data.serials,selectedSale])

  useEffect(()=>{
    if(!open)return
    const chosenCustomer=source.customerId||customerId||data.customers[0]?.id||''
    const sale=data.sales.find(item=>item.id===source.saleId&&item.status==='Completed')||
      data.sales.find(item=>item.customerId===chosenCustomer&&item.status==='Completed')
    const product=sale?.lines.find(item=>item.productId===source.productId)||sale?.lines[0]
    setCustomerId(chosenCustomer)
    setSaleId(sale?.id||'')
    setProductId(product?.productId||'')
    setSerial(source.serial||product?.serials[0]||'')
    setCategory(source.installationId?'Installation issue':'Product malfunction')
    setPriority('Normal')
    setServiceType('On-site')
    setVisitDate('')
    setIssue('')
    setError('')
  },[open,source.customerId,source.saleId,source.productId,source.serial,source.installationId,data.customers,data.sales])

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    setError('')
    const cleanIssue=issue.trim()
    if(cleanIssue.length<10){setError('Describe the reported issue in at least 10 characters.');return}
    try{
      validateServiceSource(data,customerId,saleId,productId,serial)
      if(source.warrantyId&&!data.warranties.some(item=>item.id===source.warrantyId&&item.customerId===customerId&&item.serial===serial))
        throw new Error('The selected warranty record does not match this customer and serial number.')
    }catch(cause){setError(cause instanceof Error?cause.message:'The selected sale, product or serial could not be verified.');return}
    if(!selectedSale||!selectedLine){setError('Choose a completed invoice and product from the customer history.');return}
    const product=data.products.find(item=>item.id===productId)
    if(!product){setError('The selected product record is unavailable.');return}
    if(lock.current)return
    lock.current=true
    try{
      const now=new Date().toISOString()
      const ticketId=crypto.randomUUID()
      const ticketNumber=`SR-${new Date().getFullYear()}-${String(5101+data.serviceTickets.length).padStart(4,'0')}`
      const ticket:ServiceTicket={
        id:ticketId,ticketNumber,customerId,productId,serial,saleId:selectedSale.id,invoiceNumber:selectedSale.invoiceNumber,
        warrantyId:source.warrantyId||'',installationId:source.installationId||'',category,issue:cleanIssue,priority,serviceType,
        preferredVisitDate:visitDate,storeId:selectedSale.storeId,contactMobile:data.customers.find(item=>item.id===customerId)?.mobile||'',
        assignedTechnicianId:'',status:'Open',warrantyCoverage:getWarrantyCoverage(data,serial),
        serviceChargePaise:0,diagnosis:'',workPerformed:'',partsUsed:'',resolution:'',customerFeedback:'',
        createdAt:now,updatedAt:now,resolutionAt:'',followUpDate:'',escalationReason:'',escalationNotes:''
      }
      transact(current=>({...current,serviceTickets:[...current.serviceTickets,ticket],serviceActivities:[...current.serviceActivities,{
        id:crypto.randomUUID(),ticketId,action:'Ticket created',date:now,actor:'Aarav Sharma',
        notes:`${ticketNumber} created from ${selectedSale.invoiceNumber}. Coverage is a demo classification only.`
      }]}))
      toast.success(`Service ticket ${ticketNumber} created`)
      onOpenChange(false)
    }catch(cause){setError(cause instanceof Error?cause.message:'The service request could not be saved. No records were changed.')}
    finally{lock.current=false}
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="p7-dialog">
    <DialogTitle>Create a service ticket</DialogTitle>
    <DialogDescription>Link the request to a completed demo sale. No call, message or external service request is created.</DialogDescription>
    <form className="crm-form" onSubmit={submit} noValidate>
      <div className="crm-form-grid">
        <label className="crm-field">Customer<span>*</span><select required value={customerId} disabled={!!source.customerId} onChange={event=>{setCustomerId(event.target.value);setSaleId('');setProductId('');setSerial('')}}><option value="">Select customer</option>{data.customers.map(item=><option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>
        <label className="crm-field">Completed invoice<span>*</span><select required value={saleId} onChange={event=>{setSaleId(event.target.value);setProductId('');setSerial('')}}><option value="">Select invoice</option>{availableSales.map(item=><option key={item.id} value={item.id}>{item.invoiceNumber}</option>)}</select></label>
        <label className="crm-field">Purchased product<span>*</span><select required value={productId} onChange={event=>{setProductId(event.target.value);setSerial('')}}><option value="">Select product</option>{selectedSale?.lines.map(item=><option key={item.productId} value={item.productId}>{item.name}</option>)}</select></label>
        {(!!selectedLine?.serials?.length||!!selectedProduct?.serialRequired)&&<label className="crm-field">Sold serial number{selectedProduct?.serialRequired&&<span>*</span>}<select value={serial} required={!!selectedProduct?.serialRequired} onChange={event=>setSerial(event.target.value)}><option value="">Select serial</option>{serialOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
        {!!selectedProduct?.serialRequired&&!serialOptions.length&&<p className="p7-muted crm-field-wide">No sold serial is linked to this invoice line. Correct the sale record before creating a serial-specific service request.</p>}
        <label className="crm-field">Issue category<span>*</span><select value={category} onChange={event=>setCategory(event.target.value as ServiceCategory)}>{categories.map(value=><option key={value}>{value}</option>)}</select></label>
        <label className="crm-field">Priority<span>*</span><select value={priority} onChange={event=>setPriority(event.target.value as ServicePriority)}>{['Low','Normal','High','Urgent'].map(value=><option key={value}>{value}</option>)}</select></label>
        <label className="crm-field">Service type<span>*</span><select value={serviceType} onChange={event=>setServiceType(event.target.value as 'On-site'|'Workshop')}><option>On-site</option><option>Workshop</option></select></label>
        <label className="crm-field">Preferred visit date<input type="date" value={visitDate} onChange={event=>setVisitDate(event.target.value)}/></label>
        <label className="crm-field crm-field-wide">Issue description<span>*</span><textarea rows={4} minLength={10} required value={issue} onChange={event=>setIssue(event.target.value)} placeholder="Describe the reported issue and any relevant symptoms."/></label>
      </div>
      {error&&<p role="alert" className="crm-error">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button><Button type="submit">Create ticket</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}
