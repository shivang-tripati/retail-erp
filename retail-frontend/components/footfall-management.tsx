'use client'
import {useMemo,useState,type FormEvent} from 'react'
import Link from 'next/link'
import {Plus,UserRoundPlus} from 'lucide-react'
import {toast} from 'sonner'
import {useDemo} from './demo-provider'
import {useWorkspace} from './workspace'
import {PageHeader,DataTable,EmptyState,SearchBar,Selector} from './foundation'
import {Panel} from './analytics-controls'
import {Button} from './ui/button'
import {Input} from './ui/input'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from './ui/dialog'
import CustomerForm from './customer-form'
import {categories} from '@/lib/demo-data'
import {dateTimeInIndia,findStoreState,type Customer,type Enquiry,type WalkIn} from '@/lib/phase3-data'

type Props={mode:'footfall'|'enquiries'}
const walkStatuses=['New','Follow-up','Converted']
const enquiryStatuses=['Open','Contacted','Qualified','Won','Lost']
const inputDate=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)
export default function FootfallManagement({mode}:Props){
  const {data,update,transact}=useDemo(),{store}=useWorkspace()
  const [query,setQuery]=useState(''),[storeFilter,setStoreFilter]=useState('All stores'),[statusFilter,setStatusFilter]=useState('All statuses')
  const [walkForm,setWalkForm]=useState(false),[enquiryForm,setEnquiryForm]=useState(false),[convert,setConvert]=useState<WalkIn|null>(null)
  const [editWalk,setEditWalk]=useState<WalkIn|null>(null),[editEnquiry,setEditEnquiry]=useState<Enquiry|null>(null)
  const [error,setError]=useState('')
  const stores=data.stores.filter(item=>item.status==='Active')
  const executives=useMemo(()=>data.users.filter(user=>user.status==='Active'&&user.role==='Sales Executive').map(user=>user.name),[data.users])
  const initialStore=stores.find(item=>item.name===store)?.id||stores[0]?.id||''
  const defaultExecutive=executives[0]||data.users.find(user=>user.status==='Active')?.name||'Aarav Sharma'
  const visits=data.walkIns.filter(item=>(storeFilter==='All stores'||item.storeId===storeFilter)&&(statusFilter==='All statuses'||item.status===statusFilter)&&`${item.id} ${item.name} ${item.mobile} ${item.interest}`.toLowerCase().includes(query.toLowerCase()))
  const enquiries=data.enquiries.filter(item=>(storeFilter==='All stores'||item.storeId===storeFilter)&&(statusFilter==='All statuses'||item.status===statusFilter)&&`${item.id} ${item.customerName} ${item.mobile} ${item.interest}`.toLowerCase().includes(query.toLowerCase()))
  function addWalk(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget)
    const mobile=String(form.get('mobile')||'')
    if(mobile&&!/^[6-9]\d{9}$/.test(mobile)){setError('Enter a valid 10-digit Indian mobile number or leave it blank.');return}
    const item:WalkIn={id:`WALK-${Date.now()}`,name:String(form.get('name')||'').trim()||'Walk-in visitor',mobile,storeId:String(form.get('storeId')),visitedAt:new Date(String(form.get('visitedAt'))).toISOString(),executive:String(form.get('executive')),interest:String(form.get('interest')),status:'New',followUp:String(form.get('followUp')||''),notes:String(form.get('notes')||'')}
    update('walkIns',[item,...data.walkIns]);toast.success('Walk-in recorded');setWalkForm(false);setError('')
  }
  function addEnquiry(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget),mobile=String(form.get('mobile')||'')
    if(!/^[6-9]\d{9}$/.test(mobile)){setError('Enter a valid 10-digit Indian mobile number.');return}
    const item:Enquiry={id:`ENQ-${Date.now()}`,customerName:String(form.get('customerName')||'').trim(),mobile,storeId:String(form.get('storeId')),createdAt:new Date().toISOString(),executive:String(form.get('executive')),interest:String(form.get('interest')),status:'Open',followUp:String(form.get('followUp')||''),notes:String(form.get('notes')||'')}
    update('enquiries',[item,...data.enquiries]);toast.success('Enquiry created');setEnquiryForm(false);setError('')
  }
  function saveVisit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editWalk)return;const form=new FormData(event.currentTarget)
    update('walkIns',data.walkIns.map(item=>item.id===editWalk.id?{...item,status:String(form.get('status')),executive:String(form.get('executive')),followUp:String(form.get('followUp')||''),notes:String(form.get('notes')||'')}:item))
    toast.success('Walk-in updated');setEditWalk(null)
  }
  function saveEnquiry(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editEnquiry)return;const form=new FormData(event.currentTarget)
    update('enquiries',data.enquiries.map(item=>item.id===editEnquiry.id?{...item,status:String(form.get('status')),executive:String(form.get('executive')),followUp:String(form.get('followUp')||''),notes:String(form.get('notes')||'')}:item))
    toast.success('Enquiry updated');setEditEnquiry(null)
  }
  function registerFromVisit(customer:Customer){
    if(!convert)return
    try{
      transact(current=>({...current,customers:[...current.customers,customer],walkIns:current.walkIns.map(item=>item.id===convert.id?{...item,status:'Converted',customerId:customer.id}:item)}))
      toast.success(`${customer.name} registered and walk-in converted`)
      setConvert(null)
    }catch(cause){setError(cause instanceof Error?cause.message:'Customer registration failed.')}
  }
  function linkEnquiryToVisit(visit:WalkIn){
    update('enquiries',[{id:`ENQ-${Date.now()}`,customerName:visit.name,mobile:visit.mobile,storeId:visit.storeId,createdAt:new Date().toISOString(),executive:visit.executive,interest:visit.interest,status:'Open',followUp:visit.followUp,notes:visit.notes,walkInId:visit.id},...data.enquiries])
    toast.success('Enquiry created from walk-in')
  }
  const storeName=(id:string)=>data.stores.find(item=>item.id===id)?.name||id
  const pageTitle=mode==='footfall'?'Customer footfall':'Customer enquiries'
  return <div className="phase">
    <PageHeader eyebrow="Customers / Engagement" title={pageTitle} description={mode==='footfall'?'Record store visits and follow up on product interest without creating completed sales.':'Assign and track enquiries separately from completed invoices.'}>
      <nav className="crm-route-tabs" aria-label="Customer engagement workspaces"><Link className={mode==='footfall'?'current':''} href="/customers/footfall">Footfall</Link><Link className={mode==='enquiries'?'current':''} href="/customers/enquiries">Enquiries</Link></nav>
    </PageHeader>
    <Panel title={mode==='footfall'?'Store visit log':'Enquiry pipeline'} meta={`${mode==='footfall'?visits.length:enquiries.length} records · Assigned executive follow-up`} action={<Button onClick={()=>{setError('');mode==='footfall'?setWalkForm(true):setEnquiryForm(true)}}><Plus/>{mode==='footfall'?'Record walk-in':'Create enquiry'}</Button>}>
      <div className="crm-toolbar"><SearchBar label={`Search ${mode==='footfall'?'walk-ins':'enquiries'}`} value={query} onChange={setQuery}/><Selector label="Filter visits by store" value={storeFilter==='All stores'?'All stores':storeName(storeFilter)} options={['All stores',...stores.map(item=>item.name)]} onChange={value=>setStoreFilter(stores.find(item=>item.name===value)?.id||'All stores')}/><Selector label="Filter by enquiry status" value={statusFilter} options={['All statuses',...(mode==='footfall'?walkStatuses:enquiryStatuses)]} onChange={setStatusFilter}/></div>
      {mode==='footfall'?visits.length?<DataTable columns={['Reference','Customer / visitor','Store','Visit date & time','Executive','Interested in','Status','Follow-up','Actions']} rows={visits.map(item=>[
        item.id,item.customerId?<span key={item.id+'customer'}>{item.name} · Registered</span>:item.name,
        storeName(item.storeId),dateTimeInIndia(item.visitedAt),item.executive,item.interest,
        <span key={item.id+'status'} className={`signal ${item.status}`}>{item.status}</span>,
        item.followUp?dateTimeInIndia(item.followUp):'Not scheduled',
        <div className="rowlinks" key={item.id+'actions'}>{!item.customerId&&<button onClick={()=>setConvert(item)}><UserRoundPlus size={13}/> Register</button>}<button onClick={()=>linkEnquiryToVisit(item)}>Create enquiry</button><button onClick={()=>setEditWalk(item)}>Update</button></div>
      ])}/>:<EmptyState text="No visits match these filters. Record a walk-in to start a follow-up."/>
      :enquiries.length?<DataTable columns={['Enquiry','Customer','Store','Created','Executive','Interested in','Status','Follow-up','Actions']} rows={enquiries.map(item=>[
        item.id,<div className="cellstack" key={item.id+'name'}><b>{item.customerName}</b><small>{item.mobile}</small></div>,
        storeName(item.storeId),dateTimeInIndia(item.createdAt),item.executive,item.interest,
        <span key={item.id+'status'} className={`signal ${item.status}`}>{item.status}</span>,
        item.followUp?dateTimeInIndia(item.followUp):'Not scheduled',<button className="textlink" key={item.id+'edit'} onClick={()=>setEditEnquiry(item)}>Update follow-up</button>
      ])}/>:<EmptyState text="No enquiries match these filters. Create one to assign an executive and follow-up."/>}
    </Panel>
    <Dialog open={walkForm} onOpenChange={open=>!open&&setWalkForm(false)}><DialogContent className="crm-dialog"><DialogTitle>Record a store visit</DialogTitle><DialogDescription>Walk-ins are engagement records, not completed sales.</DialogDescription><form className="crm-form" onSubmit={addWalk}><div className="crm-form-grid">
      <label className="crm-field">Customer name<input name="name" placeholder="Leave blank for walk-in visitor"/></label><label className="crm-field">Mobile<input name="mobile" inputMode="numeric" pattern="[6-9][0-9]{9}" placeholder="Optional"/></label>
      <label className="crm-field">Store<select aria-label="Store" name="storeId" defaultValue={initialStore} required>{stores.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="crm-field">Visit date & time<input name="visitedAt" type="datetime-local" defaultValue={inputDate()} required/></label>
      <label className="crm-field">Sales executive<select aria-label="Sales executive" name="executive" defaultValue={defaultExecutive}>{(executives.length?executives:[defaultExecutive]).map(name=><option key={name}>{name}</option>)}</select></label>
      <label className="crm-field">Interested product / category<select aria-label="Interested product / category" name="interest">{categories.map(category=><option key={category}>{category}</option>)}</select></label>
      <label className="crm-field">Follow-up date<input name="followUp" type="date"/></label><label className="crm-field crm-field-wide">Follow-up notes<textarea name="notes" rows={3}/></label>
    </div>{error&&<p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={()=>setWalkForm(false)}>Cancel</Button><Button type="submit">Save visit</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={enquiryForm} onOpenChange={open=>!open&&setEnquiryForm(false)}><DialogContent className="crm-dialog"><DialogTitle>Create an enquiry</DialogTitle><DialogDescription>Assign an executive and set a follow-up date.</DialogDescription><form className="crm-form" onSubmit={addEnquiry}><div className="crm-form-grid">
      <label className="crm-field">Customer name<Input name="customerName" aria-label="Customer name" required/></label><label className="crm-field">Mobile number<Input name="mobile" aria-label="Mobile number" type="tel" required pattern="[6-9][0-9]{9}"/></label>
      <label className="crm-field">Store<select aria-label="Store" name="storeId" defaultValue={initialStore}>{stores.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="crm-field">Sales executive<select aria-label="Sales executive" name="executive" defaultValue={defaultExecutive}>{(executives.length?executives:[defaultExecutive]).map(name=><option key={name}>{name}</option>)}</select></label>
      <label className="crm-field">Interested product / category<select aria-label="Interested product / category" name="interest">{categories.map(category=><option key={category}>{category}</option>)}</select></label><label className="crm-field">Follow-up date<input aria-label="Follow-up date" name="followUp" type="date" required/></label>
      <label className="crm-field crm-field-wide">Notes<textarea name="notes" rows={3}/></label>
    </div>{error&&<p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={()=>setEnquiryForm(false)}>Cancel</Button><Button type="submit">Create enquiry</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!convert} onOpenChange={open=>!open&&setConvert(null)}><DialogContent className="crm-dialog"><DialogTitle>Register this visitor</DialogTitle><DialogDescription>Visit details are kept as a separate record and linked to this new customer.</DialogDescription>{convert&&<CustomerForm initial={{name:convert.name==='Walk-in visitor'?'':convert.name,mobile:convert.mobile,city:data.stores.find(item=>item.id===convert.storeId)?.city||'',state:findStoreState(data.stores.find(item=>item.id===convert.storeId))}} onSave={registerFromVisit} onCancel={()=>setConvert(null)}/>}</DialogContent></Dialog>
    <Dialog open={!!editWalk} onOpenChange={open=>!open&&setEditWalk(null)}><DialogContent className="crm-dialog"><DialogTitle>Update walk-in follow-up</DialogTitle>{editWalk&&<form className="crm-form" onSubmit={saveVisit}><div className="crm-form-grid">
      <label className="crm-field">Status<select aria-label="Status" name="status" defaultValue={editWalk.status}>{walkStatuses.map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="crm-field">Sales executive<select aria-label="Sales executive" name="executive" defaultValue={editWalk.executive}>{(executives.includes(editWalk.executive)?executives:[editWalk.executive,...executives]).map(name=><option key={name}>{name}</option>)}</select></label>
      <label className="crm-field">Follow-up date<input aria-label="Follow-up date" name="followUp" type="date" defaultValue={editWalk.followUp.slice(0,10)}/></label>
      <label className="crm-field crm-field-wide">Follow-up notes<textarea aria-label="Follow-up notes" name="notes" rows={3} defaultValue={editWalk.notes}/></label>
    </div><DialogFooter><Button type="button" variant="outline" onClick={()=>setEditWalk(null)}>Cancel</Button><Button type="submit">Save follow-up</Button></DialogFooter></form>}</DialogContent></Dialog>
    <Dialog open={!!editEnquiry} onOpenChange={open=>!open&&setEditEnquiry(null)}><DialogContent className="crm-dialog"><DialogTitle>Update enquiry</DialogTitle>{editEnquiry&&<form className="crm-form" onSubmit={saveEnquiry}><div className="crm-form-grid">
      <label className="crm-field">Status<select aria-label="Status" name="status" defaultValue={editEnquiry.status}>{enquiryStatuses.map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="crm-field">Sales executive<select aria-label="Sales executive" name="executive" defaultValue={editEnquiry.executive}>{(executives.includes(editEnquiry.executive)?executives:[editEnquiry.executive,...executives]).map(name=><option key={name}>{name}</option>)}</select></label>
      <label className="crm-field">Follow-up date<input aria-label="Follow-up date" name="followUp" type="date" defaultValue={editEnquiry.followUp.slice(0,10)}/></label>
      <label className="crm-field crm-field-wide">Follow-up notes<textarea aria-label="Follow-up notes" name="notes" rows={3} defaultValue={editEnquiry.notes}/></label>
    </div><DialogFooter><Button type="button" variant="outline" onClick={()=>setEditEnquiry(null)}>Cancel</Button><Button type="submit">Save enquiry</Button></DialogFooter></form>}</DialogContent></Dialog>
  </div>
}
