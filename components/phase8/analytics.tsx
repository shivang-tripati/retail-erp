'use client'

import Link from 'next/link'
import {useState,type ReactNode} from 'react'
import {Download,Printer} from 'lucide-react'
import {useDemo} from '../demo-provider'
import {PageHeader,SearchBar,Selector,DataTable,StatusBadge,EmptyState,DetailDrawer} from '../foundation'
import {Panel,ScopeBar,useScope} from '../analytics-controls'
import {agingBuckets,collectionTotal,executiveKpis,filterSales,inPeriod,referenceDate,storeAnalytics} from '@/lib/phase8-analytics'
import {compact,money,pct,dateLabel} from '@/lib/demo-data'
import {isDeliveryComplete,deliveryProductCount} from '@/lib/fulfilment'

function changeValue(current:number,previous:number){
  if(!previous)return current?100:0
  return (current-previous)/Math.abs(previous)*100
}

const rupees=(paise:number)=>paise/100

export function SalesCustomerAnalytics(){
  const {scope,set}=useScope(),{data}=useDemo()
  const kpis=executiveKpis(data,scope)
  const sales=filterSales(data,scope)
  const categoryRows=new Map<string,number>()
  const brandRows=new Map<string,number>()
  const storeRows=new Map<string,number>()
  sales.forEach(sale=>sale.lines.forEach(line=>{
    categoryRows.set(line.category,(categoryRows.get(line.category)||0)+line.taxablePaise)
    brandRows.set(line.brandId,(brandRows.get(line.brandId)||0)+line.taxablePaise)
  }))
  sales.forEach(sale=>storeRows.set(sale.storeId,(storeRows.get(sale.storeId)||0)+sale.totalPaise))
  const ranked=(rows:Map<string,number>,labels?:Map<string,string>)=>[...rows].sort((a,b)=>b[1]-a[1]).map(([id,value])=>[labels?.get(id)||id,money(rupees(value))] as React.ReactNode[])
  const storeLabels=new Map(data.stores.map(store=>[store.id,store.name]))
  const brandLabels=new Map(data.brands.map(brand=>[brand.id,brand.name]))
  return <div className="phase">
    <PageHeader eyebrow="Analytics / Commercial intelligence" title="Sales and customer analytics" description="Sales trends and customer behaviour from completed POS and CRM records."/>
    <ScopeBar scope={scope} set={set}/>
    <div className="metrics phase8-metrics">
      <div className="metric"><span>Net sales</span><strong>{compact(rupees(kpis.netSalesPaise))}</strong><small>{changeValue(kpis.netSalesPaise,kpis.previousNetSalesPaise).toFixed(1)}% vs previous period</small></div>
      <div className="metric"><span>Invoice volume</span><strong>{kpis.invoiceCount}</strong><small>Completed, non-reversed invoices</small></div>
      <div className="metric"><span>Average transaction</span><strong>{compact(rupees(kpis.averageBillPaise))}</strong><small>Net sales / invoice count</small></div>
      <div className="metric"><span>New / returning</span><strong>{kpis.newCustomers} / {kpis.returningCustomers}</strong><small>Existing customer records</small></div>
    </div>
    <div className="reportgrid">
      <Panel title="Sales by category" meta="Net taxable value by category"><DataTable columns={['Category','Sales']} rows={ranked(categoryRows)}/></Panel>
      <Panel title="Sales by brand" meta="Net taxable value by brand"><DataTable columns={['Brand','Sales']} rows={ranked(brandRows,brandLabels)}/></Panel>
      <Panel title="Sales by store" meta="Invoice net value"><DataTable columns={['Store','Sales']} rows={ranked(storeRows,storeLabels)}/></Panel>
      <Panel title="Purchase and repeat behaviour" meta="Derived only from completed sales">
        <DataTable columns={['Customer metric','Value']} rows={[
          ['New customers in period',kpis.newCustomers],
          ['Returning customers',kpis.returningCustomers],
          ['Customer conversion enquiries',data.enquiries.filter(item=>item.status==='Won').length],
          ['Walk-in footfall',data.walkIns.length]
        ]}/>
      </Panel>
    </div>
  </div>
}

