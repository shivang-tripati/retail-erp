'use client'
import {useMemo,useState,type FormEvent} from 'react'
import {toast} from 'sonner'
import {PageHeader,DataTable,DetailDrawer,EmptyState,SearchBar,Selector,Confirmation} from '../foundation'
import {Panel} from '../analytics-controls'
import {Button} from '../ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '../ui/dialog'
import {useDemo} from '../demo-provider'
import {categories} from '@/lib/demo-data'
import {currency,type Product,productBrandName} from '@/lib/phase3-data'
import {warehouseLocationId,warehouseLocationName} from '@/lib/phase4-data'
import {Field,locationName} from './shared'

const pageSize=20
const dollarsToPaise=(value:string)=>{if(!/^\d+(\.\d{1,2})?$/.test(value.trim()))return NaN;const [rupees,paise='']=value.trim().split('.');return Number(rupees)*100+Number(paise.padEnd(2,'0'))}
const moneyField=(paise:number)=>((paise||0)/100).toFixed(2)

function ProductEditor({product,onSave,onCancel}:{product?:Product;onSave:(product:Product)=>void;onCancel:()=>void}){
  const {data}=useDemo()
  const [name,setName]=useState(product?.name||''),[sku,setSku]=useState(product?.sku||''),[model,setModel]=useState(product?.model||'')
  const [brandId,setBrandId]=useState(product?.brandId||data.brands[0]?.id||''),[category,setCategory]=useState(product?.category||categories[0])
  const [productType,setProductType]=useState<Product['productType']>(product?.productType||(product?.serialRequired?'Serialized':'Quantity-based'))
  const [purchase,setPurchase]=useState(moneyField(product?.purchasePricePaise||0)),[selling,setSelling]=useState(moneyField(product?.pricePaise||0)),[gst,setGst]=useState(String(product?.gstRate??18))
  const [error,setError]=useState('')
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    const purchasePricePaise=dollarsToPaise(purchase),pricePaise=dollarsToPaise(selling),gstRate=Number(gst)
    if(!name.trim()||!sku.trim()||!model.trim()||!brandId||!Number.isFinite(purchasePricePaise)||purchasePricePaise<=0||!Number.isFinite(pricePaise)||pricePaise<=0||!Number.isFinite(gstRate)||gstRate<0||gstRate>100){setError('Enter the required product details and valid non-negative prices and GST rate.');return}
    if(data.products.some(item=>item.id!==product?.id&&(item.sku.toLowerCase()===sku.trim().toLowerCase()||item.model.toLowerCase()===model.trim().toLowerCase()))){setError('SKU and model numbers must be unique.');return}
    if(product&&data.serials.some(item=>item.productId===product.id)&&productType!=='Serialized'){setError('Products with registered serial history must remain serial-tracked.');return}
    setError('')
    onSave({id:product?.id||`PR-${crypto.randomUUID().slice(0,8).toUpperCase()}`,name:name.trim(),sku:sku.trim().toUpperCase(),model:model.trim().toUpperCase(),brandId,category,productType,purchasePricePaise,pricePaise,gstRate,serialRequired:productType==='Serialized',status:product?.status||'Active'})
  }
  return <form className="crm-form" onSubmit={submit} noValidate>
    <div className="crm-form-grid">
      <Field label="Product name" value={name} onChange={setName}/>
      <Field label="SKU" value={sku} onChange={setSku}/>
      <Field label="Model number" value={model} onChange={setModel}/>
      <label className="crm-field">Brand<select aria-label="Brand" required value={brandId} onChange={event=>setBrandId(event.target.value)}>{data.brands.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="crm-field">Category<select aria-label="Category" required value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(item=><option key={item}>{item}</option>)}</select></label>
      <label className="crm-field">Product type<select aria-label="Product type" required value={productType} disabled={!!product&&data.serials.some(item=>item.productId===product.id)} onChange={event=>setProductType(event.target.value as Product['productType'])}><option>Serialized</option><option>Quantity-based</option></select></label>
      <Field label="Purchase price (₹)" value={purchase} onChange={setPurchase} type="number" step="0.01"/>
      <Field label="Selling price (₹)" value={selling} onChange={setSelling} type="number" step="0.01"/>
      <Field label="GST rate (%)" value={gst} onChange={setGst} type="number" step="0.1"/>
    </div>
    {error&&<p role="alert" className="crm-error">{error}</p>}
    <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">{product?'Save product':'Create product'}</Button></DialogFooter>
  </form>
}

