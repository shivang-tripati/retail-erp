'use client'
import {useMemo,useState,type FormEvent} from 'react'
import {Plus} from 'lucide-react'
import {toast} from 'sonner'
import {Button} from '../ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '../ui/dialog'
import {PageHeader,DataTable,EmptyState,SearchBar,Selector,StatusBadge} from '../foundation'
import {Panel} from '../analytics-controls'
import {useDemo} from '../demo-provider'
import {useWorkspace} from '../workspace'
import {deliveryPriorities,deliveryStoreLabel,eligibleSaleLines,localDate,remainingEligibleLines} from '@/lib/fulfilment'
import {DeliveryDetailDrawer} from './shared'
import type {Delivery} from '@/lib/phase6-types'

function withinDeliveryRange(value:string,range:string){
  if(range==='All dates'||!value)return true
  const days=Number(range.match(/\d+/)?.[0]||0),date=new Date(`${value.slice(0,10)}T12:00:00+05:30`).getTime(),reference=new Date('2026-11-21T23:59:59+05:30').getTime()
  return date<=reference&&date>=reference-days*86400000
}

export function DeliveryOrders(){
  const {data,transact}=useDemo(),{store:workspaceStore}=useWorkspace()
  const [query,setQuery]=useState(''),[store,setStore]=useState('All stores'),[status,setStatus]=useState('All statuses'),[priority,setPriority]=useState('All priorities'),[range,setRange]=useState('All dates'),[sort,setSort]=useState('Newest first'),[page,setPage]=useState(0),[selected,setSelected]=useState<Delivery|null>(null),[create,setCreate]=useState(false),[saleId,setSaleId]=useState(''),[error,setError]=useState('')
  const salesWithBalance=data.sales.filter(sale=>remainingEligibleLines(sale,data.deliveries).length>0)
  const chosenSale=data.sales.find(sale=>sale.id===saleId)
  const rows=useMemo(()=>data.deliveries.filter(order=>{
    const sale=data.sales.find(item=>item.id===order.saleId),customer=data.customers.find(item=>item.id===order.customerId)
    const text=`${order.orderNumber} ${sale?.invoiceNumber||''} ${customer?.name||''} ${customer?.mobile||''} ${order.deliveryAddress}`.toLowerCase()
    return withinDeliveryRange(order.scheduledDate||order.createdAt,range)&&(!query||text.includes(query.trim().toLowerCase()))&&(store==='All stores'||order.storeId===store)&&
      (status==='All statuses'||order.status===status)&&(priority==='All priorities'||order.priority===priority)
  }).sort((a,b)=>sort==='Newest first'?b.createdAt.localeCompare(a.createdAt):sort==='Oldest first'?a.createdAt.localeCompare(b.createdAt):a.orderNumber.localeCompare(b.orderNumber)),[data,query,store,status,priority,range,sort])
  const pageSize=10,totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),visible=rows.slice(page*pageSize,(page+1)*pageSize)
  function openCreate(){
    const initialStore=data.stores.find(item=>item.name===workspaceStore)?.id||''
    const first=salesWithBalance.find(sale=>!initialStore||sale.storeId===initialStore)||salesWithBalance[0]
    setSaleId(first?.id||'');setError('');setCreate(true)
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!chosenSale){setError('Choose a completed invoice with remaining delivery-eligible products.');return}
    try{
      transact(current=>{
        const sale=current.sales.find(item=>item.id===saleId&&item.status==='Completed')
        if(!sale)throw new Error('The selected invoice is no longer available.')
        const remaining=remainingEligibleLines(sale,current.deliveries)
        if(!remaining.length)throw new Error('All eligible quantities already have delivery orders.')
        const customer=current.customers.find(item=>item.id===sale.customerId)
        if(!customer)throw new Error('The invoice customer record could not be found.')
        const matching=current.deliveries.filter(order=>order.saleId===sale.id)
        const serialIndex=matching.length+1,now=new Date().toISOString()
        const order:Delivery={
          id:`DEL-${sale.id}-${serialIndex}`,orderNumber:`DO-${sale.invoiceNumber}-${serialIndex}`,saleId:sale.id,customerId:sale.customerId,storeId:sale.storeId,
          items:remaining.map(({line,quantity,serials},index)=>({id:`${sale.id}-${line.productId}-${serialIndex}-${index}`,saleLineId:`${sale.id}-${line.productId}`,
            productId:line.productId,name:line.name,sku:line.sku,quantity,serials,dispatchedQuantity:0,dispatchedSerials:[],deliveredQuantity:0,deliveredSerials:[]})),
          status:'Pending',deliveryAddress:`${customer.address}, ${customer.city}, ${customer.state} ${customer.pinCode}`,scheduledDate:'',timeSlot:'',
          deliveryTeamId:'',vehicleId:'',priority:'Standard',instructions:'',createdAt:now,createdBy:'Aarav Sharma',dispatchedAt:'',dispatchedBy:'',manifestId:'',updatedAt:now
        }
        return {...current,deliveries:[...current.deliveries,order],deliveryActivities:[...current.deliveryActivities,{
          id:crypto.randomUUID(),deliveryId:order.id,type:'Order created',date:now,actor:'Aarav Sharma',status:'Pending',notes:`Created from completed invoice ${sale.invoiceNumber}.`
        }]}
      })
      toast.success('Delivery order created from the selected completed invoice.')
      setCreate(false)
    }catch(cause){setError(cause instanceof Error?cause.message:'Delivery order could not be created. No records were changed.')}
  }
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Orders" title="Delivery orders" description="Every order links back to a completed sale, customer, product quantities and sold serials. Stock is not deducted again here.">
      <Button onClick={openCreate}><Plus size={15}/>Create from invoice</Button>
    </PageHeader>
    <Panel title="Delivery register" meta={`${rows.length} orders · search by order, invoice, customer or mobile`}>
      <div className="crm-toolbar p6-toolbar">
        <SearchBar label="Search order, invoice, customer or mobile" value={query} onChange={value=>{setQuery(value);setPage(0)}}/>
        <Selector label="Filter by store" value={store==='All stores'?'All stores':deliveryStoreLabel(store,data)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>{setStore(data.stores.find(item=>item.name===value)?.id||'All stores');setPage(0)}}/>
        <Selector label="Filter by status" value={status} options={['All statuses','Pending','Scheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery','Delivered','Failed','Rescheduled','Cancelled']} onChange={value=>{setStatus(value);setPage(0)}}/>
        <Selector label="Filter by priority" value={priority} options={['All priorities',...deliveryPriorities]} onChange={value=>{setPriority(value);setPage(0)}}/>
        <Selector label="Filter by delivery date" value={range} options={['All dates','Last 7 days','Last 30 days','Last 90 days']} onChange={value=>{setRange(value);setPage(0)}}/>
        <Selector label="Sort delivery orders" value={sort} options={['Newest first','Oldest first','Order number']} onChange={value=>{setSort(value);setPage(0)}}/>
      </div>
      {visible.length?<DataTable columns={['Delivery order','Invoice / customer','Store','Products','Schedule','Team / vehicle','Status','Priority']} rows={visible.map(order=>{
        const sale=data.sales.find(item=>item.id===order.saleId),customer=data.customers.find(item=>item.id===order.customerId),team=data.deliveryTeams.find(item=>item.id===order.deliveryTeamId),vehicle=data.deliveryVehicles.find(item=>item.id===order.vehicleId)
        return [
          <button className="crm-customer-link" key={order.id} onClick={()=>setSelected(order)}><b>{order.orderNumber}</b><small>{order.status}</small></button>,
          <span key={order.id+'customer'}>{sale?.invoiceNumber||order.saleId}<small className="p4-sub">{customer?.name||order.customerId} · {customer?.mobile||'—'}</small></span>,
          deliveryStoreLabel(order.storeId,data),order.items.reduce((sum,item)=>sum+item.quantity,0),order.scheduledDate?`${localDate(order.scheduledDate)} · ${order.timeSlot||'time pending'}`:'Not scheduled',
          `${team?.name||'Unassigned'}${vehicle?` · ${vehicle.registration}`:''}`,<StatusBadge key={order.id+'status'}>{order.status}</StatusBadge>,<StatusBadge key={order.id+'priority'}>{order.priority}</StatusBadge>
        ]
      })}/>:<EmptyState text="No delivery orders match these filters."/>}
      <div className="p6-pagination"><span>Page {Math.min(page+1,totalPages)} of {totalPages}</span><div><Button variant="outline" size="sm" disabled={page===0} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><Button variant="outline" size="sm" disabled={page+1>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages-1,value+1))}>Next</Button></div></div>
    </Panel>
    <DeliveryDetailDrawer order={selected} open={!!selected} onClose={()=>setSelected(null)}/>
    <Dialog open={create} onOpenChange={open=>!open&&setCreate(false)}><DialogContent className="crm-dialog">
      <DialogTitle>Create a delivery order</DialogTitle><DialogDescription>Only remaining delivery-eligible quantities from a completed sale can be added. Existing quantities cannot be duplicated.</DialogDescription>
      <form className="crm-form" onSubmit={submit} noValidate>
        <label className="crm-field">Completed invoice<span>*</span><select required value={saleId} onChange={event=>setSaleId(event.target.value)}><option value="">Select invoice</option>{salesWithBalance.map(sale=><option key={sale.id} value={sale.id}>{sale.invoiceNumber} · {sale.customerName} · {deliveryStoreLabel(sale.storeId,data)}</option>)}</select></label>
        {chosenSale&&<div className="p6-order-preview"><b>Remaining eligible quantities</b>{remainingEligibleLines(chosenSale,data.deliveries).map(({line,quantity,serials})=><p key={line.productId}>{line.name} × {quantity}{serials.length?` · ${serials.join(', ')}`:''}</p>)}{!eligibleSaleLines(chosenSale).length&&<p>No delivery-eligible products on this invoice.</p>}</div>}
        {error&&<p role="alert" className="crm-error">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={()=>setCreate(false)}>Cancel</Button><Button type="submit" disabled={!chosenSale}>Create delivery order</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>
}
