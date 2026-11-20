'use client'
import {useMemo,useState,type FormEvent} from 'react'
import {toast} from 'sonner'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector,StatusBadge} from '../foundation'
import {Panel} from '../analytics-controls'
import {Button} from '../ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '../ui/dialog'
import {useDemo} from '../demo-provider'
import {allocatedPaise,allocationsForPayment,inDateRange,invoiceFinance,invoicePaymentHistory,latestReconciliation,paymentIsActive,paymentStatus,paymentStoreId,paymentSnapshot,unallocatedPaise} from '@/lib/finance'
import type {Payment,Sale} from '@/lib/phase3-data'
import type {PaymentReconciliation,ReconciliationStatus} from '@/lib/finance-types'
import {currency} from '@/lib/phase3-data'
import {FinanceMetrics,dateLabel,dateTimeLabel,financeDateRanges,makeFinanceId,modeGroup,storeLabel} from './shared'

const pageSize=25
const statusClass=(status:string)=>status==='Paid'||status==='Matched'?'Active':status==='Reversed'||status==='Needs review'||status==='Overdue'?'High':'Medium'

export function PaymentAnalysis(){
  const {data,transact}=useDemo()
  const [query,setQuery]=useState(''),[range,setRange]=useState('Last 30 days'),[store,setStore]=useState('All stores'),[mode,setMode]=useState('All modes'),[status,setStatus]=useState('All statuses'),[page,setPage]=useState(0)
  const [reverseTarget,setReverseTarget]=useState<Payment|null>(null),[reason,setReason]=useState(''),[error,setError]=useState('')
  const filtered=useMemo(()=>data.payments.filter(payment=>{
    const customer=data.customers.find(item=>item.id===payment.customerId)
    const invoice=data.sales.find(item=>item.invoiceNumber===payment.invoiceId)
    return inDateRange(payment.date,range)&&(store==='All stores'||paymentStoreId(payment,data)===store)&&
      (mode==='All modes'||payment.mode===mode)&&(status==='All statuses'||paymentStatus(payment,data)===status)&&
      (!query||`${payment.reference} ${payment.invoiceId} ${customer?.name||''} ${customer?.mobile||''} ${payment.mode} ${payment.collectedBy||invoice?.salesperson||''}`.toLowerCase().includes(query.trim().toLowerCase()))
  }).sort((a,b)=>b.date.localeCompare(a.date)),[data,range,store,mode,status,query])
  const active=filtered.filter(payment=>paymentIsActive(payment,data))
  const total=active.reduce((sum,payment)=>sum+payment.amountPaise,0)
  const modes=['Cash','UPI','Debit/Credit Card','Bank Transfer','Financing / EMI'].map(label=>({label,value:active.filter(payment=>modeGroup(payment.mode)===label||label==='Debit/Credit Card'&&modeGroup(payment.mode)==='Card').reduce((sum,payment)=>sum+payment.amountPaise,0)}))
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize)
  function reverse(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!reverseTarget)return
    const clean=reason.trim()
    if(clean.length<8){setError('Enter a reversal reason with at least eight characters.');return}
    try{
      transact(current=>{
        const payment=current.payments.find(item=>item.id===reverseTarget.id)
        if(!payment||current.paymentReversals.some(item=>item.paymentId===payment.id))throw new Error('This payment was already reversed or is no longer available.')
        const now=new Date().toISOString(),reversal={id:makeFinanceId('PREV'),paymentId:payment.id,amountPaise:payment.amountPaise,date:now,actor:'Aarav Sharma',reason:clean}
        const next={...current,paymentReversals:[...current.paymentReversals,reversal]}
        const linkedInvoices=allocationsForPayment(payment,current)
        return {...next,sales:current.sales.map(sale=>paymentSnapshot(sale,next)),
          financialAudit:[...current.financialAudit,...(linkedInvoices.length?linkedInvoices.map(allocation=>({id:makeFinanceId('FAUD'),reference:payment.reference||payment.id,activity:'Payment reversed' as const,date:now,actor:'Aarav Sharma',reason:clean,customerId:payment.customerId,invoiceId:allocation.invoiceId})):
            [{id:makeFinanceId('FAUD'),reference:payment.reference||payment.id,activity:'Payment reversed' as const,date:now,actor:'Aarav Sharma',reason:clean,customerId:payment.customerId,invoiceId:undefined}])]}
      })
      toast.success('Payment reversed with an audit reason')
      setReverseTarget(null);setReason('');setError('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Payment reversal failed. No records were changed.')}
  }
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Payment analysis" title="Payment analysis" description="Review payment-date collections from the shared register. Reversed payments remain visible but are excluded from totals."/>
    <FinanceMetrics items={[{label:'Payments in view',value:String(filtered.length)},{label:'Valid collection total',value:currency(total)},{label:'Unallocated advances',value:currency(active.reduce((sum,item)=>sum+unallocatedPaise(item,data),0))},{label:'Payment date basis',value:dateLabel('2026-11-21')}]}/>
    <Panel title="Collection by payment mode" meta="Each non-reversed payment record is counted once">
      <div className="finance-bars">{modes.filter(item=>item.value>0).map(item=><div className="finance-bar-row" key={item.label}><div><span>{item.label}</span><strong>{currency(item.value)}</strong></div><progress max={Math.max(1,...modes.map(row=>row.value))} value={item.value}/></div>)}</div>
    </Panel>
    <Panel title="Payment register" meta={`${filtered.length} records · Search reference, invoice, customer or recorded user`}>
      <div className="crm-toolbar finance-toolbar">
        <SearchBar label="Search payments" value={query} onChange={value=>{setQuery(value);setPage(0)}}/>
        <Selector label="Payment date range" value={range} options={financeDateRanges} onChange={value=>{setRange(value);setPage(0)}}/>
        <Selector label="Filter payments by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>{setStore(data.stores.find(item=>item.name===value)?.id||'All stores');setPage(0)}}/>
        <Selector label="Filter payments by mode" value={mode} options={['All modes','Cash','UPI','Debit/Credit Card','Bank Transfer','Financing / EMI']} onChange={value=>{setMode(value);setPage(0)}}/>
        <Selector label="Filter payments by status" value={status} options={['All statuses','Recorded','Matched','Needs review','Reversed']} onChange={value=>{setStatus(value);setPage(0)}}/>
      </div>
      {visible.length?<DataTable columns={['Payment reference','Invoice','Customer','Store','Payment date','Mode','Amount','Collection status','Recorded by','Action']} rows={visible.map(payment=>{
        const customer=data.customers.find(item=>item.id===payment.customerId)
        const invoice=data.sales.find(item=>item.invoiceNumber===payment.invoiceId)
        const state=paymentStatus(payment,data)
        return [payment.reference||payment.id,payment.invoiceId||'Customer advance',customer?.name||payment.customerId,
          storeLabel(paymentStoreId(payment,data),data.stores),dateTimeLabel(payment.date),payment.mode,currency(payment.amountPaise),
          <span key={payment.id+'status'} className={`signal ${statusClass(state)}`}>{state}</span>,payment.collectedBy||invoice?.salesperson||'Demo user',
          paymentIsActive(payment,data)?<button type="button" className="textlink" key={payment.id+'reverse'} onClick={()=>{setReverseTarget(payment);setReason('');setError('')}}>Reverse</button>:'—']
      })}/>:<EmptyState text="No payments match these filters."/>}
      <div className="crm-pagination"><span>Showing {filtered.length?page*pageSize+1:0}–{Math.min((page+1)*pageSize,filtered.length)} of {filtered.length}</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(filtered.length/pageSize))}</span><Button variant="outline" disabled={(page+1)*pageSize>=filtered.length} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
      <p className="crm-note">A payment is a collection once, regardless of how many invoices receive allocations. Reversal is a separate record; historical rows are never deleted.</p>
    </Panel>
    <Dialog open={!!reverseTarget} onOpenChange={open=>!open&&setReverseTarget(null)}><DialogContent><DialogTitle>Reverse payment {reverseTarget?.reference||''}?</DialogTitle><DialogDescription>The payment will remain in history, stop counting as a collection and restore its valid invoice balances.</DialogDescription>
      <form className="crm-form" onSubmit={reverse}><label className="crm-field">Reason for reversal<textarea required minLength={8} rows={3} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Explain why this payment is being reversed"/></label>{error&&<p role="alert" className="crm-error">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={()=>setReverseTarget(null)}>Cancel</Button><Button type="submit" variant="destructive">Confirm payment reversal</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>
}