export function ProductCatalogue(){
  const {data,update,transact}=useDemo()
  const [query,setQuery]=useState(''),[category,setCategory]=useState('All categories'),[brand,setBrand]=useState('All brands')
  const [sort,setSort]=useState('Name A–Z'),[page,setPage]=useState(0),[formOpen,setFormOpen]=useState(false),[editing,setEditing]=useState<Product|undefined>()
  const [detail,setDetail]=useState<Product|undefined>(),[deactivate,setDeactivate]=useState<Product|undefined>()
  const filtered=useMemo(()=>data.products.filter(product=>
    (!query||`${product.name} ${product.sku} ${product.model} ${productBrandName(product,data.brands)}`.toLowerCase().includes(query.trim().toLowerCase()))&&
    (category==='All categories'||product.category===category)&&(brand==='All brands'||product.brandId===data.brands.find(item=>item.name===brand)?.id)
  ),[data.products,data.brands,query,category,brand])
  const sorted=[...filtered].sort((a,b)=>sort==='Name A–Z'?a.name.localeCompare(b.name):sort==='Price: high to low'?b.pricePaise-a.pricePaise:sort==='Price: low to high'?a.pricePaise-b.pricePaise:a.sku.localeCompare(b.sku))
  const visible=sorted.slice(page*pageSize,(page+1)*pageSize)
  function saveProduct(product:Product){
    try{
      if(editing)update('products',data.products.map(item=>item.id===product.id?product:item))
      else{
        transact(current=>({...current,products:[...current.products,product],inventory:[...current.inventory,...current.stores.map(store=>({productId:product.id,storeId:store.id,quantity:0})),{productId:product.id,storeId:warehouseLocationId,quantity:0}]}))
      }
      toast.success(editing?'Product updated':'Product created')
      setFormOpen(false);setEditing(undefined)
    }catch(error){toast.error(error instanceof Error?error.message:'Product could not be saved.')}
  }
  function setStatus(product:Product){
    update('products',data.products.map(item=>item.id===product.id?{...item,status:(product.status==='Active'?'Inactive':'Active') as Product['status']}:item))
    toast.success(`Product ${product.status==='Active'?'deactivated':'activated'}`)
    setDeactivate(undefined)
  }
  return <div className="phase">
    <PageHeader eyebrow="Products / Catalogue" title="Product catalogue" description="Maintain the shared product, pricing and serial-tracking records used by POS and inventory.">
      <Button onClick={()=>{setEditing(undefined);setFormOpen(true)}}>Add product</Button>
    </PageHeader>
    <Panel title="Products" meta={`${filtered.length} products · SKU and model values must be unique`}>
      <div className="crm-toolbar phase4-toolbar">
        <SearchBar label="Search products, SKU, model or brand" value={query} onChange={value=>{setQuery(value);setPage(0)}}/>
        <Selector label="Filter products by category" value={category} options={['All categories',...categories]} onChange={value=>{setCategory(value);setPage(0)}}/>
        <Selector label="Filter products by brand" value={brand} options={['All brands',...data.brands.map(item=>item.name)]} onChange={value=>{setBrand(value);setPage(0)}}/>
        <Selector label="Sort products" value={sort} options={['Name A–Z','SKU','Price: high to low','Price: low to high']} onChange={setSort}/>
      </div>
      {visible.length?<DataTable columns={['Product','SKU / Model','Brand','Category','Type','Purchase price','Selling price','GST','Status','Actions']} rows={visible.map(product=>[
        <button key={product.id} className="crm-customer-link" onClick={()=>setDetail(product)}><b>{product.name}</b><small>{product.id}</small></button>,
        <span key={product.id+'sku'}>{product.sku}<small className="p4-sub">{product.model}</small></span>,productBrandName(product,data.brands),product.category,product.productType,currency(product.purchasePricePaise),currency(product.pricePaise),`${product.gstRate}%`,
        <span key={product.id+'status'} className={`signal ${product.status==='Active'?'Active':'Low'}`}>{product.status}</span>,
        <div className="rowlinks" key={product.id+'actions'}><button onClick={()=>{setEditing(product);setFormOpen(true)}}>Edit</button><button onClick={()=>setDeactivate(product)}>{product.status==='Active'?'Deactivate':'Activate'}</button></div>
      ])}/>:<EmptyState text="No products match these filters."/>}
      <div className="crm-pagination"><span>Showing {filtered.length?page*pageSize+1:0}–{Math.min((page+1)*pageSize,filtered.length)} of {filtered.length}</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(filtered.length/pageSize))}</span><Button variant="outline" disabled={(page+1)*pageSize>=filtered.length} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
    </Panel>
    <Dialog open={formOpen} onOpenChange={open=>{if(!open){setFormOpen(false);setEditing(undefined)}}}><DialogContent className="crm-dialog"><DialogTitle>{editing?'Edit product':'Add product'}</DialogTitle><DialogDescription>Changes are shared with POS and inventory for this browser session.</DialogDescription><ProductEditor key={editing?.id||'new-product'} product={editing} onSave={saveProduct} onCancel={()=>{setFormOpen(false);setEditing(undefined)}}/></DialogContent></Dialog>
    <Confirmation open={!!deactivate} title={`${deactivate?.status==='Active'?'Deactivate':'Activate'} ${deactivate?.name}?`} text="This changes catalogue availability; it does not remove historical stock or sales records." onClose={()=>setDeactivate(undefined)} onConfirm={()=>deactivate&&setStatus(deactivate)}/>
    <DetailDrawer open={!!detail} title={detail?.name||'Product details'} onClose={()=>setDetail(undefined)}>{detail&&<ProductDetails product={data.products.find(item=>item.id===detail.id)||detail}/>}</DetailDrawer>
  </div>
}

