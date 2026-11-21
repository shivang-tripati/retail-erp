import type {Customer,Phase3State,Sale,SaleLine} from './phase3-data'
import {isDeliveryEligibleCategory} from './phase6-data'
import type {Delivery,DeliveryActivity,DeliveryItem,DeliveryManifest,DeliveryProof,DeliveryProofLine,DeliveryStatus} from './phase6-types'
import type {InstallationActivity} from './phase7-types'

export const deliveryStatuses:DeliveryStatus[]=[
  'Pending','Scheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery','Delivered','Failed','Rescheduled','Cancelled'
]
export const deliveryPriorities=['Standard','High','Urgent'] as const
export const deliveryTimeSlots=['09:00–12:00','12:00–15:00','15:00–18:00']
export const deliveryExceptionReasons=['Customer unavailable','Incorrect address','Product damaged','Vehicle issue','Delivery postponed','Customer refused delivery','Other'] as const

export function eligibleSaleLines(sale:Sale){
  return sale.status==='Completed'?sale.lines.filter(line=>line.fulfilmentMode!=='Counter pickup'&&(line.fulfilmentMode==='Delivery'||isDeliveryEligibleCategory(line.category))):[]
}

export function createPosDeliveryOrder(sale:Sale,customer:Customer,actor:string,now:string):Delivery|undefined{
  const lines=sale.status==='Completed'?sale.lines.filter(line=>line.fulfilmentMode==='Delivery'):[]
  if(!lines.length)return undefined
  if(customer.id!==sale.customerId)throw new Error('Delivery customer must match the completed sale.')
  return {
    id:`DEL-${sale.invoiceNumber}`,orderNumber:`DO-${sale.invoiceNumber}`,saleId:sale.id,customerId:customer.id,storeId:sale.storeId,
    items:lines.map((line,index)=>({id:`${sale.id}-${line.productId}-${index+1}`,saleLineId:`${sale.id}-${line.productId}`,
      productId:line.productId,name:line.name,sku:line.sku,quantity:line.quantity,serials:[...line.serials],
      dispatchedQuantity:0,dispatchedSerials:[],deliveredQuantity:0,deliveredSerials:[]})),
    status:'Pending',deliveryAddress:`${customer.address}, ${customer.city}, ${customer.state} ${customer.pinCode}`,
    scheduledDate:'',timeSlot:'',deliveryTeamId:'',vehicleId:'',priority:'Standard',instructions:'',
    createdAt:now,createdBy:actor,dispatchedAt:'',dispatchedBy:'',manifestId:'',updatedAt:now
  }
}

export function remainingEligibleLines(sale:Sale,deliveries:Delivery[]):Array<{line:SaleLine;quantity:number;serials:string[]}>{
  return eligibleSaleLines(sale).flatMap(line=>{
    const saleLineId=`${sale.id}-${line.productId}`
    const reserved=deliveries.filter(order=>order.saleId===sale.id&&order.status!=='Cancelled')
      .flatMap(order=>order.items).filter(item=>item.saleLineId===saleLineId).reduce((sum,item)=>sum+item.quantity,0)
    const quantity=Math.max(0,line.quantity-reserved)
    const alreadyReserved=new Set(deliveries.filter(order=>order.saleId===sale.id&&order.status!=='Cancelled')
      .flatMap(order=>order.items).filter(item=>item.saleLineId===saleLineId).flatMap(item=>item.serials))
    return quantity?[{line,quantity,serials:line.serials.filter(serial=>!alreadyReserved.has(serial)).slice(0,quantity)}]:[]
  })
}

export function outstandingQuantity(item:DeliveryItem){return Math.max(0,item.quantity-item.deliveredQuantity)}
export function isDeliveryComplete(order:Delivery){return order.items.length>0&&order.items.every(item=>item.deliveredQuantity>=item.quantity)}
export function deliveryProductCount(order:Delivery){return order.items.reduce((sum,item)=>sum+item.quantity,0)}
export function deliveryAmount(order:Delivery,sales:Sale[]){
  const sale=sales.find(item=>item.id===order.saleId)
  return order.items.reduce((sum,item)=>{
    const line=sale?.lines.find(saleLine=>saleLine.productId===item.productId)
    return sum+(line?.unitPricePaise||0)*item.quantity
  },0)
}

