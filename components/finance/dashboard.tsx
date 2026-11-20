'use client'
import {useMemo,useState} from 'react'
import {Area,AreaChart,Bar,BarChart,CartesianGrid,Tooltip,XAxis,YAxis} from 'recharts'
import {CalendarClock,IndianRupee,ReceiptText,Wallet} from 'lucide-react'
import {PageHeader,DataTable,EmptyState,SearchBar,Selector,StatusBadge} from '../foundation'
import {Panel} from '../analytics-controls'
import {ChartContainer} from '../ui/chart'
import {useDemo} from '../demo-provider'
import {activeInvoices,agingBucket,financeReferenceDate,inDateRange,paymentIsActive,paymentStatus,paymentStoreId,unallocatedPaise} from '@/lib/finance'
import {currency} from '@/lib/phase3-data'
import {FinanceFilters,FinanceMetrics,dateLabel,dateTimeLabel,modeGroup,storeLabel} from './shared'

const latestDate=(payments:{date:string}[])=>{const dates=payments.map(item=>item.date.slice(0,10)).sort();return dates[dates.length-1]||financeReferenceDate}
const monthLabel=(date:string)=>new Date(`${date}-01T00:00:00Z`).toLocaleDateString('en-IN',{month:'short',year:'2-digit',timeZone:'UTC'})