function ProductDetails({product}:{product:Product}){
  const {data}=useDemo(),[tab,setTab]=useState('Overview'),[page,setPage]=useState(0)
  const tabs=['Overview','Pricing','Serial Numbers','Stock by Store','Stock Ledger','Sales History','Purchase History']
  const productSerials=data.serials.filter(item=>item.productId===product.id)
  const productMovements=data.movements.filter(item=>item.productId===product.id).sort((a,b)=>b.date.localeCompare(a.date))
  const purchases=productMovements.filter(item=>['Purchase Receipt','Buyback'].includes(item.type))
  const sales=data.sales.filter(sale=>sale.status==='Completed'&&sale.lines.some(line=>line.productId===product.id))
  const stock=data.inventory.filter(item=>item.productId===product.id)
  const paginate=(count:number)=>count>pageSize?<div className="crm-pagination"><span>Showing {page*pageSize+1}–{Math.min((page+1)*pageSize,count)} of {count}</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.ceil(count/pageSize)}</span><Button variant="outline" disabled={(page+1)*pageSize>=count} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>:null
  return <div className="p4-detail">
    <nav className="crm-tabs" aria-label="Product detail tabs">{tabs.map(item=><button type="button" key={item} aria-pressed={tab===item} onClick={()=>{setTab(item);setPage(0)}}>{item}</button>)}</nav>
    {tab==='Overview'&&<dl className="facts">{[['SKU',product.sku],['Model',product.model],['Brand',productBrandName(product,data.brands)],['Category',product.category],['Type',product.productType],['Status',product.status],['Serial tracking',product.serialRequired?'Required':'Not required']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {tab==='Pricing'&&<dl className="facts">{[['Purchase price',currency(product.purchasePricePaise)],['Selling price',currency(product.pricePaise)],['Illustrative GST',`${product.gstRate}%`],['Gross margin',currency(product.pricePaise-product.purchasePricePaise)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {tab==='Serial Numbers'&&(productSerials.length?<><DataTable columns={['Serial','Store / location','Status','GRN','Purchase date','Sale invoice','Warranty']} rows={productSerials.slice(page*pageSize,(page+1)*pageSize).map(item=>[item.serial,locationName(item.storeId,data.stores),item.status,item.grnReference||'Not recorded',item.purchaseDate?new Date(item.purchaseDate).toLocaleDateString('en-IN'):'Not recorded',item.invoiceId||'—',item.warrantyUntil?new Date(item.warrantyUntil).toLocaleDateString('en-IN'):'Not recorded'])}/>{paginate(productSerials.length)}</>:<EmptyState text="No serial records exist for this product."/>)}
    {tab==='Stock by Store'&&<DataTable columns={['Location','Quantity','Inventory value']} rows={stock.map(item=>[locationName(item.storeId,data.stores),item.quantity,currency(item.quantity*product.purchasePricePaise)])}/>}
    {tab==='Stock Ledger'&&<><DataTable columns={['Date','Movement','Reference','Location','Qty','Reason']} rows={productMovements.slice(page*pageSize,(page+1)*pageSize).map(item=>[new Date(item.date).toLocaleDateString('en-IN'),item.type,item.reference,locationName(item.toLocation||item.fromLocation,data.stores),item.quantity,item.reason])}/>{paginate(productMovements.length)}</>}
    {tab==='Sales History'&&(sales.length?<><DataTable columns={['Invoice','Date','Customer','Quantity','Invoice total','Status']} rows={sales.slice(page*pageSize,(page+1)*pageSize).map(sale=>[sale.invoiceNumber,new Date(sale.date).toLocaleDateString('en-IN'),sale.customerName,sale.lines.filter(line=>line.productId===product.id).reduce((sum,line)=>sum+line.quantity,0),currency(sale.totalPaise),sale.paymentStatus])}/>{paginate(sales.length)}</>:<EmptyState text="No completed POS sales exist for this product."/>)}
    {tab==='Purchase History'&&<><DataTable columns={['Date','Reference','Supplier / source','Quantity','Purchase value','Reason']} rows={purchases.slice(page*pageSize,(page+1)*pageSize).map(item=>[new Date(item.date).toLocaleDateString('en-IN'),item.reference,item.fromLocation||'Supplier',item.quantity,currency(item.quantity*product.purchasePricePaise),item.reason])}/>{paginate(purchases.length)}</>}
  </div>
}

export function SerialRegistry(){
  const {data}=useDemo()
  const [query,setQuery]=useState(''),[product,setProduct]=useState('All products'),[store,setStore]=useState('All locations'),[status,setStatus]=useState('All statuses'),[selected,setSelected]=useState<string>(''),[page,setPage]=useState(0)
  const filtered=data.serials.filter(serial=>{
    const item=data.products.find(product=>product.id===serial.productId)
    const location=locationName(serial.storeId,data.stores)
    return (!query||`${serial.serial} ${item?.name||''} ${item?.sku||''} ${serial.invoiceId||''} ${serial.grnReference||''}`.toLowerCase().includes(query.trim().toLowerCase()))&&
      (product==='All products'||serial.productId===product)&&(store==='All locations'||location===store)&&(status==='All statuses'||serial.status===status)
  })
  const visible=filtered.slice(page*50,(page+1)*50)
  const record=data.serials.find(item=>item.serial===selected)
  const recordProduct=record&&data.products.find(item=>item.id===record.productId)
  const movements=record?data.movements.filter(item=>item.serial===record.serial).sort((a,b)=>b.date.localeCompare(a.date)):[]
  const transitLocations=[...new Set(data.serials.map(item=>item.storeId).filter(id=>id.startsWith('T-')))]
  return <div className="phase">
    <PageHeader eyebrow="Products / Traceability" title="Serial registry" description="Trace serialized units through receipts, transfers, sales, returns and service."/>
    <Panel title="Serial numbers" meta={`${filtered.length.toLocaleString('en-IN')} records · Sold serials change only through sale reversal or approved return workflows.`}>
      <div className="crm-toolbar phase4-toolbar"><SearchBar label="Search serial, product or reference" value={query} onChange={value=>{setQuery(value);setPage(0)}}/><Selector label="Filter serials by product" value={product} options={['All products',...data.products.filter(item=>item.serialRequired).map(item=>item.name)]} onChange={value=>{setProduct(data.products.find(item=>item.name===value)?.id||'All products');setPage(0)}}/><Selector label="Filter serials by location" value={store} options={['All locations',...data.stores.map(item=>item.name),warehouseLocationName,...transitLocations]} onChange={value=>{setStore(value);setPage(0)}}/><Selector label="Filter serials by status" value={status} options={['All statuses','In Transit','Available','Reserved','Sold','Returned','Under Service','Scrapped','Unavailable','Transferred']} onChange={value=>{setStatus(value);setPage(0)}}/></div>
      {visible.length?<DataTable columns={['Serial number','Product / SKU','Brand','Store / warehouse','Status','GRN reference','Purchase date','Sale invoice','Warranty']} rows={visible.map(serial=>{
        const item=data.products.find(product=>product.id===serial.productId)
        const sale=serial.invoiceId&&data.sales.find(record=>record.invoiceNumber===serial.invoiceId)
        return [<button className="textlink" key={serial.serial} onClick={()=>setSelected(serial.serial)}>{serial.serial}</button>,<span key={serial.serial+'product'}>{item?.name}<small className="p4-sub">{item?.sku}</small></span>,item?productBrandName(item,data.brands):'—',locationName(serial.storeId,data.stores),serial.status,serial.grnReference||'—',serial.purchaseDate?new Date(serial.purchaseDate).toLocaleDateString('en-IN'):'—',sale?<button className="textlink" onClick={()=>toast.info(`Invoice ${sale.invoiceNumber} · ${sale.customerName}`)}>{sale.invoiceNumber}</button>:serial.invoiceId||'—',serial.warrantyUntil?new Date(serial.warrantyUntil).toLocaleDateString('en-IN'):'—']
      })}/>:<EmptyState text="No serial numbers match these filters."/>}
      <div className="crm-pagination"><span>Showing {filtered.length?page*50+1:0}–{Math.min((page+1)*50,filtered.length)} of {filtered.length}</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(filtered.length/50))}</span><Button variant="outline" disabled={(page+1)*50>=filtered.length} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
    </Panel>
    <DetailDrawer open={!!record} title={record?.serial||'Serial details'} onClose={()=>setSelected('')}>{record&&recordProduct&&<><dl className="facts">{[['Product',recordProduct.name],['SKU',recordProduct.sku],['Brand',productBrandName(recordProduct,data.brands)],['Location',locationName(record.storeId,data.stores)],['Status',record.status],['GRN reference',record.grnReference||'Not recorded'],['Purchase date',record.purchaseDate?new Date(record.purchaseDate).toLocaleDateString('en-IN'):'Not recorded'],['Sale reference',record.invoiceId||'Not sold'],['Warranty',record.warrantyUntil?new Date(record.warrantyUntil).toLocaleDateString('en-IN'):'Not recorded'],['Customer',data.sales.find(sale=>sale.invoiceNumber===record.invoiceId)?.customerName||'—']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>Serial history</h3>{movements.length?<DataTable columns={['Date','Movement','Reference','From','To','Reason']} rows={movements.map(item=>[new Date(item.date).toLocaleString('en-IN'),item.type,item.reference,locationName(item.fromLocation,data.stores),locationName(item.toLocation,data.stores),item.reason])}/>:<EmptyState text="No movement detail is recorded for this seeded serial."/ >}</>}</DetailDrawer>
  </div>
}
