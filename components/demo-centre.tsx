'use client'

import Link from 'next/link'
import {useState} from 'react'
import {CheckCircle2,RotateCcw,Store,ShieldCheck,ArrowRight} from 'lucide-react'
import {toast} from 'sonner'
import {useDemo} from './demo-provider'
import {useWorkspace} from './workspace'
import {Confirmation,PageHeader,StatusBadge} from './foundation'
import {roles} from '@/lib/retail'

const workflows=[
  {letter:'A',title:'Purchase to available inventory',problem:'A new receipt must increase stock and assign serials without counting the same receipt twice.',result:'Stock, serial ownership and warehouse analytics move together.',links:[
    ['Open GRN','/warehouse/grn'],['Serial scanning','/warehouse/serial-scanning'],['Stock overview','/inventory/stock-overview'],['Inventory aging','/inventory/inventory-aging']]},
  {letter:'B',title:'Inter-store stock transfer',problem:'Stock must leave only the source and arrive only after destination receipt.',result:'A transfer preserves history and cannot be received twice.',links:[
    ['Create or dispatch transfer','/inventory/transfers'],['Stock ledger','/inventory/stock-ledger'],['Serial registry','/products/serial-registry']]},
  {letter:'C',title:'Customer to sale to payment',problem:'One customer purchase must reconcile invoice, payment, stock and balances.',result:'POS, CRM, finance and sales analytics use the same invoice.',links:[
    ['POS & Billing','/sales/pos-billing'],['Customer directory','/customers/customer-directory'],['Sales history','/sales/sales-history'],['Finance dashboard','/finance/finance-dashboard']]},
  {letter:'D',title:'Sale to delivery to installation',problem:'Only delivered quantities should create installation eligibility.',result:'Delivery and installation remain linked to the invoice and serials.',links:[
    ['Delivery scheduling','/fulfilment/delivery-scheduling'],['Proof of delivery','/fulfilment/proof-of-delivery'],['Installation worklist','/after-sales/installation-worklist'],['Fulfilment analytics','/fulfilment/fulfilment-analytics']]},
  {letter:'E',title:'Warranty to service desk',problem:'Coverage must be verified against a sold serial and remain distinct from a retailer plan.',result:'Warranty certificates and service tickets preserve serial linkage.',links:[
    ['Serial registry','/products/serial-registry'],['Warranty registration','/after-sales/warranty-registration'],['Warranty directory','/after-sales/warranty-directory'],['Service tickets','/after-sales/service-tickets']]},
  {letter:'F',title:'Collections and due recovery',problem:'A payment must allocate only to valid invoice balances.',result:'Advances remain separate and collections exclude reversed activity.',links:[
    ['Collections','/finance/collections'],['Receivables','/finance/receivables'],['Due recovery','/finance/due-recovery'],['Finance analytics','/analytics/finance-collections-analytics']]},
  {letter:'G',title:'Buyback, resale and scrap',problem:'Returned products need approval, disposition and traceable serial status.',result:'Only approved resale becomes eligible; scrap cannot be sold.',links:[
    ['Buyback & Scrap','/warehouse/buyback-scrap'],['Stock overview','/inventory/stock-overview'],['Warehouse analytics','/analytics/inventory-warehouse-analytics']]}
] as const

export default function DemoCentre(){
  const {data,resetDemo}=useDemo()
  const {store,role}=useWorkspace()
  const [active,setActive]=useState(0)
  const [resetOpen,setResetOpen]=useState(false)
  const workflow=workflows[active]
  function reset(){
    try{
      resetDemo()
      setResetOpen(false)
      toast.success('Demo data reset to the known baseline')
    }catch(error){
      toast.error(error instanceof Error?error.message:'Demo reset failed')
    }
  }
  return <div className="phase demo-centre">
    <PageHeader eyebrow="Client demonstration / RetailOS" title="Demo Centre" description="Present the complete fictional retail lifecycle using live shared records."/>
    <section className="demo-command">
      <div><span className="demo-indicator"><i/>DEMO DATA</span><h2>Sharma Electronics · Delhi NCR</h2><p>Frontend-only fictional scenario · Asia/Kolkata · INR</p></div>
      <div className="demo-context"><span><Store size={15}/>{store}</span><span><ShieldCheck size={15}/>{role}</span></div>
    </section>
    <div className="demo-layout">
      <aside className="workflow-list" aria-label="Business workflows">
        {workflows.map((item,index)=><button key={item.letter} className={active===index?'active':''} onClick={()=>setActive(index)}>
          <span>{item.letter}</span><div><strong>{item.title}</strong><small>{item.result}</small></div>
        </button>)}
      </aside>
      <section className="workflow-guide">
        <div className="workflow-heading"><div><small>Workflow {workflow.letter}</small><h2>{workflow.title}</h2></div><StatusBadge>Shared state</StatusBadge></div>
        <div className="workflow-cards"><article><small>Business problem</small><p>{workflow.problem}</p></article><article><small>Demo result</small><p>{workflow.result}</p></article></div>
        <h3>Presentation sequence</h3>
        <ol className="workflow-steps">
          {workflow.links.map(([label,href],index)=><li key={href}><span>{index+1}</span><div><strong>{label}</strong><Link href={href}>Open screen <ArrowRight size={13}/></Link></div></li>)}
        </ol>
        <div className="workflow-links"><h3>Relevant screens</h3>{workflow.links.map(([label,href])=><Link key={href} href={href}>{label}<ArrowRight size={13}/></Link>)}</div>
      </section>
    </div>
    <div className="demo-data-panel">
      <div><h2>Controlled demo data</h2><p>Reset restores the known baseline for customers, products, serials, invoices, deliveries, installations, warranties and service tickets.</p></div>
      <div className="demo-counts">
        <span><strong>{data.customers.length}</strong>Customers</span><span><strong>{data.products.length}</strong>Products</span>
        <span><strong>{data.serials.length}</strong>Serials</span><span><strong>{data.sales.length}</strong>Invoices</span>
      </div>
      <button className="outlinebtn danger" onClick={()=>setResetOpen(true)}><RotateCcw size={15}/>Reset demo data</button>
    </div>
    <section className="role-demo">
      <div><h2>Role-based demonstration</h2><p>Use the profile role selector in the top navigation to demonstrate a different operating perspective. This is session-only context, not authentication or enforceable authorization.</p></div>
      <div className="role-grid">{roles.map(item=><span key={item} className={item===role?'active':''}><CheckCircle2 size={14}/>{item}</span>)}</div>
    </section>
    <Confirmation open={resetOpen} title="Reset all demo data?" text="This replaces every local demo transaction with the known baseline. It affects only this browser demo session and cannot restore later client changes." onClose={()=>setResetOpen(false)} onConfirm={reset}/>
  </div>
}
