'use client'
import {useMemo,useState} from 'react'
import {Bar,BarChart,CartesianGrid,Line,LineChart,Tooltip,XAxis,YAxis} from 'recharts'
import {AlertTriangle,CalendarDays,PackageCheck,Truck} from 'lucide-react'
import {PageHeader,DataTable,EmptyState,Selector,StatusBadge} from '../foundation'
import {Panel} from '../analytics-controls'
import {ChartContainer} from '../ui/chart'
import {useDemo} from '../demo-provider'
import {demoDateToday,deliveryStoreLabel,isDeliveryComplete,localDateTime} from '@/lib/fulfilment'
import {DeliveryDetailDrawer} from './shared'
import type {Delivery} from '@/lib/phase6-types'

const reference='2026-11-21'
const ranges=['All dates','Last 7 days','Last 30 days','Last 90 days']
function withinRange(value:string,range:string){
  if(range==='All dates'||!value)return true
  const days=Number(range.match(/\d+/)?.[0]||0)
  const date=new Date(`${value.slice(0,10)}T12:00:00+05:30`).getTime()
  const end=new Date(`${reference}T23:59:59+05:30`).getTime()
  return date<=end&&date>=end-days*86400000
}

export function DeliveryDashboard(){
  const {data}=useDemo()
  const [range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[status,setStatus]=useState('All statuses'),[team,setTeam]=useState('All teams'),[priority,setPriority]=useState('All priorities'),[selected,setSelected]=useState<Delivery|null>(null)
  const filtered=data.deliveries.filter(order=>
    withinRange(order.scheduledDate||order.createdAt,range)&&
    (store==='All stores'||order.storeId===store)&&
    (status==='All statuses'||order.status===status)&&
    (team==='All teams'||order.deliveryTeamId===team)&&
    (priority==='All priorities'||order.priority===priority))
  const count=(key:Delivery['status'])=>filtered.filter(item=>item.status===key).length
  const delayed=filtered.filter(item=>item.scheduledDate&&item.scheduledDate<reference&&!isDeliveryComplete(item)&&item.status!=='Cancelled').length
  const metrics=[
    {label:'Delivery orders',value:filtered.length,icon:Truck},
    {label:'Pending scheduling',value:filtered.filter(item=>!item.scheduledDate&&item.status==='Pending').length,icon:CalendarDays},
    {label:'Scheduled',value:count('Scheduled')+count('Rescheduled'),icon:CalendarDays},
    {label:'Ready for dispatch',value:count('Ready for Dispatch'),icon:PackageCheck},
    {label:'Dispatched',value:count('Dispatched'),icon:Truck},
    {label:'In transit',value:count('In Transit')+count('Out for Delivery'),icon:Truck},
    {label:'Delivered',value:count('Delivered'),icon:PackageCheck},
    {label:'Failed',value:count('Failed'),icon:AlertTriangle},
    {label:'Delayed',value:delayed,icon:AlertTriangle}
  ]
  const daily=useMemo(()=>{
    const dates=filtered.map(item=>item.scheduledDate||item.createdAt.slice(0,10)).filter(Boolean).sort()
    const latest=dates[dates.length-1]||reference
    return Array.from({length:7},(_,index)=>{
      const date=new Date(`${latest}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-6+index)
      const key=date.toISOString().slice(0,10)
      return {day:new Intl.DateTimeFormat('en-IN',{timeZone:'UTC',day:'2-digit',month:'short'}).format(date),
        orders:filtered.filter(item=>(item.scheduledDate||item.createdAt.slice(0,10))===key).length}
    })
  },[filtered])
  const byStore=useMemo(()=>{
    const records=new Map<string,{orders:number;delivered:number;failed:number}>()
    filtered.forEach(order=>{const row=records.get(order.storeId)||{orders:0,delivered:0,failed:0};row.orders++;if(isDeliveryComplete(order))row.delivered++;if(order.status==='Failed')row.failed++;records.set(order.storeId,row)})
    return [...records].map(([storeId,row])=>({store:deliveryStoreLabel(storeId,data),...row,rate:row.orders?Math.round(row.delivered/row.orders*100):0})).sort((a,b)=>b.orders-a.orders)
  },[filtered,data])
  const byStatus=useMemo(()=>['Pending','Scheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery','Delivered','Failed','Rescheduled','Cancelled']
    .map(label=>({label,count:filtered.filter(item=>item.status===label).length})).filter(item=>item.count>0),[filtered])
  const byTeam=useMemo(()=>data.deliveryTeams.map(item=>({team:item.name,orders:filtered.filter(order=>order.deliveryTeamId===item.id).length,
    delivered:filtered.filter(order=>order.deliveryTeamId===item.id&&isDeliveryComplete(order)).length})).sort((a,b)=>b.delivered-a.delivered),[data.deliveryTeams,filtered])
  const recent=[...data.deliveryActivities].filter(activity=>filtered.some(order=>order.id===activity.deliveryId)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7)
  const alerts=filtered.filter(item=>item.status==='Failed'||(item.scheduledDate&&item.scheduledDate<reference&&!isDeliveryComplete(item)&&item.status!=='Cancelled'))
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Operations" title="Delivery dashboard" description="A store-to-door view of the demo delivery book. Dispatch, delivery and stock movement are recorded as separate events."/>
    <div className="p6-filters">
      <Selector label="Delivery date range" value={range} options={ranges} onChange={setRange}/>
      <Selector label="Filter by store" value={store==='All stores'?'All stores':deliveryStoreLabel(store,data)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/>
      <Selector label="Filter by delivery status" value={status} options={['All statuses','Pending','Scheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery','Delivered','Failed','Rescheduled','Cancelled']} onChange={setStatus}/>
      <Selector label="Filter by delivery team" value={team==='All teams'?'All teams':data.deliveryTeams.find(item=>item.id===team)?.name||team} options={['All teams',...data.deliveryTeams.map(item=>item.name)]} onChange={value=>setTeam(data.deliveryTeams.find(item=>item.name===value)?.id||'All teams')}/>
      <Selector label="Filter by priority" value={priority} options={['All priorities','Standard','High','Urgent']} onChange={setPriority}/>
    </div>
    <div className="p6-metrics">{metrics.map(({label,value,icon:Icon})=><article key={label}><span><Icon size={16}/>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="p6-chart-grid">
      <Panel title="Delivery activity" meta="Orders scheduled or created by day in the selected scope">
        <ChartContainer config={{orders:{label:'Orders',color:'var(--chart-1)'}}} className="finance-chart">
          <LineChart accessibilityLayer data={daily} margin={{left:4,right:12,top:8,bottom:0}}><CartesianGrid vertical={false} strokeDasharray="3 4"/><XAxis dataKey="day" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} width={34} tickLine={false} axisLine={false}/><Tooltip/><Line dataKey="orders" type="monotone" stroke="var(--color-orders)" strokeWidth={2} dot={{r:3}} isAnimationActive={false}/></LineChart>
        </ChartContainer>
      </Panel>
      <Panel title="Delivery status" meta="Current order state; each delivery appears once">
        {byStatus.length?<ChartContainer config={{count:{label:'Orders',color:'var(--chart-2)'}}} className="finance-chart">
          <BarChart accessibilityLayer data={byStatus} layout="vertical" margin={{left:4,right:12,top:8,bottom:0}}><CartesianGrid horizontal={false} strokeDasharray="3 4"/><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="label" width={114} tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="count" fill="var(--color-count)" radius={[0,4,4,0]} isAnimationActive={false}/></BarChart>
        </ChartContainer>:<EmptyState text="No delivery orders match these filters."/>}
      </Panel>
    </div>
    <div className="p6-report-grid">
      <Panel title="Store performance" meta="Delivered orders ÷ all visible orders">
        {byStore.length?<DataTable columns={['Store','Orders','Delivered','Completion']} rows={byStore.map(item=>[item.store,item.orders,item.delivered,`${item.rate}%`])}/>:<EmptyState text="No store delivery records in this selection."/>}
        <p className="p6-caption">Completion is delivered orders ÷ visible orders. Punctuality requires scheduled and delivered timestamps.</p>
      </Panel>
      <Panel title="Delivery team" meta="Current assignments and completed orders">
        {byTeam.length?<DataTable columns={['Team','Assigned orders','Delivered']} rows={byTeam.map(item=>[item.team,item.orders,item.delivered])}/>:<EmptyState text="No team records."/>}
      </Panel>
      <Panel title="Operational alerts" meta="Failed and overdue demo deliveries">
        {alerts.length?<DataTable columns={['Delivery','Store','Issue','Scheduled']} rows={alerts.map(order=>[
          <button className="crm-customer-link" key={order.id} onClick={()=>setSelected(order)}><b>{order.orderNumber}</b><small>{order.status}</small></button>,
          deliveryStoreLabel(order.storeId,data),order.status==='Failed'?'Failed delivery':'Schedule is past due',order.scheduledDate||'—'
        ])}/>:<EmptyState text="No failed or overdue deliveries in this selection."/>}
      </Panel>
      <Panel title="Recent delivery activity" meta="Latest events from the fulfilment log">
        {recent.length?<DataTable columns={['Activity','Delivery','When','By']} rows={recent.map(activity=>[
          <StatusBadge key={activity.id}>{activity.type}</StatusBadge>,data.deliveries.find(order=>order.id===activity.deliveryId)?.orderNumber||activity.deliveryId,localDateTime(activity.date),activity.actor
        ])}/>:<EmptyState text="No recent delivery activity in this selection."/>}
      </Panel>
    </div>
    <DeliveryDetailDrawer order={selected} open={!!selected} onClose={()=>setSelected(null)}/>
  </div>
}