export function InventoryWarehouseAnalytics(){
  const {scope,set}=useScope(),{data}=useDemo()
  const kpis=executiveKpis(data,scope)
  const rows=data.inventory.filter(row=>(!scope.store||row.storeId===scope.store)&&row.quantity>0).map(row=>{
    const product=data.products.find(item=>item.id===row.productId)
    if(!product||(scope.brand&&product.brandId!==scope.brand)||(scope.category&&product.category!==scope.category))return null
    const brand=data.brands.find(item=>item.id===product.brandId)
    const receipt=data.movements.find(item=>item.productId===row.productId&&item.toLocation===row.storeId&&item.type==='Purchase Receipt')
    const age=receipt?Math.max(0,Math.floor((referenceDate-new Date(receipt.date).getTime()/86400000))) : 0
    return {product,brand,row,ageEstimated:!!receipt,age}
  }).filter((row):row is NonNullable<typeof row>=>!!row)
  const fast=new Map<string,number>()
  data.movements.filter(item=>item.type==='Sale'&&(!scope.store||item.fromLocation===scope.store)).forEach(item=>fast.set(item.productId,(fast.get(item.productId)||0)+item.quantity))
  const ranked=[...fast].sort((a,b)=>b[1]-a[1]).slice(0,8)
  return <div className="phase">
    <PageHeader eyebrow="Analytics / Supply chain" title="Inventory and warehouse analytics" description="Current stock valuation, movement and estimated lot-age indicators."/>
    <ScopeBar scope={scope} set={set}/>
    <div className="metrics phase8-metrics">
      <div className="metric"><span>Inventory value</span><strong>{compact(rupees(kpis.inventoryValuePaise))}</strong><small>At purchase cost · current demo</small></div>
      <div className="metric"><span>Low-stock lines</span><strong>{kpis.lowStock}</strong><small>Estimated at 3 units or fewer</small></div>
      <div className="metric"><span>GRNs</span><strong>{data.grns.filter(item=>item.status==='Received').length}</strong><small>Received purchase records</small></div>
      <div className="metric"><span>Open transfers</span><strong>{data.transfers.filter(item=>!['Received','Cancelled'].includes(item.status)).length}</strong><small>Inter-store transfer records</small></div>
    </div>
    <div className="reportgrid">
      <Panel title="Fast-moving products" meta="Units moved by completed sale movements"><DataTable columns={['Product','Units sold']} rows={ranked.map(([id,qty])=>[data.products.find(item=>item.id===id)?.name||id,qty])}/></Panel>
      <Panel title="Low stock and out of stock" meta="Current stock, not historical availability"><DataTable columns={['Product','Store','Qty']} rows={rows.filter(row=>row.row.quantity<=3).slice(0,12).map(row=>[row.product.name,data.stores.find(store=>store.id===row.row.storeId)?.name||row.row.storeId,row.row.quantity])}/></Panel>
      <Panel title="Stock aging — estimated" meta="Estimated from the earliest available purchase movement; quantity-based lot history is unavailable"><DataTable columns={['Product','Location','Est. age']} rows={rows.filter(row=>row.ageEstimated).slice(0,12).map(row=>[row.product.name,data.stores.find(store=>store.id===row.row.storeId)?.name||row.row.storeId,`${row.age} days`])}/></Panel>
      <Panel title="Warehouse activity" meta="Shared GRN, transfer, buyback and scrap records"><DataTable columns={['Activity','Count']} rows={[
        ['Received GRNs',data.grns.filter(item=>item.status==='Received').length],
        ['Inter-store transfers',data.transfers.length],
        ['Buybacks',data.buybacks.length],
        ['Approved resale',data.buybacks.filter(item=>item.disposition==='Resale stock').length],
        ['Scrap requests',data.scrapRequests.length]
      ]}/></Panel>
    </div>
  </div>
}

