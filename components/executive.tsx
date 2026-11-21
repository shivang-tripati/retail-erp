'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Wallet,Receipt,IndianRupee,Banknote,Clock3,Package,Truck,Users,ShieldCheck,ArrowUpRight} from 'lucide-react'
import {useDemo} from './demo-provider'
import {KpiCard,DataTable,EmptyState,StatusBadge} from './foundation'
import {Panel,ScopeBar,useScope} from './analytics-controls'
import {executiveKpis,storeAnalytics,agingBuckets,referenceDate} from '@/lib/phase8-analytics'
import {compact,money,pct,dateLabel} from '@/lib/demo-data'

export default function Executive(){
  const {scope,set}=useScope(),{data}=useDemo(),router=useRouter()
  const k=executiveKpis(data,scope)
  const paise=(value:number)=>value/100
  const cards=[
    {label:'Total / net sales',value:compact(paise(k.netSalesPaise)),note:`${k.sales.length} invoices · current period`,icon:Wallet,color:'blue',href:'/analytics/executive-kpis'},
    {label:'Collections received',value:compact(paise(k.collectionsPaise)),note:'Valid allocated payments only',icon:Banknote,color:'teal',href:'/finance/finance-dashboard'},
    {label:'Outstanding receivables',value:compact(paise(k.outstandingPaise)),note:'Excludes reversed invoices',icon:Clock3,color:'amber',href:'/finance/receivables'},
    {label:'Inventory value',value:compact(paise(k.inventoryValuePaise)),note:'At purchase cost · current stock',icon:Package,color:'blue',href:'/inventory/stock-overview'}
  ]
  const operations=[
    {label:'Invoice count',value:k.invoiceCount.toLocaleString('en-IN'),note:'Completed, active sales',icon:Receipt,color:'violet',href:'/sales/sales-history'},
    {label:'Average bill value',value:compact(paise(k.averageBillPaise)),note:'Net invoice sales / invoices',icon:IndianRupee,color:'violet',href:'/analytics/executive-kpis'},
    {label:'Delivery completion',value:pct(k.deliveryCompletionPaise),note:'Shared delivery records',icon:Truck,color:'teal',href:'/fulfilment/delivery-dashboard'},
    {label:'Pending installations',value:k.pendingInstallations.toLocaleString('en-IN'),note:'Delivered products awaiting completion',icon:Users,color:'green',href:'/after-sales/installation-worklist'},
    {label:'Active warranties',value:k.activeWarranties.toLocaleString('en-IN'),note:`${k.expiringWarranties} expire within 30 days`,icon:ShieldCheck,color:'green',href:'/after-sales/warranty-directory'},
    {label:'Open service tickets',value:k.openTickets.toLocaleString('en-IN'),note:'Excludes resolved, closed and cancelled',icon:Clock3,color:'amber',href:'/after-sales/service-tickets'}
  ]
  const stores=storeAnalytics(data,scope).sort((a,b)=>b.netPaise-a.netPaise)
  const aging=agingBuckets(data,scope)
  const recent=k.sales.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8)
  const alertRows=data.alerts.filter(alert=>!scope.store||data.stores.find(store=>store.id===scope.store)?.name===alert.store).slice(0,6)
  const salesChange=k.previousNetSalesPaise?((k.netSalesPaise-k.previousNetSalesPaise)/Math.abs(k.previousNetSalesPaise))*100:0
  const collectionChange=k.previousCollectionsPaise?((k.collectionsPaise-k.previousCollectionsPaise)/Math.abs(k.previousCollectionsPaise))*100:0
  return <div className="phase">
    <section className="hero executive-hero"><div className="herotext"><div className="heroeyebrow"><i/>EXECUTIVE INTELLIGENCE</div><h1>Executive dashboard</h1><p>{data.settings.Company} · Connected multi-module performance</p></div><div className="blueprint" aria-hidden="true"/><small className="fig">FIG. 08 / EXECUTIVE VIEW</small></section>
    <ScopeBar scope={scope} set={set}/>
    <div className="sectionheading"><h2>Financial position</h2><span className="scope">Active period · {salesChange>=0?'+' : ''}{salesChange.toFixed(1)}% net sales</span></div>
    <div className="metrics">{cards.map(card=><KpiCard key={card.label} label={card.label} icon={card.icon} color={card.color} value={card.value} note={card.note} onClick={()=>router.push(card.href)}/>)}</div>
    <div className="reportgrid widefirst">
      <Panel title="Net sales trend" meta="Connected completed invoices · previous-period change"><div className="executive-trend"><strong>{compact(paise(k.netSalesPaise))}</strong><span>{k.previousNetSalesPaise?`${salesChange>=0?'+':''}${salesChange.toFixed(1)}% vs previous period`:'No prior baseline'}</span><div className="trend-bars">{k.sales.slice(-14).map(sale=><i key={sale.id} style={{height:`${Math.max(8,Math.round(sale.totalPaise/Math.max(...k.sales.map(item=>item.totalPaise))*100))}%`}} title={`${sale.invoiceNumber}: ${money(paise(sale.totalPaise))}`}/>)}</div></div></Panel>
      <Panel title="Store comparison" meta="Net sales by store" action={<Link href="/analytics/store-performance"><ArrowUpRight size={17}/></Link>}><div className="ranklist">{stores.slice(0,6).map(row=><div className="rankrow" key={row.store.id}><div><span>{row.store.name}</span><b>{compact(paise(row.netPaise))}</b></div><progress value={row.netPaise} max={stores[0]?.netPaise||1}/></div>)}</div></Panel>
    </div>
    <div className="sectionheading"><h2>Operations and customer outcomes</h2></div>
    <div className="metrics">{operations.map(card=><KpiCard key={card.label} label={card.label} icon={card.icon} color={card.color} value={card.value} note={card.note} onClick={()=>router.push(card.href)}/>)}</div>
    <div className="reportgrid">
      <Panel title="Customer acquisition" meta="Derived from completed shared sales"><DataTable columns={['Metric','Count']} rows={[['New customers',k.newCustomers],['Returning customers',k.returningCustomers],['CRM enquiries won',data.enquiries.filter(item=>item.status==='Won').length],['Walk-in records',data.walkIns.length]]}/></Panel>
      <Panel title="Receivables aging" meta="Active invoice balances; invoice age estimated"><DataTable columns={['Bucket','Outstanding']} rows={aging.map(bucket=>[bucket.name,money(paise(bucket.totalPaise))])}/></Panel>
      <Panel title="Recent transactions" meta="Drill down to sales and finance records">{recent.length?<DataTable columns={['Invoice','Customer','Store','Net']} rows={recent.map(sale=>[<Link className="textlink" key={sale.id} href="/sales/sales-history">{sale.invoiceNumber}</Link>,sale.customerName,data.stores.find(store=>store.id===sale.storeId)?.name||sale.storeId,money(paise(sale.totalPaise))])}/>:<EmptyState text="No invoices in this selection."/>}</Panel>
      <Panel title="Operational alerts" meta={`${alertRows.length} relevant demo alerts`} action={<Link href="/analytics/alerts-notifications" className="textlink">View all →</Link>}><DataTable columns={['Issue','Severity','Status']} rows={alertRows.map(alert=>[alert.type,<StatusBadge key={alert.id}>{alert.severity}</StatusBadge>,alert.status])}/></Panel>
    </div>
  </div>
}
