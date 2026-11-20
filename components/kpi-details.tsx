'use client'
import {PageHeader,DataTable} from './foundation'
import {ScopeBar,useScope,Panel} from './analytics-controls'
import {SalesTrend} from './sales-trend'
import {money,pct} from '@/lib/demo-data'
import {financeAnalytics,financeChange} from '@/lib/finance-analytics'
import {useDemo} from './demo-provider'

export default function Kpis(){
  const {scope,set}=useScope(),{data}=useDemo(),days=scope.days
  const current=financeAnalytics(scope,0,data),previous=financeAnalytics(scope,days,data),older=financeAnalytics(scope,days*2,data)
  const s=current.stats,p=previous.stats,pp=older.stats
  const growth=financeChange(s.net,p.net),previousGrowth=financeChange(p.net,pp.net)
  const items=[
    ['Gross sales','gross',money,'Before invoice discounts'],
    ['Net sales','net',money,'After invoice discounts'],
    ['Invoice count','count',(value:number)=>value.toLocaleString('en-IN'),'Active invoices in the period'],
    ['Average bill value','avg',money,'Net sales ÷ invoices'],
    ['Collection efficiency','eff',pct,'Recorded collections ÷ net sales'],
    ['Outstanding receivables','out',money,'Open active invoice balances'],
    ['Inventory turnover','turn',(value:number)=>value.toFixed(2)+'×','Cost of sales ÷ average inventory'],
    ['Delivery completion','delivery',pct,'Completed deliveries ÷ invoices'],
    ['Installation completion','install',pct,'Completed ÷ required installations']
  ] as const
  return <div className="phase">
    <PageHeader eyebrow="Analytics / Measurement" title="KPI details" description="Illustrative calculations from fictional invoice, payment and inventory records. These are not accounting or operational figures."/>
    <ScopeBar scope={scope} set={set}/>
    <SalesTrend current={current.rows} previous={previous.rows} days={days}/>
    <Panel title="Performance measures" meta={`Current ${days} days compared with the previous ${days} days. Payment collections follow recorded payment dates; balances follow invoice allocations.`}>
      <DataTable columns={['Measure','Current period','Previous period','Change','Calculation']} rows={[
        ['Sales growth',growth===null?'—':pct(growth),previousGrowth===null?'—':pct(previousGrowth),growth!==null&&previousGrowth!==null?`${(growth-previousGrowth).toFixed(1)} pp`:'—','Net sales change from preceding period'],
        ...items.map(([label,key,format,description])=>{
          const change=financeChange(s[key],p[key])
          return [label,format(s[key]),format(p[key]),change===null?'—':`${change>0?'+':''}${pct(change)}`,description]
        })
      ]}/>
      <p className="crm-note">Invoiced sales, collected payments and outstanding receivables are separate values. Payment allocations use integer paise. Due dates and aging are simulated from the invoice date; tax and operational ratios require professional validation before production use.</p>
    </Panel>
  </div>
}