export function FinanceCollectionsAnalytics(){
  const {scope,set}=useScope(),{data}=useDemo()
  const kpis=executiveKpis(data,scope)
  const buckets=agingBuckets(data,scope)
  const reversed=data.financialAudit.filter(item=>item.activity==='Payment reversed'||item.activity==='Invoice reversed').length
  const advances=data.paymentAllocations.filter(allocation=>!allocation.invoiceId).length
  return <div className="phase">
    <PageHeader eyebrow="Analytics / Finance" title="Finance and collections analytics" description="Separate invoice revenue, allocated collections, advances and outstanding receivables."/>
    <ScopeBar scope={scope} set={set}/>
    <div className="metrics phase8-metrics">
      <div className="metric"><span>Net invoice sales</span><strong>{compact(rupees(kpis.netSalesPaise))}</strong><small>Active invoices only</small></div>
      <div className="metric"><span>Collections received</span><strong>{compact(rupees(kpis.collectionsPaise))}</strong><small>Valid allocations only</small></div>
      <div className="metric"><span>Outstanding receivables</span><strong>{compact(rupees(kpis.outstandingPaise))}</strong><small>Active invoice balances</small></div>
      <div className="metric"><span>Advance records</span><strong>{advances}</strong><small>Unallocated; not counted as collections</small></div>
    </div>
    <div className="reportgrid">
      <Panel title="Receivables aging" meta="Reference date: 20 Nov 2026 · due-date data unavailable; invoice age is used as a demo estimate"><DataTable columns={['Bucket','Outstanding','Invoices']} rows={buckets.map(bucket=>[bucket.name,money(rupees(bucket.totalPaise)),bucket.count])}/></Panel>
      <Panel title="Payment allocations" meta="Reversed payments and reversed invoices are excluded"><DataTable columns={['Status','Count']} rows={[
        ['Active allocations',collectionTotal(data,scope)?activeAllocationCount(data):0],
        ['Reversal records',reversed],
        ['Unallocated advance records',advances]
      ]}/></Panel>
      <Panel title="Store collections" meta="Allocated customer payments only"><DataTable columns={['Store','Collections']} rows={storeAnalytics(data,scope).sort((a,b)=>b.collectionsPaise-a.collectionsPaise).map(row=>[row.store.name,money(rupees(row.collectionsPaise))])}/></Panel>
      <Panel title="Invoice monitoring" meta="Exceptions and reversals"><DataTable columns={['Metric','Count']} rows={[
        ['Partially paid invoices',data.sales.filter(sale=>sale.status==='Completed'&&sale.paymentStatus==='Partially paid').length],
        ['Unpaid invoices',data.sales.filter(sale=>sale.status==='Completed'&&sale.paymentStatus==='Unpaid').length],
        ['Reversed invoices',data.sales.filter(sale=>sale.status==='Reversed').length]
      ]}/></Panel>
    </div>
  </div>
}

function activeAllocationCount(data:Parameters<typeof collectionTotal>[0]){
  const reversed=new Set(data.paymentReversals.map(item=>item.paymentId))
  return data.paymentAllocations.filter(item=>item.invoiceId&&item.invoiceId!==''&&!reversed.has(item.paymentId)).length
}

export function FulfilmentAfterSalesAnalytics(){
  const {scope,set}=useScope(),{data}=useDemo()
  const kpis=executiveKpis(data,scope)
  const deliveries=data.deliveries.filter(order=>(!scope.store||order.storeId===scope.store)&&inPeriod(order.createdAt,scope.days))
  const completed=deliveries.filter(isDeliveryComplete)
  const partial=deliveries.filter(order=>order.items.some(item=>item.deliveredQuantity>0)&&order.items.some(item=>item.deliveredQuantity<item.quantity)).length
  const now=referenceDate
  const active=data.warranties.filter(item=>new Date(item.endDate).getTime()>=now).length
  const expiring=data.warranties.filter(item=>{const end=new Date(item.endDate).getTime();return end>=now&&end<=now+30*86400000}).length
  return <div className="phase">
    <PageHeader eyebrow="Analytics / Operations" title="Fulfilment and after-sales analytics" description="Delivery, installation, warranty and service performance from linked demo records."/>
    <ScopeBar scope={scope} set={set}/>
    <div className="metrics phase8-metrics">
      <div className="metric"><span>Delivery completion</span><strong>{pct(kpis.deliveryCompletionPaise)}</strong><small>{completed.length} completed / {deliveries.length} orders</small></div>
      <div className="metric"><span>Partial deliveries</span><strong>{partial}</strong><small>Orders with remaining quantities</small></div>
      <div className="metric"><span>Pending installations</span><strong>{kpis.pendingInstallations}</strong><small>Shared installation queue</small></div>
      <div className="metric"><span>Open service tickets</span><strong>{kpis.openTickets}</strong><small>Not resolved, closed or cancelled</small></div>
    </div>
    <div className="reportgrid">
      <Panel title="Delivery status" meta="Shared delivery orders"><DataTable columns={['Status','Count']} rows={['Pending','Scheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery','Delivered','Failed','Rescheduled','Cancelled'].map(status=>[status,deliveries.filter(order=>order.status===status).length])}/></Panel>
      <Panel title="Team performance" meta="Completed quantity / dispatched quantity"><DataTable columns={['Team','Orders','Completed']} rows={data.deliveryTeams.map(team=>{const rows=deliveries.filter(order=>order.deliveryTeamId===team.id);return [team.name,rows.length,rows.filter(isDeliveryComplete).length]})}/></Panel>
      <Panel title="Installation and warranty" meta="No external turnaround metrics are inferred"><DataTable columns={['Metric','Count']} rows={[
        ['Pending / scheduled',kpis.pendingInstallations],
        ['Completed',data.installations.filter(item=>item.status==='Completed').length],
        ['Failed',data.installations.filter(item=>item.status==='Failed').length],
        ['Active warranties',active],
        ['Expiring in 30 days',expiring],
        ['Expired warranties',data.warranties.filter(item=>new Date(item.endDate).getTime()<now).length]
      ]}/></Panel>
      <Panel title="Service desk" meta="Resolution time is shown only for timestamped resolutions"><DataTable columns={['Metric','Count']} rows={[
        ['Open / assigned / scheduled',data.serviceTickets.filter(ticket=>['Open','Assigned','Scheduled','In Progress','Waiting for Parts','Escalated'].includes(ticket.status)).length],
        ['Resolved / closed',data.serviceTickets.filter(ticket=>ticket.status==='Resolved'||ticket.status==='Closed').length],
        ['Escalated',data.serviceTickets.filter(ticket=>ticket.status==='Escalated'||!!ticket.escalationReason).length],
        ['Warranty covered',data.serviceTickets.filter(ticket=>ticket.warrantyCoverage==='Covered').length],
        ['Chargeable',data.serviceTickets.filter(ticket=>ticket.warrantyCoverage==='Chargeable').length]
      ]}/></Panel>
    </div>
  </div>
}

