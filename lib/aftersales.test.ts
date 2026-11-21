import {describe,expect,it} from 'vitest'
import {initialPhase3State,initialProducts,initialSales} from './phase3-data'
import {initialPhase6State} from './phase6-data'
import {initialPhase7State} from './phase7-data'
import {addMonthsToDate,canRegisterWarranty,getInstallationEligibility,getWarrantyCoverage,transitionServiceTicket,validateInstallationCompletion,validateServiceSource} from './aftersales'
import {recordDemoProof} from './fulfilment'
import type {Delivery} from './phase6-types'
import type {AfterSalesData} from './aftersales'
import type {WarrantyRegistration} from './phase7-types'

function baseData():AfterSalesData{
  return {...initialPhase3State,...initialPhase6State,...initialPhase7State}
}

function serializedSale(data:AfterSalesData){
  const source=initialSales.find(item=>item.status==='Completed')
  const product=initialProducts.find(item=>item.serialRequired)
  if(!source||!product)throw new Error('Completed sale and serialized product seeds are required.')
  const serial='SERIAL-AFTERSALES-TEST'
  const line={...source.lines[0],productId:product.id,name:product.name,brandId:product.brandId,sku:product.sku,model:product.model,
    category:product.category,quantity:1,serials:[serial]}
  const sale={...source,invoiceNumber:'INV-AFTERSALES-TEST',lines:[line],status:'Completed' as const}
  const plan=data.warrantyPlans.find(item=>item.status==='Active'&&item.categories.includes(product.category)&&item.brandIds.includes(product.brandId))
  if(!plan)throw new Error('A matching active retailer plan is required.')
  return {
    serial,product,plan,sale,
    data:{...data,sales:[...data.sales.filter(item=>item.id!==sale.id),sale],
      serials:[...data.serials,{serial,productId:product.id,storeId:sale.storeId,status:'Sold' as const,invoiceId:sale.invoiceNumber,warrantyUntil:'2027-12-31'}]}
  }
}

