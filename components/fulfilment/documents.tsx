'use client'
import {useState} from 'react'
import {Printer} from 'lucide-react'
import {Button} from '../ui/button'
import {EmptyState,PageHeader} from '../foundation'
import {Panel} from '../analytics-controls'
import {useDemo} from '../demo-provider'
import {deliveryStoreLabel,localDate,localDateTime} from '@/lib/fulfilment'

export function DeliveryDocuments(){
  const {data}=useDemo()
  const [deliveryId,setDeliveryId]=useState(data.deliveries[0]?.id||''),[proofId,setProofId]=useState(''),[printTarget,setPrintTarget]=useState<'challan'|'receipt'>('challan')
  const order=data.deliveries.find(item=>item.id===deliveryId)
  const sale=order?data.sales.find(item=>item.id===order.saleId):undefined
  const customer=order?data.customers.find(item=>item.id===order.customerId):undefined
  const store=order?data.stores.find(item=>item.id===order.storeId):undefined
  const team=order?data.deliveryTeams.find(item=>item.id===order.deliveryTeamId):undefined
  const vehicle=order?data.deliveryVehicles.find(item=>item.id===order.vehicleId):undefined
  const proofs=order?data.deliveryProofs.filter(item=>item.deliveryId===order.id):[]
  const proof=proofs.find(item=>item.id===proofId)||proofs[proofs.length-1]
  function print(target:'challan'|'receipt'){
    setPrintTarget(target)
    window.setTimeout(()=>window.print(),50)
  }
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Documents" title="Delivery documents" description="Prepare browser-printable A4 demo challans and delivery receipts from linked orders and recorded proof. No legally binding signatures or photos are created."/>
    <div className="p6-filters">
      <label className="crm-field">Select delivery order<span>*</span><select value={deliveryId} onChange={event=>{setDeliveryId(event.target.value);setProofId('')}}><option value="">Select an order</option>{data.deliveries.map(item=><option key={item.id} value={item.id}>{item.orderNumber} · {data.sales.find(sale=>sale.id===item.saleId)?.invoiceNumber||item.saleId}</option>)}</select></label>
      {proofs.length>0&&<label className="crm-field">Select delivery confirmation<select value={proof?.id||''} onChange={event=>setProofId(event.target.value)}>{proofs.map(item=><option key={item.id} value={item.id}>{item.reference} · {localDate(item.date)}</option>)}</select></label>}
    </div>
    {!order?<EmptyState text="Create a delivery order before preparing documents."/>:<div className="p6-documents">
      <Panel title="Delivery challan" meta="A4 print layout · shipment handoff copy">
        <div className="p6-document-actions"><Button onClick={()=>print('challan')}><Printer size={15}/>Print challan</Button></div>
        <article className={`p6-print-document ${printTarget==='challan'?'p6-active-print':''}`}>
          <header className="p6-doc-header"><div className="p6-doc-brand"><span>SE</span><div><h2>Sharma Electronics</h2><p>{store?.name||deliveryStoreLabel(order.storeId,data)} · {store?.address||'Delhi NCR'}</p><p>{store?.city||'Delhi NCR'} · {store?.phone||'Demo contact'}</p></div></div><div><small>Delivery document</small><h1>Delivery challan</h1></div></header>
          <div className="p6-doc-reference"><span><small>Challan number</small><b>CH-{order.orderNumber}</b></span><span><small>Delivery order</small><b>{order.orderNumber}</b></span><span><small>Invoice reference</small><b>{sale?.invoiceNumber||order.saleId}</b></span><span><small>Dispatch date</small><b>{order.dispatchedAt?localDate(order.dispatchedAt):'Not dispatched'}</b></span></div>
          <div className="p6-doc-party"><section><small>Customer</small><b>{customer?.name||order.customerId}</b><span>{customer?.mobile||'—'}</span><span>{customer?.email||''}</span></section><section><small>Delivery address</small><b>{order.deliveryAddress||'Address not recorded'}</b></section><section><small>Delivery assignment</small><b>{team?.name||'Not assigned'}</b><span>{vehicle?.registration||'Not assigned'}</span><span>{order.scheduledDate?`${localDate(order.scheduledDate)} · ${order.timeSlot}`:'Not scheduled'}</span></section></div>
          <table className="p6-doc-table"><thead><tr><th>Product description</th><th>SKU</th><th>Quantity</th><th>Serial numbers</th></tr></thead><tbody>{order.items.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{item.serials.join(', ')||'Quantity tracked'}</td></tr>)}</tbody></table>
          <div className="p6-doc-foot"><p>Demo dispatch document. Sale inventory was deducted at checkout; dispatch does not change stock again.</p><div className="p6-recipient-lines"><span>Recipient name: ____________________</span><span>Date / time received: ____________________</span><span>Condition confirmed: Yes / No</span></div><small>This blank recipient section is a manual confirmation area, not a captured customer signature.</small></div>
        </article>
      </Panel>
      <Panel title="Delivery receipt" meta="Created only after an order has a recorded demo proof of delivery">
        {proof?<><div className="p6-document-actions"><Button onClick={()=>print('receipt')}><Printer size={15}/>Print receipt</Button></div>
          <article className={`p6-print-document ${printTarget==='receipt'?'p6-active-print':''}`}>
            <header className="p6-doc-header"><div className="p6-doc-brand"><span>SE</span><div><h2>Sharma Electronics</h2><p>{store?.name||deliveryStoreLabel(order.storeId,data)} · {store?.address||'Delhi NCR'}</p></div></div><div><small>Delivery confirmation</small><h1>Delivery receipt</h1></div></header>
            <div className="p6-doc-reference"><span><small>Proof reference</small><b>{proof.reference}</b></span><span><small>Delivery order</small><b>{order.orderNumber}</b></span><span><small>Invoice reference</small><b>{sale?.invoiceNumber||order.saleId}</b></span><span><small>Delivered</small><b>{localDateTime(proof.date)}</b></span></div>
            <div className="p6-doc-party"><section><small>Customer</small><b>{customer?.name||order.customerId}</b><span>{customer?.mobile||'—'}</span></section><section><small>Received by</small><b>{proof.recipientName}</b><span>{proof.recipientMobile}</span></section><section><small>Condition</small><b>{proof.conditionConfirmed?'Confirmed':'Not confirmed'}</b></section></div>
            <table className="p6-doc-table"><thead><tr><th>Delivered product</th><th>Quantity</th><th>Serial numbers</th></tr></thead><tbody>{proof.lines.map(line=>{const item=order.items.find(record=>record.id===line.deliveryItemId);return <tr key={line.deliveryItemId}><td>{item?.name||'Product'}</td><td>{line.quantity}</td><td>{line.serials.join(', ')||'Quantity tracked'}</td></tr>})}</tbody></table>
            <div className="p6-doc-foot"><p>{proof.notes||'No delivery notes recorded.'}</p><p>Demo confirmation reference only. No signature image or photograph is stored.</p></div>
          </article>
        </>:<EmptyState text="This order has no recorded proof of delivery yet."/>}
      </Panel>
    </div>}
  </div>
}
