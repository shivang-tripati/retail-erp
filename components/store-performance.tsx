'use client'

import {useState} from 'react'
import {PageHeader,DataTable,DetailDrawer,SearchBar,Selector,EmptyState} from './foundation'
import {Panel,ScopeBar,useScope} from './analytics-controls'
import {useDemo} from './demo-provider'
import {storeAnalytics} from '@/lib/phase8-analytics'
import {compact,money,pct} from '@/lib/demo-data'

export default function Performance(){
  const {scope,set}=useScope(),{data}=useDemo()
  const [search,q]=useState('')
  const [sort,setSort]=useState('Highest sales')
  const [id,open]=useState('')
  const rows=storeAnalytics(data,scope).filter(row=>`${row.store.name} ${row.store.city}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      if(sort==='Store A–Z')return a.store.name.localeCompare(b.store.name)
      if(sort==='Highest collections')return b.collectionsPaise-a.collectionsPaise
      if(sort==='Lowest outstanding')return a.outstandingPaise-b.outstandingPaise
      if(sort==='Highest delivery')return b.deliveryCompletionPct-a.deliveryCompletionPct
      return b.netPaise-a.netPaise
    })
  const item=rows.find(row=>row.store.id===id)
  const rupees=(paise:number)=>paise/100
  return <div className="phase">
    <PageHeader eyebrow="Analytics / Branch intelligence" title="Store performance" description="Compare connected sales, finance, inventory, delivery and after-sales results."/>
    <ScopeBar scope={scope} set={set}/>
    <Panel title="Branch comparison" meta={`${rows.length} stores · Select a branch for its performance`}>
      <div className="filters">
        <SearchBar label="Search store or city" value={search} onChange={q}/>
        <Selector label="Sort stores" value={sort} onChange={setSort} options={['Highest sales','Highest collections','Lowest outstanding','Highest delivery','Store A–Z']}/>
      </div>
      {rows.length?<DataTable columns={['Store','City','Sales','Invoices','A bill','Collections','Outstanding','Reversals','Inventory','Delivery','Installation','Tickets']} rows={rows.map(row=>[
        <button className="textlink" key={row.store.id} onClick={()=>open(row.store.id)}>{row.store.name}</button>,
        row.store.city,compact(rupees(row.netPaise)),row.invoiceCount,compact(rupees(row.averageBillPaise)),
        compact(rupees(row.collectionsPaise)),compact(rupees(row.outstandingPaise)),row.reversals,
        compact(rupees(row.inventoryValuePaise)),pct(row.deliveryCompletionPct),pct(row.installationCompletionPct),row.serviceTickets
      ])}/>:<EmptyState text="No stores match this selection."/>}
    </Panel>
    <DetailDrawer title={item?.store.name||'Store performance'} open={!!item} onClose={()=>open('')}>
      {item&&<dl className="facts">
        <div><dt>Net sales</dt><dd>{compact(rupees(item.netPaise))}</dd></div>
        <div><dt>Invoice count</dt><dd>{item.invoiceCount}</dd></div>
        <div><dt>Average bill</dt><dd>{compact(rupees(item.averageBillPaise))}</dd></div>
        <div><dt>Collections</dt><dd>{compact(rupees(item.collectionsPaise))}</dd></div>
        <div><dt>Outstanding</dt><dd>{compact(rupees(item.outstandingPaise))}</dd></div>
        <div><dt>Reversed invoices</dt><dd>{item.reversals}</dd></div>
        <div><dt>Inventory value</dt><dd>{compact(rupees(item.inventoryValuePaise))}</dd></div>
        <div><dt>Delivery completion</dt><dd>{pct(item.deliveryCompletionPct)}</dd></div>
        <div><dt>Installation completion</dt><dd>{pct(item.installationCompletionPct)}</dd></div>
        <div><dt>Service tickets</dt><dd>{item.serviceTickets}</dd></div>
      </dl>}
    </DetailDrawer>
  </div>
}
