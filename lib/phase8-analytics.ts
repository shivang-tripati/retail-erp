import type {Phase3State,Sale} from './phase3-data'
import type {Scope} from './demo-data'
import {endDay} from './demo-data'

export type AnalyticsFilter={store:string;brand:string;category:string;days:number}
export type StoreAnalytics=ReturnType<typeof storeAnalytics>[number]

export const referenceDate=endDay
export const periodStart=(days:number,offset=0)=>new Date(referenceDate-(offset+days)*86400000)
export const periodEnd=(days:number,offset=0)=>new Date(referenceDate-offset*86400000)

export function inPeriod(date:string,days:number,offset=0){
  if(!date)return false
  const value=new Date(date).getTime()
  return value>=periodStart(days,offset).getTime()&&value<=periodEnd(days,offset).getTime()
}

export function filterSales(data:Phase3State,scope:AnalyticsFilter,offset=0){
  return data.sales.filter(sale=>{
    if(sale.status==='Reversed'||!inPeriod(sale.date,scope.days,offset))return false
    if(scope.store&&sale.storeId!==scope.store)return false
    const first=sale.lines[0]
    if(scope.brand&&sale.lines.every(line=>line.brandId!==scope.brand))return false
    if(scope.category&&sale.lines.every(line=>line.category!==scope.category))return false
    if(!scope.brand&&!scope.category)return true
    return !!first
  })
}

export function activeValidAllocations(data:Phase3State){
  const reversed=new Set(data.paymentReversals.map(item=>item.paymentId))
  return data.paymentAllocations.filter(allocation=>{
    if(reversed.has(allocation.paymentId))return false
    if(!allocation.invoiceId)return false
    return data.sales.some(sale=>sale.invoiceNumber===allocation.invoiceId&&sale.status==='Completed')
  })
}

export function collectionTotal(data:Phase3State,scope:AnalyticsFilter,offset=0){
  const reversed=new Set(data.paymentReversals.map(item=>item.paymentId))
  const allocations=activeValidAllocations(data)
  return data.payments.reduce((sum,payment)=>{
    if(reversed.has(payment.id)||!inPeriod(payment.date,scope.days,offset))return sum
    if(scope.store&&payment.storeId!==scope.store)return sum
    const matching=allocations.filter(item=>item.paymentId===payment.id)
    return sum+matching.reduce((amount,allocation)=>{
      const sale=data.sales.find(item=>item.invoiceNumber===allocation.invoiceId)
      if(!sale)return amount
      if(scope.brand&&sale.lines.every(line=>line.brandId!==scope.brand))return amount
      if(scope.category&&sale.lines.every(line=>line.category!==scope.category))return amount
      return amount+allocation.amountPaise
    },0)
  },0)
}

export function outstandingTotal(data:Phase3State,scope:AnalyticsFilter){
  return data.sales.reduce((sum,sale)=>{
    if(sale.status==='Reversed'||(scope.store&&sale.storeId!==scope.store))return sum
    if(scope.brand&&sale.lines.every(line=>line.brandId!==scope.brand))return sum
    if(scope.category&&sale.lines.every(line=>line.category!==scope.category))return sum
    return sum+Math.max(0,sale.balancePaise)
  },0)
}

export function executiveKpis(data:Phase3State,scope:AnalyticsFilter){
  const sales=filterSales(data,scope)
  const previous=filterSales(data,scope,scope.days)
  const net=sales.reduce((sum,sale)=>sum+sale.totalPaise,0)
  const previousNet=previous.reduce((sum,sale)=>sum+sale.totalPaise,0)
  const collections=collectionTotal(data,scope)
  const previousCollections=collectionTotal(data,scope,scope.days)
  const outstanding=outstandingTotal(data,scope)
  const inventoryValue=data.inventory.reduce((sum,row)=>{
    const product=data.products.find(item=>item.id===row.productId)
    if(!product||(scope.store&&row.storeId!==scope.store)||(scope.brand&&product.brandId!==scope.brand)||(scope.category&&product.category!==scope.category))return sum
    return sum+row.quantity*product.purchasePricePaise
  },0)
  const completedDeliveries=data.deliveries.filter(order=>{
    if(scope.store&&order.storeId!==scope.store)return false
    if(!inPeriod(order.createdAt,scope.days))return false
    return order.status==='Delivered'||order.items.every(item=>item.deliveredQuantity>=item.quantity)
  }).length
  const totalDeliveries=data.deliveries.filter(order=>inPeriod(order.createdAt,scope.days)&&(!scope.store||order.storeId===scope.store)).length
  const pendingInstallations=data.installations.filter(item=>!scope.store||item.storeId===scope.store)
    .filter(item=>['Pending','Scheduled','Assigned','In Progress','Rescheduled','Awaiting scheduling'].includes(item.status)).length
  const now=referenceDate
  const activeWarranties=data.warranties.filter(item=>new Date(item.endDate).getTime()>=now&&(!scope.store||data.sales.some(sale=>sale.id===item.saleId&&sale.storeId===scope.store))).length
  const expiring=data.warranties.filter(item=>{
    const end=new Date(item.endDate).getTime()
    return end>=now&&end<=now+30*86400000&&(!scope.store||data.sales.some(sale=>sale.id===item.saleId&&sale.storeId===scope.store))
  }).length
  const openTickets=data.serviceTickets.filter(ticket=>!['Resolved','Closed','Cancelled'].includes(ticket.status)&&(!scope.store||ticket.storeId===scope.store)).length
  const customerIds=new Set(sales.map(sale=>sale.customerId))
  const returningCustomerCount=[...customerIds].filter(customerId=>data.sales.filter(sale=>sale.status==='Completed'&&sale.customerId===customerId).length>1).length
  const firstSaleByCustomer=new Map<string,string>()
  data.sales.filter(sale=>sale.status==='Completed').forEach(sale=>{
    if(!firstSaleByCustomer.has(sale.customerId)||sale.date<firstSaleByCustomer.get(sale.customerId)!)firstSaleByCustomer.set(sale.customerId,sale.date)
  })
  const newCustomers=[...customerIds].filter(customerId=>inPeriod(firstSaleByCustomer.get(customerId)||'',scope.days)).length
  const lowStock=data.inventory.filter(row=>(!scope.store||row.storeId===scope.store)&&row.quantity<=3).length
  return {
    sales:sales,netSalesPaise:net,previousNetSalesPaise:previousNet,
    invoiceCount:sales.length,averageBillPaise:sales.length?Math.round(net/sales.length):0,
    collectionsPaise:collections,previousCollectionsPaise:previousCollections,
    outstandingPaise:outstanding,inventoryValuePaise:inventoryValue,
    lowStock,deliveryCompletionPaise:totalDeliveries?completedDeliveries/totalDeliveries*100:0,
    pendingInstallations,activeWarranties,expiringWarranties:expiring,openTickets,
    newCustomers,returningCustomers:returningCustomerCount
  }
}

