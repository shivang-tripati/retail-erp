'use client'
import {useMemo,useState} from 'react'
import {Plus,ArrowUpDown,UserRoundPlus} from 'lucide-react'
import {toast} from 'sonner'
import {useDemo} from './demo-provider'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector} from './foundation'
import {Panel} from './analytics-controls'
import CustomerForm from './customer-form'
import CustomerProfile from './customer-profile'
import {Button} from './ui/button'
import {Dialog,DialogContent,DialogDescription,DialogTitle} from './ui/dialog'
import {dateInIndia,staticCustomerInvoices,type Customer} from '@/lib/phase3-data'
import {money} from '@/lib/demo-data'
import type {ReactNode} from 'react'

const pageSize=20
export default function CustomerDirectory(){
  const {data,update}=useDemo()
  const [query,setQuery]=useState(''),[city,setCity]=useState('All cities'),[status,setStatus]=useState('All statuses')
  const [sortKey,setSortKey]=useState('name'),[direction,setDirection]=useState<'asc'|'desc'>('asc')
  const [page,setPage]=useState(0),[form,setForm]=useState<Customer|null|undefined>(undefined),[profile,setProfile]=useState<Customer|null>(null)
  const cities=[...new Set(data.customers.map(customer=>customer.city))].sort()
  const customerStats=useMemo(()=>data.customers.map(customer=>{
    const legacy=staticCustomerInvoices(customer.id),sales=data.sales.filter(sale=>sale.customerId===customer.id&&sale.status==='Completed')
    const purchases=legacy.length+sales.length
    const amount=legacy.reduce((sum,row)=>sum+row.net,0)+sales.reduce((sum,sale)=>sum+sale.totalPaise/100,0)
    const due=legacy.reduce((sum,row)=>sum+Math.max(0,row.net-row.paid),0)+sales.reduce((sum,sale)=>sum+sale.balancePaise/100,0)
    const lastSale=sales.reduce((last,sale)=>!last||sale.date>last? sale.date:last,'')
    const lastLegacy=legacy.length?Math.min(...legacy.map(row=>row.age)):null
    const lastDate=lastSale&&lastLegacy!==null?new Date(Math.max(new Date(lastSale).getTime(),Date.UTC(2026,10,20-lastLegacy))).toISOString():lastSale|| (lastLegacy===null?'':new Date(Date.UTC(2026,10,20-lastLegacy)).toISOString())
    return {customer,purchases,amount,due,lastDate}
  }),[data.customers,data.sales])
  const filtered=customerStats.filter(({customer})=>
    (!query||`${customer.id} ${customer.name} ${customer.mobile}`.toLowerCase().includes(query.trim().toLowerCase()))&&
    (city==='All cities'||customer.city===city)&&(status==='All statuses'||customer.status===status))
  const sorted=[...filtered].sort((a,b)=>{
    const left=sortKey==='purchases'?a.purchases:sortKey==='amount'?a.amount:sortKey==='due'?a.due:sortKey==='lastDate'?a.lastDate:a.customer[sortKey as keyof Customer]||''
    const right=sortKey==='purchases'?b.purchases:sortKey==='amount'?b.amount:sortKey==='due'?b.due:sortKey==='lastDate'?b.lastDate:b.customer[sortKey as keyof Customer]||''
    const value=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right))
    return direction==='asc'?value:-value
  })
  const visible=sorted.slice(page*pageSize,(page+1)*pageSize)
  function sortBy(key:string){if(sortKey===key)setDirection(current=>current==='asc'?'desc':'asc');else{setSortKey(key);setDirection('asc')}setPage(0)}
  const head=(label:string,key:string):ReactNode=><button type="button" className="crm-sort" onClick={()=>sortBy(key)} aria-label={`Sort by ${label}`}>{label}{sortKey===key?<span>{direction==='asc'?'↑':'↓'}</span>:<ArrowUpDown size={12}/>}</button>
  function saveCustomer(customer:Customer){
    update('customers',data.customers.some(item=>item.id===customer.id)
      ?data.customers.map(item=>item.id===customer.id?customer:item)
      :[...data.customers,customer])
    toast.success(form?.id?'Customer updated':'Customer registered')
    setForm(undefined)
  }
  return <div className="phase">
    <PageHeader eyebrow="Customers / Directory" title="Customer directory" description="Customer relationships, purchase history and receivables in one place."/>
    <Panel title="Customer records" meta={`${filtered.length.toLocaleString('en-IN')} customers · Fictional demo purchases`} action={<Button onClick={()=>setForm(null)}><Plus/>Add customer</Button>}>
      <div className="crm-toolbar"><SearchBar label="Search name, mobile or customer ID" value={query} onChange={value=>{setQuery(value);setPage(0)}}/><Selector label="Filter by city" value={city} options={['All cities',...cities]} onChange={value=>{setCity(value);setPage(0)}}/><Selector label="Filter by customer status" value={status} options={['All statuses','Active','Inactive']} onChange={value=>{setStatus(value);setPage(0)}}/></div>
      {visible.length?<DataTable columns={[
        head('Customer','name'),head('Mobile','mobile'),head('City','city'),head('Purchases','purchases'),
        head('Purchase value','amount'),head('Outstanding','due'),head('Last purchase','lastDate'),'Status','Actions'
      ]} rows={visible.map(({customer,purchases,amount,due,lastDate})=>[
        <button type="button" className="crm-customer-link" key={customer.id} onClick={()=>setProfile(customer)}><b>{customer.name}</b><small>{customer.id} · {customer.email||'Email not provided'}</small></button>,
        customer.mobile,customer.city,purchases.toLocaleString('en-IN'),money(amount),money(due),
        lastDate?dateInIndia(lastDate):'No purchases',
        <span key={customer.id+'status'} className={`signal ${customer.status}`}>{customer.status}</span>,
        <button type="button" className="textlink" key={customer.id+'edit'} onClick={()=>setForm(customer)}>Edit</button>
      ])}/>:<EmptyState text="No customers match these filters. Add a customer or adjust your search."/>}
      <div className="crm-pagination"><span>Showing {filtered.length? page*pageSize+1:0}–{Math.min((page+1)*pageSize,filtered.length)} of {filtered.length}</span><div><Button variant="outline" disabled={page===0} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(filtered.length/pageSize))}</span><Button variant="outline" disabled={(page+1)*pageSize>=filtered.length} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
    </Panel>
    <Dialog open={form!==undefined} onOpenChange={open=>!open&&setForm(undefined)}><DialogContent className="crm-dialog"><DialogTitle>{form?.id?'Edit customer':'Register a customer'}</DialogTitle><DialogDescription>Required fields are marked with an asterisk. Mobile numbers must be valid Indian numbers.</DialogDescription>{form!==undefined&&<CustomerForm customer={form||undefined} onSave={saveCustomer} onCancel={()=>setForm(undefined)}/>}</DialogContent></Dialog>
    <DetailDrawer open={!!profile} title={profile?.name||'Customer profile'} onClose={()=>setProfile(null)}>{profile&&<CustomerProfile customer={profile}/>}</DetailDrawer>
  </div>
}
