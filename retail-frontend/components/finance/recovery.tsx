'use client'
import {useState,type FormEvent} from 'react'
import {toast} from 'sonner'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector,StatusBadge} from '../foundation'
import {Panel} from '../analytics-controls'
import {Button} from '../ui/button'
import {useDemo} from '../demo-provider'
import {activeInvoices,dueDateForSale,financeReferenceDate,inDateRange,paymentIsActive} from '@/lib/finance'
import type {RecoveryActivity,RecoveryCase,RecoveryStatus} from '@/lib/finance-types'
import {currency} from '@/lib/phase3-data'
import {FinanceMetrics,dateLabel,dateTimeLabel,financeDateRanges,makeFinanceId,storeLabel,toDemoDate} from './shared'

const recoveryStatuses:RecoveryStatus[]=['Not Contacted','Contacted','Promised to Pay','Partially Recovered','Fully Recovered','Disputed','Escalated']
const recoveryExecutives=(users:{name:string;role?:string;status:string}[])=>users.filter(user=>user.status==='Active'&&(user.role==='Finance Executive'||user.role==='Store Manager')).map(user=>user.name)
type RecoveryRow={key:string;customerId:string;customerName:string;mobile:string;storeId:string;invoices:ReturnType<typeof activeInvoices>;balancePaise:number;daysOverdue:number;recoveryCase?:RecoveryCase}

function recoveryRows(data:ReturnType<typeof useDemo>['data'],range='All dates',store='All stores'):RecoveryRow[]{
  const grouped=new Map<string,ReturnType<typeof activeInvoices>>()
  activeInvoices(data).filter(item=>item.status==='Overdue'&&item.balancePaise>0&&inDateRange(item.sale.date,range)&&
    (store==='All stores'||item.sale.storeId===store)).forEach(item=>{
      const key=`${item.sale.customerId}:${item.sale.storeId}`
      grouped.set(key,[...(grouped.get(key)||[]),item])
    })
  return [...grouped].map(([key,invoices])=>{
    const first=invoices[0],customer=data.customers.find(item=>item.id===first.sale.customerId)
    const existing=data.recoveryCases.find(item=>item.customerId===first.sale.customerId&&item.storeId===first.sale.storeId)
    return {key,customerId:first.sale.customerId,customerName:customer?.name||first.sale.customerName,mobile:customer?.mobile||'',
      storeId:first.sale.storeId,invoices,balancePaise:invoices.reduce((sum,item)=>sum+item.balancePaise,0),
      daysOverdue:Math.max(...invoices.map(item=>item.daysOverdue)),recoveryCase:existing}
  }).sort((a,b)=>b.daysOverdue-a.daysOverdue||b.balancePaise-a.balancePaise)
}

