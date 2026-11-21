// Runtime validation coverage for shared delivery fulfillment rules.
import {describe,expect,it} from 'vitest'
import {initialCustomers,initialProducts,initialSales,initialPhase3State} from './phase3-data'
import {initialDeliveryTeams,initialDeliveryVehicles,initialPhase6State} from './phase6-data'
import {createDemoManifest,createPosDeliveryOrder,deliveryProgress,dispatchDemoManifest,dispatchReadiness,markDemoDeliveryReady,outstandingQuantity,recordDemoProof,remainingEligibleLines,scheduleDemoDelivery} from './fulfilment'
import type {Delivery,DeliveryItem} from './phase6-types'

function makeWorkflowState(){
  const source=initialSales[0],product=initialProducts.find(item=>item.category==='Home appliances'&&!item.serialRequired)
  if(!product)throw new Error('Non-serialized appliance demo product seed is missing.')
  const line={...source.lines[0],productId:product.id,name:product.name,brandId:product.brandId,sku:product.sku,model:product.model,
    category:product.category,quantity:2,serials:[],fulfilmentMode:'Delivery' as const}
  const sale={...source,invoiceNumber:'INV-PHASE6-TEST',lines:[line],status:'Completed' as const}
  const team=initialDeliveryTeams[0],vehicle=initialDeliveryVehicles[0]
  const order:Delivery={...initialPhase6State.deliveries[0],id:'DEL-PHASE6-TEST',orderNumber:'DO-PHASE6-TEST',saleId:sale.id,
    customerId:sale.customerId,storeId:sale.storeId,status:'Ready for Dispatch',deliveryAddress:'10 Market Road, New Delhi',
    scheduledDate:'2026-11-21',timeSlot:'09:00–12:00',deliveryTeamId:team.id,vehicleId:vehicle.id,manifestId:'',
    items:[{id:'ITEM-PHASE6-TEST',saleLineId:`${sale.id}-${product.id}`,productId:product.id,name:product.name,sku:product.sku,
      quantity:2,serials:[],dispatchedQuantity:0,dispatchedSerials:[],deliveredQuantity:0,deliveredSerials:[]}]}
  const base={...initialPhase3State,...initialPhase6State,
    sales:initialPhase3State.sales.map(item=>item.id===sale.id?sale:item),deliveries:[order],deliveryManifests:[],
    deliveryProofs:[],deliveryActivities:[],installations:[]}
  return {base,order,sale,team,vehicle}
}

