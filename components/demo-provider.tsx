'use client'
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {initialStores,initialBrands,initialUsers,initialAlerts,initialSettings} from '@/lib/demo-data'
import {initialPhase3State,type Payment,type Product,type Sale} from '@/lib/phase3-data'
import {initialPhase4State,warehouseLocationId} from '@/lib/phase4-data'
import {initialPhase6State} from '@/lib/phase6-data'
import type {Delivery,DeliveryActivity,DeliveryStatus} from '@/lib/phase6-types'
import {initialPhase7State} from '@/lib/phase7-data'
import type {Installation,InstallationActivity} from '@/lib/phase7-types'
const seed={stores:initialStores,brands:initialBrands,users:initialUsers,alerts:initialAlerts,settings:initialSettings,...initialPhase3State,...initialPhase4State,...initialPhase6State,...initialPhase7State};type State=typeof seed
const C=createContext<{data:State;update:<K extends keyof State>(k:K,v:State[K])=>void;transact:(prepare:(current:State)=>State)=>void;resetDemo:()=>void}|null>(null)
type LegacyDelivery={id:string;saleId:string;customerId:string;storeId:string;products:string;status:string;scheduledDate:string}
const deliveryStatuses:DeliveryStatus[]=['Pending','Scheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery','Delivered','Failed','Rescheduled','Cancelled']
function normalizeDelivery(saved:Delivery|LegacyDelivery,sales:Sale[],customers:State['customers']):Delivery{
  const sale=sales.find(item=>item.id===saved.saleId)
  const customer=customers.find(item=>item.id===saved.customerId)
  if('items' in saved&&Array.isArray(saved.items)){
    const status=sale?.status==='Reversed'?'Cancelled':deliveryStatuses.includes(saved.status)?saved.status:'Pending'
    return {...saved,status,items:saved.items.map(item=>({...item,serials:[...(item.serials||[])],dispatchedSerials:[...(item.dispatchedSerials||[])],deliveredSerials:[...(item.deliveredSerials||[])]}))}
  }
  const legacy=saved as LegacyDelivery
  const line=sale?.lines.find(item=>item.name===legacy.products)
  const status=sale?.status==='Reversed'||legacy.status==='Cancelled by invoice reversal'?'Cancelled':legacy.status==='Ready for collection'?'Pending':
    deliveryStatuses.includes(legacy.status as DeliveryStatus)?legacy.status as DeliveryStatus:'Pending'
  return {
    id:legacy.id,orderNumber:`DO-${sale?.invoiceNumber||legacy.id}`,saleId:legacy.saleId,customerId:legacy.customerId,storeId:legacy.storeId,
    items:line?[{id:`${saved.id}-${line.productId}`,saleLineId:`${sale!.id}-${line.productId}`,productId:line.productId,name:line.name,sku:line.sku,
      quantity:line.quantity,serials:[...line.serials],dispatchedQuantity:0,dispatchedSerials:[],deliveredQuantity:0,deliveredSerials:[]}]:[],
    status,deliveryAddress:customer?`${customer.address}, ${customer.city}, ${customer.state} ${customer.pinCode}`:'',
    scheduledDate:saved.scheduledDate||'',timeSlot:'',deliveryTeamId:'',vehicleId:'',priority:'Standard',instructions:'',
    createdAt:sale?.date||legacy.scheduledDate||new Date().toISOString(),createdBy:sale?.createdBy||'Demo migration',
    dispatchedAt:'',dispatchedBy:'',manifestId:'',updatedAt:sale?.date||legacy.scheduledDate||new Date().toISOString()
  }
}
function normalizeInstallation(saved:Installation,sales:Sale[],deliveries:Delivery[],customers:State['customers'],products:Product[]):Installation{
  const delivery=deliveries.find(item=>item.id===saved.deliveryId||item.id===saved.saleId||item.saleId===saved.saleId)
  const sale=sales.find(item=>item.id===saved.saleId)||sales.find(item=>item.id===delivery?.saleId)
  const item=delivery?.items.find(record=>record.id===saved.deliveryItemId||record.productId===saved.productId||record.name===saved.product)
  const line=sale?.lines.find(record=>record.productId===saved.productId||record.name===saved.product||record.productId===item?.productId)
  const product=products.find(record=>record.id===line?.productId||record.id===item?.productId)
  const customer=customers.find(record=>record.id===saved.customerId)
  const status=saved.status==='Awaiting scheduling'?'Pending':saved.status==='Cancelled by invoice reversal'?'Cancelled':saved.status
  const date=saved.createdAt||delivery?.updatedAt||sale?.date||new Date().toISOString()
  return {
    ...saved,
    saleId:sale?.id||saved.saleId,
    product:product?.name||saved.product,
    productId:product?.id||saved.productId,
    storeId:saved.storeId||delivery?.storeId||sale?.storeId,
    deliveryId:delivery?.id||saved.deliveryId,
    deliveryItemId:item?.id||saved.deliveryItemId,
    serials:[...(saved.serials||item?.deliveredSerials||[])],
    quantity:saved.quantity||item?.deliveredQuantity||1,
    scheduledDate:saved.scheduledDate==='Not scheduled'?'':saved.scheduledDate||'',
    status,
    address:saved.address||(customer?`${customer.address}, ${customer.city}, ${customer.state} ${customer.pinCode}`:delivery?.deliveryAddress||''),
    preferredDate:saved.preferredDate||'',
    timeSlot:saved.timeSlot||'',
    technicianId:saved.technicianId||'',
    serviceType:saved.serviceType||'On-site',
    instructions:saved.instructions||'',
    createdAt:date,
    updatedAt:saved.updatedAt||date,
    checklist:[...(saved.checklist||[])],
    customerConfirmed:saved.customerConfirmed||false,
    reportReference:saved.reportReference||''
  }
}
function mergeRows<T extends {id:string}>(defaults:T[],saved:T[]):T[]{
  return [...defaults.filter(item=>!saved.some(existing=>existing.id===item.id)),...saved]
}
function restore(saved:string):State{
  const parsed=JSON.parse(saved) as Partial<State>,merged={...seed,...parsed}
  const savedSales=parsed.sales||[]
  const sales=[...seed.sales.filter(item=>!savedSales.some(existing=>existing.id===item.id)),...savedSales]
  const savedPayments=parsed.payments||[]
  const payments=[...seed.payments.filter(item=>!savedPayments.some(existing=>existing.id===item.id)),...savedPayments]
  const paymentReversals=merged.paymentReversals||[]
  const savedDeliveryRows=(parsed.deliveries||[]) as Array<Delivery|LegacyDelivery>
  const normalizedSavedDeliveries=savedDeliveryRows.map(item=>normalizeDelivery(item,sales,merged.customers))
  const savedDeliverySaleIds=new Set(normalizedSavedDeliveries.map(item=>item.saleId))
  const deliveries=[...seed.deliveries.filter(item=>!savedDeliverySaleIds.has(item.saleId)),...normalizedSavedDeliveries]
  const deliveryIds=new Set(deliveries.map(item=>item.id))
  const deliveryManifests=parsed.deliveryManifests||seed.deliveryManifests
  const deliveryActivities=[...(seed.deliveryActivities.filter(item=>deliveryIds.has(item.deliveryId)&&!(parsed.deliveryActivities||[]).some(existing=>existing.id===item.id))),
    ...((parsed.deliveryActivities||[]) as DeliveryActivity[])]
  const deliveryExceptions=(parsed.deliveryExceptions||seed.deliveryExceptions).filter(item=>deliveryIds.has(item.deliveryId))
  const deliveryProofs=(parsed.deliveryProofs||seed.deliveryProofs).filter(item=>deliveryIds.has(item.deliveryId))
  const deliveryTeams=[...seed.deliveryTeams.filter(item=>!(parsed.deliveryTeams||[]).some(existing=>existing.id===item.id)),...(parsed.deliveryTeams||[])]
  const deliveryVehicles=[...seed.deliveryVehicles.filter(item=>!(parsed.deliveryVehicles||[]).some(existing=>existing.id===item.id)),...(parsed.deliveryVehicles||[])]
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
  const deliveryCreationActivities:DeliveryActivity[]=deliveries.flatMap(order=>deliveryActivities.some(item=>item.deliveryId===order.id)?[]:[{
    id:`DA-MIG-${order.id}`,deliveryId:order.id,type:'Order created',date:order.createdAt,actor:order.createdBy,status:order.status,notes:'Delivery record migrated from the earlier demo session.'
  }])
  const savedInstallations=parsed.installations||[]
  const normalizedInstallations=savedInstallations.map(item=>normalizeInstallation(item,sales,deliveries,merged.customers,products))
  const installations=mergeRows(seed.installations,normalizedInstallations)
  const installationIds=new Set(installations.map(item=>item.id))
  const savedInstallationActivities=(parsed.installationActivities||[]) as InstallationActivity[]
  const installationActivities=mergeRows(
    seed.installationActivities.filter(item=>installationIds.has(item.installationId)),
    savedInstallationActivities.filter(item=>installationIds.has(item.installationId))
  )
  const technicians=mergeRows(seed.technicians,parsed.technicians||[])
  const warrantyPlans=mergeRows(seed.warrantyPlans,parsed.warrantyPlans||[])
  const warranties=mergeRows(seed.warranties,parsed.warranties||[])
  const serviceTickets=mergeRows(seed.serviceTickets,parsed.serviceTickets||[])
  const serviceTicketIds=new Set(serviceTickets.map(item=>item.id))
  const serviceActivities=mergeRows(
    seed.serviceActivities.filter(item=>serviceTicketIds.has(item.ticketId)),
    (parsed.serviceActivities||[]).filter(item=>serviceTicketIds.has(item.ticketId))
  )
  return {...merged,products,inventory,serials,grns,movements,sales:reconciledSales,payments,paymentAllocations,paymentReversals:paymentReversalsMerged,
    deliveryTeams,deliveryVehicles,deliveryManifests,deliveries,deliveryActivities:[...deliveryActivities,...deliveryCreationActivities],
    deliveryExceptions,deliveryProofs,paymentReconciliations,recoveryCases,recoveryActivities,financialAudit:[...financialAudit,...reversalAudit],
    installations,installationActivities,technicians,warrantyPlans,warranties,serviceTickets,serviceActivities}
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
  function resetDemo(){
    const baseline=JSON.parse(JSON.stringify(seed)) as State
    try{sessionStorage.setItem('retailos-phase2-v1',JSON.stringify(baseline))}
    catch(error){throw new Error('Could not reset demo data in browser storage.',{cause:error})}
    state.current=baseline
    setData(baseline)
  }
  return <C.Provider value={{data,update,transact,resetDemo}}>{children}</C.Provider>
}
export function useDemo(){const c=useContext(C);if(!c)throw new Error('Demo provider required');return c}