export function Reports(){
  const {data}=useDemo()
  const [category,setCategory]=useState('Sales Reports')
  const [search,setSearch]=useState('')
  const [store,setStore]=useState('All stores')
  const [status,setStatus]=useState('All statuses')
  const [sort,setSort]=useState('Reference A–Z')
  const [page,setPage]=useState(1)
  const categories=['Sales Reports','Customer Reports','Store Reports','Inventory Reports','Finance Reports','Collection Reports','Delivery Reports','Installation Reports','Warranty Reports','Service Reports']
  const activeStore=data.stores.find(item=>item.name===store)?.id
  type ReportRow=[ReactNode,ReactNode,ReactNode,ReactNode]
  let columns=['Reference','Name','Store','Amount / status']
  let rows:ReportRow[]=[]
  if(category==='Sales Reports'||category==='Finance Reports'||category==='Collection Reports'){
    rows=data.sales.filter(sale=>sale.status==='Completed'&&(category==='Sales Reports'||sale.status==='Completed')).filter(sale=>!activeStore||sale.storeId===activeStore).filter(sale=>`${sale.invoiceNumber} ${sale.customerName}`.toLowerCase().includes(search.toLowerCase())).map(sale=>[sale.invoiceNumber,sale.customerName,data.stores.find(store=>store.id===sale.storeId)?.name||sale.storeId,category==='Collection Reports'?money(rupees(sale.paidPaise)):money(rupees(sale.totalPaise))])
  }else if(category==='Customer Reports'){
    rows=data.customers.filter(customer=>`${customer.name} ${customer.mobile}`.toLowerCase().includes(search.toLowerCase())).map(customer=>[customer.id,customer.name,data.stores.find(store=>store.id===data.sales.find(sale=>sale.customerId===customer.id)?.storeId)?.name||'Multiple',customer.status])
  }else if(category==='Store Reports'){
    rows=storeAnalytics(data,{store:'',brand:'',category:'',days:30}).filter(row=>row.store.name.toLowerCase().includes(search.toLowerCase())).map(row=>[row.store.code,row.store.name,row.store.city,money(rupees(row.netPaise))])
  }else if(category==='Inventory Reports'){
    rows=data.inventory.filter(row=>(!activeStore||row.storeId===activeStore)&&`${row.productId}`.toLowerCase().includes(search.toLowerCase())).slice(0,100).map(row=>{const product=data.products.find(item=>item.id===row.productId);return [product?.sku||row.productId,product?.name||row.productId,data.stores.find(store=>store.id===row.storeId)?.name||row.storeId,row.quantity]})
  }else if(category==='Delivery Reports'){
    rows=data.deliveries.filter(order=>(!activeStore||order.storeId===activeStore)&&(status==='All statuses'||order.status===status)&&`${order.orderNumber} ${order.customerId}`.toLowerCase().includes(search.toLowerCase())).map(order=>[order.orderNumber,order.customerId,data.stores.find(store=>store.id===order.storeId)?.name||order.storeId,order.status])
  }else if(category==='Installation Reports'){
    rows=data.installations.filter(item=>(!activeStore||item.storeId===activeStore)&&(status==='All statuses'||item.status===status)&&`${item.id} ${item.product}`.toLowerCase().includes(search.toLowerCase())).map(item=>[item.id,item.product,data.stores.find(store=>store.id===item.storeId)?.name||item.storeId,item.status])
  }else if(category==='Warranty Reports'){
    rows=data.warranties.filter(item=>(!activeStore||data.sales.find(sale=>sale.id===item.saleId)?.storeId===activeStore)&&`${item.reference} ${item.serial}`.toLowerCase().includes(search.toLowerCase())).map(item=>[item.reference,item.planName,data.stores.find(store=>store.id===data.sales.find(sale=>sale.id===item.saleId)?.storeId)?.name||'Multiple',item.status])
  }else{
    rows=data.serviceTickets.filter(item=>(!activeStore||item.storeId===activeStore)&&(status==='All statuses'||item.status===status)&&`${item.ticketNumber} ${item.issue}`.toLowerCase().includes(search.toLowerCase())).map(item=>[item.ticketNumber,item.category,data.stores.find(store=>store.id===item.storeId)?.name||item.storeId,item.status])
  }
  const sorted=[...rows].sort((a,b)=>{
    const av=String(a[0]).toLowerCase(),bv=String(b[0]).toLowerCase()
    return sort==='Reference Z–A'?bv.localeCompare(av):av.localeCompare(bv)
  })
  const pageSize=10,pages=Math.max(1,Math.ceil(sorted.length/pageSize),1)
  const visible=sorted.slice((Math.min(page,pages)-1)*pageSize,Math.min(page,pages)*pageSize)
  const statuses=['All statuses','Pending','Scheduled','Delivered','Failed','Open','Assigned','Resolved','Closed','Active','Expiring Soon','Expired']
  function exportCsv(){
    const escape=(value:ReactNode)=>'"'+String(value==null?'':value).replace(/"/g,'""')+'"'
    const csv=[columns.join(','),...sorted.map(row=>row.map(escape).join(','))].join('\n')
    const url='data:text/csv;charset=utf-8,'+encodeURIComponent(csv)
    const anchor=document.createElement('a')
    anchor.href=url
    anchor.download='retailos-'+category.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv'
    anchor.style.display='none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }
  return <div className="phase phase8-report">
    <PageHeader eyebrow="Analytics / Reporting" title="Unified reports" description="Search, filter, sort, print and export unified demo report views."/>
    <section className="report-panel">
      <div className="report-toolbar">
        <Selector label="Report category" value={category} onChange={value=>{setCategory(value);setPage(1)}} options={categories}/>
        <Selector label="Store" value={store} onChange={value=>{setStore(value);setPage(1)}} options={['All stores',...data.stores.map(item=>item.name)]}/>
        {['Delivery Reports','Installation Reports','Warranty Reports','Service Reports'].includes(category)&&<Selector label="Status" value={status} onChange={value=>{setStatus(value);setPage(1)}} options={statuses}/>}
        <Selector label="Sort" value={sort} onChange={setSort} options={['Reference A–Z','Reference Z–A']}/>
        <SearchBar label="Search report" value={search} onChange={value=>{setSearch(value);setPage(1)}}/>
        <button className="outlinebtn" onClick={()=>window.print()}><Printer size={15}/>Print</button>
        <button className="outlinebtn" onClick={exportCsv}><Download size={15}/>CSV export</button>
      </div>
      <div className="report-summary"><strong>{sorted.length}</strong><span>matching records</span></div>
      {visible.length?<DataTable columns={columns} rows={visible}/>:<EmptyState text="No records match this report selection."/>}
      {pages>1&&<div className="report-pagination"><button className="outlinebtn" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</button><span>Page {Math.min(page,pages)} of {pages}</span><button className="outlinebtn" disabled={page>=pages} onClick={()=>setPage(value=>Math.min(pages,value+1))}>Next</button></div>}
    </section>
  </div>
}
