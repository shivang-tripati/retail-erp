import {initialCustomers,initialSales} from './phase3-data'
import type {Installation} from './phase7-types'
import type {Delivery,DeliveryActivity,DeliveryException,DeliveryManifest,DeliveryProof,DeliveryTeam,DeliveryVehicle} from './phase6-types'

export const initialDeliveryTeams:DeliveryTeam[]=[
  {id:'TEAM-NORTH',name:'North Route Team',lead:'Rohan Khanna',mobile:'9811000201',status:'Available'},
  {id:'TEAM-CENTRAL',name:'Central Route Team',lead:'Nisha Batra',mobile:'9811000202',status:'Available'},
  {id:'TEAM-WEST',name:'West Route Team',lead:'Kabir Mehta',mobile:'9811000203',status:'Available'},
  {id:'TEAM-SOUTH',name:'South Route Team',lead:'Meera Sethi',mobile:'9811000204',status:'Available'}
]

export const initialDeliveryVehicles:DeliveryVehicle[]=[
  {id:'VEH-01',registration:'DL 1L AB 2401',type:'Closed delivery van',capacity:'1,000 kg',status:'Available'},
  {id:'VEH-02',registration:'DL 1L AB 2402',type:'Light commercial vehicle',capacity:'750 kg',status:'Available'},
  {id:'VEH-03',registration:'HR 55 C 2403',type:'Closed delivery van',capacity:'1,200 kg',status:'Available'},
  {id:'VEH-04',registration:'UP 16 D 2404',type:'Two-wheeler cargo',capacity:'40 kg',status:'Available'}
]

const isDeliveryLine=(category:string)=>['Home appliances','TV & audio','Small appliances'].includes(category)
const statusByInvoice:Record<string,Delivery['status']>={
  'INV-DEMO-2401':'Scheduled',
  'INV-DEMO-2402':'Delivered',
  'INV-DEMO-2403':'Failed',
  'INV-DEMO-2405':'Ready for Dispatch',
  'INV-DEMO-2407':'In Transit',
  'INV-DEMO-2408':'Pending'
}
const scheduleByInvoice:Record<string,string>={
  'INV-DEMO-2401':'2026-11-21',
  'INV-DEMO-2402':'2026-09-11',
  'INV-DEMO-2403':'2026-10-13',
  'INV-DEMO-2405':'2026-11-21',
  'INV-DEMO-2407':'2026-08-22'
}
const teamByInvoice:Record<string,string>={
  'INV-DEMO-2401':'TEAM-CENTRAL',
  'INV-DEMO-2402':'TEAM-CENTRAL',
  'INV-DEMO-2403':'TEAM-NORTH',
  'INV-DEMO-2405':'TEAM-WEST',
  'INV-DEMO-2407':'TEAM-SOUTH'
}
const vehicleByInvoice:Record<string,string>={
  'INV-DEMO-2401':'VEH-01',
  'INV-DEMO-2402':'VEH-02',
  'INV-DEMO-2403':'VEH-01',
  'INV-DEMO-2405':'VEH-03',
  'INV-DEMO-2407':'VEH-02'
}

const initialSeedOrders:Delivery[]=initialSales
  .filter(sale=>sale.status==='Completed'&&statusByInvoice[sale.invoiceNumber])
  .flatMap(sale=>{
    const lines=sale.lines.filter(line=>isDeliveryLine(line.category))
    if(!lines.length)return []
    const status=statusByInvoice[sale.invoiceNumber]
    const dispatched=status==='Dispatched'||status==='In Transit'||status==='Out for Delivery'||status==='Delivered'
    const delivered=status==='Delivered'
    return [{
      id:`DEL-${sale.invoiceNumber}`,
      orderNumber:`DO-${sale.invoiceNumber}`,
      saleId:sale.id,
      customerId:sale.customerId,
      storeId:sale.storeId,
      items:lines.map((line,index)=>({
        id:`${sale.id}-${line.productId}-${index+1}`,
        saleLineId:`${sale.id}-${line.productId}`,
        productId:line.productId,
        name:line.name,
        sku:line.sku,
        quantity:line.quantity,
        serials:[...line.serials],
        dispatchedQuantity:delivered?line.quantity:dispatched?line.quantity:0,
        dispatchedSerials:delivered||dispatched?[...line.serials]:[],
        deliveredQuantity:delivered?line.quantity:0,
        deliveredSerials:delivered?[...line.serials]:[]
      })),
      status,
      deliveryAddress:(()=>{const customer=initialCustomers.find(item=>item.id===sale.customerId);return customer?`${customer.address}, ${customer.city}, ${customer.state} ${customer.pinCode}`:'Delhi NCR demo address'})(),
      scheduledDate:scheduleByInvoice[sale.invoiceNumber]||'',
      timeSlot:status==='Pending'?'':'09:00–12:00',
      deliveryTeamId:teamByInvoice[sale.invoiceNumber]||'',
      vehicleId:vehicleByInvoice[sale.invoiceNumber]||'',
      priority:sale.invoiceNumber==='INV-DEMO-2401'?'High':'Standard',
      instructions:'',
      createdAt:sale.date,
      createdBy:sale.createdBy,
      dispatchedAt:dispatched?`${scheduleByInvoice[sale.invoiceNumber]}T08:30:00.000Z`:'',
      dispatchedBy:dispatched?'Aarav Sharma':'',
      manifestId:dispatched?`MAN-DEMO-${sale.invoiceNumber}`:'',
      updatedAt:delivered?`${scheduleByInvoice[sale.invoiceNumber]}T13:00:00.000Z`:sale.date
    }]
  })

