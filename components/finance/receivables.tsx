'use client'
import {useMemo,useState} from 'react'
import {ArrowUpDown} from 'lucide-react'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector,StatusBadge} from '../foundation'
import {Panel} from '../analytics-controls'
import {Button} from '../ui/button'
import {activeInvoices,agingBucket,inDateRange,invoiceFinance,invoicePayments} from '@/lib/finance'
import {currency} from '@/lib/phase3-data'
import type {Customer} from '@/lib/phase3-data'
import {FinanceMetrics,dateLabel,financeDateRanges,storeLabel} from './shared'
import {useDemo} from '../demo-provider'

type ReceivableCustomer={customer:Customer;invoices:ReturnType<typeof activeInvoices>;invoiceCount:number;totalPaise:number;paidPaise:number;balancePaise:number;oldestDue:string;lastPayment:string;storeNames:string}
export function ReceivablesDirectory(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[store,setStore]=useState('All stores'),[range,setRange]=useState('All dates'),[amount,setAmount]=useState('Any balance'),[sortKey,setSortKey]=useState('balance'),[direction,setDirection]=useState<'asc'|'desc'>('desc'),[page,setPage]=useState(0),[detail,setDetail]=useState<ReceivableCustomer|null>(null)
  const invoiceRows=activeInvoices(data).filter(item=>inDateRange(item.sale.date,range)&&(store==='All stores'||item.sale.storeId===store))
  const customers=useMemo<ReceivableCustomer[]>(()=>{
    const groups=new Map<string,ReturnType<typeof activeInvoices>>()
    invoiceRows.forEach(row=>groups.set(row.sale.customerId,[...(groups.get(row.sale.customerId)||[]),row]))
    return [...groups].flatMap(([customerId,rows])=>{
      const customer=data.customers.find(item=>item.id===customerId)
      const open=rows.filter(item=>item.balancePaise>0)
      const balancePaise=open.reduce((sum,item)=>sum+item.balancePaise,0)
      if(!customer||balancePaise===0)return []
      const dates=rows.flatMap(item=>invoicePayments(item.sale,data).map(payment=>payment.date)).sort()
      const storeIds=[...new Set(rows.map(item=>item.sale.storeId))]
      return [{customer,invoices:rows,invoiceCount:rows.length,totalPaise:rows.reduce((sum,item)=>sum+item.sale.totalPaise,0),
        paidPaise:rows.reduce((sum,item)=>sum+item.paidPaise,0),balancePaise,
        oldestDue:open.map(item=>item.dueDate).sort()[0]||'',lastPayment:dates[dates.length-1]||'',
        storeNames:storeIds.length===1?storeLabel(storeIds[0],data.stores):'Multiple stores'}]
    })
  },[invoiceRows,data])
  const filtered=customers.filter(row=>
    (!query||`${row.customer.id} ${row.customer.name} ${row.customer.mobile}`.toLowerCase().includes(query.trim().toLowerCase()))&&
    (amount==='Any balance'||amount==='Over ₹10,000'&&row.balancePaise>1000000||amount==='Over ₹50,000'&&row.balancePaise>5000000))
  const sorted=[...filtered].sort((a,b)=>{
    const left=sortKey==='invoices'?a.invoiceCount:sortKey==='total'?a.totalPaise:sortKey==='paid'?a.paidPaise:sortKey==='balance'?a.balancePaise:sortKey==='oldest'?a.oldestDue:sortKey==='last'?a.lastPayment:a.customer.name
    const right=sortKey==='invoices'?b.invoiceCount:sortKey==='total'?b.totalPaise:sortKey==='paid'?b.paidPaise:sortKey==='balance'?b.balancePaise:sortKey==='oldest'?b.oldestDue:sortKey==='last'?b.lastPayment:b.customer.name
    const comparison=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right))
    return direction==='asc'?comparison:-comparison
  })
  const visible=sorted.slice(page*20,(page+1)*20)
  const totalOutstanding=customers.reduce((sum,row)=>sum+row.balancePaise,0)
  const totalCollected=customers.reduce((sum,row)=>sum+row.paidPaise,0)
  const invoiceCount=customers.reduce((sum,row)=>sum+row.invoiceCount,0)
  const activeCount=customers.length
  function sortBy(key:string){if(sortKey===key)setDirection(current=>current==='asc'?'desc':'asc');else{setSortKey(key);setDirection('desc')}setPage(0)}
  const head=(label:string,key:string)=><button type="button" className="crm-sort" onClick={()=>sortBy(key)} aria-label={`Sort by ${label}`}>{label}{sortKey===key?<span>{direction==='asc'?'↑':'↓'}</span>:<ArrowUpDown size={12}/>}</button>
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Customer receivables" title="Receivables" description="Customer balances from active shared invoices and valid payment allocations. Unallocated advances stay separate."/>
    <FinanceMetrics items={[{label:'Customers with balances',value:String(activeCount)},{label:'Open invoices',value:String(invoiceCount)},{label:'Amount collected',value:currency(totalCollected)},{label:'Outstanding receivables',value:currency(totalOutstanding)}]}/>
    <Panel title="Customer receivables directory" meta="Customer-level balances are summed from open invoice-level amounts">
      <div className="crm-toolbar finance-toolbar">
        <SearchBar label="Search customer, ID or mobile" value={query} onChange={value=>{setQuery(value);setPage(0)}}/>
        <Selector label="Invoice date range" value={range} options={financeDateRanges} onChange={value=>{setRange(value);setPage(0)}}/>
        <Selector label="Filter receivables by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>{setStore(data.stores.find(item=>item.name===value)?.id||'All stores');setPage(0)}}/>
        <Selector label="Filter by outstanding amount" value={amount} options={['Any balance','Over ₹10,000','Over ₹50,000']} onChange={value=>{setAmount(value);setPage(0)}}/>
      </div>
      {visible.length?<DataTable columns={[head('Customer','name'),'Mobile','Store',head('Invoices','invoices'),head('Invoice total','total'),head('Collected','paid'),head('Outstanding','balance'),head('Oldest unpaid','oldest'),head('Last payment','last')]} rows={visible.map(row=>[
        <button type="button" className="crm-customer-link" key={row.customer.id} onClick={()=>setDetail(row)}><b>{row.customer.name}</b><small>{row.customer.id}</small></button>,
        row.customer.mobile,row.storeNames,row.invoiceCount,currency(row.totalPaise),currency(row.paidPaise),currency(row.balancePaise),
        row.oldestDue?dateLabel(row.oldestDue):'—',row.lastPayment?dateLabel(row.lastPayment):'No payment'
      ])}/>:<EmptyState text="No customer receivables match these filters."/>}
      <div className="crm-pagination"><span>Showing {filtered.length?page*20+1:0}–{Math.min((page+1)*20,filtered.length)} of {filtered.length}</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(filtered.length/20))}</span><Button variant="outline" disabled={(page+1)*20>=filtered.length} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
    </Panel>
    <DetailDrawer open={!!detail} title={detail?.customer.name||'Customer financial summary'} onClose={()=>setDetail(null)}>
      {detail&&<><FinanceMetrics items={[{label:'Invoice count',value:String(detail.invoiceCount)},{label:'Invoiced',value:currency(detail.totalPaise)},{label:'Collected',value:currency(detail.paidPaise)},{label:'Outstanding',value:currency(detail.balancePaise)}]}/>
        <dl className="facts">{[['Customer ID',detail.customer.id],['Mobile',detail.customer.mobile],['Email',detail.customer.email||'Not recorded'],['Store scope',detail.storeNames],['Oldest unpaid invoice',detail.oldestDue?dateLabel(detail.oldestDue):'—']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <h3>Associated invoices</h3><DataTable columns={['Invoice','Date','Invoice amount','Paid','Balance','Status']} rows={detail.invoices.map(item=>[item.sale.invoiceNumber,dateLabel(item.sale.date),currency(item.sale.totalPaise),currency(item.paidPaise),currency(item.balancePaise),item.status])}/>
      </>}
    </DetailDrawer>
  </div>
}

export function InvoiceReceivables(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[status,setStatus]=useState('All statuses'),[detail,setDetail]=useState<ReturnType<typeof invoiceFinance>|null>(null)
  const records=data.sales.map(sale=>invoiceFinance(sale,data)).filter(item=>
    inDateRange(item.sale.date,range)&&(store==='All stores'||item.sale.storeId===store)&&
    (status==='All statuses'||item.status===status)&&(!query||`${item.sale.invoiceNumber} ${item.sale.customerName} ${item.sale.customerId}`.toLowerCase().includes(query.trim().toLowerCase()))
  ).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))
  const outstanding=records.filter(item=>item.status!=='Reversed').reduce((sum,item)=>sum+item.balancePaise,0)
  const overdue=records.filter(item=>item.status==='Overdue').reduce((sum,item)=>sum+item.balancePaise,0)
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Invoice balances" title="Invoice receivables" description="Open balance and due status at invoice level. Due dates are explicitly simulated from invoice date + 30 days."/>
    <FinanceMetrics items={[{label:'Invoices in view',value:String(records.length)},{label:'Active outstanding',value:currency(outstanding)},{label:'Overdue',value:currency(overdue)},{label:'Due-date basis',value:'Simulated +30 days'}]}/>
    <Panel title="Invoice-level receivables" meta="Reference date: 21 Nov 2026 · Reversed invoices are retained for history but excluded from open balances">
      <div className="crm-toolbar finance-toolbar"><SearchBar label="Search invoice or customer" value={query} onChange={setQuery}/><Selector label="Invoice date range" value={range} options={financeDateRanges} onChange={setRange}/><Selector label="Filter invoices by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/><Selector label="Filter invoice status" value={status} options={['All statuses','Paid','Partially Paid','Unpaid','Overdue','Reversed']} onChange={setStatus}/></div>
      {records.length?<DataTable columns={['Invoice','Invoice date','Customer','Store','Invoice amount','Amount paid','Balance due','Due date · simulated','Days overdue','Status']} rows={records.map(item=>[
        <button type="button" className="crm-customer-link" key={item.sale.id} onClick={()=>setDetail(item)}><b>{item.sale.invoiceNumber}</b><small>View invoice balance</small></button>,
        dateLabel(item.sale.date),item.sale.customerName,storeLabel(item.sale.storeId,data.stores),currency(item.sale.totalPaise),currency(item.paidPaise),currency(item.balancePaise),
        dateLabel(item.dueDate),item.daysOverdue||'—',<StatusBadge key={item.sale.id+'status'}>{item.status}</StatusBadge>
      ])}/>:<EmptyState text="No invoice receivables match these filters."/>}
    </Panel>
    <DetailDrawer open={!!detail} title={detail?.sale.invoiceNumber||'Invoice balance'} onClose={()=>setDetail(null)}>
      {detail&&<dl className="facts">{[['Customer',detail.sale.customerName],['Invoice amount',currency(detail.sale.totalPaise)],['Amount paid',currency(detail.paidPaise)],['Balance due',currency(detail.balancePaise)],['Due date',`${dateLabel(detail.dueDate)} · simulated`],['Days overdue',detail.daysOverdue],['Status',detail.status]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    </DetailDrawer>
  </div>
}

export function ReceivablesAging(){
  const {data}=useDemo()
  const [store,setStore]=useState('All stores'),[range,setRange]=useState('All dates')
  const open=activeInvoices(data).filter(item=>item.balancePaise>0&&inDateRange(item.sale.date,range)&&(store==='All stores'||item.sale.storeId===store))
  const buckets=['Current','1–30 days','31–60 days','61–90 days','Over 90 days']
  const stats=buckets.map(label=>{
    const records=open.filter(item=>agingBucket(item.daysOverdue)===label)
    return {label,records,amount:records.reduce((sum,item)=>sum+item.balancePaise,0),customers:new Set(records.map(item=>item.sale.customerId)).size}
  })
  const storeTotals=data.stores.map(item=>({store:item.name,records:open.filter(row=>row.sale.storeId===item.id)}))
  const customerTotals=[...new Set(open.map(item=>item.sale.customerId))].map(id=>({
    customer:data.customers.find(item=>item.id===id),
    records:open.filter(row=>row.sale.customerId===id)
  })).sort((a,b)=>b.records.reduce((sum,item)=>sum+item.balancePaise,0)-a.records.reduce((sum,item)=>sum+item.balancePaise,0)).slice(0,20)
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Aging analysis" title="Receivables aging" description="Age each unpaid balance from its simulated due date. One fixed reference date keeps buckets consistent across views."/>
    <div className="crm-toolbar finance-toolbar"><Selector label="Invoice date range" value={range} options={financeDateRanges} onChange={setRange}/><Selector label="Filter aging by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/></div>
    <div className="finance-aging-strip">{stats.map(item=><article key={item.label}><span>{item.label}</span><strong>{currency(item.amount)}</strong><small>{item.records.length} invoices · {item.customers} customers</small></article>)}</div>
    <Panel title="Store-wise aging" meta="Outstanding per store and bucket">
      {storeTotals.some(item=>item.records.length)?<DataTable columns={['Store',...buckets,'Total outstanding']} rows={storeTotals.filter(item=>item.records.length).map(item=>{
        const values=buckets.map(bucket=>item.records.filter(row=>agingBucket(row.daysOverdue)===bucket).reduce((sum,row)=>sum+row.balancePaise,0))
        return [item.store,...values.map(currency),currency(values.reduce((sum,value)=>sum+value,0))]
      })}/>:<EmptyState text="No outstanding invoices in this selection."/>}
    </Panel>
    <Panel title="Customer-wise aging" meta="Largest outstanding customers first">
      {customerTotals.length?<DataTable columns={['Customer','Invoice count',...buckets,'Total outstanding']} rows={customerTotals.map(({customer,records})=>{
        const values=buckets.map(bucket=>records.filter(row=>agingBucket(row.daysOverdue)===bucket).reduce((sum,row)=>sum+row.balancePaise,0))
        return [customer?.name||records[0].sale.customerName,records.length,...values.map(currency),currency(values.reduce((sum,value)=>sum+value,0))]
      })}/>:<EmptyState text="No customer balances to age."/>}
    </Panel>
    <p className="crm-note">A due date is not stored on these demo invoices. This view simulates one as invoice date + 30 days; aging uses 21 Nov 2026 as the fixed reference date. Reversed invoices and unallocated advances are excluded.</p>
  </div>
}