type ReadinessState=Pick<Phase3State,'sales'|'products'|'serials'|'deliveryTeams'|'deliveryVehicles'|'deliveries'>
export function dispatchReadiness(order:Delivery,data:ReadinessState):string[]{
  const issues:string[]=[]
  const sale=data.sales.find(item=>item.id===order.saleId)
  if(!sale||sale.status!=='Completed')issues.push('Linked sale is not completed.')
  if(order.status!=='Ready for Dispatch')issues.push('Order must be marked Ready for Dispatch.')
  if(!order.deliveryTeamId||!data.deliveryTeams.some(item=>item.id===order.deliveryTeamId&&item.status==='Available'))issues.push('Assign an available delivery team.')
  if(!order.vehicleId||!data.deliveryVehicles.some(item=>item.id===order.vehicleId&&item.status==='Available'))issues.push('Assign an available vehicle.')
  if(!order.scheduledDate)issues.push('Schedule a delivery date.')
  if(!order.items.length)issues.push('No products are linked to this order.')
  for(const item of order.items){
    const line=sale?.lines.find(saleLine=>saleLine.productId===item.productId)
    const product=data.products.find(record=>record.id===item.productId)
    if(!line||item.saleLineId!==`${sale?.id}-${item.productId}`||!line.name||item.name!==line.name)issues.push(`${item.name}: product does not match the linked sale.`)
    const alreadyAllocated=data.deliveries.filter(record=>record.saleId===order.saleId&&record.id!==order.id&&record.status!=='Cancelled')
      .flatMap(record=>record.items).filter(record=>record.saleLineId===item.saleLineId).reduce((sum,record)=>sum+record.quantity,0)
    if(line&&item.quantity+alreadyAllocated>line.quantity)issues.push(`${item.name}: delivery quantity exceeds the remaining eligible sale quantity.`)
    if(item.quantity<=0||item.deliveredQuantity>=item.quantity)issues.push(`${item.name}: no quantity remains for dispatch.`)
    if(product?.serialRequired){
      if(item.serials.length!==item.quantity)issues.push(`${item.name}: every unit must have a sale serial.`)
      const valid=item.serials.every(serial=>data.serials.some(record=>record.serial===serial&&record.productId===item.productId&&record.storeId===sale?.storeId&&record.invoiceId===sale?.invoiceNumber&&record.status==='Sold'))
      if(!valid)issues.push(`${item.name}: one or more sale serials could not be verified.`)
    }
  }
  return [...new Set(issues)]
}

export function appendDeliveryActivity(order:Delivery,type:DeliveryActivity['type'],status:DeliveryStatus,actor:string,notes:string,date=new Date().toISOString()):DeliveryActivity{
  return {id:crypto.randomUUID(),deliveryId:order.id,type,status,actor,notes,date}
}

export function deliveryProgress(order:Delivery){
  const total=order.items.reduce((sum,item)=>sum+item.quantity,0)
  const delivered=order.items.reduce((sum,item)=>sum+item.deliveredQuantity,0)
  return {total,delivered,percent:total?Math.round(delivered/total*100):0}
}

export function localDate(value:string){
  if(!value)return '—'
  return new Date(value).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'})
}
export function localDateTime(value:string){
  if(!value)return '—'
  return new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
}
export function demoDateToday(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date())
}
export function deliveryStoreLabel(storeId:string,data:{stores:Array<{id:string;name:string}>}){
  return data.stores.find(item=>item.id===storeId)?.name||storeId||'Unassigned'
}

type ScheduleState=Pick<Phase3State,'deliveries'|'deliveryTeams'|'deliveryVehicles'|'deliveryManifests'|'deliveryActivities'>
type DispatchState=Pick<Phase3State,'sales'|'products'|'serials'|'deliveries'|'deliveryTeams'|'deliveryVehicles'|'deliveryManifests'|'deliveryActivities'>
type ProofState=Pick<Phase3State,'sales'|'products'|'deliveries'|'deliveryActivities'|'deliveryProofs'|'installations'|'installationActivities'>