describe('shared delivery fulfilment rules',()=>{
  it('creates POS delivery orders only for completed-sale lines selected for delivery',()=>{
    const source=initialSales[0],customer=initialCustomers.find(item=>item.id===source.customerId)
    if(!customer)throw new Error('Demo sale customer is missing.')
    const productA=initialProducts[0],productB=initialProducts[1]
    const line=(product:typeof productA,fulfilmentMode:'Delivery'|'Counter pickup')=>({...source.lines[0],
      productId:product.id,name:product.name,brandId:product.brandId,sku:product.sku,model:product.model,category:product.category,
      fulfilmentMode,quantity:1,serials:[]})
    const sale={...source,invoiceNumber:'INV-POS-FULFILMENT-TEST',lines:[line(productA,'Delivery'),line(productB,'Counter pickup')],status:'Completed' as const}
    const order=createPosDeliveryOrder(sale,customer,'Demo user','2026-11-21T08:00:00.000Z')
    expect(order?.saleId).toBe(sale.id)
    expect(order?.customerId).toBe(customer.id)
    expect(order?.items.map(item=>item.productId)).toEqual([productA.id])
    expect(order?.items[0].quantity).toBe(1)
    expect(createPosDeliveryOrder({...sale,status:'Reversed'},customer,'Demo user','2026-11-21T08:00:00.000Z')).toBeUndefined()
    expect(createPosDeliveryOrder({...sale,lines:[line(productB,'Counter pickup')]},customer,'Demo user','2026-11-21T08:00:00.000Z')).toBeUndefined()
  })

  it('reserves active quantities once and releases cancelled quantities for a replacement order',()=>{
    const sale=initialSales[0],source=sale.lines[0]
    const line={...source,quantity:3,serials:[],fulfilmentMode:'Delivery' as const}
    const expandedSale={...sale,lines:[line]}
    const item:DeliveryItem={id:'ITEM-TEST',saleLineId:`${sale.id}-${line.productId}`,productId:line.productId,name:line.name,sku:line.sku,
      quantity:1,serials:[],dispatchedQuantity:0,dispatchedSerials:[],deliveredQuantity:0,deliveredSerials:[]}
    const existing:Delivery={...initialPhase6State.deliveries[0],id:'DEL-TEST',saleId:sale.id,items:[item],status:'Scheduled'}
    expect(remainingEligibleLines(expandedSale,[existing])).toEqual([{line,quantity:2,serials:[]}])
    expect(remainingEligibleLines(expandedSale,[{...existing,status:'Cancelled'}])).toEqual([{line,quantity:3,serials:[]}])
  })

  it('requires serial records to match the completed sale before dispatch',()=>{
    const source=initialSales[0],product=initialProducts.find(item=>item.serialRequired)
    if(!product)throw new Error('Serialized demo product seed is missing.')
    const serial='SERIAL-DELIVERY-TEST'
    const line={...source.lines[0],productId:product.id,name:product.name,brandId:product.brandId,sku:product.sku,model:product.model,
      category:product.category,quantity:1,serials:[serial],fulfilmentMode:'Delivery' as const}
    const sale={...source,invoiceNumber:'INV-TEST-DELIVERY',lines:[line],status:'Completed' as const}
    const team=initialDeliveryTeams[0],vehicle=initialDeliveryVehicles[0]
    const order:Delivery={
      ...initialPhase6State.deliveries[0],id:'DEL-TEST-SERIAL',orderNumber:'DO-TEST-SERIAL',saleId:sale.id,storeId:sale.storeId,
      status:'Ready for Dispatch',scheduledDate:'2026-11-21',timeSlot:'09:00–12:00',deliveryTeamId:team.id,vehicleId:vehicle.id,
      items:[{id:'ITEM-SERIAL-TEST',saleLineId:`${sale.id}-${product.id}`,productId:product.id,name:product.name,sku:product.sku,quantity:1,
        serials:[serial],dispatchedQuantity:0,dispatchedSerials:[],deliveredQuantity:0,deliveredSerials:[]}]
    }
    const records={...initialPhase3State,...initialPhase6State,sales:[sale],products:[product],
      serials:[{serial,productId:product.id,storeId:sale.storeId,status:'Sold' as const,invoiceId:sale.invoiceNumber}],
      deliveryTeams:[team],deliveryVehicles:[vehicle]}
    expect(dispatchReadiness(order,records)).toEqual([])
    expect(dispatchReadiness(order,{...records,serials:[]})).toContain(`${product.name}: one or more sale serials could not be verified.`)
    const dispatched:Delivery={...order,status:'Dispatched',items:[{...order.items[0],dispatchedQuantity:1,dispatchedSerials:[serial]}]}
    const proofInput={date:'2026-11-21T10:00:00.000Z',actor:'Demo user',recipientName:'Nisha Sharma',recipientMobile:'9810000001',
      notes:'Serial unit received.',conditionConfirmed:true,lines:[{deliveryItemId:dispatched.items[0].id,quantity:1,serials:[serial]}]}
    const delivered=recordDemoProof({...records,deliveries:[dispatched],deliveryProofs:[],deliveryActivities:[],installations:[]},dispatched.id,proofInput)
    expect(delivered.deliveries[0].items[0].deliveredSerials).toEqual([serial])
    const duplicate={...dispatched,id:'DEL-ALREADY-DELIVERED',items:[{...dispatched.items[0],deliveredQuantity:1,deliveredSerials:[serial]}],status:'Delivered' as const}
    expect(()=>recordDemoProof({...records,deliveries:[dispatched,duplicate],deliveryProofs:[],deliveryActivities:[],installations:[]},dispatched.id,proofInput))
      .toThrow('A serial number has already been delivered or selected twice.')
  })

  it('keeps partially delivered quantities open',()=>{
    const order:Delivery={...initialPhase6State.deliveries[0],items:[{
      ...initialPhase6State.deliveries[0].items[0],quantity:3,deliveredQuantity:1,deliveredSerials:[]
    }]}
    expect(outstandingQuantity(order.items[0])).toBe(2)
    expect(deliveryProgress(order)).toEqual({total:3,delivered:1,percent:33})
  })

  it('schedules without overlapping the same team or vehicle slot and retains the schedule event',()=>{
    const base={...initialPhase3State,...initialPhase6State}
    const pending=base.deliveries.find(item=>item.status==='Pending'),scheduled=base.deliveries.find(item=>item.status==='Scheduled')
    if(!pending||!scheduled)throw new Error('Scheduled and pending demo orders are required.')
    expect(()=>scheduleDemoDelivery(base,pending.id,{date:scheduled.scheduledDate,timeSlot:scheduled.timeSlot,
      teamId:scheduled.deliveryTeamId,vehicleId:initialDeliveryVehicles[1].id,priority:'High',instructions:'',actor:'Demo user',now:'2026-11-21T08:00:00.000Z'}))
      .toThrow('The selected team or vehicle is already assigned')
    const patch=scheduleDemoDelivery(base,pending.id,{date:'2026-11-25',timeSlot:'12:00–15:00',teamId:initialDeliveryTeams[1].id,
      vehicleId:initialDeliveryVehicles[1].id,priority:'High',instructions:'Use the rear entrance',actor:'Demo user',now:'2026-11-21T08:00:00.000Z'})
    expect(patch.deliveries.find(item=>item.id===pending.id)?.status).toBe('Scheduled')
    expect(patch.deliveryActivities.at(-1)?.type).toBe('Scheduled')
  })

  it('creates a manifest, dispatches without changing inventory, and confirms partial then complete delivery',()=>{
    const {base,order}=makeWorkflowState()
    const ready=markDemoDeliveryReady({...base,deliveries:[{...order,status:'Scheduled'}]},order.id,'Demo user','2026-11-21T08:00:00.000Z')
    const readyState={...base,...ready}
    const {manifest,...manifestPatch}=createDemoManifest(readyState,[order.id],'Demo user','2026-11-21T08:10:00.000Z')
    const manifestState={...readyState,...manifestPatch}
    const stockBefore=manifestState.inventory
    const dispatchPatch=dispatchDemoManifest(manifestState,manifest.id,'Demo user','2026-11-21T08:30:00.000Z')
    const dispatched={...manifestState,...dispatchPatch}
    expect(dispatched.inventory).toBe(stockBefore)
    expect(dispatched.deliveries[0].status).toBe('Dispatched')
    expect(dispatched.deliveries[0].items[0].dispatchedQuantity).toBe(2)
    const firstProof=recordDemoProof(dispatched,order.id,{date:'2026-11-21T10:00:00.000Z',actor:'Demo user',recipientName:'Nisha Sharma',
      recipientMobile:'9810000001',notes:'One unit received in good condition.',conditionConfirmed:true,
      lines:[{deliveryItemId:order.items[0].id,quantity:1,serials:[]}]})
    const partial={...dispatched,...firstProof}
    expect(partial.deliveries[0].status).toBe('Out for Delivery')
    expect(partial.deliveries[0].items[0].deliveredQuantity).toBe(1)
    expect(partial.installations).toHaveLength(1)
    expect(partial.installations[0].quantity).toBe(1)
    const finalProof=recordDemoProof(partial,order.id,{date:'2026-11-21T11:00:00.000Z',actor:'Demo user',recipientName:'Nisha Sharma',
      recipientMobile:'9810000001',notes:'Remaining unit delivered.',conditionConfirmed:true,
      lines:[{deliveryItemId:order.items[0].id,quantity:1,serials:[]}]})
    const complete={...partial,...finalProof}
    expect(complete.deliveries[0].status).toBe('Delivered')
    expect(complete.deliveries[0].items[0].deliveredQuantity).toBe(2)
    expect(complete.installations).toHaveLength(2)
    expect(complete.installations.every(item=>item.deliveryId===order.id)).toBe(true)
    expect(complete.deliveryProofs).toHaveLength(2)
  })
})
