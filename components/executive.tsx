'use client'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Wallet,Receipt,IndianRupee,Banknote,Clock3,Users,Package,Truck,ArrowUpRight,CalendarDays} from 'lucide-react'
import {KpiCard,DataTable,EmptyState,StatusBadge} from './foundation'
import {Panel,ScopeBar,useScope} from './analytics-controls'
import {SalesTrend} from './sales-trend'
import {useDemo} from './demo-provider'
import {compact,money,dateLabel,pct} from '@/lib/demo-data'
import {financeAnalytics,financeChange} from '@/lib/finance-analytics'
import type {Invoice} from '@/lib/demo-data'

function rank(rows:Invoice[],key:'store'|'brand'|'category'){
  const totals=new Map<string,number>()
  rows.forEach(row=>totals.set(row[key],(totals.get(row[key])||0)+row.net))
  return [...totals].sort((a,b)=>b[1]-a[1])
}
function Bars({rows}:{rows:[string,number][]}){
  return <div className="ranklist">{rows.length?rows.map(([name,value],index)=><div className="rankrow" key={name}><div><span>{name}</span><b>{compact(value)}</b></div><progress aria-label={name} value={value} max={rows[0][1]||1} style={{opacity:1-index*.04}}/></div>):<EmptyState text="No activity in this selection."/>}</div>
}

export default function Executive(){
  const {scope,set}=useScope(),{data}=useDemo(),router=useRouter()
  const current=financeAnalytics(scope,0,data),previous=financeAnalytics(scope,scope.days,data)
  const rows=current.rows,prior=previous.rows,s=current.stats,p=previous.stats
  const inventoryValue=data.inventory.reduce((total,row)=>{
    const product=data.products.find(item=>item.id===row.productId)
    if(!product||scope.store&&row.storeId!==scope.store||scope.brand&&product.brandId!==scope.brand||scope.category&&product.category!==scope.category)return total
    return total+row.quantity*product.purchasePricePaise/100
  },0)
  const store=(id:string)=>data.stores.find(item=>item.id===id)?.name||id
  const brand=(id:string)=>data.brands.find(item=>item.id===id)?.name||id
  const definitions=[
    ['Total sales','net',Wallet,'blue'],['Invoices','count',Receipt,'violet'],['Average bill value','avg',IndianRupee,'amber'],
    ['Total collections','paid',Banknote,'teal'],['Outstanding receivables','out',Clock3,'amber'],
    ['Active customers','customers',Users,'violet'],['Inventory value','stock',Package,'blue'],['Pending deliveries','pending',Truck,'teal']
  ] as const
  const cards=definitions.map(([label,key,icon,color])=>{
    const inventory=key==='stock',value=inventory?inventoryValue:s[key],delta=inventory?null:financeChange(s[key],p[key])
    return <KpiCard key={key} label={label} icon={icon} color={color} value={['count','customers','pending'].includes(key)?value.toLocaleString('en-IN'):compact(value)}
      note={inventory?'On-hand stock at purchase cost · current demo':delta===null?'No prior baseline':`${delta>=0?'+':''}${pct(delta)} vs previous period`}
      onClick={()=>router.push('/analytics/executive-kpis')}/>
  })
  const alerts=data.alerts.filter(item=>item.status!=='Resolved'&&item.age<scope.days&&(!scope.store||item.store===scope.store)&&
    (!scope.brand||item.brand===scope.brand)&&(!scope.category||item.category===scope.category))
  const paymentModeRows=current.paymentModes.slice(0,6).map(([name,value])=>[name,value] as [string,number])
  return <div className="phase">
    <section className="hero executive-hero"><div className="herotext"><div className="heroeyebrow"><i/> EXECUTIVE INTELLIGENCE</div><h1>Executive dashboard</h1><p>{data.settings.Company} · Multi-store performance overview</p></div><div className="blueprint" aria-hidden="true"/><small className="fig">FIG. 02 &nbsp;/&nbsp; EXECUTIVE VIEW</small></section>
    <ScopeBar scope={scope} set={set}/>
    <div className="sectionheading"><div><h2>Financial overview</h2></div><span className="scope"><CalendarDays size={13}/> Period comparison</span></div>
    <div className="metrics">{cards.slice(0,4)}</div>
    <div className="reportgrid widefirst">
      <SalesTrend current={rows} previous={prior} days={scope.days}/>
      <Panel title="Top-performing stores" meta="Ranked by net sales" action={<Link aria-label="View store performance" href="/analytics/store-performance"><ArrowUpRight size={17}/></Link>}>
        <Bars rows={rank(rows,'store').slice(0,5).map(([id,value])=>[store(id),value])}/>
      </Panel>
    </div>
    <div className="sectionheading"><h2>Operational snapshot</h2></div>
    <div className="metrics">{cards.slice(4)}</div>
    <div className="reportgrid">
      <Panel title="Sales by category" meta="Net revenue by product family"><Bars rows={rank(rows,'category')}/></Panel>
      <Panel title="Payment modes" meta="Canonical payment records plus historical summary invoices"><Bars rows={paymentModeRows}/></Panel>
      <Panel title="Top-selling brands" meta="Leading five brands by sales"><Bars rows={rank(rows,'brand').slice(0,5).map(([id,value])=>[brand(id),value])}/></Panel>
      <Panel title="Store-wise comparison" meta="All matching branches"><Bars rows={rank(rows,'store').map(([id,value])=>[store(id),value])}/></Panel>
      <Panel title="Recent transactions" meta="Latest invoices in the selected period">
        {rows.length?<DataTable columns={['Invoice','Date','Store','Net sales']} rows={rows.slice(0,6).map(item=>[item.id,dateLabel(item.age),store(item.store),money(item.net)])}/>:<EmptyState text="No matching invoices."/>}
      </Panel>
      <Panel title="Operational alerts" meta={`${alerts.length} unresolved in scope`} action={<Link href="/analytics/alerts-notifications" className="textlink">View all →</Link>}>
        {alerts.length?<DataTable columns={['Issue','Store','Severity']} rows={alerts.slice(0,6).map(item=>[item.type,store(item.store),<StatusBadge key={item.id}>{item.severity}</StatusBadge>])}/>:<EmptyState text="No unresolved issues in this selection."/>}
      </Panel>
    </div>
  </div>
}