export function FinanceDashboard(){
  const {data}=useDemo()
  const [range,setRange]=useState('Last 30 days'),[store,setStore]=useState('All stores'),[mode,setMode]=useState('All modes'),[status,setStatus]=useState('All statuses'),[customerSearch,setCustomerSearch]=useState('')
  const allInvoices=activeInvoices(data)
  const invoices=allInvoices.filter(item=>(store==='All stores'||item.sale.storeId===store)&&inDateRange(item.sale.date,range))
  const paymentScope=data.payments.filter(payment=>paymentIsActive(payment,data)&&
    (store==='All stores'||paymentStoreId(payment,data)===store)&&(mode==='All modes'||payment.mode===mode)&&
    (status==='All statuses'||paymentStatus(payment,data)===status))
  const payments=paymentScope.filter(payment=>inDateRange(payment.date,range))
  const invoiceTotal=invoices.reduce((sum,item)=>sum+item.sale.totalPaise,0)
  const collected=payments.reduce((sum,item)=>sum+item.amountPaise,0)
  const outstanding=invoices.reduce((sum,item)=>sum+item.balancePaise,0)
  const overdue=invoices.filter(item=>item.status==='Overdue').reduce((sum,item)=>sum+item.balancePaise,0)
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date())
  const todayCollections=paymentScope.filter(payment=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date(payment.date))===today).reduce((sum,item)=>sum+item.amountPaise,0)
  const monthCollections=paymentScope.filter(payment=>payment.date.slice(0,7)===financeReferenceDate.slice(0,7)).reduce((sum,item)=>sum+item.amountPaise,0)
  const pendingAllocation=payments.reduce((sum,item)=>sum+unallocatedPaise(item,data),0)
  const dailyRows=useMemo(()=>{
    const last=latestDate(payments),days=Array.from({length:14},(_,index)=>{
      const date=new Date(`${last}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-13+index)
      return date.toISOString().slice(0,10)
    })
    return days.map(date=>({date:dateLabel(date),collections:payments.filter(payment=>payment.date.slice(0,10)===date).reduce((sum,payment)=>sum+payment.amountPaise/100,0)}))
  },[payments])
  const monthlyRows=useMemo(()=>{
    const byMonth=new Map<string,number>()
    for(const payment of payments){
      const month=payment.date.slice(0,7);byMonth.set(month,(byMonth.get(month)||0)+payment.amountPaise/100)
    }
    return [...byMonth].sort(([a],[b])=>a.localeCompare(b)).slice(-8).map(([month,amount])=>({month:monthLabel(month),collections:amount}))
  },[payments])
  const storeRows=useMemo(()=>{
    const totals=new Map<string,number>()
    payments.forEach(payment=>{const storeId=paymentStoreId(payment,data);totals.set(storeId,(totals.get(storeId)||0)+payment.amountPaise)})
    return [...totals].sort((a,b)=>b[1]-a[1]).map(([id,value])=>[storeLabel(id,data.stores),currency(value)] as [string,string])
  },[payments,data])
  const modeRows=useMemo(()=>{
    const totals=new Map<string,number>()
    payments.forEach(payment=>{const label=modeGroup(payment.mode);totals.set(label,(totals.get(label)||0)+payment.amountPaise)})
    return [...totals].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}))
  },[payments])
  const agingRows=useMemo(()=>{
    const buckets=new Map<string,number>([['Current',0],['1–30 days',0],['31–60 days',0],['61–90 days',0],['Over 90 days',0]])
    invoices.filter(item=>item.balancePaise>0)
      .forEach(item=>{const bucket=agingBucket(item.daysOverdue);buckets.set(bucket,(buckets.get(bucket)||0)+item.balancePaise)})
    return [...buckets].map(([label,value])=>({label,value}))
  },[allInvoices,store])
  const customerRows=useMemo(()=>{
    const totals=new Map<string,number>()
    invoices.filter(item=>item.balancePaise>0)
      .forEach(item=>totals.set(item.sale.customerId,(totals.get(item.sale.customerId)||0)+item.balancePaise))
    return [...totals].map(([id,value])=>({customer:data.customers.find(item=>item.id===id),id,value}))
      .filter(item=>item.customer&&(!customerSearch||`${item.customer.name} ${item.customer.mobile} ${item.id}`.toLowerCase().includes(customerSearch.toLowerCase())))
      .sort((a,b)=>b.value-a.value).slice(0,6)
  },[invoices,data.customers,customerSearch])
  const recent=[...payments].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8)
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Overview" title="Finance overview" description="Follow invoiced sales, collected payments and open receivables as separate measures. All values are fictional demo records."/>
    <FinanceFilters range={range} store={store} mode={mode} status={status} stores={data.stores} onRange={setRange} onStore={setStore} onMode={setMode} onStatus={setStatus}/>
    <FinanceMetrics items={[
      {label:'Invoiced sales',value:currency(invoiceTotal),note:'Completed invoices in the selected invoice period'},
      {label:'Collections',value:currency(collected),note:'Valid payments in the selected collection period'},
      {label:'Outstanding receivables',value:currency(outstanding),note:'Open invoice balances; advances remain unallocated'},
      {label:'Overdue receivables',value:currency(overdue),note:'Simulated 30-day due date basis'},
      {label:'Collection efficiency',value:`${invoiceTotal?((collected/invoiceTotal)*100).toFixed(1):'0.0'}%`,note:'Selected collections ÷ selected invoiced sales'},
      {label:'Today’s collections',value:currency(todayCollections),note:'Asia/Kolkata calendar day'},
      {label:'This month’s collections',value:currency(monthCollections),note:'November 2026 demo period'},
      {label:'Pending payment allocations',value:currency(pendingAllocation),note:'Customer advances not applied to invoices'}
    ]}/>
    <div className="finance-chart-grid">
      <Panel title="Daily collection trend" meta="Recorded payment dates · last 14 days in the selected scope">
        <ChartContainer config={{collections:{label:'Collections',color:'var(--chart-1)'}}} className="finance-chart">
          <AreaChart accessibilityLayer data={dailyRows} margin={{left:4,right:12,top:8,bottom:0}}>
            <defs><linearGradient id="finance-daily-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22}/><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.01}/></linearGradient></defs>
            <CartesianGrid vertical={false} strokeDasharray="3 4"/><XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24}/><YAxis tickFormatter={value=>`₹${Number(value).toLocaleString('en-IN')}`} width={74} tickLine={false} axisLine={false}/><Tooltip formatter={value=>currency(Number(value)*100)}/><Area dataKey="collections" type="monotone" stroke="var(--color-collections)" fill="url(#finance-daily-fill)" isAnimationActive={false}/>
          </AreaChart>
        </ChartContainer>
      </Panel>
      <Panel title="Monthly collection trend" meta="Payment-date totals from the canonical payment register">
        <ChartContainer config={{collections:{label:'Collections',color:'var(--chart-2)'}}} className="finance-chart">
          <BarChart accessibilityLayer data={monthlyRows} margin={{left:4,right:10,top:8,bottom:0}}>
            <CartesianGrid vertical={false} strokeDasharray="3 4"/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis tickFormatter={value=>`₹${Number(value).toLocaleString('en-IN')}`} width={74} tickLine={false} axisLine={false}/><Tooltip formatter={value=>currency(Number(value)*100)}/><Bar dataKey="collections" fill="var(--color-collections)" radius={[4,4,0,0]} isAnimationActive={false}/>
          </BarChart>
        </ChartContainer>
      </Panel>
    </div>
    <div className="reportgrid">
      <Panel title="Store-wise collections" meta="One total per valid payment record">{storeRows.length?<DataTable columns={['Store','Collected']} rows={storeRows}/>:<EmptyState text="No collection records in this selection."/>}</Panel>
      <Panel title="Payment-mode distribution" meta="Reversed payments are excluded">{modeRows.length?<div className="finance-bars">{modeRows.map(item=><div className="finance-bar-row" key={item.label}><div><span>{item.label}</span><strong>{currency(item.value)}</strong></div><progress max={Math.max(1,...modeRows.map(row=>row.value))} value={item.value}/></div>)}</div>:<EmptyState text="No collection records in this selection."/>}</Panel>
      <Panel title="Outstanding aging" meta="Reference date 21 Nov 2026 · simulated due date is invoice date + 30 days">
        <ChartContainer config={{balance:{label:'Outstanding',color:'var(--chart-3)'}}} className="finance-chart finance-chart-short">
          <BarChart accessibilityLayer data={agingRows} layout="vertical" margin={{left:10,right:14,top:4,bottom:0}}>
            <CartesianGrid horizontal={false} strokeDasharray="3 4"/><XAxis type="number" tickFormatter={value=>`₹${(Number(value)/100).toLocaleString('en-IN')}`} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="label" width={94} tickLine={false} axisLine={false}/><Tooltip formatter={value=>currency(Number(value))}/><Bar dataKey="value" fill="var(--color-balance)" radius={[0,4,4,0]} isAnimationActive={false}/>
          </BarChart>
        </ChartContainer>
      </Panel>
      <Panel title="Customers by outstanding" meta="Largest active balances across selected stores" action={<SearchBar label="Search outstanding customers" value={customerSearch} onChange={setCustomerSearch}/>}>
        {customerRows.length?<DataTable columns={['Customer','Outstanding']} rows={customerRows.map(({customer,id,value})=>[<span key={id}>{customer?.name}<small className="p4-sub">{id} · {customer?.mobile}</small></span>,currency(value)])}/>:<EmptyState text="No outstanding customers match this search."/>}
      </Panel>
      <Panel title="Recent collection activity" meta="Payment records sorted by date">
        {recent.length?<DataTable columns={['Reference','Customer','Date','Mode','Amount','Status']} rows={recent.map(payment=>[
          payment.reference||payment.id,data.customers.find(item=>item.id===payment.customerId)?.name||payment.customerId,dateTimeLabel(payment.date),payment.mode,currency(payment.amountPaise),
          <StatusBadge key={payment.id}>{paymentStatus(payment,data)}</StatusBadge>
        ])}/>:<EmptyState text="No payment activity in this selection."/>}
      </Panel>
      <Panel title="How to read this view" meta="Prototype calculation notes">
        <div className="finance-explainer"><p><ReceiptText size={15}/> Invoiced sales use active completed invoices dated in the selected range.</p><p><Wallet size={15}/> Collections use each valid payment once, by its recorded payment date.</p><p><CalendarClock size={15}/> Outstanding and aging come from invoice allocations; unallocated advances do not reduce balances.</p><p><IndianRupee size={15}/> Aging uses a single fixed reference date and simulated due dates. These are not accounting figures.</p></div>
      </Panel>
    </div>
  </div>
}
