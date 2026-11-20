'use client'
import {useMemo,useState,type FormEvent} from 'react'
import {toast} from 'sonner'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector,Confirmation} from '../foundation'
import {Panel} from '../analytics-controls'
import {Button} from '../ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '../ui/dialog'
import {useDemo} from '../demo-provider'
import {useWorkspace} from '../workspace'
import {currency} from '@/lib/phase3-data'
import {type InventoryMovement,type MovementType,warehouseLocationId,warehouseLocationName} from '@/lib/phase4-data'
import {Field,locationName,parsePaise,SelectField} from './shared'

const pageSize=25
const movementTypes:MovementType[]=['Purchase Receipt','Sale','Sale Reversal','Customer Return','Inter-store Transfer Out','Inter-store Transfer In','Buyback','Scrap','Stock Adjustment','Putaway']
const locOptions=(stores:{id:string;name:string}[])=>[{value:warehouseLocationId,label:warehouseLocationName},...stores.map(item=>({value:item.id,label:item.name}))]
const stockFor=(inventory:{productId:string;storeId:string;quantity:number}[],productId:string,storeId:string)=>inventory.find(item=>item.productId===productId&&item.storeId===storeId)?.quantity||0
const serialList=(value:string)=>[...new Set(value.split(/[,\s]+/).map(item=>item.trim()).filter(Boolean))]

export function StockOverview(){
  const {data}=useDemo(),{store:workspaceStore}=useWorkspace()
  const initialStore=data.stores.find(item=>item.name===workspaceStore)?.id||'All locations'
  const [query,setQuery]=useState(''),[store,setStore]=useState(initialStore),[category,setCategory]=useState('All categories'),[brand,setBrand]=useState('All brands'),[stockStatus,setStockStatus]=useState('All stock'),[page,setPage]=useState(0)
  const inTransit=(productId:string,locationId:string)=>data.transfers.filter(item=>item.status==='Dispatched'||item.status==='Partially Received').reduce((total,transfer)=>{
    const line=transfer.items.find(row=>row.productId===productId);if(!line)return total
    const pending=Math.max(0,line.dispatchedQuantity-line.receivedQuantity)
    return total+((transfer.destinationLocation===locationId)?pending:0)
  },0)
  const reserves=(productId:string,locationId:string)=>data.serials.filter(item=>item.productId===productId&&item.storeId===locationId&&item.status==='Reserved').length
  const rows=data.inventory.filter(stock=>
    (store==='All locations'||stock.storeId===store)&&
    (!query||`${data.products.find(item=>item.id===stock.productId)?.name||''} ${data.products.find(item=>item.id===stock.productId)?.sku||''}`.toLowerCase().includes(query.trim().toLowerCase()))&&
    (category==='All categories'||data.products.find(item=>item.id===stock.productId)?.category===category)&&
    (brand==='All brands'||data.products.find(item=>item.id===stock.productId)?.brandId===data.brands.find(item=>item.name===brand)?.id)
  ).map(stock=>{
    const product=data.products.find(item=>item.id===stock.productId)!
    const reserved=reserves(product.id,stock.storeId),available=Math.max(0,stock.quantity-reserved),transit=inTransit(product.id,stock.storeId)
    const sold=data.sales.filter(sale=>sale.status==='Completed'&&sale.storeId===stock.storeId).flatMap(sale=>sale.lines.filter(line=>line.productId===product.id)).reduce((sum,line)=>sum+line.quantity,0)
    const status=available===0?'Out of stock':available<=3?'Low stock':'In stock'
    return {stock,product,available,reserved,transit,sold,status,value:(available+reserved)*product.purchasePricePaise}
  }).filter(row=>stockStatus==='All stock'||row.status===stockStatus)
  const summary=rows.reduce((result,row)=>({quantity:result.quantity+row.available+row.reserved,value:result.value+row.value,available:result.available+row.available,reserved:result.reserved+row.reserved,transit:result.transit+row.transit,sold:result.sold+row.sold}),{quantity:0,value:0,available:0,reserved:0,transit:0,sold:0})
  const low=rows.filter(row=>row.available>0&&row.available<=3).length,out=rows.filter(row=>row.available===0).length
  const sorted=[...rows].sort((a,b)=>a.product.name.localeCompare(b.product.name)||a.stock.storeId.localeCompare(b.stock.storeId))
  const visible=sorted.slice(page*pageSize,(page+1)*pageSize)
  return <div className="phase">
    <PageHeader eyebrow="Inventory / Stock position" title="Stock overview" description="A shared view of sellable, reserved and moving stock across stores and the central warehouse."/>
    <div className="p4-metrics">{[['Total stock',summary.quantity.toLocaleString('en-IN')],['Inventory value',currency(summary.value)],['Available',summary.available.toLocaleString('en-IN')],['Reserved',summary.reserved.toLocaleString('en-IN')],['In transit',summary.transit.toLocaleString('en-IN')],['Sold units',summary.sold.toLocaleString('en-IN')],['Low-stock lines',low],['Out of stock',out]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <Panel title="Product by location" meta={`${rows.length.toLocaleString('en-IN')} product-location rows · Serialized units are counted from the same inventory records as POS`}>
      <div className="crm-toolbar phase4-toolbar"><SearchBar label="Search stock by product or SKU" value={query} onChange={value=>{setQuery(value);setPage(0)}}/><Selector label="Filter stock by location" value={store==='All locations'?'All locations':locationName(store,data.stores)} options={['All locations',...data.stores.map(item=>item.name),warehouseLocationName]} onChange={value=>{setStore(data.stores.find(item=>item.name===value)?.id|| (value===warehouseLocationName?warehouseLocationId:'All locations'));setPage(0)}}/><Selector label="Filter stock by category" value={category} options={['All categories',...new Set(data.products.map(item=>item.category))]} onChange={value=>{setCategory(value);setPage(0)}}/><Selector label="Filter stock by brand" value={brand} options={['All brands',...data.brands.map(item=>item.name)]} onChange={value=>{setBrand(value);setPage(0)}}/><Selector label="Filter stock status" value={stockStatus} options={['All stock','In stock','Low stock','Out of stock']} onChange={value=>{setStockStatus(value);setPage(0)}}/></div>
      {visible.length?<DataTable columns={['Product / SKU','Brand','Category','Type','Location','Available','Reserved','In transit','Sold','Inventory value','Status']} rows={visible.map(row=>[
        <span key={row.product.id}>{row.product.name}<small className="p4-sub">{row.product.sku}</small></span>,data.brands.find(item=>item.id===row.product.brandId)?.name||row.product.brandId,row.product.category,row.product.serialRequired?'Serialized':'Quantity-based',locationName(row.stock.storeId,data.stores),row.available,row.reserved,row.transit,row.sold,currency(row.value),<span key={row.product.id+row.stock.storeId} className={`signal ${row.status==='In stock'?'Active':row.status==='Low stock'?'Medium':'High'}`}>{row.status}</span>
      ])}/>:<EmptyState text="No stock lines match these filters."/>}
      <div className="crm-pagination"><span>Showing {rows.length?page*pageSize+1:0}–{Math.min((page+1)*pageSize,rows.length)} of {rows.length}</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(rows.length/pageSize))}</span><Button variant="outline" disabled={(page+1)*pageSize>=rows.length} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
      <p className="crm-note">Inventory value uses product purchase price × on-hand quantity, including reserved units. Seeded stock counts and sample receipt dates are illustrative. In-transit stock remains outside destination on-hand quantity until receipt.</p>
    </Panel>
  </div>
}