type InvoiceRecord={sale:Sale;paidPaise:number;balancePaise:number;status:string;dueDate:string;daysOverdue:number}
export function InvoiceMonitoring(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[status,setStatus]=useState('All statuses'),[detail,setDetail]=useState<InvoiceRecord|null>(null)
  const records=data.sales.map(sale=>{
    const values=invoiceFinance(sale,data)
    return {...values,status:values.status}
  }).filter(item=>inDateRange(item.sale.date,range)&&(store==='All stores'||item.sale.storeId===store)&&
    (status==='All statuses'||item.status===status)&&
    (!query||`${item.sale.invoiceNumber} ${item.sale.customerName} ${item.sale.lines.map(line=>line.name).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a,b)=>b.sale.date.localeCompare(a.sale.date))
  const details=detail?invoicePaymentHistory(detail.sale,data):[]
  const audit=detail?data.financialAudit.filter(item=>item.invoiceId===detail.sale.invoiceNumber||item.reference===detail.sale.invoiceNumber):[]
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Invoice monitoring" title="Invoice monitoring" description="One invoice register for totals, payment allocations, balances and reversal history."/>
    <FinanceMetrics items={[{label:'Invoices',value:String(records.length)},{label:'Invoiced total',value:currency(records.reduce((sum,item)=>sum+item.sale.totalPaise,0))},{label:'Paid amount',value:currency(records.reduce((sum,item)=>sum+item.paidPaise,0))},{label:'Outstanding',value:currency(records.reduce((sum,item)=>sum+item.balancePaise,0))}]}/>
    <Panel title="Consolidated invoice register" meta="Invoice-level balances are derived from valid allocations; reversed invoices have zero active receivable.">
      <div className="crm-toolbar finance-toolbar">
        <SearchBar label="Search invoice or customer" value={query} onChange={setQuery}/>
        <Selector label="Invoice date range" value={range} options={financeDateRanges} onChange={setRange}/>
        <Selector label="Filter invoices by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/>
        <Selector label="Filter invoices by payment status" value={status} options={['All statuses','Paid','Partially Paid','Unpaid','Overdue','Reversed']} onChange={setStatus}/>
      </div>
      {records.length?<DataTable columns={['Invoice','Date','Customer','Store','Gross','Discount','Tax','Net','Paid','Outstanding','Payment status','Reversal']} rows={records.map(item=>[
        <button type="button" className="crm-customer-link" key={item.sale.id} onClick={()=>setDetail(item)}><b>{item.sale.invoiceNumber}</b><small>View invoice activity</small></button>,
        dateLabel(item.sale.date),item.sale.customerName,storeLabel(item.sale.storeId,data.stores),currency(item.sale.grossPaise),
        currency(item.sale.itemDiscountPaise+item.sale.cartDiscountPaise),currency(item.sale.taxPaise),currency(item.sale.totalPaise),
        currency(item.paidPaise),currency(item.balancePaise),<StatusBadge key={item.sale.id+'status'}>{item.status}</StatusBadge>,
        item.sale.status==='Reversed'?item.sale.reversalReason:'—'
      ])}/>:<EmptyState text="No invoices match these filters."/>}
    </Panel>
    <DetailDrawer open={!!detail} title={detail?.sale.invoiceNumber||'Invoice detail'} onClose={()=>setDetail(null)}>
      {detail&&<><dl className="facts">{[['Customer',detail.sale.customerName],['Store',storeLabel(detail.sale.storeId,data.stores)],['Date',dateTimeLabel(detail.sale.date)],['Invoice total',currency(detail.sale.totalPaise)],['Amount paid',currency(detail.paidPaise)],['Balance due',currency(detail.balancePaise)],['Payment status',detail.status],['Reversal reason',detail.sale.reversalReason||'Not reversed'],['Due date',`${dateLabel(detail.dueDate)} · simulated +30 days`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <h3>Payment history</h3>{details.length?<DataTable columns={['Date','Mode','Reference','Allocated amount','Status']} rows={details.map(payment=>[dateTimeLabel(payment.date),payment.mode,payment.reference||payment.id,currency(payment.amountPaise),paymentStatus(payment,data)])}/>:<p className="crm-note">No valid payment allocations.</p>}
        <h3>Financial activity</h3>{audit.length?<DataTable columns={['Date','Activity','User','Reason']} rows={audit.map(item=>[dateTimeLabel(item.date),item.activity,item.actor,item.reason])}/>:<p className="crm-note">No financial audit entries for this invoice.</p>}
      </>}
    </DetailDrawer>
  </div>
}

export function PaymentReconciliation(){
  const {data,transact}=useDemo()
  const [query,setQuery]=useState(''),[range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[error,setError]=useState('')
  const payments=data.payments.filter(payment=>inDateRange(payment.date,range)&&(store==='All stores'||paymentStoreId(payment,data)===store)&&
    (!query||`${payment.reference} ${payment.mode} ${payment.customerId} ${payment.invoiceId}`.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a,b)=>b.date.localeCompare(a.date))
  function reconcile(payment:Payment,nextStatus:Exclude<ReconciliationStatus,'Unreconciled'>){
    setError('')
    try{
      transact(current=>{
        const source=current.payments.find(item=>item.id===payment.id)
        if(!source)throw new Error('Payment could not be found. Refresh the register and try again.')
        const now=new Date().toISOString(),entry:PaymentReconciliation={id:makeFinanceId('RECON'),paymentId:source.id,status:nextStatus,date:now,actor:'Aarav Sharma',note:'Manual demo reconciliation update'}
        return {...current,paymentReconciliations:[...current.paymentReconciliations,entry],
          financialAudit:[...current.financialAudit,{id:makeFinanceId('FAUD'),reference:source.reference||source.id,activity:'Reconciliation updated',date:now,actor:'Aarav Sharma',reason:`Status set to ${nextStatus}`,customerId:source.customerId,invoiceId:source.invoiceId||undefined}]}
      })
      toast.success(`Payment marked ${nextStatus.toLowerCase()}`)
    }catch(cause){setError(cause instanceof Error?cause.message:'Reconciliation status could not be saved.')}
  }
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Reconciliation" title="Payment reconciliation" description="Manually mark fictional payment records for review. No bank, UPI or payment gateway data is connected."/>
    <div className="finance-prototype-note">This is a demo status log only. It does not reconcile with a bank, UPI provider, card processor or finance company.</div>
    <Panel title="Reconciliation register" meta="Recorded amount, invoice allocations and remaining advance balance">
      <div className="crm-toolbar finance-toolbar"><SearchBar label="Search reference, mode or customer" value={query} onChange={setQuery}/><Selector label="Payment date range" value={range} options={financeDateRanges} onChange={setRange}/><Selector label="Filter reconciliation by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/></div>
      {payments.length?<DataTable columns={['Payment reference','Mode','Recorded amount','Allocated','Unallocated','Status','Reconciliation date','Action']} rows={payments.map(payment=>{
        const allocated=allocatedPaise(payment,data)
        const remaining=unallocatedPaise(payment,data)
        const latest=latestReconciliation(payment.id,data)
        const currentStatus=paymentStatus(payment,data)
        return [payment.reference||payment.id,payment.mode,currency(payment.amountPaise),currency(allocated),currency(remaining),
          <StatusBadge key={payment.id+'status'}>{currentStatus}</StatusBadge>,dateTimeLabel(latest?.date||''),
          paymentIsActive(payment,data)?<div className="finance-action-group" key={payment.id+'action'}><Button size="sm" variant="outline" onClick={()=>reconcile(payment,'Matched')}>Match</Button><Button size="sm" variant="outline" onClick={()=>reconcile(payment,'Needs review')}>Review</Button></div>:'—']
      })}/>:<EmptyState text="No payments match these filters."/>}
      {error&&<p className="crm-error" role="alert">{error}</p>}
      <p className="crm-note">Allocations are shown from the immutable allocation list. Changing reconciliation status appends a dated history entry.</p>
    </Panel>
  </div>
}

export function FinancialAuditHistory(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[activity,setActivity]=useState('All activity')
  const entries=[...data.financialAudit].filter(item=>(activity==='All activity'||item.activity===activity)&&
    (!query||`${item.reference} ${item.activity} ${item.actor} ${item.reason} ${item.customerId||''} ${item.invoiceId||''}`.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a,b)=>b.date.localeCompare(a.date))
  const activities=['Payment recorded','Payment allocated','Payment reversed','Collection adjusted','Invoice reversed','Recovery activity recorded','Reconciliation updated']
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Audit history" title="Financial audit history" description="Append-only-style activity for payment, allocation, reversal, recovery and reconciliation changes."/>
    <Panel title="Financial activity" meta={`${entries.length} entries · Historical rows are retained`}>
      <div className="crm-toolbar finance-toolbar"><SearchBar label="Search activity or reference" value={query} onChange={setQuery}/><Selector label="Filter audit activity" value={activity} options={['All activity',...activities]} onChange={setActivity}/></div>
      {entries.length?<DataTable columns={['Date and time','Reference','Activity','Responsible user','Reason','Customer','Invoice']} rows={entries.map(item=>[
        dateTimeLabel(item.date),item.reference,<StatusBadge key={item.id+'type'}>{item.activity}</StatusBadge>,item.actor,item.reason,
        data.customers.find(customer=>customer.id===item.customerId)?.name||item.customerId||'—',item.invoiceId||'—'
      ])}/>:<EmptyState text="No financial activity matches this search."/>}
      <p className="crm-note">Entries are retained in browser session state. This prototype does not provide production-grade tamper resistance or accounting audit guarantees.</p>
    </Panel>
  </div>
}
