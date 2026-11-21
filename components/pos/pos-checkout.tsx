'use client'
import {useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {ArrowRight,ReceiptText,UserRoundPlus} from 'lucide-react'
import {toast} from 'sonner'
import {useDemo} from '../demo-provider'
import {useWorkspace} from '../workspace'
import {PageHeader,DetailDrawer,Selector} from '../foundation'
import {Panel} from '../analytics-controls'
import {Button} from '../ui/button'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogTitle} from '../ui/dialog'
import CustomerForm from '../customer-form'
import CustomerProfile from '../customer-profile'
import ProductSearch from './product-search'
import CartSummary from './cart-summary'
import PaymentCollection,{collectPaymentAmount} from './payment-collection'
import InvoicePreview from './invoice-preview'
import type {CartLine,SplitPayment} from './pos-types'
import {calculateInvoice,currency,findStoreState,type Customer,type Payment,type Product,type Sale,type SaleLine} from '@/lib/phase3-data'
import {invoicePayments as paymentsForInvoice} from '@/lib/finance'
import {isDeliveryEligibleCategory} from '@/lib/phase6-data'
import {createPosDeliveryOrder} from '@/lib/fulfilment'
import type {InventoryMovement} from '@/lib/phase4-data'
import type {Row} from '@/lib/demo-data'
import type {FulfilmentMode} from '@/lib/phase6-types'

const moneyToPaise=(value:string)=>{
  const parts=value.trim().split('.')
  if(!value.trim())return 0
  if(parts.length>2||!/^\d+$/.test(parts[0])||(parts[1]&&!/^\d{1,2}$/.test(parts[1])))return NaN
  return Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'))
}
const newSplit=():SplitPayment=>({id:crypto.randomUUID(),mode:'Cash',amount:'',reference:'',financier:''})

