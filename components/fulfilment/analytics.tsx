'use client'
import {useMemo,useState} from 'react'
import {Bar,BarChart,CartesianGrid,Tooltip,XAxis,YAxis} from 'recharts'
import {ChartContainer} from '../ui/chart'
import {PageHeader,DataTable,EmptyState,Selector,StatusBadge} from '../foundation'
import {Panel} from '../analytics-controls'
import {useDemo} from '../demo-provider'
import {deliveryStoreLabel,isDeliveryComplete,localDateTime} from '@/lib/fulfilment'
import type {Delivery} from '@/lib/phase6-types'

const reference='2026-11-21'
const rangeOptions=['All dates','Last 7 days','Last 30 days','Last 90 days']
function inRange(order:Delivery,range:string){
  if(range==='All dates')return true
  const days=Number(range.match(/\d+/)?.[0]||0),key=(order.scheduledDate||order.createdAt).slice(0,10)
  const date=new Date(`${key}T12:00:00+05:30`).getTime(),end=new Date(`${reference}T23:59:59+05:30`).getTime()
  return date<=end&&date>=end-days*86400000
}
function completedAt(order:Delivery,data:ReturnType<typeof useDemo>['data']){
  return data.deliveryActivities.filter(item=>item.deliveryId===order.id&&item.type==='Delivery completed').sort((a,b)=>a.date.localeCompare(b.date))[0]?.date||''
}
function dispatchedAt(order:Delivery,data:ReturnType<typeof useDemo>['data']){
  return order.dispatchedAt||data.deliveryActivities.filter(item=>item.deliveryId===order.id&&item.type==='Dispatched').sort((a,b)=>a.date.localeCompare(b.date))[0]?.date||''
}