const seedActivities:DeliveryActivity[]=initialSeedOrders.flatMap(order=>{
  const rows:DeliveryActivity[]=[
    {id:`DA-${order.id}-CREATED`,deliveryId:order.id,type:'Order created',date:order.createdAt,actor:order.createdBy,status:'Pending',notes:'Demo delivery order created from a completed sale.'}
  ]
  if(order.scheduledDate)rows.push({id:`DA-${order.id}-SCHEDULED`,deliveryId:order.id,type:'Scheduled',date:`${order.scheduledDate}T07:00:00.000Z`,actor:'Aarav Sharma',status:order.status,notes:`Scheduled for ${order.scheduledDate} · ${order.timeSlot}.`})
  if(order.dispatchedAt)rows.push({id:`DA-${order.id}-DISPATCHED`,deliveryId:order.id,type:'Dispatched',date:order.dispatchedAt,actor:order.dispatchedBy,status:order.status,notes:'Dispatch recorded in the demo register.'})
  if(order.status==='Delivered')rows.push({id:`DA-${order.id}-DELIVERED`,deliveryId:order.id,type:'Delivery completed',date:order.updatedAt,actor:'Rohan Khanna',status:'Delivered',notes:'All listed units delivered; demo proof recorded.'})
  if(order.status==='Failed')rows.push({id:`DA-${order.id}-FAILED`,deliveryId:order.id,type:'Exception recorded',date:order.updatedAt,actor:'Rohan Khanna',status:'Failed',notes:'Customer unavailable at the delivery address.'})
  return rows
})

const failedOrder=initialSeedOrders.find(order=>order.status==='Failed')
const deliveredOrder=initialSeedOrders.find(order=>order.status==='Delivered')
const seedExceptions:DeliveryException[]=failedOrder?[{
  id:'DEX-DEMO-2403',
  deliveryId:failedOrder.id,
  reason:'Customer unavailable',
  notes:'Customer was not available at the delivery address.',
  date:failedOrder.updatedAt,
  actor:'Rohan Khanna',
  followUpDate:'2026-10-15',
  status:'Open'
}]:[]
const seedProofs:DeliveryProof[]=deliveredOrder?[{
  id:'POD-DEMO-2402',
  reference:'POD-DEMO-INV-DEMO-2402',
  deliveryId:deliveredOrder.id,
  date:deliveredOrder.updatedAt,
  actor:'Rohan Khanna',
  recipientName:'Nisha Sharma',
  recipientMobile:'9810000001',
  notes:'Demo delivery confirmation.',
  conditionConfirmed:true,
  lines:deliveredOrder.items.map(item=>({deliveryItemId:item.id,quantity:item.quantity,serials:[...item.serials]}))
}]:[]

const seedInstallations:Installation[]=deliveredOrder?deliveredOrder.items.flatMap(item=>{
  const sale=initialSales.find(record=>record.id===deliveredOrder.saleId)
  const line=sale?.lines.find(record=>record.productId===item.productId)
  return line&&['Home appliances','TV & audio'].includes(line.category)?[{
    id:`INS-${deliveredOrder.orderNumber}-${item.productId}`,
    saleId:deliveredOrder.saleId,
    customerId:deliveredOrder.customerId,
    product:item.name,
    scheduledDate:'Not scheduled',
    status:'Awaiting scheduling',
    deliveryId:deliveredOrder.id
  }]:[]
}):[]

export const initialPhase6State={
  deliveries:initialSeedOrders,
  deliveryTeams:initialDeliveryTeams,
  deliveryVehicles:initialDeliveryVehicles,
  deliveryManifests:[] as DeliveryManifest[],
  deliveryActivities:seedActivities,
  deliveryExceptions:seedExceptions,
  deliveryProofs:seedProofs,
  installations:seedInstallations
}

export function isDeliveryEligibleCategory(category:string){return isDeliveryLine(category)}
