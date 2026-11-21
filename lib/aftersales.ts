import type {Customer,Product,Sale,SerialRecord} from './phase3-data'
import type {Delivery,DeliveryItem} from './phase6-types'
import type {Installation,InstallationStatus,ServiceStatus,ServiceTicket,Technician,WarrantyCoverage,WarrantyPlan,WarrantyRegistration} from './phase7-types'

export type AfterSalesData={
  customers:Customer[]
  products:Product[]
  sales:Sale[]
  serials:SerialRecord[]
  deliveries:Delivery[]
  installations:Installation[]
  technicians:Technician[]
  warrantyPlans:WarrantyPlan[]
  warranties:WarrantyRegistration[]
  serviceTickets:ServiceTicket[]
}

export type InstallationEligibility={
  delivery:Delivery
  item:DeliveryItem
  sale:Sale
  customer:Customer
  product:Product
  storeId:string
  availableQuantity:number
  availableSerials:string[]
}

const installationCategories=new Set(['Home appliances','TV & audio'])
const activeInstallationStatuses=new Set<InstallationStatus>(['Pending','Scheduled','Assigned','In Progress','Rescheduled','Awaiting scheduling'])

export function getInstallationEligibility(data:AfterSalesData):InstallationEligibility[]{
  const rows:InstallationEligibility[]=[]
  for(const delivery of data.deliveries){
    const sale=data.sales.find(item=>item.id===delivery.saleId)
    if(!sale||sale.status!=='Completed'||delivery.status==='Cancelled')continue
    const customer=data.customers.find(item=>item.id===delivery.customerId)
    if(!customer)continue
    for(const item of delivery.items){
      const product=data.products.find(record=>record.id===item.productId)
      const line=sale.lines.find(record=>record.productId===item.productId)
      if(!product||!line||!installationCategories.has(product.category)||item.deliveredQuantity<1)continue
      const existing=data.installations.filter(record=>record.deliveryId===delivery.id&&
        (record.deliveryItemId===item.id||(!record.deliveryItemId&&record.productId===product.id)))
      if(product.serialRequired){
        const availableSerials=item.deliveredSerials.filter(serial=>!existing.some(record=>
          record.serials?.includes(serial)&&record.status!=='Failed'&&record.status!=='Cancelled'&&record.status!=='Cancelled by invoice reversal'))
        if(availableSerials.length)rows.push({delivery,item,sale,customer,product,storeId:delivery.storeId,availableQuantity:availableSerials.length,availableSerials})
      }else{
        const consumed=existing.filter(record=>record.status!=='Failed'&&record.status!=='Cancelled'&&record.status!=='Cancelled by invoice reversal')
          .reduce((sum,record)=>sum+(record.quantity||1),0)
        const availableQuantity=Math.max(0,item.deliveredQuantity-consumed)
        if(availableQuantity)rows.push({delivery,item,sale,customer,product,storeId:delivery.storeId,availableQuantity,availableSerials:[]})
      }
    }
  }
  return rows
}

export function canRegisterWarranty(data:AfterSalesData,serialValue:string,planId:string):{sale:Sale;product:Product;serial:SerialRecord;plan:WarrantyPlan}{
  const serial= data.serials.find(item=>item.serial===serialValue)
  if(!serial||serial.status!=='Sold'||!serial.invoiceId)throw new Error('Select a serial number recorded as sold; transfers and stock-only serials are not eligible.')
  const sale=data.sales.find(item=>item.invoiceNumber===serial.invoiceId&&item.status==='Completed')
  if(!sale)throw new Error('The serial number must be linked to a completed demo invoice.')
  const line=sale.lines.find(item=>item.productId===serial.productId&&item.serials.includes(serial.serial))
  const product=data.products.find(item=>item.id===serial.productId)
  if(!line||!product)throw new Error('The selected serial is not linked to this invoice product.')
  const plan=data.warrantyPlans.find(item=>item.id===planId&&item.status==='Active')
  if(!plan)throw new Error('Select an active retailer extended-warranty plan.')
  if(!plan.categories.includes(product.category)||!plan.brandIds.includes(product.brandId))throw new Error('This plan does not cover the selected product brand and category.')
  const today=new Date().toISOString().slice(0,10)
  const activeDuplicate=data.warranties.some(item=>item.serial===serial.serial&&item.planId===plan.id&&item.status!=='Cancelled'&&item.endDate>=today)
  if(activeDuplicate)throw new Error('An active registration already exists for this serial and plan.')
  return {sale,product,serial,plan}
}

