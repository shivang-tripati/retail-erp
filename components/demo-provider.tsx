'use client'
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {initialStores,initialBrands,initialUsers,initialAlerts,initialSettings} from '@/lib/demo-data'
import {initialPhase3State,type Payment,type Product,type Sale} from '@/lib/phase3-data'
import {initialPhase4State,warehouseLocationId} from '@/lib/phase4-data'
const seed={stores:initialStores,brands:initialBrands,users:initialUsers,alerts:initialAlerts,settings:initialSettings,...initialPhase3State,...initialPhase4State};type State=typeof seed
const C=createContext<{data:State;update:<K extends keyof State>(k:K,v:State[K])=>void;transact:(prepare:(current:State)=>State)=>void}|null>(null)
function restore(saved:string):State{
  const parsed=JSON.parse(saved) as Partial<State>,merged={...seed,...parsed}
  const savedSales=parsed.sales||[]
  const sales=[...seed.sales.filter(item=>!savedSales.some(existing=>existing.id===item.id)),...savedSales]
  const savedPayments=parsed.payments||[]
  const payments=[...seed.payments.filter(item=>!savedPayments.some(existing=>existing.id===item.id)),...savedPayments]
  const paymentReversals=merged.paymentReversals||[]
  const knownAllocations=parsed.paymentAllocations||[]
  const paymentAllocations=[
    ...seed.paymentAllocations.filter(item=>!knownAllocations.some(existing=>existing.id===item.id)),
    ...knownAllocations
  ]
  for(const payment of payments){
    if(paymentReversals.some(item=>item.paymentId===payment.id)||paymentAllocations.some(item=>item.paymentId===payment.id)||!payment.invoiceId)continue
    const invoice=sales.find(item=>item.invoiceNumber===payment.invoiceId)
    if(invoice)paymentAllocations.push({id:`ALLOC-MIG-${payment.id}`,paymentId:payment.id,invoiceId:invoice.invoiceNumber,amountPaise:payment.amountPaise,createdAt:payment.date,createdBy:payment.collectedBy||'Demo migration'})
  }
  const recoveryCases=[...seed.recoveryCases.filter(item=>!(parsed.recoveryCases||[]).some(existing=>existing.id===item.id)),...(parsed.recoveryCases||[])]
  const recoveryActivities=parsed.recoveryActivities||seed.recoveryActivities
  const paymentReconciliations=parsed.paymentReconciliations||seed.paymentReconciliations
  const paymentReversalsMerged=parsed.paymentReversals||seed.paymentReversals
  const financialAudit=[...seed.financialAudit.filter(item=>!(parsed.financialAudit||[]).some(existing=>existing.id===item.id)),...(parsed.financialAudit||[])]
  const reversalAudit:State['financialAudit']=paymentReversalsMerged.flatMap(reversal=>{
    const payment=payments.find(item=>item.id===reversal.paymentId)
    if(!payment)return []
    const linkedInvoices=[...new Set(paymentAllocations.filter(item=>item.paymentId===payment.id).map(item=>item.invoiceId))]
    const invoiceIds=linkedInvoices.length?linkedInvoices:payment.invoiceId?[payment.invoiceId]:[undefined]
    return invoiceIds.filter(invoiceId=>!financialAudit.some(item=>item.activity==='Payment reversed'&&item.reference===(payment.reference||payment.id)&&item.invoiceId===invoiceId))
      .map(invoiceId=>({id:`FAUD-REV-${reversal.id}-${invoiceId||'ADVANCE'}`,reference:payment.reference||payment.id,activity:'Payment reversed' as const,
        date:reversal.date,actor:reversal.actor,reason:reversal.reason,customerId:payment.customerId,invoiceId}))
  })
  const missingSeedSales=parsed.sales===undefined?[]:seed.sales.filter(item=>!savedSales.some(existing=>existing.id===item.id)&&item.status==='Completed')
  const productSeeds=new Map(seed.products.map(item=>[item.id,item]))
  const products=merged.products.map(item=>{
    const defaults=productSeeds.get(item.id)
    const serialRequired=item.serialRequired??defaults?.serialRequired??(item.productType==='Serialized')
    const productType:Product['productType']=serialRequired?'Serialized':'Quantity-based'
    return {...defaults,...item,
      productType,
      serialRequired,
      purchasePricePaise:item.purchasePricePaise??defaults?.purchasePricePaise??Math.round(item.pricePaise*.78),
      status:item.status||defaults?.status||'Active'
    }
  })
  const inventory=[...merged.inventory]
  if(parsed.inventory!==undefined)for(const sale of missingSeedSales)for(const line of sale.lines){
    const index=inventory.findIndex(row=>row.storeId===sale.storeId&&row.productId===line.productId)
    if(index>=0)inventory[index]={...inventory[index],quantity:Math.max(0,inventory[index].quantity-line.quantity)}
  }
  const reconciledSales=sales.map((sale:Sale)=>{
    if(sale.status==='Reversed')return {...sale,balancePaise:0}
    const paymentIds=new Set(payments.filter((payment:Payment)=>payment.invoiceId===sale.invoiceNumber).map(payment=>payment.id))
    const paidPaise=Math.min(sale.totalPaise,paymentAllocations.filter(item=>item.invoiceId===sale.invoiceNumber&&paymentIds.has(item.paymentId)&&!paymentReversalsMerged.some(reversal=>reversal.paymentId===item.paymentId)).reduce((sum,item)=>sum+item.amountPaise,0))
    const paymentStatus:Sale['paymentStatus']=paidPaise>=sale.totalPaise?'Paid':paidPaise?'Partially paid':'Unpaid'
    return {...sale,paidPaise,balancePaise:Math.max(0,sale.totalPaise-paidPaise),paymentStatus}
  })
  for(const product of products)for(const location of [...merged.stores.map(item=>item.id),warehouseLocationId]){
    if(!inventory.some(row=>row.productId===product.id&&row.storeId===location))inventory.push({productId:product.id,storeId:location,quantity:0})
  }
  const serialSeeds=new Map(seed.serials.map(item=>[item.serial,item]))
  const serials=merged.serials.map(item=>({...serialSeeds.get(item.serial),...item}))
  const grns=merged.grns.map(grn=>({...grn,items:grn.items.map(line=>{
    const serialRecords=grn.status==='Received'&&products.find(item=>item.id===line.productId)?.serialRequired
      ?serials.filter(record=>record.grnReference===grn.id&&record.productId===line.productId)
      :[]
    return {
      ...line,
      serials:[...new Set([...(line.serials||[]),...serialRecords.filter(record=>record.status!=='Unavailable').map(record=>record.serial)])],
      damagedSerials:[...new Set([...(line.damagedSerials||[]),...serialRecords.filter(record=>record.status==='Unavailable').map(record=>record.serial)])]
    }
  })}))
  const openingReferences=new Set(seed.grns.map(grn=>grn.id))
  const movements=[
    ...merged.movements.filter(movement=>!(openingReferences.has(movement.reference)&&!movement.serial&&products.find(item=>item.id===movement.productId)?.serialRequired)),
    ...seed.movements.filter(movement=>!merged.movements.some(existing=>existing.id===movement.id)&&
      (!openingReferences.has(movement.reference)||!!movement.serial||!products.find(item=>item.id===movement.productId)?.serialRequired))
  ]
  return {...merged,products,inventory,serials,grns,movements,sales:reconciledSales,payments,paymentAllocations,paymentReversals:paymentReversalsMerged,
    paymentReconciliations,recoveryCases,recoveryActivities,financialAudit:[...financialAudit,...reversalAudit]}
}
export function DemoProvider({children}:{children:ReactNode}){
  const [data,setData]=useState(seed),[ready,setReady]=useState(false),state=useRef<State>(seed)
  useEffect(()=>{
    try{
      const saved=sessionStorage.getItem('retailos-phase2-v1')
      if(saved){state.current=restore(saved);setData(state.current)}
    }catch(error){console.error('Unable to restore the demo session.',error)}
    setReady(true)
  },[])
  useEffect(()=>{
    if(!ready)return
    try{sessionStorage.setItem('retailos-phase2-v1',JSON.stringify(data))}
    catch(error){console.error('Unable to persist the demo session.',error)}
  },[data,ready])
  function commit(next:State){
    try{sessionStorage.setItem('retailos-phase2-v1',JSON.stringify(next))}
    catch(error){throw new Error('Could not save this demo session in browser storage.',{cause:error})}
    state.current=next
    setData(next)
  }
  function update<K extends keyof State>(key:K,value:State[K]){commit({...state.current,[key]:value})}
  function transact(prepare:(current:State)=>State){commit(prepare(state.current))}
  return <C.Provider value={{data,update,transact}}>{children}</C.Provider>
}
export function useDemo(){const c=useContext(C);if(!c)throw new Error('Demo provider required');return c}