export function scheduleDemoDelivery(current:ScheduleState,deliveryId:string,input:{date:string;timeSlot:string;teamId:string;vehicleId:string;priority:Delivery['priority'];instructions:string;actor:string;now:string}){
  const order=current.deliveries.find(item=>item.id===deliveryId)
  if(!order||!['Pending','Scheduled','Rescheduled','Failed','Ready for Dispatch'].includes(order.status)||!order.items.some(item=>item.deliveredQuantity<item.quantity))
    throw new Error('This order is no longer available for scheduling.')
  if(current.deliveryManifests.some(manifest=>manifest.status==='Draft'&&manifest.deliveryIds.includes(order.id)))
    throw new Error('Remove this order from its draft dispatch manifest before rescheduling.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||Number.isNaN(new Date(`${input.date}T12:00:00Z`).getTime())||!input.timeSlot)
    throw new Error('Enter a valid delivery date and time slot.')
  if(!current.deliveryTeams.some(item=>item.id===input.teamId&&item.status==='Available')||
    !current.deliveryVehicles.some(item=>item.id===input.vehicleId&&item.status==='Available'))
    throw new Error('Choose an available delivery team and vehicle.')
  const active=['Scheduled','Rescheduled','Ready for Dispatch','Dispatched','In Transit','Out for Delivery']
  const conflict=current.deliveries.find(item=>item.id!==order.id&&item.scheduledDate===input.date&&item.timeSlot===input.timeSlot&&active.includes(item.status)&&
    (item.deliveryTeamId===input.teamId||item.vehicleId===input.vehicleId))
  if(conflict)throw new Error(`The selected team or vehicle is already assigned to ${conflict.orderNumber} for this slot.`)
  const previous=order.scheduledDate?`${order.scheduledDate} · ${order.timeSlot||'time unspecified'}`:'not previously scheduled'
  const status:DeliveryStatus=order.scheduledDate?'Rescheduled':'Scheduled'
  const updated={...order,scheduledDate:input.date,timeSlot:input.timeSlot,deliveryTeamId:input.teamId,vehicleId:input.vehicleId,
    priority:input.priority,instructions:input.instructions.trim(),status,updatedAt:input.now}
  return {
    deliveries:current.deliveries.map(item=>item.id===order.id?updated:item),
    deliveryActivities:[...current.deliveryActivities,appendDeliveryActivity(updated,order.scheduledDate?'Rescheduled':'Scheduled',status,input.actor,
      `Scheduled for ${input.date} · ${input.timeSlot}; previous schedule: ${previous}.`,input.now)]
  }
}

export function markDemoDeliveryReady(current:DispatchState,deliveryId:string,actor:string,now:string){
  const order=current.deliveries.find(item=>item.id===deliveryId)
  if(!order||!['Scheduled','Rescheduled'].includes(order.status))throw new Error('Only a scheduled delivery can be prepared.')
  const updated={...order,status:'Ready for Dispatch' as const,updatedAt:now}
  const issues=dispatchReadiness(updated,current)
  if(issues.length)throw new Error(issues.join(' '))
  return {
    deliveries:current.deliveries.map(item=>item.id===order.id?updated:item),
    deliveryActivities:[...current.deliveryActivities,appendDeliveryActivity(updated,'Status updated','Ready for Dispatch',actor,'Dispatch preparation checks passed.',now)]
  }
}

export function createDemoManifest(current:DispatchState,deliveryIds:string[],actor:string,now:string){
  const ids=[...new Set(deliveryIds)]
  if(!ids.length)throw new Error('Select one or more ready orders for a manifest.')
  const orders=ids.map(id=>current.deliveries.find(item=>item.id===id))
  if(orders.some(item=>!item||item.status!=='Ready for Dispatch'))throw new Error('Every selected order must still be ready for dispatch.')
  const selected=orders as Delivery[],first=selected[0]
  if(selected.some(item=>item.storeId!==first.storeId||item.deliveryTeamId!==first.deliveryTeamId||item.vehicleId!==first.vehicleId))
    throw new Error('Manifest orders must share one store, team and vehicle.')
  if(current.deliveryManifests.some(manifest=>manifest.status==='Draft'&&manifest.deliveryIds.some(id=>ids.includes(id))))
    throw new Error('A selected delivery order already belongs to a draft manifest.')
  const issues=selected.flatMap(item=>dispatchReadiness(item,current).map(issue=>`${item.orderNumber}: ${issue}`))
  if(issues.length)throw new Error(issues.join(' '))
  const manifest:DeliveryManifest={
    id:`MAN-${crypto.randomUUID()}`,manifestNumber:`DM-${now.slice(0,10).replace(/-/g,'')}-${String(current.deliveryManifests.length+1).padStart(3,'0')}`,
    createdAt:now,createdBy:actor,storeId:first.storeId,deliveryTeamId:first.deliveryTeamId,vehicleId:first.vehicleId,
    deliveryIds:ids,status:'Draft',dispatchedAt:'',dispatchedBy:''
  }
  return {
    manifest,
    deliveryManifests:[...current.deliveryManifests,manifest],
    deliveries:current.deliveries.map(item=>ids.includes(item.id)?{...item,manifestId:manifest.id,updatedAt:now}:item),
    deliveryActivities:[...current.deliveryActivities,...selected.map(item=>appendDeliveryActivity({...item,manifestId:manifest.id},
      'Manifest created',item.status,actor,`Added to manifest ${manifest.manifestNumber}.`,now))]
  }
}

export function dispatchDemoManifest(current:DispatchState,manifestId:string,actor:string,now:string){
  const manifest=current.deliveryManifests.find(item=>item.id===manifestId&&item.status==='Draft')
  if(!manifest)throw new Error('Only a draft manifest can be dispatched.')
  const orders=manifest.deliveryIds.map(id=>current.deliveries.find(item=>item.id===id))
  if(orders.some(item=>!item||item.status!=='Ready for Dispatch'))throw new Error('Every manifest order must still be ready for dispatch.')
  const selected=orders as Delivery[]
  if(!selected.length||selected.some(item=>item.storeId!==manifest.storeId||item.deliveryTeamId!==manifest.deliveryTeamId||item.vehicleId!==manifest.vehicleId))
    throw new Error('Manifest orders no longer match their assigned store, team and vehicle.')
  const issues=selected.flatMap(item=>dispatchReadiness(item,current).map(issue=>`${item.orderNumber}: ${issue}`))
  if(issues.length)throw new Error(issues.join(' '))
  return {
    deliveryManifests:current.deliveryManifests.map(item=>item.id===manifest.id?{...item,status:'Dispatched' as const,dispatchedAt:now,dispatchedBy:actor}:item),
    deliveries:current.deliveries.map(item=>manifest.deliveryIds.includes(item.id)?{...item,status:'Dispatched' as const,dispatchedAt:now,dispatchedBy:actor,
      items:item.items.map(line=>({...line,dispatchedQuantity:line.quantity,dispatchedSerials:[...line.serials]})),updatedAt:now}:item),
    deliveryActivities:[...current.deliveryActivities,...selected.map(item=>appendDeliveryActivity(item,'Dispatched','Dispatched',actor,
      `Dispatched on ${manifest.manifestNumber}. Stock was not deducted again.`,now))]
  }
}

export function recordDemoProof(current:ProofState,deliveryId:string,input:{date:string;actor:string;recipientName:string;recipientMobile:string;notes:string;conditionConfirmed:boolean;lines:DeliveryProofLine[]}){
  const order=current.deliveries.find(item=>item.id===deliveryId&&['Dispatched','In Transit','Out for Delivery'].includes(item.status))
  if(!order)throw new Error('This order is no longer eligible for proof of delivery.')
  if(!input.recipientName.trim()||!/^\d{10}$/.test(input.recipientMobile.trim())||!input.notes.trim()||!input.conditionConfirmed||Number.isNaN(new Date(input.date).getTime()))
    throw new Error('Enter a recipient, valid mobile number, delivery time, notes and condition confirmation.')
  if(!input.lines.length)throw new Error('Enter at least one delivered quantity.')
  const seenItems=new Set<string>(),seenSerials=new Set<string>()
  for(const line of input.lines){
    const item=order.items.find(record=>record.id===line.deliveryItemId),product=item&&current.products.find(record=>record.id===item.productId)
    if(!item||!product||seenItems.has(line.deliveryItemId))throw new Error('Proof contains a missing or duplicate delivery item.')
    seenItems.add(line.deliveryItemId)
    if(!Number.isInteger(line.quantity)||line.quantity<=0||line.quantity>item.dispatchedQuantity-item.deliveredQuantity)
      throw new Error(`${item.name}: delivered quantity exceeds the dispatched balance.`)
    if(product.serialRequired&&(line.serials.length!==line.quantity||line.serials.some(serial=>!item.dispatchedSerials.includes(serial)||item.deliveredSerials.includes(serial))))
      throw new Error(`${item.name}: serial selection must match the quantity and contain undisclosed dispatched serials.`)
    if(!product.serialRequired&&line.serials.length)throw new Error(`${item.name}: quantity-tracked products must not include serial numbers.`)
    for(const serial of line.serials){
      if(seenSerials.has(serial)||current.deliveries.some(record=>record.items.some(recordItem=>recordItem.deliveredSerials.includes(serial))))
        throw new Error('A serial number has already been delivered or selected twice.')
      seenSerials.add(serial)
    }
  }
  const date=new Date(input.date).toISOString(),proof:DeliveryProof={
    id:crypto.randomUUID(),reference:`POD-${order.orderNumber}-${current.deliveryProofs.filter(item=>item.deliveryId===order.id).length+1}`,
    deliveryId:order.id,date,actor:input.actor,recipientName:input.recipientName.trim(),recipientMobile:input.recipientMobile.trim(),
    notes:input.notes.trim(),conditionConfirmed:true,lines:input.lines.map(line=>({...line,serials:[...line.serials]}))
  }
  const items=order.items.map(item=>{
    const delivered=input.lines.find(line=>line.deliveryItemId===item.id)
    return delivered?{...item,deliveredQuantity:item.deliveredQuantity+delivered.quantity,deliveredSerials:[...item.deliveredSerials,...delivered.serials]}:item
  })
  const complete=items.every(item=>item.deliveredQuantity>=item.quantity)
  const status:DeliveryStatus=complete?'Delivered':'Out for Delivery'
  const updated={...order,items,status,updatedAt:date}
  const activities=[appendDeliveryActivity(updated,'Proof of delivery',status,input.actor,
    `${proof.reference}: ${input.lines.reduce((sum,line)=>sum+line.quantity,0)} unit(s) delivered. ${proof.notes}`,date)]
  if(complete)activities.push(appendDeliveryActivity(updated,'Delivery completed','Delivered',input.actor,`All delivery quantities confirmed by ${proof.recipientName}.`,date))
  const sale=current.sales.find(item=>item.id===order.saleId)
  const installationRecords=sale?input.lines.flatMap(delivered=>{
    const item=order.items.find(record=>record.id===delivered.deliveryItemId)
    const line=item&&sale.lines.find(record=>record.productId===item.productId)
    if(!item||!line||!['Home appliances','TV & audio'].includes(line.category))return []
    const units=delivered.serials.length
      ?delivered.serials.map(serial=>({serials:[serial],quantity:1}))
      :[{serials:[],quantity:delivered.quantity}]
    return units.map((unit,index)=>{
      const id=`INS-${order.id}-${item.productId}-${proof.id}-${index+1}`
      const installation={
        id,saleId:sale.id,customerId:order.customerId,product:item.name,productId:item.productId,storeId:order.storeId,
        deliveryId:order.id,deliveryItemId:item.id,serials:unit.serials,quantity:unit.quantity,
        scheduledDate:'',status:'Pending' as const,address:order.deliveryAddress,preferredDate:'',timeSlot:'',
        technicianId:'',serviceType:'On-site',instructions:'',createdAt:date,updatedAt:date,checklist:[],
        customerConfirmed:false,reportReference:''
      }
      const activity:InstallationActivity={
        id:`IHA-${id}-ELIGIBLE`,installationId:id,action:'Eligibility recorded',date,actor:input.actor,
        notes:`${unit.quantity} delivered unit(s) entered the installation queue from ${proof.reference}.`
      }
      return {installation,activity}
    })
  }):[]
  const installations=installationRecords.map(record=>record.installation)
  return {
    proof,complete,
    deliveries:current.deliveries.map(item=>item.id===order.id?updated:item),
    deliveryProofs:[...current.deliveryProofs,proof],
    deliveryActivities:[...current.deliveryActivities,...activities],
    installations:[...current.installations,...installations],
    installationActivities:[...current.installationActivities,...installationRecords.map(record=>record.activity)]
  }
}