export function FulfilmentAnalytics(){
  const {data}=useDemo()
  const [range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[team,setTeam]=useState('All teams')
  const orders=data.deliveries.filter(order=>inRange(order,range)&&(store==='All stores'||order.storeId===store)&&(team==='All teams'||order.deliveryTeamId===team)&&order.status!=='Cancelled')
  const delivered=orders.filter(isDeliveryComplete)
  const onTime=delivered.filter(order=>order.scheduledDate&&completedAt(order,data)&&completedAt(order,data).slice(0,10)<=order.scheduledDate)
  const onTimeEligible=delivered.filter(order=>order.scheduledDate&&completedAt(order,data))
  const elapsed=delivered.flatMap(order=>{
    const start=dispatchedAt(order,data),end=completedAt(order,data)
    if(!start||!end)return []
    const hours=(new Date(end).getTime()-new Date(start).getTime())/3600000
    return hours>=0?[hours]:[]
  })
  const failureEligible=orders.filter(order=>order.status==='Failed'||order.dispatchedAt)
  const failed=orders.filter(order=>order.status==='Failed').length
  const pending=orders.filter(order=>!isDeliveryComplete(order)&&order.status!=='Failed').length
  const exceptionCount=data.deliveryExceptions.filter(exception=>orders.some(order=>order.id===exception.deliveryId)).length
  const metrics=[
    {label:'On-time delivery',value:`${onTimeEligible.length?Math.round(onTime.length/onTimeEligible.length*100):0}%`,note:`${onTime.length} of ${onTimeEligible.length} delivered orders with schedule dates`},
    {label:'Average delivery time',value:elapsed.length?`${(elapsed.reduce((sum,value)=>sum+value,0)/elapsed.length).toFixed(1)} h`:'—',note:'Dispatch timestamp to full completion activity'},
    {label:'Failed delivery rate',value:`${failureEligible.length?Math.round(failed/failureEligible.length*100):0}%`,note:`${failed} failed of ${failureEligible.length} attempted or failed`},
    {label:'Pending deliveries',value:String(pending),note:'Not fully delivered; cancelled orders excluded'},
    {label:'Exception frequency',value:orders.length?`${(exceptionCount/orders.length).toFixed(2)}`:'0.00',note:'Recorded exceptions per visible order'},
    {label:'Completed deliveries',value:String(delivered.length),note:'All item quantities delivered'}
  ]
  const storeRows=useMemo(()=>{
    const ids=[...new Set(orders.map(order=>order.storeId))]
    return ids.map(id=>{
      const rows=orders.filter(order=>order.storeId===id),done=rows.filter(isDeliveryComplete)
      const valid=done.filter(order=>order.scheduledDate&&completedAt(order,data))
      const punctual=valid.filter(order=>completedAt(order,data).slice(0,10)<=order.scheduledDate)
      return {store:deliveryStoreLabel(id,data),orders:rows.length,delivered:done.length,onTime:valid.length?`${Math.round(punctual.length/valid.length*100)}%`:'—',
        failed:rows.filter(order=>order.status==='Failed').length}
    }).sort((a,b)=>b.orders-a.orders)
  },[orders,data])
  const teamRows=useMemo(()=>data.deliveryTeams.filter(item=>team==='All teams'||item.id===team).map(item=>{
    const rows=orders.filter(order=>order.deliveryTeamId===item.id),done=rows.filter(isDeliveryComplete)
    return {name:item.name,orders:rows.length,delivered:done.length,failed:rows.filter(order=>order.status==='Failed').length}
  }).sort((a,b)=>b.delivered-a.delivered),[data.deliveryTeams,orders,team])
  const trend=useMemo(()=>['Pending','Scheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery','Delivered','Failed'].map(status=>({status,count:orders.filter(order=>order.status===status).length})).filter(row=>row.count),[orders])
  const activityRows=data.deliveryActivities.filter(activity=>orders.some(order=>order.id===activity.deliveryId)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8)
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Analytics" title="Fulfilment analytics" description="Operational measures are calculated from delivery orders and their timestamped activity history; figures are fictional prototype indicators."/>
    <div className="p6-filters">
      <Selector label="Delivery date range" value={range} options={rangeOptions} onChange={setRange}/>
      <Selector label="Filter by store" value={store==='All stores'?'All stores':deliveryStoreLabel(store,data)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/>
      <Selector label="Filter by delivery team" value={team==='All teams'?'All teams':data.deliveryTeams.find(item=>item.id===team)?.name||team} options={['All teams',...data.deliveryTeams.map(item=>item.name)]} onChange={value=>setTeam(data.deliveryTeams.find(item=>item.name===value)?.id||'All teams')}/>
    </div>
    <div className="p6-metrics p6-analytics-metrics">{metrics.map(item=><article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</div>
    <div className="p6-chart-grid">
      <Panel title="Current delivery pipeline" meta="Count by current status; each order appears once">
        {trend.length?<ChartContainer config={{count:{label:'Orders',color:'var(--chart-1)'}}} className="finance-chart">
          <BarChart accessibilityLayer data={trend} layout="vertical" margin={{left:4,right:12,top:8,bottom:0}}><CartesianGrid horizontal={false} strokeDasharray="3 4"/><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="status" width={130} tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="count" fill="var(--color-count)" radius={[0,4,4,0]} isAnimationActive={false}/></BarChart>
        </ChartContainer>:<EmptyState text="No delivery records match this period."/>}
      </Panel>
      <Panel title="Calculation notes" meta="Consistent rules for this demo report">
        <div className="p6-calculation-notes">
          <p><b>On-time delivery</b> = fully delivered orders with both schedule and completion activity, completed on or before the scheduled date.</p>
          <p><b>Average delivery time</b> = elapsed hours between the first dispatch timestamp and full completion activity; missing or negative intervals are excluded.</p>
          <p><b>Failed delivery rate</b> = currently failed orders ÷ orders failed or dispatched in this scope.</p>
          <p><b>Pending</b> = active orders that are not fully delivered and are not currently marked failed. Reversed/cancelled orders are excluded.</p>
          <p>These are prototype indicators, not a logistics SLA, live tracking feed or carrier report.</p>
        </div>
      </Panel>
    </div>
    <div className="p6-report-grid">
      <Panel title="Store performance" meta="Completion and punctuality use recorded order activity">
        {storeRows.length?<DataTable columns={['Store','Orders','Delivered','On time','Failed']} rows={storeRows.map(item=>[item.store,item.orders,item.delivered,item.onTime,item.failed])}/>:<EmptyState text="No store performance data."/>}
      </Panel>
      <Panel title="Delivery team performance" meta="Assigned orders, completed and failed">
        {teamRows.length?<DataTable columns={['Team','Orders','Delivered','Failed']} rows={teamRows.map(item=>[item.name,item.orders,item.delivered,item.failed])}/>:<EmptyState text="No team performance data."/>}
      </Panel>
      <Panel title="Exception activity" meta="Latest entries tied to visible deliveries">
        {activityRows.length?<DataTable columns={['Activity','Delivery','Recorded at','By']} rows={activityRows.map(item=>[<StatusBadge key={item.id}>{item.type}</StatusBadge>,orders.find(order=>order.id===item.deliveryId)?.orderNumber||item.deliveryId,localDateTime(item.date),item.actor])}/>:<EmptyState text="No delivery activity in this scope."/>}
      </Panel>
    </div>
  </div>
}
