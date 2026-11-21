'use client'
import {useMemo} from 'react'
import {DetailDrawer,DataTable,StatusBadge,EmptyState} from '../foundation'
import {useDemo} from '../demo-provider'
import type {Delivery} from '@/lib/phase6-types'
import {deliveryProgress,deliveryStoreLabel,localDateTime} from '@/lib/fulfilment'

export function DeliveryDetailDrawer({order,open,onClose}:{order:Delivery|null;open:boolean;onClose:()=>void}){
  const {data}=useDemo()
  const sale=order?data.sales.find(item=>item.id===order.saleId):undefined
  const customer=order?data.customers.find(item=>item.id===order.customerId):undefined
  const team=order?data.deliveryTeams.find(item=>item.id===order.deliveryTeamId):undefined
  const vehicle=order?data.deliveryVehicles.find(item=>item.id===order.vehicleId):undefined
  const progress=order?deliveryProgress(order):{total:0,delivered:0,percent:0}
  const activities=useMemo(()=>order?data.deliveryActivities.filter(item=>item.deliveryId===order.id).sort((a,b)=>a.date.localeCompare(b.date)):[],[data.deliveryActivities,order])
  const exceptions=order?data.deliveryExceptions.filter(item=>item.deliveryId===order.id).sort((a,b)=>b.date.localeCompare(a.date)):[]
  const proofs=order?data.deliveryProofs.filter(item=>item.deliveryId===order.id).sort((a,b)=>b.date.localeCompare(a.date)):[]
  return <DetailDrawer title={order?.orderNumber||'Delivery details'} open={open&&!!order} onClose={onClose}>
    {order&&<div className="p6-detail">
      <div className="p6-detail-head"><StatusBadge>{order.status}</StatusBadge><span>{progress.delivered} of {progress.total} units delivered · {progress.percent}%</span></div>
      <div className="p6-detail-grid">
        <div><small>Invoice</small><b>{sale?.invoiceNumber||order.saleId}</b></div>
        <div><small>Customer</small><b>{customer?.name||order.customerId}</b><span>{customer?.mobile||'No mobile'}</span></div>
        <div><small>Store</small><b>{deliveryStoreLabel(order.storeId,data)}</b></div>
        <div><small>Delivery team</small><b>{team?.name||'Not assigned'}</b><span>{team?.lead||''}</span></div>
        <div><small>Vehicle</small><b>{vehicle?.registration||'Not assigned'}</b></div>
        <div><small>Schedule</small><b>{order.scheduledDate||'Not scheduled'}</b><span>{order.timeSlot||'No time slot'}</span></div>
        <div className="p6-detail-wide"><small>Address</small><b>{order.deliveryAddress||'Address not recorded'}</b></div>
      </div>
      <h3>Products</h3>
      {order.items.length?<DataTable columns={['Product','Qty','Serial numbers','Delivered']} rows={order.items.map(item=>[
        <span key={item.id}><b>{item.name}</b><small className="p4-sub">{item.sku}</small></span>,item.quantity,
        item.serials.length?item.serials.join(', '):'Quantity tracked',`${item.deliveredQuantity} / ${item.quantity}`
      ])}/>:<EmptyState text="This order has no linked sale products."/>}
      {order.instructions&&<p className="p6-notice"><b>Instructions</b><br/>{order.instructions}</p>}
      <h3>Tracking history</h3>
      {activities.length?<ol className="p6-timeline">{activities.map(activity=><li key={activity.id}><span className="p6-timeline-dot"/><div><b>{activity.type}</b><StatusBadge>{activity.status}</StatusBadge><p>{activity.notes}</p><small>{localDateTime(activity.date)} · {activity.actor}</small></div></li>)}</ol>:<EmptyState text="No delivery activity has been recorded."/>}
      {exceptions.length>0&&<><h3>Exceptions</h3>{exceptions.map(item=><div className="p6-history-card" key={item.id}><b>{item.reason}</b><StatusBadge>{item.status}</StatusBadge><p>{item.notes}</p><small>{localDateTime(item.date)} · follow-up {item.followUpDate||'not scheduled'}</small></div>)}</>}
      {proofs.length>0&&<><h3>Proof of delivery</h3>{proofs.map(item=><div className="p6-history-card" key={item.id}><b>{item.reference}</b><p>Received by {item.recipientName} · {item.recipientMobile}</p><small>{localDateTime(item.date)} · {item.conditionConfirmed?'Condition confirmed':'Condition not confirmed'}</small></div>)}</>}
    </div>}
  </DetailDrawer>
}

export function statusClass(status:string){
  return `p6-status p6-status-${status.toLowerCase().replace(/[^a-z]+/g,'-')}`
}