export function getWarrantyCoverage(data:AfterSalesData,serialValue:string,referenceDate=new Date()):WarrantyCoverage{
  if(!serialValue)return 'Pending review'
  const serial=data.serials.find(item=>item.serial===serialValue)
  if(!serial||serial.status!=='Sold'||!serial.invoiceId)return 'Pending review'
  const sale=data.sales.find(item=>item.invoiceNumber===serial.invoiceId&&item.status==='Completed')
  const line=sale?.lines.find(item=>item.productId===serial.productId&&item.serials.includes(serial.serial))
  if(!sale||!line)return 'Pending review'
  const day=referenceDate.toISOString().slice(0,10)
  const retailerCoverage=data.warranties.some(item=>item.serial===serial.serial&&item.status!=='Cancelled'&&item.startDate<=day&&item.endDate>=day)
  if(retailerCoverage||(serial.warrantyUntil&&serial.warrantyUntil>=day))return 'Covered'
  return 'Chargeable'
}

export function addMonthsToDate(dateValue:string,months:number):string{
  const date=new Date(`${dateValue.slice(0,10)}T12:00:00.000Z`)
  if(Number.isNaN(date.getTime())||!Number.isInteger(months)||months<1)throw new Error('Choose a valid date and warranty duration.')
  const targetDay=date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth()+months)
  const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()
  date.setUTCDate(Math.min(targetDay,lastDay))
  return date.toISOString().slice(0,10)
}

export function installationStatusLabel(status:InstallationStatus):string{
  return status==='Awaiting scheduling'?'Pending':status==='Cancelled by invoice reversal'?'Cancelled':status
}

export function installationCategoryRequiresService(product:Product):boolean{
  return installationCategories.has(product.category)
}

export function validateServiceSource(data:AfterSalesData,customerId:string,saleId:string,productId:string,serialValue:string){
  const customer=data.customers.find(item=>item.id===customerId)
  const sale=data.sales.find(item=>item.id===saleId&&item.status==='Completed')
  if(!customer||!sale||sale.customerId!==customerId)throw new Error('Choose a completed invoice belonging to this customer.')
  const line=sale.lines.find(item=>item.productId===productId)
  const product=data.products.find(item=>item.id===productId)
  if(!line||!product)throw new Error('Choose a product listed on the selected invoice.')
  if(product.serialRequired&&!serialValue)throw new Error('Select a sold serial number for this serialized product.')
  if(serialValue){
    const serial=data.serials.find(item=>item.serial===serialValue)
    if(!serial||serial.status!=='Sold'||serial.invoiceId!==sale.invoiceNumber||serial.productId!==productId||!line.serials.includes(serialValue))
      throw new Error('The serial number must be sold on the selected customer invoice and product.')
  }
  return {customer,sale,line,product}
}

const serviceTransitions:Record<ServiceStatus,ServiceStatus[]>={
  Open:['Assigned','Scheduled','Escalated','Cancelled'],
  Assigned:['Scheduled','In Progress','Waiting for Parts','Escalated','Resolved','Cancelled'],
  Scheduled:['In Progress','Waiting for Parts','Escalated','Resolved','Cancelled'],
  'In Progress':['Waiting for Parts','Escalated','Resolved','Cancelled'],
  'Waiting for Parts':['In Progress','Escalated','Resolved','Cancelled'],
  Escalated:['Assigned','In Progress','Resolved','Cancelled'],
  Resolved:['In Progress','Closed'],
  Closed:[],
  Cancelled:[]
}

export function transitionServiceTicket(ticket:ServiceTicket,next:ServiceStatus,resolution=''):ServiceTicket{
  if(!serviceTransitions[ticket.status].includes(next))throw new Error(`A ${ticket.status} ticket cannot move to ${next}.`)
  if(next==='In Progress'&&!ticket.assignedTechnicianId)throw new Error('Assign an active technician before starting work.')
  if(next==='Resolved'&&!resolution.trim())throw new Error('Record a resolution summary before resolving the ticket.')
  return {...ticket,status:next,resolution:next==='Resolved'?resolution.trim():ticket.resolution}
}

export function validateInstallationCompletion(installation:{status:InstallationStatus;arrivedAt?:string;checklist?:Array<{checked:boolean}>;customerConfirmed?:boolean}):void{
  if(installation.status!=='In Progress')throw new Error('Only an in-progress installation can be completed.')
  if(!installation.arrivedAt)throw new Error('Record technician arrival before completing the installation.')
  if(!installation.checklist?.length||installation.checklist.some(item=>!item.checked))throw new Error('Complete every installation checklist item first.')
  if(!installation.customerConfirmed)throw new Error('Record customer confirmation before completing the installation.')
}