export default function POSCheckout(){
  const {data,transact,update}=useDemo(),{store,role}=useWorkspace(),router=useRouter()
  const initialStore=data.stores.find(item=>item.name===store&&item.status==='Active')?.id||data.stores.find(item=>item.status==='Active')?.id||''
  const [storeId,setStoreId]=useState(initialStore),[customerId,setCustomerId]=useState('')
  const [cart,setCart]=useState<CartLine[]>([]),[discountPct,setDiscountPct]=useState(0),[discountCode,setDiscountCode]=useState('')
  const [paymentMode,setPaymentMode]=useState('UPI'),[paymentAmount,setPaymentAmount]=useState('')
  const [reference,setReference]=useState(''),[financier,setFinancier]=useState(''),[split,setSplit]=useState<SplitPayment[]>([newSplit(),{...newSplit(),mode:'UPI'}])
  const [customerForm,setCustomerForm]=useState(false),[profileOpen,setProfileOpen]=useState(false)
  const [review,setReview]=useState(false),[invoiceId,setInvoiceId]=useState(''),[error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false),submittingRef=useRef(false)
  const activeStores=data.stores.filter(item=>item.status==='Active')
  const storeRecord=data.stores.find(item=>item.id===storeId)
  const stock=useMemo(()=>Object.fromEntries(data.inventory.filter(item=>item.storeId===storeId).map(item=>[item.productId,item.quantity])),[data.inventory,storeId])
  const activeCustomer=data.customers.find(item=>item.id===customerId&&item.status==='Active')
  const draftLines=cart.flatMap(line=>{
    const product=data.products.find(item=>item.id===line.productId)
    return product?[{quantity:line.quantity,unitPricePaise:product.pricePaise,itemDiscountPct:line.itemDiscountPct,gstRate:product.gstRate}]:[]
  })
  const calculationState=useMemo(()=>{
    if(!cart.length)return {calculation:null,error:''}
    try{
      const customer=data.customers.find(item=>item.id===customerId)
      const calculation=calculateInvoice(draftLines,discountPct,discountCode,!!customer&&!!storeRecord&&customer.state!==findStoreState(storeRecord))
      return {calculation,error:''}
    }catch(cause){return {calculation:null,error:cause instanceof Error?cause.message:'Invoice calculation failed.'}}
  },[cart,draftLines,data.customers,customerId,discountPct,discountCode,storeRecord])
  const calculation=calculationState.calculation
  const currentSale=data.sales.find(sale=>sale.id===invoiceId)
  const invoiceCustomer=currentSale?data.customers.find(item=>item.id===currentSale.customerId):undefined
  const invoiceStore=currentSale?data.stores.find(item=>item.id===currentSale.storeId):undefined
  const invoicePayments=currentSale?paymentsForInvoice(currentSale,data):[]
  const inventoryFor=(productId:string)=>stock[productId]||0
  function addProduct(product:Product){
    const available=inventoryFor(product.id),line=cart.find(item=>item.productId===product.id)
    if(available<1){setError('This product is no longer available at the selected store.');return}
    if(line&&line.quantity>=available){setError(`Only ${available} unit${available===1?'':'s'} of ${product.name} remain at this store.`);return}
    setCart(current=>line?current.map(item=>item.productId===product.id?{...item,quantity:item.quantity+1}:item):[...current,{productId:product.id,quantity:1,itemDiscountPct:0,serials:[],fulfilmentMode:isDeliveryEligibleCategory(product.category)?'Delivery':'Counter pickup'}])
    setError('')
  }
  function changeQuantity(productId:string,quantity:number){
    if(quantity<1){setCart(current=>current.filter(item=>item.productId!==productId));return}
    const available=inventoryFor(productId)
    if(quantity>available){setError(`Only ${available} unit${available===1?'':'s'} are available at this store.`);return}
    setCart(current=>current.map(item=>item.productId===productId?{...item,quantity,serials:item.serials.slice(0,quantity)}:item));setError('')
  }
  function changeSerial(productId:string,index:number,serial:string){
    setCart(current=>current.map(item=>{
      if(item.productId!==productId)return item
      const serials=Array.from({length:item.quantity},(_,unit)=>unit===index?serial:item.serials[unit]||'')
      return {...item,serials}
    }))
  }
  function changeFulfilment(productId:string,value:FulfilmentMode){setCart(current=>current.map(item=>item.productId===productId?{...item,fulfilmentMode:value}:item))}
  function splitChange(id:string,key:keyof SplitPayment,value:string){setSplit(current=>current.map(item=>item.id===id?{...item,[key]:value}:item))}
  function registerCustomer(customer:Customer){
    try{update('customers',[...data.customers,customer]);setCustomerId(customer.id);setCustomerForm(false);toast.success(`${customer.name} registered for checkout`)}
    catch(cause){setError(cause instanceof Error?cause.message:'Customer registration failed.')}
  }
  function beginCheckout(){
    setError('')
    if(!activeCustomer){setError('Select an active customer before checkout.');return}
    if(!storeRecord||storeRecord.status!=='Active'){setError('Select an active store before checkout.');return}
    if(!cart.length||!calculation){setError(calculationState.error||'Add products and resolve any discount errors before checkout.');return}
    const received=collectPaymentAmount(paymentMode,paymentAmount||((calculation.totalPaise/100).toFixed(2)),split)
    if(!Number.isFinite(received)||received<=0||received>calculation.totalPaise){setError('Enter a valid payment amount greater than zero and no more than the invoice total.');return}
    if(paymentMode==='Financing / EMI'&&(!financier.trim()||!reference.trim())){setError('Enter the financier and reference for this demo EMI payment.');return}
    if(paymentMode==='Split Payment'){
      if(split.some(item=>!Number.isFinite(moneyToPaise(item.amount))||moneyToPaise(item.amount)<=0)){setError('Enter a positive amount for every split payment line.');return}
      if(split.some(item=>item.mode==='Financing / EMI'&&(!item.financier.trim()||!item.reference.trim()))){setError('Enter the financier and reference for each EMI split.');return}
    }
    for(const line of cart){
      const product=data.products.find(item=>item.id===line.productId)
      if(!product||line.quantity>inventoryFor(line.productId)){setError('Stock has changed. Check the cart quantities and try again.');return}
      if(product.serialRequired&&(line.serials.length!==line.quantity||line.serials.some(serial=>!serial)||new Set(line.serials).size!==line.quantity)){
        setError(`Assign a different available serial number for every unit of ${product.name}.`);return
      }
    }
    setReview(true)
  }
  function completeCheckout(){
    if(submittingRef.current)return
    submittingRef.current=true;setSubmitting(true);setError('')
    let completed:Sale|undefined
    try{
      const receivedInput=paymentMode==='Split Payment'?split.map(item=>moneyToPaise(item.amount)):null
      const received=paymentMode==='Split Payment'?receivedInput!.reduce((sum,value)=>sum+value,0):moneyToPaise(paymentAmount||((calculation?.totalPaise||0)/100).toFixed(2))
      transact(current=>{
        const customer=current.customers.find(item=>item.id===customerId&&item.status==='Active')
        const chosenStore=current.stores.find(item=>item.id===storeId&&item.status==='Active')
        if(!customer||!chosenStore)throw new Error('The selected customer or store is no longer active.')
        const products=cart.map(line=>{
          const product=current.products.find(item=>item.id===line.productId)
          const stockRow=current.inventory.find(item=>item.productId===line.productId&&item.storeId===storeId)
          if(!product||!stockRow||line.quantity>stockRow.quantity)throw new Error('Stock changed before confirmation. Review the cart and retry.')
          if(product.serialRequired){
            const distinct=new Set(line.serials)
            if(line.serials.length!==line.quantity||distinct.size!==line.quantity||line.serials.some(serial=>!current.serials.some(record=>record.serial===serial&&record.productId===product.id&&record.storeId===storeId&&record.status==='Available'))){
              throw new Error(`Serial availability changed for ${product.name}. Reassign serials before checkout.`)
            }
          }
          return product
        })
        const isInterstate=customer.state!==findStoreState(chosenStore)
        const totals=calculateInvoice(products.map((product,index)=>({quantity:cart[index].quantity,unitPricePaise:product.pricePaise,itemDiscountPct:cart[index].itemDiscountPct,gstRate:product.gstRate})),discountPct,discountCode,isInterstate)
        if(!Number.isFinite(received)||received<=0||received>totals.totalPaise)throw new Error('Payment amount is invalid or greater than the confirmed invoice total.')
        const now=new Date().toISOString(),day=new Date().toISOString().slice(0,10)
        const dayCount=current.sales.filter(sale=>sale.date.slice(0,10)===day).length+1
        const invoiceNumber=`SE-${day.replaceAll('-','')}-${String(dayCount).padStart(4,'0')}`
        const invoiceId=`sale-${crypto.randomUUID()}`
        const invoiceLines:SaleLine[]=products.map((product,index)=>{
          const computed=totals.lines[index]
          return {productId:product.id,name:product.name,brandId:product.brandId,sku:product.sku,model:product.model,category:product.category,quantity:cart[index].quantity,unitPricePaise:product.pricePaise,itemDiscountPct:cart[index].itemDiscountPct,itemDiscountPaise:computed.itemDiscountPaise,cartDiscountPaise:computed.cartDiscountPaise,taxablePaise:computed.taxablePaise,gstRate:product.gstRate,taxPaise:computed.taxPaise,serials:product.serialRequired?[...cart[index].serials]:[],fulfilmentMode:cart[index].fulfilmentMode}
        })
        const entries:Omit<Payment,'id'|'invoiceId'|'customerId'|'date'>[]=paymentMode==='Split Payment'
          ?split.map((item,index)=>({amountPaise:receivedInput![index],mode:item.mode,reference:item.reference.trim(),financier:item.mode==='Financing / EMI'?item.financier.trim():''}))
          :[{amountPaise:received,mode:paymentMode,reference:reference.trim(),financier:paymentMode==='Financing / EMI'?financier.trim():''}]
        const paymentIds=entries.map(()=>crypto.randomUUID())
        const payments:Payment[]=entries.map((entry,index)=>({...entry,id:paymentIds[index],invoiceId:invoiceNumber,customerId:customer.id,date:now,storeId,collectedBy:'Aarav Sharma'}))
        const allocations=payments.map(payment=>({id:`ALLOC-${payment.id}`,paymentId:payment.id,invoiceId:invoiceNumber,amountPaise:payment.amountPaise,createdAt:now,createdBy:'Aarav Sharma'}))
        const amountDue=Math.max(0,totals.totalPaise-received)
        const sale:Sale={
          id:invoiceId,invoiceNumber,date:now,storeId,customerId:customer.id,customerName:customer.name,
          salesperson:current.users.find(user=>user.status==='Active'&&user.role==='Sales Executive')?.name||'Aarav Sharma',
          payment:paymentMode==='Split Payment'?'Split payment':paymentMode,
          lines:invoiceLines,grossPaise:totals.grossPaise,itemDiscountPaise:totals.itemDiscountPaise,cartDiscountPaise:totals.cartDiscountPaise,
          taxablePaise:totals.taxablePaise,cgstPaise:totals.cgstPaise,sgstPaise:totals.sgstPaise,igstPaise:totals.igstPaise,
          taxPaise:totals.taxPaise,roundOffPaise:totals.roundOffPaise,totalPaise:totals.totalPaise,paidPaise:received,balancePaise:amountDue,
          paymentStatus:amountDue===0?'Paid':'Partially paid',paymentIds,status:'Completed',reversalReason:'',reversedAt:'',reversedBy:'',
          createdAt:now,createdBy:`Aarav Sharma · ${role}`
        }
        completed=sale
        const stockByKey=new Map(current.inventory.map(row=>[`${row.storeId}:${row.productId}`,row]))
        for(const line of cart){
          const key=`${storeId}:${line.productId}`,record=stockByKey.get(key)
          if(!record)throw new Error('Inventory record is missing for a selected product.')
          stockByKey.set(key,{...record,quantity:record.quantity-line.quantity})
        }
        const soldSerials=new Set(cart.flatMap(line=>line.serials.filter(Boolean)))
        const newDelivery=createPosDeliveryOrder(sale,customer,'Aarav Sharma',now)
        const newDeliveries=newDelivery?[newDelivery]:[]
        const deliveryActivities=newDeliveries.map(order=>({id:crypto.randomUUID(),deliveryId:order.id,type:'Order created' as const,
          date:now,actor:'Aarav Sharma',status:'Pending' as const,notes:`Created from completed invoice ${invoiceNumber}.`}))
        const audit={id:crypto.randomUUID(),date:now,action:'Sale completed',actor:'Aarav Sharma',reference:invoiceNumber,detail:`${customer.name} · ${chosenStore.name} · ${currency(totals.totalPaise)}`}
        const financialAudit=payments.flatMap(payment=>[
          {id:crypto.randomUUID(),reference:payment.reference||payment.id,activity:'Payment recorded' as const,date:now,actor:'Aarav Sharma',reason:`POS collection · ${payment.mode}`,customerId:customer.id,invoiceId:invoiceNumber},
          {id:crypto.randomUUID(),reference:payment.reference||payment.id,activity:'Payment allocated' as const,date:now,actor:'Aarav Sharma',reason:`Allocated to invoice ${invoiceNumber}`,customerId:customer.id,invoiceId:invoiceNumber}
        ])
        const movements:InventoryMovement[]=cart.flatMap(line=>{
          const product=products.find(item=>item.id===line.productId)!
          const serials=product.serialRequired?line.serials:['']
          return serials.map(serial=>({id:crypto.randomUUID(),reference:invoiceNumber,productId:product.id,sku:product.sku,serial,fromLocation:storeId,toLocation:'',quantity:product.serialRequired?1:line.quantity,type:'Sale',date:now,actor:`Aarav Sharma · ${role}`,reason:`POS invoice ${invoiceNumber}`}))
        })
        return {...current,
          sales:[...current.sales,sale],payments:[...current.payments,...payments],paymentAllocations:[...current.paymentAllocations,...allocations],
          financialAudit:[...current.financialAudit,...financialAudit],
          inventory:[...current.inventory].map(row=>stockByKey.get(`${row.storeId}:${row.productId}`)||row),
          serials:current.serials.map(serial=>soldSerials.has(serial.serial)?{...serial,status:'Sold',invoiceId:invoiceNumber}:serial),
          deliveries:[...current.deliveries,...newDeliveries],deliveryActivities:[...current.deliveryActivities,...deliveryActivities],
          audit:[...current.audit,audit],movements:[...current.movements,...movements]
        }
      })
      if(!completed)throw new Error('Checkout could not be completed. No records were changed.')
      setInvoiceId(completed.id);setReview(false);setCart([]);setDiscountPct(0);setDiscountCode('')
      setPaymentMode('UPI');setPaymentAmount('');setReference('');setFinancier('');setSplit([newSplit(),{...newSplit(),mode:'UPI'}])
      toast.success(`Invoice ${completed.invoiceNumber} created`)
    }catch(cause){setError(cause instanceof Error?cause.message:'Checkout failed. Review the cart and try again.')}
    finally{submittingRef.current=false;setSubmitting(false)}
  }
  const paid=calculation?collectPaymentAmount(paymentMode,paymentAmount||((calculation.totalPaise/100).toFixed(2)),split):0
  return <div className="phase pos-page">
    <PageHeader eyebrow="Sales / Counter checkout" title="POS & billing" description="Build a sale, assign serials, collect a payment and issue a demo invoice.">
      <div className="pos-heading-actions"><span className="pos-prototype-tag"><ReceiptText size={14}/> Demo transaction · no payment gateway</span><Button variant="outline" onClick={()=>router.push('/sales/sales-history')}>Sales history <ArrowRight size={14}/></Button></div>
    </PageHeader>
    <div className="pos-context-bar">
      <Selector label="Checkout store" value={storeRecord?.name||''} options={activeStores.map(item=>item.name)} onChange={value=>{setStoreId(activeStores.find(item=>item.name===value)?.id||'');setError('')}}/>
      <label className="pos-customer-select">Customer
        <select aria-label="Select checkout customer" value={customerId} onChange={event=>setCustomerId(event.target.value)}><option value="">Select a customer</option>{data.customers.filter(item=>item.status==='Active').map(item=><option key={item.id} value={item.id}>{item.name} · {item.mobile} · {item.id}</option>)}</select>
      </label>
      <Button variant="outline" onClick={()=>setCustomerForm(true)}><UserRoundPlus size={15}/> Register customer</Button>
      {activeCustomer&&<Button variant="ghost" onClick={()=>setProfileOpen(true)}>View customer profile</Button>}
    </div>
    <div className="pos-layout">
      <ProductSearch products={data.products} brands={data.brands} stock={stock} onAdd={addProduct}/>
      <CartSummary cart={cart} products={data.products} stock={stock} serials={data.serials.filter(item=>item.storeId===storeId)} calculation={calculation}
        cartDiscountPct={discountPct} discountCode={discountCode}
        onQty={changeQuantity} onRemove={productId=>setCart(current=>current.filter(line=>line.productId!==productId))}
        onItemDiscount={(productId,value)=>setCart(current=>current.map(line=>line.productId===productId?{...line,itemDiscountPct:value}:line))} onFulfilment={changeFulfilment}
        onCartDiscount={setDiscountPct} onDiscountCode={setDiscountCode} onSerial={changeSerial}/>
    </div>
    <div className="pos-lower-grid">
      <PaymentCollection totalPaise={calculation?.totalPaise||0} mode={paymentMode} amount={paymentAmount||((calculation?.totalPaise||0)/100).toFixed(2)}
        reference={reference} financier={financier} split={split} onMode={value=>{setPaymentMode(value);if(value==='Split Payment')setSplit(current=>current.length?current:[newSplit()])}}
        onAmount={setPaymentAmount} onReference={setReference} onFinancier={setFinancier} onSplit={splitChange}
        onAddSplit={()=>setSplit(current=>[...current,newSplit()])} onRemoveSplit={id=>setSplit(current=>current.filter(item=>item.id!==id))}/>
      <Panel title="Ready to issue invoice" meta="Stock and serials are reserved only after confirmation.">
        <div className="pos-checkout-summary"><div><span>Customer</span><strong>{activeCustomer?.name||'Select a customer'}</strong></div><div><span>Store</span><strong>{storeRecord?.name||'Select a store'}</strong></div><div><span>Lines / units</span><strong>{cart.length} / {cart.reduce((sum,line)=>sum+line.quantity,0)}</strong></div><div><span>Received now</span><strong>{currency(Number.isFinite(paid)?paid:0)}</strong></div><div className="pos-checkout-total"><span>Invoice total</span><strong>{currency(calculation?.totalPaise||0)}</strong></div></div>
        {(error||calculationState.error)&&<p role="alert" className="crm-error">{error||calculationState.error}</p>}
        <Button className="pos-confirm-button" disabled={!cart.length||!activeCustomer||!calculation||submitting} onClick={beginCheckout}>Review & confirm checkout</Button>
        <p className="crm-note">Demo-only state stored in this browser tab; it is not a production transaction ledger.</p>
      </Panel>
    </div>
    <Dialog open={customerForm} onOpenChange={open=>!open&&setCustomerForm(false)}><DialogContent className="crm-dialog"><DialogTitle>Register a customer</DialogTitle><DialogDescription>Add a customer without leaving the checkout.</DialogDescription><CustomerForm onSave={registerCustomer} onCancel={()=>setCustomerForm(false)}/></DialogContent></Dialog>
    <DetailDrawer open={profileOpen} title={activeCustomer?.name||'Customer profile'} onClose={()=>setProfileOpen(false)}>{activeCustomer&&<CustomerProfile customer={activeCustomer}/>}</DetailDrawer>
    <Dialog open={review} onOpenChange={open=>!open&&setReview(false)}><DialogContent className="checkout-review">
      <DialogTitle>Confirm this checkout</DialogTitle><DialogDescription>Review the customer, serials, payment and totals. No stock has changed yet.</DialogDescription>
      <dl className="pos-review-facts"><div><dt>Customer</dt><dd>{activeCustomer?.name} · {activeCustomer?.mobile}</dd></div><div><dt>Store</dt><dd>{storeRecord?.name}</dd></div><div><dt>Items</dt><dd>{cart.map(line=>`${data.products.find(item=>item.id===line.productId)?.name} × ${line.quantity}${line.serials.some(Boolean)?` · ${line.serials.filter(Boolean).join(', ')}`:''}`).join('; ')}</dd></div><div><dt>GST calculation</dt><dd>{calculation?.igstPaise?`IGST ${currency(calculation.igstPaise)}`:`CGST ${currency(calculation?.cgstPaise||0)} + SGST ${currency(calculation?.sgstPaise||0)}`}</dd></div><div><dt>Payment</dt><dd>{paymentMode==='Split Payment'?split.map(item=>`${item.mode} ${currency(moneyToPaise(item.amount)||0)}`).join(' + '):`${paymentMode} · ${currency(paid)}`}</dd></div><div><dt>Due after payment</dt><dd>{currency(Math.max(0,(calculation?.totalPaise||0)-(Number.isFinite(paid)?paid:0)))}</dd></div><div className="pos-review-total"><dt>Invoice total</dt><dd>{currency(calculation?.totalPaise||0)}</dd></div></dl>
      {error&&<p role="alert" className="crm-error">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={submitting} onClick={()=>setReview(false)}>Back to checkout</Button><Button type="button" disabled={submitting} onClick={completeCheckout}>{submitting?'Saving…':'Confirm checkout'}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!currentSale&&!!invoiceCustomer} onOpenChange={open=>!open&&setInvoiceId('')}><DialogContent className="invoice-dialog"><DialogTitle className="sr-only">Invoice {currentSale?.invoiceNumber}</DialogTitle>{currentSale&&invoiceCustomer&&<InvoicePreview sale={currentSale} customer={invoiceCustomer} store={invoiceStore as Row|undefined} payments={invoicePayments as Payment[]} company={data.settings.Company}/>}</DialogContent></Dialog>
  </div>
}