export function StockLedger(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[type,setType]=useState('All movement types'),[location,setLocation]=useState('All locations'),[page,setPage]=useState(0),[detail,setDetail]=useState<InventoryMovement|undefined>()
  const filtered=useMemo(()=>data.movements.filter(item=>{
    const product=data.products.find(row=>row.id===item.productId)
    return (type==='All movement types'||item.type===type)&&
      (location==='All locations'||item.fromLocation===location||item.toLocation===location)&&
      (!query||`${item.reference} ${item.sku} ${item.serial} ${product?.name||''} ${item.reason} ${item.actor}`.toLowerCase().includes(query.trim().toLowerCase()))
  }).sort((a,b)=>b.date.localeCompare(a.date)),[data.movements,data.products,type,location,query])
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize)
  return <div className="phase">
    <PageHeader eyebrow="Inventory / Audit trail" title="Stock ledger" description="Append-only demo stock movements. Corrections are new compensating entries; history is never edited or deleted."/>
    <Panel title="Movement history" meta={`${filtered.length.toLocaleString('en-IN')} entries · Source and destination quantities are traceable by reference`}>
      <div className="crm-toolbar phase4-toolbar"><SearchBar label="Search movement, serial or reference" value={query} onChange={value=>{setQuery(value);setPage(0)}}/><Selector label="Filter movement type" value={type} options={['All movement types',...movementTypes]} onChange={value=>{setType(value);setPage(0)}}/><Selector label="Filter movement location" value={location==='All locations'?'All locations':locationName(location,data.stores)} options={['All locations',...data.stores.map(item=>item.name),warehouseLocationName]} onChange={value=>{setLocation(data.stores.find(item=>item.name===value)?.id||(value===warehouseLocationName?warehouseLocationId:'All locations'));setPage(0)}}/></div>
      {visible.length?<DataTable columns={['Date / time','Movement','Reference','Product / SKU','Serial','From','To','Quantity','Responsible user','Reason']} rows={visible.map(item=>[
        new Date(item.date).toLocaleString('en-IN'),item.type,<button className="textlink" key={item.id} onClick={()=>setDetail(item)}>{item.reference}</button>,
        <span key={item.id+'product'}>{data.products.find(product=>product.id===item.productId)?.name||item.productId}<small className="p4-sub">{item.sku}</small></span>,item.serial||'—',locationName(item.fromLocation,data.stores),locationName(item.toLocation,data.stores),item.quantity,item.actor,item.reason
      ])}/>:<EmptyState text="No stock movements match these filters."/>}
      <div className="crm-pagination"><span>Showing {filtered.length?page*pageSize+1:0}–{Math.min((page+1)*pageSize,filtered.length)} of {filtered.length}</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(filtered.length/pageSize))}</span><Button variant="outline" disabled={(page+1)*pageSize>=filtered.length} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
    </Panel>
    <DetailDrawer open={!!detail} title={detail?.reference||'Movement details'} onClose={()=>setDetail(undefined)}>{detail&&<dl className="facts">{[['Movement',detail.type],['Product',data.products.find(item=>item.id===detail.productId)?.name||detail.productId],['SKU',detail.sku],['Serial',detail.serial||'Not applicable'],['Source',locationName(detail.fromLocation,data.stores)],['Destination',locationName(detail.toLocation,data.stores)],['Quantity',detail.quantity],['Date',new Date(detail.date).toLocaleString('en-IN')],['Responsible user',detail.actor],['Reason',detail.reason]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}</DetailDrawer>
  </div>
}

type AdjustmentDraft={productId:string;storeId:string;quantity:string;serials:string;reason:string}
const freshAdjustment=():AdjustmentDraft=>({productId:'',storeId:'',quantity:'',serials:'',reason:''})
export function StockAdjustments(){
  const {data,transact}=useDemo()
  const [open,setOpen]=useState(false),[draft,setDraft]=useState<AdjustmentDraft>(freshAdjustment),[error,setError]=useState(''),[confirm,setConfirm]=useState(false)
  const product=data.products.find(item=>item.id===draft.productId),currentQty=product&&draft.storeId?stockFor(data.inventory,product.id,draft.storeId):0
  function review(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');const amount=Number(draft.quantity),serials=serialList(draft.serials)
    if(!product||!draft.storeId||!Number.isInteger(amount)||amount===0||draft.reason.trim().length<5){setError('Select a product and location, enter a non-zero whole-unit adjustment, and provide a reason of at least five characters.');return}
    if(currentQty+amount<0){setError(`The adjustment would make stock negative. Current stock is ${currentQty}.`);return}
    if(product.serialRequired&&serials.length!==Math.abs(amount)){setError(`Enter exactly ${Math.abs(amount)} unique serial number${Math.abs(amount)===1?'':'s'} for this adjustment.`);return}
    if(new Set(serials).size!==serials.length){setError('A serial number cannot appear twice in one adjustment.');return}
    setConfirm(true)
  }
  function apply(){
    const amount=Number(draft.quantity),serials=serialList(draft.serials)
    try{
      transact(current=>{
        const selectedProduct=current.products.find(item=>item.id===draft.productId)
        const row=current.inventory.find(item=>item.productId===draft.productId&&item.storeId===draft.storeId)
        if(!selectedProduct||!row||row.quantity+amount<0)throw new Error('Stock changed before confirmation. No adjustment was applied.')
        if(selectedProduct.serialRequired){
          const currentRecords=current.serials.filter(item=>serials.includes(item.serial))
          if(amount<0&&currentRecords.length!==serials.length||amount<0&&currentRecords.some(item=>item.productId!==selectedProduct.id||item.storeId!==draft.storeId||item.status!=='Available'))throw new Error('One or more selected serials are no longer available at this location.')
          if(amount>0&&serials.some(value=>current.serials.some(item=>item.serial===value)))throw new Error('A serial number already exists in the registry.')
        }
        const now=new Date().toISOString(),reference=`ADJ-${now.replace(/\D/g,'').slice(0,14)}`
        const newSerials=amount>0&&selectedProduct.serialRequired?serials.map(serial=>({serial,productId:selectedProduct.id,storeId:draft.storeId,status:'Available' as const,purchaseDate:now})): []
        const updatedSerials=current.serials.map(item=>serials.includes(item.serial)&&amount<0?{...item,status:'Unavailable' as const}:item)
        const perSerial=selectedProduct.serialRequired?serials.map(serial=>({id:crypto.randomUUID(),reference,productId:selectedProduct.id,sku:selectedProduct.sku,serial,fromLocation:amount<0?draft.storeId:'',toLocation:amount>0?draft.storeId:'',quantity:1,type:'Stock Adjustment' as const,date:now,actor:'Aarav Sharma',reason:draft.reason.trim()})):[{id:crypto.randomUUID(),reference,productId:selectedProduct.id,sku:selectedProduct.sku,serial:'',fromLocation:amount<0?draft.storeId:'',toLocation:amount>0?draft.storeId:'',quantity:Math.abs(amount),type:'Stock Adjustment' as const,date:now,actor:'Aarav Sharma',reason:draft.reason.trim()}]
        return {...current,inventory:current.inventory.map(item=>item===row?{...item,quantity:item.quantity+amount}:item),serials:[...updatedSerials,...newSerials],movements:[...current.movements,...perSerial],audit:[...current.audit,{id:crypto.randomUUID(),date:now,action:'Stock adjustment',actor:'Aarav Sharma',reference,detail:`${selectedProduct.name} · ${amount>0?'+':''}${amount} · ${draft.reason.trim()}`}]}
      })
      toast.success('Stock adjustment recorded in the ledger')
      setConfirm(false);setOpen(false);setDraft(freshAdjustment())
    }catch(cause){setError(cause instanceof Error?cause.message:'Adjustment failed. No stock was changed.')}
  }
  return <div className="phase">
    <PageHeader eyebrow="Inventory / Reconciliation" title="Stock adjustments" description="Correct a counted variance with a reason and a compensating movement. Serialized stock requires exact serial references."><Button onClick={()=>{setDraft(freshAdjustment());setError('');setOpen(true)}}>Create adjustment</Button></PageHeader>
    <Panel title="Recent adjustments" meta="Historical movement records cannot be changed or deleted.">
      <DataTable columns={['Date','Reference','Product','Location','Quantity','Reason','User']} rows={data.movements.filter(item=>item.type==='Stock Adjustment').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,50).map(item=>[new Date(item.date).toLocaleString('en-IN'),item.reference,data.products.find(product=>product.id===item.productId)?.name||item.productId,locationName(item.toLocation||item.fromLocation,data.stores),item.quantity,item.reason,item.actor])}/>
    </Panel>
    <Dialog open={open} onOpenChange={value=>{if(!value)setOpen(false)}}><DialogContent className="crm-dialog"><DialogTitle>Record stock adjustment</DialogTitle><DialogDescription>The current quantity is shown for reference. Nothing changes until the confirmation step.</DialogDescription>
      <form className="crm-form" onSubmit={review} noValidate><div className="crm-form-grid">
        <SelectField label="Product" value={draft.productId} onChange={value=>setDraft(current=>({...current,productId:value}))} options={[{value:'',label:'Select product'},...data.products.map(item=>({value:item.id,label:`${item.name} · ${item.sku}`}))]}/>
        <SelectField label="Store or warehouse" value={draft.storeId} onChange={value=>setDraft(current=>({...current,storeId:value}))} options={[{value:'',label:'Select location'},...locOptions(data.stores)]}/>
        <Field label={`Adjustment quantity (${currentQty} current)`} value={draft.quantity} onChange={value=>setDraft(current=>({...current,quantity:value}))} type="number" step="1" placeholder="Use a positive or negative whole number"/>
        {product?.serialRequired&&<Field label="Affected serial numbers (comma or space separated)" value={draft.serials} onChange={value=>setDraft(current=>({...current,serials:value}))} required/>}
        <Field label="Reason / notes" value={draft.reason} onChange={value=>setDraft(current=>({...current,reason:value}))}/>
      </div>{error&&<p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit">Review adjustment</Button></DialogFooter></form>
    </DialogContent></Dialog>
    <Confirmation open={confirm} title="Apply this stock adjustment?" text={`${product?.name||'Product'} · ${draft.quantity} units at ${locationName(draft.storeId,data.stores)}. This creates a permanent movement and audit entry.`} onClose={()=>setConfirm(false)} onConfirm={apply}/>
  </div>
}

type TransferDraftLine={productId:string;quantity:string;serials:string}
function TransferCreator({onCancel,onCreate}:{onCancel:()=>void;onCreate:(source:string,destination:string,items:TransferDraftLine[],notes:string)=>void}){
  const {data}=useDemo()
  const [source,setSource]=useState(data.stores[0]?.id||''),[destination,setDestination]=useState(data.stores[1]?.id||'')
  const [productId,setProductId]=useState(data.products[0]?.id||''),[quantity,setQuantity]=useState('1'),[serials,setSerials]=useState(''),[notes,setNotes]=useState('')
  const [items,setItems]=useState<TransferDraftLine[]>([]),[error,setError]=useState('')
  const product=data.products.find(item=>item.id===productId)
  function addLine(){
    const qty=Number(quantity),serialListValue=serialList(serials)
    if(!product||!Number.isInteger(qty)||qty<1){setError('Select a product and enter a positive whole quantity.');return}
    if(product.serialRequired&&(serialListValue.length!==qty||new Set(serialListValue).size!==qty)){setError(`Provide ${qty} distinct available serial numbers.`);return}
    if(items.some(item=>item.productId===product.id)){setError('A product may appear only once in this transfer request.');return}
    setItems(current=>[...current,{productId:product.id,quantity:String(qty),serials:serialListValue.join(',')}]);setSerials('');setQuantity('1');setError('')
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(!source||!destination||source===destination||!items.length){setError('Choose different source and destination locations and add at least one product.');return}
    const duplicate=new Set(items.flatMap(item=>serialList(item.serials))).size!==items.flatMap(item=>serialList(item.serials)).length
    if(duplicate){setError('A serial can only be included once in a transfer.');return}
    onCreate(source,destination,items,notes.trim())
  }
  return <form className="crm-form" onSubmit={submit} noValidate><div className="crm-form-grid">
    <SelectField label="Source location" value={source} onChange={setSource} options={locOptions(data.stores)}/>
    <SelectField label="Destination store" value={destination} onChange={setDestination} options={data.stores.map(item=>({value:item.id,label:item.name}))}/>
    <SelectField label="Product" value={productId} onChange={setProductId} options={data.products.filter(item=>item.status==='Active').map(item=>({value:item.id,label:`${item.name} · ${item.sku}`}))}/>
    <Field label="Quantity" value={quantity} onChange={setQuantity} type="number" step="1"/>
    {product?.serialRequired&&<Field label="Serials to transfer (comma or space separated)" value={serials} onChange={setSerials} required/>}
    <Field label="Transfer notes" value={notes} onChange={setNotes} required={false}/>
  </div><Button type="button" variant="outline" onClick={addLine}>Add product to transfer</Button>
  {items.length>0&&<DataTable columns={['Product','Quantity','Serials','Action']} rows={items.map((item,index)=>[data.products.find(row=>row.id===item.productId)?.name,item.quantity,item.serials||'Quantity-only',<button className="textlink" key={index} type="button" onClick={()=>setItems(current=>current.filter((_,i)=>i!==index))}>Remove</button>])}/>}
  {error&&<p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">Create transfer request</Button></DialogFooter></form>
}

export function Transfers(){
  const {data,transact}=useDemo()
  const [create,setCreate]=useState(false),[receive,setReceive]=useState<string>(''),[receiveValues,setReceiveValues]=useState<Record<string,{quantity:string;serials:string}>>({}),[error,setError]=useState(''),[detail,setDetail]=useState<string>(''),[confirmation,setConfirmation]=useState<{id:string;action:'Dispatch'|'Cancel'}|null>(null)
  const selected=data.transfers.find(item=>item.id===receive)
  function createTransfer(source:string,destination:string,items:TransferDraftLine[],notes:string){
    try{
      transact(current=>{
        if(source===destination||!current.stores.some(item=>item.id===destination&&item.status==='Active'))throw new Error('Select a different active destination store.')
        const lines=items.map(item=>{
          const product=current.products.find(row=>row.id===item.productId),qty=Number(item.quantity),serials=serialList(item.serials)
          if(!product||!Number.isInteger(qty)||qty<1)throw new Error('A transfer line is invalid.')
          if(product.serialRequired){
            const records=serials.map(serial=>current.serials.find(row=>row.serial===serial))
            if(serials.length!==qty||records.some(row=>!row||row.productId!==product.id||row.storeId!==source||row.status!=='Available'))throw new Error(`Selected serials for ${product.name} are not all available at the source.`)
          }
          return {productId:product.id,quantity:qty,dispatchedQuantity:0,receivedQuantity:0,serials,receivedSerials:[]}
        })
        const id=`TR-${crypto.randomUUID().slice(0,8).toUpperCase()}`,now=new Date().toISOString()
        return {...current,transfers:[...current.transfers,{id,sourceLocation:source,destinationLocation:destination,status:'Draft' as const,items:lines,createdAt:now,dispatchedAt:'',receivedAt:'',createdBy:'Aarav Sharma',notes}]}
      })
      toast.success('Transfer request created');setCreate(false)
    }catch(cause){toast.error(cause instanceof Error?cause.message:'Transfer request could not be created.')}
  }
  function request(id:string){transact(current=>({...current,transfers:current.transfers.map(item=>item.id===id&&item.status==='Draft'?{...item,status:'Requested'}:item)}));toast.success('Transfer request submitted')}
  function approve(id:string){transact(current=>({...current,transfers:current.transfers.map(item=>item.id===id&&item.status==='Requested'?{...item,status:'Approved'}:item)}));toast.success('Transfer approved')}
  function dispatch(id:string){
    try{
      transact(current=>{
        const transfer=current.transfers.find(item=>item.id===id&&item.status==='Approved')
        if(!transfer)throw new Error('Only an approved transfer can be dispatched.')
        for(const line of transfer.items){
          const row=current.inventory.find(item=>item.productId===line.productId&&item.storeId===transfer.sourceLocation)
          const product=current.products.find(item=>item.id===line.productId)
          if(!row||!product||row.quantity<line.quantity)throw new Error(`Insufficient source stock for ${product?.name||line.productId}.`)
          if(product.serialRequired&&line.serials.some(serial=>!current.serials.some(item=>item.serial===serial&&item.productId===product.id&&item.storeId===transfer.sourceLocation&&item.status==='Available')))throw new Error(`Serial availability changed for ${product.name}.`)
        }
        const now=new Date().toISOString(),transitLocation=`T-${transfer.id}`
        const movements:InventoryMovement[]=transfer.items.flatMap(line=>{
          const product=current.products.find(item=>item.id===line.productId)!
          return (product.serialRequired?line.serials:['']).map(serial=>({id:crypto.randomUUID(),reference:transfer.id,productId:product.id,sku:product.sku,serial,fromLocation:transfer.sourceLocation,toLocation:transitLocation,quantity:product.serialRequired?1:line.quantity,type:'Inter-store Transfer Out' as const,date:now,actor:'Aarav Sharma',reason:transfer.notes||'Approved transfer dispatched'}))
        })
        return {...current,
          inventory:current.inventory.map(row=>transfer.items.some(line=>line.productId===row.productId)&&row.storeId===transfer.sourceLocation?{...row,quantity:row.quantity-transfer.items.find(line=>line.productId===row.productId)!.quantity}:row),
          serials:current.serials.map(item=>transfer.items.some(line=>line.serials.includes(item.serial))?{...item,storeId:transitLocation,status:'In Transit'}:item),
          transfers:current.transfers.map(item=>item.id===id?{...item,status:'Dispatched',dispatchedAt:now,items:item.items.map(line=>({...line,dispatchedQuantity:line.quantity}))}:item),
          movements:[...current.movements,...movements]
        }
      })
      toast.success('Transfer dispatched; destination stock is unchanged until receipt.')
    }catch(cause){toast.error(cause instanceof Error?cause.message:'Transfer dispatch failed. No stock was changed.')}
  }
  function openReceive(transferId:string){
    const transfer=data.transfers.find(item=>item.id===transferId)
    if(!transfer)return
    setReceiveValues(Object.fromEntries(transfer.items.map(line=>[line.productId,{quantity:'',serials:line.serials.filter(serial=>!line.receivedSerials.includes(serial)).join(',')}])));setError('');setReceive(transferId)
  }
  function receiveTransfer(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    try{
      transact(current=>{
        const transfer=current.transfers.find(item=>item.id===receive&&(item.status==='Dispatched'||item.status==='Partially Received'))
        if(!transfer)throw new Error('This transfer is not awaiting receipt.')
        const now=new Date().toISOString(),updatedItems=transfer.items.map(line=>{
          const product=current.products.find(item=>item.id===line.productId)!
          const remaining=line.dispatchedQuantity-line.receivedQuantity
          const form=receiveValues[line.productId]||{quantity:'',serials:''}
          let quantity=Number(form.quantity),serials:string[]=[]
          if(product.serialRequired){
            serials=serialList(form.serials)
            if(!serials.length)return line
            quantity=serials.length
            if(quantity>remaining||serials.some(serial=>!line.serials.includes(serial)||line.receivedSerials.includes(serial)||!current.serials.some(item=>item.serial===serial&&item.storeId===`T-${transfer.id}`&&item.status==='In Transit')))throw new Error(`Select available, not-yet-received transfer serials for ${product.name}.`)
          }else{
            if(!form.quantity.trim())return line
            if(!Number.isInteger(quantity)||quantity<1||quantity>remaining)throw new Error(`Receive quantity for ${product.name} must be 1–${remaining}.`)
          }
          return {...line,receivedQuantity:line.receivedQuantity+quantity,receivedSerials:[...line.receivedSerials,...serials]}
        })
        if(updatedItems.every((line,index)=>line.receivedQuantity===transfer.items[index].receivedQuantity))throw new Error('Enter at least one received quantity or serial.')
        const allReceived=updatedItems.every(line=>line.receivedQuantity===line.dispatchedQuantity)
        const anyReceived=updatedItems.some(line=>line.receivedQuantity>0)
        const movements:InventoryMovement[]=transfer.items.flatMap(line=>{
          const deltaLine=updatedItems.find(item=>item.productId===line.productId)!
          const receivedNow=deltaLine.receivedQuantity-line.receivedQuantity
          if(!receivedNow)return []
          const product=current.products.find(item=>item.id===line.productId)!
          const serials=product.serialRequired?deltaLine.receivedSerials.slice(line.receivedSerials.length):['']
          return serials.map(serial=>({id:crypto.randomUUID(),reference:transfer.id,productId:product.id,sku:product.sku,serial,fromLocation:`T-${transfer.id}`,toLocation:transfer.destinationLocation,quantity:product.serialRequired?1:receivedNow,type:'Inter-store Transfer In' as const,date:now,actor:'Aarav Sharma',reason:'Transfer quantity confirmed at destination'}))
        })
        const additions=new Map(updatedItems.map(line=>[line.productId,line.receivedQuantity-transfer.items.find(item=>item.productId===line.productId)!.receivedQuantity]))
        for(const line of updatedItems)if(line.receivedQuantity>transfer.items.find(item=>item.productId===line.productId)!.receivedQuantity&&!current.inventory.some(row=>row.productId===line.productId&&row.storeId===transfer.destinationLocation))throw new Error('Destination inventory record is missing. No stock was changed.')
        return {...current,
          inventory:current.inventory.map(row=>row.storeId===transfer.destinationLocation?{...row,quantity:row.quantity+(additions.get(row.productId)||0)}:row),
          serials:current.serials.map(item=>updatedItems.some(line=>line.receivedSerials.slice(transfer.items.find(old=>old.productId===line.productId)!.receivedSerials.length).includes(item.serial))?{...item,storeId:transfer.destinationLocation,status:'Available'}:item),
          transfers:current.transfers.map(item=>item.id===transfer.id?{...item,status:allReceived?'Received':anyReceived?'Partially Received':'Dispatched',receivedAt:allReceived?now:item.receivedAt,items:updatedItems}:item),
          movements:[...current.movements,...movements]
        }
      })
      toast.success('Transfer receipt recorded')
      setReceive('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Transfer receipt failed. No destination stock was changed.')}
  }
  function cancel(id:string){
    try{
      transact(current=>{
        const transfer=current.transfers.find(item=>item.id===id&&['Draft','Requested','Approved'].includes(item.status))
        if(!transfer)throw new Error('Only an undispatched transfer can be cancelled.')
        return {...current,transfers:current.transfers.map(item=>item.id===id?{...item,status:'Cancelled'}:item),audit:[...current.audit,{id:crypto.randomUUID(),date:new Date().toISOString(),action:'Transfer cancelled',actor:'Aarav Sharma',reference:id,detail:'Cancelled before dispatch'}]}
      })
      toast.success('Transfer cancelled and retained in history')
    }catch(cause){toast.error(cause instanceof Error?cause.message:'Transfer could not be cancelled.')}
  }
  const transferDetail=data.transfers.find(item=>item.id===detail)
  return <div className="phase">
    <PageHeader eyebrow="Inventory / Movement" title="Stock transfers" description="Request, approve, dispatch and receive stock without counting in-transit units at the destination."><Button onClick={()=>setCreate(true)}>New transfer</Button></PageHeader>
    <Panel title="Transfer register" meta={`${data.transfers.length} transfers · Dispatch and receipt are single-use state transitions`}>
      {data.transfers.length?<DataTable columns={['Reference','From','To','Products','Created','Status','Actions']} rows={[...data.transfers].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(item=>[
        <button className="textlink" key={item.id} onClick={()=>setDetail(item.id)}>{item.id}</button>,locationName(item.sourceLocation,data.stores),locationName(item.destinationLocation,data.stores),item.items.map(line=>`${data.products.find(product=>product.id===line.productId)?.name} × ${line.quantity}`).join(', '),new Date(item.createdAt).toLocaleDateString('en-IN'),<span className="signal Medium" key={item.id+'status'}>{item.status}</span>,
        <div className="rowlinks" key={item.id+'actions'}>
          {item.status==='Draft'&&<button onClick={()=>request(item.id)}>Submit</button>}
          {item.status==='Requested'&&<button onClick={()=>approve(item.id)}>Approve</button>}
          {item.status==='Approved'&&<button onClick={()=>setConfirmation({id:item.id,action:'Dispatch'})}>Dispatch</button>}
          {(item.status==='Dispatched'||item.status==='Partially Received')&&<button onClick={()=>openReceive(item.id)}>Receive</button>}
          {['Draft','Requested','Approved'].includes(item.status)&&<button onClick={()=>setConfirmation({id:item.id,action:'Cancel'})}>Cancel</button>}
        </div>
      ])}/>:<EmptyState text="No transfers yet. Create a request to begin a tracked stock movement."/>}
    </Panel>
    <Dialog open={create} onOpenChange={setCreate}><DialogContent className="crm-dialog"><DialogTitle>Create a transfer request</DialogTitle><DialogDescription>Serial numbers are checked at request and again before dispatch.</DialogDescription><TransferCreator onCancel={()=>setCreate(false)} onCreate={createTransfer}/></DialogContent></Dialog>
    <Confirmation open={!!confirmation} title={confirmation?.action==='Dispatch'?'Dispatch this transfer?':'Cancel this transfer?'} text={confirmation?.action==='Dispatch'?'Source stock will move into transit. Destination stock changes only when the receiving store confirms delivery.':'This transfer will be marked cancelled and retained in the audit history. Only an undispatched transfer can be cancelled.'} onClose={()=>setConfirmation(null)} onConfirm={()=>{if(confirmation){if(confirmation.action==='Dispatch')dispatch(confirmation.id);else cancel(confirmation.id)}setConfirmation(null)}}/>
    <Dialog open={!!selected} onOpenChange={open=>!open&&setReceive('')}><DialogContent className="crm-dialog"><DialogTitle>Receive transfer {selected?.id}</DialogTitle><DialogDescription>Record all or part of each dispatched line. Destination inventory changes only on confirmation.</DialogDescription>
      {selected&&<form className="crm-form" onSubmit={receiveTransfer}>{selected.items.filter(line=>line.dispatchedQuantity>line.receivedQuantity).map(line=>{
        const product=data.products.find(item=>item.id===line.productId)!
        const left=line.dispatchedQuantity-line.receivedQuantity
        const value=receiveValues[line.productId]||{quantity:'',serials:''}
        return <section className="p4-transfer-receipt" key={line.productId}><strong>{product.name} · {left} remaining</strong>{product.serialRequired?<Field label={`Serials received for ${product.name}`} value={value.serials} onChange={serials=>setReceiveValues(current=>({...current,[line.productId]:{...value,serials}}))} required/>:<Field label={`Quantity received for ${product.name}`} value={value.quantity} onChange={quantity=>setReceiveValues(current=>({...current,[line.productId]:{...value,quantity}}))} type="number" step="1"/>}</section>
      })}{error&&<p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={()=>setReceive('')}>Cancel</Button><Button type="submit">Confirm receipt</Button></DialogFooter></form>}
    </DialogContent></Dialog>
    <DetailDrawer open={!!transferDetail} title={transferDetail?.id||'Transfer details'} onClose={()=>setDetail('')}>{transferDetail&&<><dl className="facts">{[['Source',locationName(transferDetail.sourceLocation,data.stores)],['Destination',locationName(transferDetail.destinationLocation,data.stores)],['Status',transferDetail.status],['Created by',transferDetail.createdBy],['Created at',new Date(transferDetail.createdAt).toLocaleString('en-IN')],['Dispatched at',transferDetail.dispatchedAt?new Date(transferDetail.dispatchedAt).toLocaleString('en-IN'):'Not dispatched'],['Received at',transferDetail.receivedAt?new Date(transferDetail.receivedAt).toLocaleString('en-IN'):'Not fully received'],['Notes',transferDetail.notes||'—']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><DataTable columns={['Product','Requested','Dispatched','Received','Serials']} rows={transferDetail.items.map(line=>[data.products.find(item=>item.id===line.productId)?.name,line.quantity,line.dispatchedQuantity,line.receivedQuantity,line.serials.join(', ')||'Quantity-only'])}/></>}</DetailDrawer>
  </div>
}

export function InventoryAging(){
  const {data}=useDemo()
  const [store,setStore]=useState('All locations'),[bucket,setBucket]=useState('All buckets')
  const now=Date.now()
  const rows=data.inventory.filter(item=>item.quantity>0&&(store==='All locations'||item.storeId===store)).map(stock=>{
    const product=data.products.find(item=>item.id===stock.productId)!
    const serialDates=data.serials.filter(item=>item.productId===product.id&&item.storeId===stock.storeId&&item.status==='Available').map(item=>item.purchaseDate).filter(Boolean) as string[]
    const receiptDates=data.movements.filter(item=>item.productId===product.id&&item.toLocation===stock.storeId&&['Purchase Receipt','Inter-store Transfer In','Putaway','Buyback'].includes(item.type)).map(item=>item.date)
    const receivedAt=serialDates.length?serialDates.sort()[0]:receiptDates.sort()[0]||new Date().toISOString()
    const ageDays=Math.max(0,Math.floor((now-new Date(receivedAt).getTime())/86400000))
    const agingBucket=ageDays<=30?'0–30 days':ageDays<=60?'31–60 days':ageDays<=90?'61–90 days':'Over 90 days'
    return {stock,product,ageDays,agingBucket,value:stock.quantity*product.purchasePricePaise,receivedAt}
  }).filter(item=>bucket==='All buckets'||item.agingBucket===bucket).sort((a,b)=>b.ageDays-a.ageDays)
  return <div className="phase"><PageHeader eyebrow="Inventory / Age profile" title="Inventory aging" description="Estimate on-hand age from recorded receipt dates. Seeded opening dates are illustrative, not supplier documents."/>
    <Panel title="Aging by product and location" meta={`${rows.length} lines · Value uses current purchase price`}>
      <div className="crm-toolbar phase4-toolbar"><Selector label="Filter aging by location" value={store==='All locations'?'All locations':locationName(store,data.stores)} options={['All locations',...data.stores.map(item=>item.name),warehouseLocationName]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||(value===warehouseLocationName?warehouseLocationId:'All locations'))}/><Selector label="Filter aging bucket" value={bucket} options={['All buckets','0–30 days','31–60 days','61–90 days','Over 90 days']} onChange={setBucket}/></div>
      {rows.length?<DataTable columns={['Product','SKU','Location','Quantity','Inventory value','Receipt basis','Stock age','Aging bucket']} rows={rows.slice(0,100).map(row=>[row.product.name,row.product.sku,locationName(row.stock.storeId,data.stores),row.stock.quantity,currency(row.value),new Date(row.receivedAt).toLocaleDateString('en-IN'),`${row.ageDays} days`,row.agingBucket])}/>:<EmptyState text="No on-hand inventory matches this aging filter."/>}
      <p className="crm-note">For serialized stock the original purchase date travels with the serial. For quantity-only stock this prototype estimates age from the oldest recorded receipt at the location; mixed receipt lots are not tracked separately.</p>
    </Panel>
  </div>
}

function allocate(total:number,weights:number[],index:number){
  if(index===weights.length-1)return total-weights.slice(0,index).reduce((sum,value)=>sum+Math.floor(total*value/weights.reduce((a,b)=>a+b,0)),0)
  return Math.floor(total*weights[index]/Math.max(1,weights.reduce((a,b)=>a+b,0)))
}
export function ProductOutstanding(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[store,setStore]=useState('All locations')
  const rows=data.sales.filter(sale=>sale.status==='Completed').flatMap(sale=>{
    const lines=sale.lines.filter(line=>store==='All locations'||sale.storeId===store)
    const weights=sale.lines.map(line=>line.taxablePaise+line.taxPaise)
    const paid=data.payments.filter(payment=>sale.paymentIds.includes(payment.id)).reduce((sum,payment)=>sum+payment.amountPaise,0)
    return lines.map(line=>{
      const index=sale.lines.indexOf(line)
      const invoiceValue=allocate(sale.totalPaise,weights,index),collected=allocate(paid,weights,index)
      const outstanding=Math.max(0,invoiceValue-collected),age=Math.max(0,Math.floor((Date.now()-new Date(sale.date).getTime())/86400000))
      return {sale,line,invoiceValue,collected,outstanding,age}
    })
  }).filter(row=>row.outstanding>0&&(!query||`${row.line.name} ${row.line.sku} ${row.sale.invoiceNumber} ${row.sale.customerName}`.toLowerCase().includes(query.trim().toLowerCase())))
  const totals=rows.reduce((result,row)=>({value:result.value+row.invoiceValue,collected:result.collected+row.collected,due:result.due+row.outstanding}),{value:0,collected:0,due:0})
  return <div className="phase"><PageHeader eyebrow="Inventory / Receivables" title="Product outstanding" description="Allocate real Phase 3 invoice values and payments to product lines; reversed invoices are excluded."/>
    <div className="p4-metrics"><article><span>Outstanding invoice value</span><strong>{currency(totals.value)}</strong></article><article><span>Collected</span><strong>{currency(totals.collected)}</strong></article><article><span>Balance due</span><strong>{currency(totals.due)}</strong></article><article><span>Open product lines</span><strong>{rows.length}</strong></article></div>
    <Panel title="Outstanding by product line" meta="Historical Phase 2 summary invoices do not include product-level balances and are intentionally excluded.">
      <div className="crm-toolbar phase4-toolbar"><SearchBar label="Search product, invoice or customer" value={query} onChange={setQuery}/><Selector label="Filter outstanding by store" value={store==='All locations'?'All locations':locationName(store,data.stores)} options={['All locations',...data.stores.map(item=>item.name)]} onChange={value=>setStore(data.stores.find(item=>item.name===value)?.id||'All locations')}/></div>
      {rows.length?<DataTable columns={['Product','SKU','Store','Invoice','Customer','Sold qty','Invoice value','Amount collected','Outstanding','Age']} rows={rows.map(row=>[row.line.name,row.line.sku,locationName(row.sale.storeId,data.stores),row.sale.invoiceNumber,row.sale.customerName,row.line.quantity,currency(row.invoiceValue),currency(row.collected),currency(row.outstanding),`${row.age} days`])}/>:<EmptyState text="There are no product-level outstanding balances in the selected store."/>}
      <p className="crm-note">Invoice round-off is allocated proportionally by taxable line value. Figures reconcile to current Phase 3 payment records; this is a demo analysis, not an accounting subledger.</p>
    </Panel>
  </div>
}
