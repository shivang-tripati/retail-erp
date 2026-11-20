'use client'
import {useState} from 'react'
import {CalendarDays,Mail,MapPin,Phone,UserRound} from 'lucide-react'
import {useDemo} from './demo-provider'
import {DataTable,EmptyState} from './foundation'
import {dateLabel,money} from '@/lib/demo-data'
import {currency,dateInIndia,staticCustomerInvoices} from '@/lib/phase3-data'
import {allocationsForPayment,customerOutstanding,invoiceFinance,paymentStatus} from '@/lib/finance'
import type {Customer} from '@/lib/phase3-data'

const tabs=['Overview','Purchase history','Payments','Deliveries','Installations','Warranty & service']
export default function CustomerProfile({customer}:{customer:Customer}){
  const {data}=useDemo(),[tab,setTab]=useState(tabs[0])
  const old=staticCustomerInvoices(customer.id)
  const sales=data.sales.filter(s=>s.customerId===customer.id)
  const activeSales=sales.filter(s=>s.status==='Completed')
  const totalPurchases=old.length+activeSales.length
  const totalValue=old.reduce((sum,row)=>sum+row.net,0)+activeSales.reduce((sum,sale)=>sum+sale.totalPaise/100,0)
  const due=old.reduce((sum,row)=>sum+row.net-row.paid,0)+customerOutstanding(customer.id,data)/100
  const storeName=(id:string)=>data.stores.find(store=>store.id===id)?.name||id
  const history=[
    ...old.map(row=>[row.id,`${dateLabel(row.age)} 2026`,storeName(row.store),data.brands.find(brand=>brand.id===row.brand)?.name||row.category,money(row.net),row.paid>=row.net?'Paid':row.paid?'Partially paid':'Unpaid']),
    ...sales.map(sale=>{const financial=invoiceFinance(sale,data);return [sale.invoiceNumber,dateInIndia(sale.date),storeName(sale.storeId),sale.lines.map(line=>line.name).join(', '),currency(sale.totalPaise),financial.status]})
  ]
  const payments=[
    ...old.filter(row=>row.paid>0).map(row=>[`${dateLabel(row.age)} 2026`,money(row.paid),row.payment,`DEMO-${row.id}`,row.id,'Recorded']),
    ...data.payments.filter(payment=>payment.customerId===customer.id).map(payment=>{
      const allocations=allocationsForPayment(payment,data)
      const related=allocations.map(item=>item.invoiceId).join(', ')||'Unallocated advance'
      return [dateInIndia(payment.date),currency(payment.amountPaise),payment.mode,payment.reference||payment.id,related,paymentStatus(payment,data)]
    })
  ]
  const deliveries=[
    ...old.filter(row=>row.delivery).map(row=>[row.id,data.stores.find(store=>store.id===row.store)?.name||row.store,row.category,row.delivery,`${dateLabel(row.age)} 2026`]),
    ...data.deliveries.filter(item=>item.customerId===customer.id).map(item=>[item.id,storeName(item.storeId),item.products,item.status,item.scheduledDate])
  ]
  const installations=[
    ...old.filter(row=>row.installation!=='Not required').map(row=>[row.category,`${dateLabel(row.age)} 2026`,row.installation]),
    ...data.installations.filter(item=>item.customerId===customer.id).map(item=>[item.product,item.scheduledDate,item.status])
  ]
  const warranties=activeSales.flatMap(sale=>sale.lines.flatMap(line=>line.serials.map(serial=>[
    line.name,serial,`${dateInIndia(sale.date)} · 12 months (illustrative)`,
    sale.status==='Completed'?'Warranty recorded':'Reversed'
  ])))
  return <section className="crm-profile">
    <nav className="crm-tabs" aria-label="Customer profile sections">{tabs.map(name=><button type="button" key={name} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    {tab==='Overview'&&<div className="crm-profile-grid">
      <section className="crm-profile-block"><h3>Contact information</h3><dl className="facts">
        <div><dt><UserRound size={14}/> Customer ID</dt><dd>{customer.id}</dd></div>
        <div><dt><Phone size={14}/> Mobile</dt><dd>{customer.mobile}</dd></div>
        {customer.alternateMobile&&<div><dt>Alternate mobile</dt><dd>{customer.alternateMobile}</dd></div>}
        <div><dt><Mail size={14}/> Email</dt><dd>{customer.email||'Not provided'}</dd></div>
        <div><dt><MapPin size={14}/> Address</dt><dd>{customer.address}, {customer.city}, {customer.state} {customer.pinCode}</dd></div>
        <div><dt>Customer type</dt><dd>{customer.type}</dd></div>
      </dl></section>
      <section className="crm-profile-block"><h3>Purchase summary</h3><dl className="facts">
        <div><dt>Invoices</dt><dd>{totalPurchases}</dd></div>
        <div><dt>Total purchase value</dt><dd>{money(totalValue)}</dd></div>
        <div><dt>Outstanding balance</dt><dd>{money(due)}</dd></div>
        <div><dt><CalendarDays size={14}/> Customer since</dt><dd>{dateInIndia(customer.since)}</dd></div>
        <div><dt>Most recent sale</dt><dd>{sales.length?dateInIndia(sales[sales.length-1].date):old.length?`${dateLabel(Math.min(...old.map(row=>row.age)))} 2026`:'No completed purchases'}</dd></div>
      </dl></section>
      {customer.notes&&<section className="crm-profile-block"><h3>Notes</h3><p>{customer.notes}</p></section>}
    </div>}
    {tab==='Purchase history'&&(history.length?<DataTable columns={['Invoice number','Purchase date','Store','Products','Invoice amount','Payment status']} rows={history}/>:<EmptyState text="No purchases are recorded for this customer." />)}
    {tab==='Payments'&&(payments.length?<DataTable columns={['Payment date','Amount','Payment mode','Reference','Related invoice','Status']} rows={payments}/>:<EmptyState text="No payment records are available for this customer." />)}
    {tab==='Deliveries'&&(deliveries.length?<DataTable columns={['Order reference','Store','Products','Delivery status','Scheduled date']} rows={deliveries}/>:<EmptyState text="No delivery records are available for this customer." />)}
    {tab==='Installations'&&(installations.length?<DataTable columns={['Product','Installation date','Status']} rows={installations}/>:<EmptyState text="No installation records are available for this customer." />)}
    {tab==='Warranty & service'&&(warranties.length?<><DataTable columns={['Product','Serial number','Warranty details','Status']} rows={warranties}/><div className="crm-note">Warranty periods are illustrative demo information, not manufacturer terms.</div><EmptyState text="No service tickets are recorded for this customer."/></>:<EmptyState text="No serialised purchases or service tickets are recorded for this customer." />)}
  </section>
}
