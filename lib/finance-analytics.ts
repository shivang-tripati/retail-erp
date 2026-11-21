import {change,ledger,summary,type Invoice,type Scope} from './demo-data'
import {toAnalyticsInvoice,type Phase3State} from './phase3-data'
import {activeInvoices,allocationsForPayment,daysBetween,financeReferenceDate,paymentIsActive,paymentStoreId} from './finance'

export function financeAnalytics(scope:Scope,offset:number,data:Phase3State){
  const additional=data.sales.filter(sale=>sale.status==='Completed').map(toAnalyticsInvoice)
  const rows=ledger(scope,offset,additional)
  const legacyRows=ledger(scope,offset)
  const currentInvoices=activeInvoices(data).filter(item=>{
    const age=daysBetween(item.sale.date,financeReferenceDate),first=item.sale.lines[0]
    return age>=offset&&age<offset+scope.days&&(!scope.store||item.sale.storeId===scope.store)&&
      (!scope.brand||first?.brandId===scope.brand)&&(!scope.category||first?.category===scope.category)
  })
  const currentCollected=data.payments.filter(payment=>{
    const age=daysBetween(payment.date,financeReferenceDate)
    return paymentIsActive(payment,data)&&age>=offset&&age<offset+scope.days&&(!scope.store||paymentStoreId(payment,data)===scope.store)
  }).reduce((sum,payment)=>{
    const allocations=allocationsForPayment(payment,data)
    if(!scope.brand&&!scope.category)return sum+payment.amountPaise/100
    return sum+allocations.reduce((amount,allocation)=>{
      const sale=data.sales.find(item=>item.invoiceNumber===allocation.invoiceId)
      const first=sale?.lines[0]
      return sale&&(!scope.brand||first?.brandId===scope.brand)&&(!scope.category||first?.category===scope.category)?amount+allocation.amountPaise/100:amount
    },0)
  },0)
  const stats=summary(rows,scope,offset)
  const scopedDeliveries=data.deliveries.filter(order=>{
    const sale=data.sales.find(item=>item.id===order.saleId&&item.status==='Completed')
    if(!sale)return false
    const age=daysBetween(sale.date,financeReferenceDate)
    if(age<offset||age>=offset+scope.days||(scope.store&&sale.storeId!==scope.store))return false
    return sale.lines.some(line=>order.items.some(item=>item.productId===line.productId)&&
      (!scope.brand||line.brandId===scope.brand)&&(!scope.category||line.category===scope.category))
  }).filter(order=>order.status!=='Cancelled')
  const completedDeliveries=scopedDeliveries.filter(order=>order.items.length>0&&order.items.every(item=>item.deliveredQuantity>=item.quantity)).length
  const pendingDeliveries=scopedDeliveries.filter(order=>!order.items.length||order.items.some(item=>item.deliveredQuantity<item.quantity)).length
  const legacyCollected=legacyRows.reduce((sum,row)=>sum+row.paid,0)
  const legacyOutstanding=legacyRows.reduce((sum,row)=>sum+Math.max(0,row.net-row.paid),0)
  const currentOutstanding=currentInvoices.reduce((sum,item)=>sum+item.balancePaise/100,0)
  const paid=legacyCollected+currentCollected
  const outstanding=legacyOutstanding+currentOutstanding
  return {
    rows,
    stats:{...stats,paid,out:outstanding,eff:stats.net?paid/stats.net*100:0,pending:pendingDeliveries,
      delivery:scopedDeliveries.length?completedDeliveries/scopedDeliveries.length*100:0},
    paymentModes:paymentModesFor(scope,offset,data,legacyRows)
  }
}

function paymentModesFor(scope:Scope,offset:number,data:Phase3State,legacyRows:Invoice[]){
  const totals=new Map<string,number>()
  for(const row of legacyRows)totals.set(row.payment,(totals.get(row.payment)||0)+row.paid)
  for(const payment of data.payments){
    const age=daysBetween(payment.date,financeReferenceDate)
    if(age<offset||age>=offset+scope.days||!paymentIsActive(payment,data)||scope.store&&paymentStoreId(payment,data)!==scope.store)continue
    const allocations=allocationsForPayment(payment,data)
    const matching=scope.brand||scope.category
      ?allocations.filter(allocation=>{
        const sale=data.sales.find(item=>item.invoiceNumber===allocation.invoiceId),first=sale?.lines[0]
        return !!sale&&(!scope.brand||first?.brandId===scope.brand)&&(!scope.category||first?.category===scope.category)
      }).reduce((sum,item)=>sum+item.amountPaise/100,0)
      :payment.amountPaise/100
    if(matching)totals.set(payment.mode,(totals.get(payment.mode)||0)+matching)
  }
  return [...totals].sort((a,b)=>b[1]-a[1])
}

export function financeChange(current:number,previous:number){return change(current,previous)}