function RecoveryEditor({row,onClose}:{row:RecoveryRow;onClose:()=>void}){
  const {data,transact}=useDemo()
  const existing=row.recoveryCase
  const [type,setType]=useState<RecoveryActivity['type']>('Call'),[actor,setActor]=useState('Aarav Sharma')
  const executives=recoveryExecutives(data.users)
  const [assigned,setAssigned]=useState(existing?.assignedExecutive||executives[0]||''),[status,setStatus]=useState<RecoveryStatus>(existing?.status||'Not Contacted')
  const [date,setDate]=useState(financeReferenceDate),[promised,setPromised]=useState(existing?.promisedPaymentAt.slice(0,10)||'')
  const [followUp,setFollowUp]=useState(existing?.nextFollowUpAt.slice(0,10)||''),[notes,setNotes]=useState(''),[error,setError]=useState('')
  const history=data.recoveryActivities.filter(item=>item.caseId===(existing?.id||row.key)).sort((a,b)=>b.date.localeCompare(a.date))
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('')
    if(!assigned||!executives.includes(assigned)){setError('Assign an active Finance Executive or Store Manager.');return}
    if(notes.trim().length<5){setError('Enter an activity note with at least five characters.');return}
    if(status==='Promised to Pay'&&!promised){setError('Enter the promised payment date for this status.');return}
    try{
      transact(current=>{
        const key=row.key,prior=current.recoveryCases.find(item=>item.customerId===row.customerId&&item.storeId===row.storeId)
        const now=new Date().toISOString(),caseId=prior?.id||makeFinanceId('REC')
        const activity:RecoveryActivity={id:makeFinanceId('RACT'),caseId,date:toDemoDate(date),type,actor,notes:notes.trim(),
          promisedPaymentAt:promised?toDemoDate(promised):'',nextFollowUpAt:followUp?toDemoDate(followUp):'',status}
        const recoveryCase:RecoveryCase={id:caseId,customerId:row.customerId,storeId:row.storeId,assignedExecutive:assigned,status,
          lastContactAt:type==='Note'?(prior?.lastContactAt||''):activity.date,nextFollowUpAt:activity.nextFollowUpAt,
          promisedPaymentAt:activity.promisedPaymentAt,notes:activity.notes,createdAt:prior?.createdAt||now}
        const updated=prior?current.recoveryCases.map(item=>item.id===prior.id?recoveryCase:item):[...current.recoveryCases,recoveryCase]
        return {...current,recoveryCases:updated,recoveryActivities:[...current.recoveryActivities,activity],
          financialAudit:[...current.financialAudit,{id:makeFinanceId('FAUD'),reference:row.invoices.map(item=>item.sale.invoiceNumber).join(', '),activity:'Recovery activity recorded' as const,date:now,actor,reason:`${type}: ${notes.trim()}`,customerId:row.customerId,invoiceId:row.invoices[0]?.sale.invoiceNumber}]}
      })
      toast.success('Recovery activity recorded')
      onClose()
    }catch(cause){setError(cause instanceof Error?cause.message:'Recovery activity could not be saved.')}
  }
  return <div className="finance-recovery-drawer">
    <FinanceMetrics items={[{label:'Overdue invoices',value:String(row.invoices.length)},{label:'Overdue balance',value:currency(row.balancePaise)},{label:'Oldest balance',value:`${row.daysOverdue} days`} ]}/>
    <dl className="facts">{[['Customer',row.customerName],['Mobile',row.mobile],['Store',storeLabel(row.storeId,data.stores)],['Invoices',row.invoices.map(item=>item.sale.invoiceNumber).join(', ')],['Current status',existing?.status||'Not Contacted']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <form className="crm-form" onSubmit={submit} noValidate>
      <label className="crm-field">Assigned recovery executive<span>*</span><select value={assigned} onChange={event=>setAssigned(event.target.value)}>{executives.map(name=><option key={name}>{name}</option>)}</select></label>
      <div className="crm-form-grid">
        <label className="crm-field">Activity type<span>*</span><select value={type} onChange={event=>setType(event.target.value as RecoveryActivity['type'])}><option>Call</option><option>Visit</option><option>Note</option></select></label>
        <label className="crm-field">Activity date<span>*</span><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
        <label className="crm-field">Recovery status<span>*</span><select value={status} onChange={event=>setStatus(event.target.value as RecoveryStatus)}>{recoveryStatuses.map(item=><option key={item}>{item}</option>)}</select></label>
        <label className="crm-field">Promised payment date{status==='Promised to Pay'&&<span>*</span>}<input type="date" value={promised} onChange={event=>setPromised(event.target.value)}/></label>
        <label className="crm-field">Next follow-up date<input type="date" value={followUp} onChange={event=>setFollowUp(event.target.value)}/></label>
        <label className="crm-field crm-field-wide">Follow-up notes<span>*</span><textarea rows={3} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Record the call or visit outcome"/></label>
      </div>
      {error&&<p role="alert" className="crm-error">{error}</p>}
      <Button type="submit">Save recovery activity</Button>
    </form>
    <h3>Recovery history</h3>{history.length?<DataTable columns={['Date','Type','Status','Responsible user','Notes']} rows={history.map(item=>[dateTimeLabel(item.date),item.type,<StatusBadge key={item.id+'status'}>{item.status}</StatusBadge>,item.actor,item.notes])}/>:<p className="crm-note">No recovery activities have been recorded.</p>}
    <p className="crm-note">This register records demo activities only. It does not place calls or send messages.</p>
  </div>
}

export function DueRecovery(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[status,setStatus]=useState('All statuses'),[selected,setSelected]=useState<RecoveryRow|null>(null)
  const rows=recoveryRows(data,range,store)
  const selectedRows=rows.filter(row=>status==='All statuses'||(row.recoveryCase?.status||'Not Contacted')===status)
  const filtered=selectedRows.filter(row=>!query||`${row.customerName} ${row.customerId} ${row.mobile} ${row.invoices.map(item=>item.sale.invoiceNumber).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  const today=financeReferenceDate
  const cases=data.recoveryCases.filter(item=>store==='All stores'||item.storeId===store)
  const followUps=cases.filter(item=>item.status!=='Fully Recovered'&&item.nextFollowUpAt&&item.nextFollowUpAt.slice(0,10)===today).length
  const missed=cases.filter(item=>item.nextFollowUpAt&&item.nextFollowUpAt.slice(0,10)<today&&item.status!=='Fully Recovered').length
  const totalOverdue=rows.reduce((sum,item)=>sum+item.balancePaise,0)
  const monthRecovery=data.payments.filter(payment=>payment.date.slice(0,7)===today.slice(0,7)&&paymentIsActive(payment,data))
    .reduce((sum,payment)=>sum+data.paymentAllocations.filter(allocation=>{
      if(allocation.paymentId!==payment.id)return false
      const invoice=data.sales.find(sale=>sale.invoiceNumber===allocation.invoiceId&&sale.status==='Completed')
      return !!invoice&&dueDateForSale(invoice)<=payment.date.slice(0,10)&&data.recoveryCases.some(item=>item.customerId===invoice.customerId&&item.storeId===invoice.storeId)
    }).reduce((paid,allocation)=>paid+allocation.amountPaise,0),0)
  const success=cases.length?cases.filter(item=>item.status==='Fully Recovered').length/cases.length*100:0
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Due recovery" title="Due recovery" description="Prioritize overdue customer balances, log recovery activities and schedule the next follow-up. No external contact is made."/>
    <FinanceMetrics items={[{label:'Total overdue amount',value:currency(totalOverdue)},{label:'Overdue customers',value:String(new Set(rows.map(item=>item.customerId)).size)},{label:'Follow-ups due today',value:String(followUps)},{label:'Missed follow-ups',value:String(missed)},{label:'Recovery this month',value:currency(monthRecovery)},{label:'Recovery success rate',value:`${success.toFixed(1)}%`,note:'Fully recovered cases ÷ recorded cases'}]}/>
    <Panel title="Recovery register" meta="Open overdue invoices grouped by customer and store">
      <div className="crm-toolbar finance-toolbar">
        <SearchBar label="Search customer, mobile or invoice" value={query} onChange={setQuery}/>
        <Selector label="Invoice date range" value={range} options={financeDateRanges} onChange={setRange}/>
        <Selector label="Filter recovery by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/>
        <Selector label="Filter recovery status" value={status} options={['All statuses',...recoveryStatuses]} onChange={setStatus}/>
      </div>
      {filtered.length?<DataTable columns={['Customer','Mobile','Invoice references','Store','Outstanding','Days overdue','Assigned executive','Last contact','Next follow-up','Status','Activity']} rows={filtered.map(row=>{
        const item=row.recoveryCase
        return [<button type="button" className="crm-customer-link" key={row.key} onClick={()=>setSelected(row)}><b>{row.customerName}</b><small>{row.customerId}</small></button>,row.mobile,row.invoices.map(invoice=>invoice.sale.invoiceNumber).join(', '),storeLabel(row.storeId,data.stores),currency(row.balancePaise),row.daysOverdue,
          item?.assignedExecutive||'Unassigned',item?.lastContactAt?dateLabel(item.lastContactAt):'—',item?.nextFollowUpAt?dateLabel(item.nextFollowUpAt):'Not scheduled',
          <StatusBadge key={row.key+'status'}>{item?.status||'Not Contacted'}</StatusBadge>,<button type="button" className="textlink" key={row.key+'activity'} onClick={()=>setSelected(row)}>Record activity</button>]
      })}/>:<EmptyState text="No overdue customers match these filters."/>}
      <p className="crm-note">Overdue values use simulated invoice date + 30-day due dates and the fixed 21 Nov 2026 reference date. Activity notes stay in the demo session.</p>
    </Panel>
    <DetailDrawer open={!!selected} title={selected?.customerName||'Recovery activity'} onClose={()=>setSelected(null)}>{selected&&<RecoveryEditor key={selected.key} row={selected} onClose={()=>setSelected(null)}/>}</DetailDrawer>
  </div>
}

export function RecoveryPerformance(){
  const {data}=useDemo()
  const [range,setRange]=useState('All dates'),[store,setStore]=useState('All stores'),[executive,setExecutive]=useState('All executives')
  const rows=recoveryRows(data,range,store)
  const executives=executive==='All executives'?recoveryExecutives(data.users):[executive]
  const summary=executives.map(name=>{
    const assigned=rows.filter(row=>(row.recoveryCase?.assignedExecutive||'Unassigned')===name)
    const amount=assigned.reduce((sum,row)=>sum+row.balancePaise,0)
    const recovered=data.payments.filter(payment=>paymentIsActive(payment,data)&&inDateRange(payment.date,range))
    const currentCases=data.recoveryCases.filter(item=>item.assignedExecutive===name&&(store==='All stores'||item.storeId===store))
    const recoveredAmount=recovered.reduce((sum,payment)=>sum+data.paymentAllocations.filter(allocation=>{
      if(allocation.paymentId!==payment.id)return false
      const invoice=data.sales.find(sale=>sale.invoiceNumber===allocation.invoiceId&&sale.status==='Completed')
      return !!invoice&&dueDateForSale(invoice)<=payment.date.slice(0,10)&&currentCases.some(item=>item.customerId===invoice.customerId&&item.storeId===invoice.storeId)
    }).reduce((total,allocation)=>total+allocation.amountPaise,0),0)
    const followUps=currentCases.filter(item=>item.status!=='Fully Recovered'&&item.nextFollowUpAt&&item.nextFollowUpAt.slice(0,10)>=financeReferenceDate).length
    const missed=currentCases.filter(item=>item.nextFollowUpAt&&item.nextFollowUpAt.slice(0,10)<financeReferenceDate&&item.status!=='Fully Recovered').length
    return {name,amount,recovered:recoveredAmount,percent:amount?recoveredAmount/amount*100:0,followUps,missed,customers:new Set(assigned.map(item=>item.customerId)).size}
  })
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Recovery performance" title="Recovery performance" description="Compare assigned overdue balances with allocations collected during the selected period. Results are illustrative."/>
    <div className="crm-toolbar finance-toolbar"><Selector label="Recovery activity date range" value={range} options={financeDateRanges} onChange={setRange}/><Selector label="Filter performance by store" value={store==='All stores'?'All stores':storeLabel(store,data.stores)} options={['All stores',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All stores')}/><Selector label="Filter by recovery executive" value={executive} options={['All executives',...recoveryExecutives(data.users)]} onChange={setExecutive}/></div>
    <Panel title="Executive recovery scorecard" meta="Assigned balance is open overdue balance; recovered amount is valid allocation activity in the date range">
      {summary.length?<DataTable columns={['Recovery executive','Assigned overdue amount','Amount recovered','Recovery percentage','Follow-ups pending','Missed follow-ups','Customers']} rows={summary.map(item=>[
        item.name,currency(item.amount),currency(item.recovered),`${item.percent.toFixed(1)}%`,item.followUps,item.missed,item.customers
      ])}/>:<EmptyState text="No recovery executives are configured."/>}
    </Panel>
    <p className="crm-note">Recovery performance attributes invoice allocations to the currently assigned demo recovery executive. It is an operational estimate, not a compensation or accounting report.</p>
  </div>
}