export function storeAnalytics(data:Phase3State & {stores:Array<{id:string;name:string;city?:string;code?:string}>},scope:AnalyticsFilter){
  return data.stores.filter(store=>!scope.store||store.id===scope.store).map(store=>{
    const storeScope={...scope,store:store.id}
    const sales=filterSales(data,storeScope)
    const net=sales.reduce((sum,sale)=>sum+sale.totalPaise,0)
    const collections=collectionTotal(data,storeScope)
    const outstanding=outstandingTotal(data,storeScope)
    const reversals=data.sales.filter(sale=>sale.status==='Reversed'&&sale.storeId===store.id&&inPeriod(sale.date,scope.days)).length
    const inventoryValue=data.inventory.filter(row=>row.storeId===store.id).reduce((sum,row)=>{
      const product=data.products.find(item=>item.id===row.productId)
      return sum+(product?.purchasePricePaise||0)*row.quantity
    },0)
    const deliveries=data.deliveries.filter(order=>order.storeId===store.id&&inPeriod(order.createdAt,scope.days))
    const completed=deliveries.filter(order=>order.status==='Delivered'||order.items.every(item=>item.deliveredQuantity>=item.quantity)).length
    const installations=data.installations.filter(item=>item.storeId===store.id)
    const installed=installations.filter(item=>item.status==='Completed').length
    const tickets=data.serviceTickets.filter(item=>item.storeId===store.id).length
    return {store,netPaise:net,invoiceCount:sales.length,averageBillPaise:sales.length?Math.round(net/sales.length):0,
      collectionsPaise:collections,outstandingPaise:outstanding,reversals,inventoryValuePaise:inventoryValue,
      deliveryCount:deliveries.length,deliveryCompletionPct:deliveries.length?completed/deliveries.length*100:0,
      installationCount:installations.length,installationCompletionPct:implementationsCount(installations)?installed/implementationsCount(installations)*100:0,
      serviceTickets:tickets}
  })
}

function implementationsCount(items:Array<{status:string}>){
  return items.filter(item=>item.status==='Completed'||item.status==='Failed'||item.status==='Cancelled').length
}

export function agingBuckets(data:Phase3State,scope:AnalyticsFilter){
  const buckets=[{name:'Current',min:0,max:0,totalPaise:0,count:0},{name:'1–30 days',min:1,max:30,totalPaise:0,count:0},{name:'31–60 days',min:31,max:60,totalPaise:0,count:0},{name:'61–90 days',min:61,max:90,totalPaise:0,count:0},{name:'Over 90 days',min:91,max:Number.MAX_SAFE_INTEGER,totalPaise:0,count:0}]
  for(const sale of data.sales){
    if(sale.status==='Reversed'||sale.balancePaise<=0||(scope.store&&sale.storeId!==scope.store)||(scope.brand&&sale.lines.every(line=>line.brandId!==scope.brand)||(scope.category&&sale.lines.every(line=>line.category!==scope.category))))continue
    const days=Math.max(0,Math.floor((referenceDate-new Date(sale.date).getTime())/86400000))
    const bucket=buckets.find(item=>days>=item.min&&days<=item.max)||buckets[4]
    bucket.totalPaise+=sale.balancePaise
    bucket.count++
  }
  return buckets
}