describe('shared after-sales workflows',()=>{
  it('exposes only the delivered installation balance and excludes already booked units',()=>{
    const data=baseData()
    const delivery=data.deliveries.find(item=>item.status==='Delivered')
    if(!delivery)throw new Error('A delivered installation-eligible seed is required.')
    const sale=data.sales.find(item=>item.id===delivery.saleId)
    const item=delivery.items.find(record=>data.products.find(product=>product.id===record.productId)?.category==='TV & audio')
    if(!sale||!item)throw new Error('The delivered television sale seed is required.')
    const product=data.products.find(record=>record.id===item.productId)
    if(!product||product.serialRequired)throw new Error('The fixture expects a quantity-tracked television.')
    const expandedSale={...sale,lines:sale.lines.map(line=>line.productId===item.productId?{...line,quantity:3}:line)}
    const partialOrder={...delivery,items:delivery.items.map(line=>line.id===item.id?{...line,quantity:3,deliveredQuantity:2}:line)}
    const fixture={...data,sales:data.sales.map(row=>row.id===sale.id?expandedSale:row),deliveries:[partialOrder],installations:[]}
    const eligible=getInstallationEligibility(fixture)
    expect(eligible).toHaveLength(1)
    expect(eligible[0].availableQuantity).toBe(2)
    const booked={...fixture,installations:[{id:'INS-TEST',saleId:sale.id,customerId:sale.customerId,product:product.name,productId:product.id,
      storeId:sale.storeId,deliveryId:delivery.id,deliveryItemId:item.id,serials:[],quantity:1,scheduledDate:'',status:'Scheduled' as const}]}
    expect(getInstallationEligibility(booked)[0].availableQuantity).toBe(1)
  })

  it('creates a serial-linked installation handoff from a delivery confirmation',()=>{
    const data=baseData(),source=initialSales[0]
    const product=initialProducts.find(item=>item.serialRequired&&['Home appliances','TV & audio'].includes(item.category))
    if(!product)throw new Error('An installation-eligible serialized product seed is required.')
    const serial='SERIAL-INSTALL-HANDOFF-TEST'
    const sale={...source,invoiceNumber:'INV-INSTALL-HANDOFF-TEST',lines:[{...source.lines[0],productId:product.id,name:product.name,
      brandId:product.brandId,sku:product.sku,model:product.model,category:product.category,quantity:1,serials:[serial]}]}
    const baseOrder=initialPhase6State.deliveries[0]
    const order:Delivery={...baseOrder,id:'DEL-INSTALL-HANDOFF-TEST',saleId:sale.id,customerId:sale.customerId,storeId:sale.storeId,
      status:'Dispatched',items:[{...baseOrder.items[0],id:'ITEM-INSTALL-HANDOFF-TEST',saleLineId:`${sale.id}-${product.id}`,
        productId:product.id,name:product.name,sku:product.sku,quantity:1,serials:[serial],dispatchedQuantity:1,
        dispatchedSerials:[serial],deliveredQuantity:0,deliveredSerials:[]}]}
    const current={...data,sales:[sale],products:[product],serials:[{serial,productId:product.id,storeId:sale.storeId,status:'Sold' as const,invoiceId:sale.invoiceNumber}],
      deliveries:[order],deliveryProofs:[],deliveryActivities:[],installations:[],installationActivities:[]}
    const result=recordDemoProof(current,order.id,{date:'2026-11-21T11:00:00.000Z',actor:'Demo installer',recipientName:'Nisha Sharma',
      recipientMobile:'9810000001',notes:'Serial appliance delivered.',conditionConfirmed:true,
      lines:[{deliveryItemId:order.items[0].id,quantity:1,serials:[serial]}]})
    expect(result.installations).toHaveLength(1)
    expect(result.installations[0].saleId).toBe(sale.id)
    expect(result.installations[0].serials).toEqual([serial])
    expect(result.installationActivities).toHaveLength(1)
  })

  it('creates retailer coverage only for a sold serial on an eligible completed invoice',()=>{
    const {serial,product,plan,data}=serializedSale(baseData())
    expect(canRegisterWarranty(data,serial,plan.id).sale.invoiceNumber).toBe('INV-AFTERSALES-TEST')
    expect(()=>canRegisterWarranty({...data,serials:data.serials.map(item=>item.serial===serial?{...item,status:'Transferred' as const}:item)},serial,plan.id))
      .toThrow('Select a serial number recorded as sold')
    const start='2026-03-31'
    expect(addMonthsToDate(start,1)).toBe('2026-04-30')
    const registration:WarrantyRegistration={
      id:'WREG-TEST',reference:'EW-TEST',kind:'Retailer Extended',customerId:data.sales[data.sales.length-1].customerId,
      saleId:data.sales[data.sales.length-1].id,invoiceNumber:'INV-AFTERSALES-TEST',productId:product.id,serial,deliveryId:'',
      installationId:'',planId:plan.id,planName:plan.name,durationMonths:plan.durationMonths,pricePaise:plan.pricePaise,
      startDate:'2026-01-01',endDate:'2026-12-31',registrationDate:'2026-01-01',registeredBy:'Demo user',
      coverage:plan.description,exclusions:plan.exclusions,status:'Active',cancellationReason:''
    }
    expect(getWarrantyCoverage({...data,warranties:[registration]},serial,new Date('2026-06-01T12:00:00.000Z'))).toBe('Covered')
    expect(getWarrantyCoverage(data,'',new Date('2026-06-01T12:00:00.000Z'))).toBe('Pending review')
    expect(()=>canRegisterWarranty({...data,warranties:[registration]},serial,plan.id)).toThrow('An active registration already exists')
  })

  it('validates ticket customer, invoice, product and serial relationships',()=>{
    const data=baseData()
    const sale=data.sales.find(item=>item.status==='Completed')
    if(!sale)throw new Error('A completed sale is required.')
    expect(validateServiceSource(data,sale.customerId,sale.id,sale.lines[0].productId,'').sale.id).toBe(sale.id)
    expect(()=>validateServiceSource(data,'CUS-0002',sale.id,sale.lines[0].productId,'')).toThrow('Choose a completed invoice belonging to this customer')
    const {serial,product,data:serialized}=serializedSale(data)
    expect(validateServiceSource(serialized,serialized.sales[serialized.sales.length-1].customerId,
      serialized.sales[serialized.sales.length-1].id,product.id,serial).product.id).toBe(product.id)
    expect(()=>validateServiceSource(serialized,serialized.sales[serialized.sales.length-1].customerId,
      serialized.sales[serialized.sales.length-1].id,product.id,'UNLINKED-SERIAL')).toThrow('serial number must be sold')
  })

  it('enforces technician assignment, resolution notes and installation completion checks',()=>{
    const ticket=initialPhase7State.serviceTickets[0]
    expect(()=>transitionServiceTicket(ticket,'In Progress')).toThrow('cannot move to In Progress')
    const assigned=transitionServiceTicket({...ticket,status:'Assigned',assignedTechnicianId:'TECH-101'},'In Progress')
    expect(assigned.status).toBe('In Progress')
    expect(()=>transitionServiceTicket(assigned,'Resolved')).toThrow('resolution summary')
    expect(transitionServiceTicket(assigned,'Resolved','Replaced the demo component.').status).toBe('Resolved')
    expect(()=>validateInstallationCompletion({status:'In Progress'})).toThrow('Record technician arrival')
    expect(()=>validateInstallationCompletion({status:'In Progress',arrivedAt:'2026-11-21T10:00:00Z',checklist:[{checked:false}],customerConfirmed:true}))
      .toThrow('Complete every installation checklist item')
    expect(()=>validateInstallationCompletion({status:'In Progress',arrivedAt:'2026-11-21T10:00:00Z',checklist:[{checked:true}],customerConfirmed:true})).not.toThrow()
  })
})
