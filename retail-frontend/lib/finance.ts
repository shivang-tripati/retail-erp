import type {Payment,Phase3State,Sale} from './phase3-data'
import type {PaymentAllocation,PaymentReversal} from './finance-types'

export const financeReferenceDate='2026-11-21'
export type FinanceRecords=Pick<Phase3State,'sales'|'payments'|'paymentAllocations'|'paymentReversals'|'paymentReconciliations'>
export type InvoiceFinance={sale:Sale;paidPaise:number;balancePaise:number;dueDate:string;daysOverdue:number;status:'Paid'|'Partially Paid'|'Unpaid'|'Overdue'|'Reversed'}

const reversed=(paymentId:string,reversals:PaymentReversal[])=>reversals.some(item=>item.paymentId===paymentId)
const addDays=(value:string,days:number)=>{
  const date=new Date(`${value.slice(0,10)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate()+days)
  return date.toISOString().slice(0,10)
}

export function dueDateForSale(sale:Sale){return addDays(sale.date,30)}
export function daysBetween(from:string,to=financeReferenceDate){
  return Math.floor((Date.parse(`${to.slice(0,10)}T00:00:00.000Z`)-Date.parse(`${from.slice(0,10)}T00:00:00.000Z`))/86400000)
}
export function allocationsForPayment(payment:Payment,records:FinanceRecords):PaymentAllocation[]{
  const stored=records.paymentAllocations.filter(item=>item.paymentId===payment.id)
  if(stored.length)return stored
  const invoice=records.sales.find(item=>item.invoiceNumber===payment.invoiceId)
  return invoice?[{id:`LEGACY-${payment.id}`,paymentId:payment.id,invoiceId:invoice.invoiceNumber,amountPaise:payment.amountPaise,createdAt:payment.date,createdBy:payment.collectedBy||'Demo user'}]:[]
}
export function allocatedPaise(payment:Payment,records:FinanceRecords){
  return reversed(payment.id,records.paymentReversals)?0:allocationsForPayment(payment,records).reduce((sum,item)=>sum+item.amountPaise,0)
}
export function unallocatedPaise(payment:Payment,records:FinanceRecords){
  return reversed(payment.id,records.paymentReversals)?0:Math.max(0,payment.amountPaise-allocatedPaise(payment,records))
}
export function invoicePayments(sale:Sale,records:FinanceRecords):Payment[]{
  return records.payments.flatMap(payment=>{
    if(reversed(payment.id,records.paymentReversals))return []
    const allocated=allocationsForPayment(payment,records).filter(item=>item.invoiceId===sale.invoiceNumber)
      .reduce((sum,item)=>sum+item.amountPaise,0)
    return allocated>0?[{...payment,invoiceId:sale.invoiceNumber,amountPaise:allocated}]:[]
  })
}
export function invoicePaymentHistory(sale:Sale,records:FinanceRecords):Payment[]{
  return records.payments.flatMap(payment=>{
    const allocated=allocationsForPayment(payment,records).filter(item=>item.invoiceId===sale.invoiceNumber)
      .reduce((sum,item)=>sum+item.amountPaise,0)
    return allocated>0?[{...payment,invoiceId:sale.invoiceNumber,amountPaise:allocated}]:[]
  })
}
export function invoiceFinance(sale:Sale,records:FinanceRecords):InvoiceFinance{
  const paidPaise=sale.status==='Reversed'?0:Math.min(sale.totalPaise,invoicePayments(sale,records).reduce((sum,payment)=>sum+payment.amountPaise,0))
  const balancePaise=sale.status==='Reversed'?0:Math.max(0,sale.totalPaise-paidPaise)
  const dueDate=dueDateForSale(sale)
  const daysOverdue=Math.max(0,daysBetween(dueDate))
  const status= sale.status==='Reversed'?'Reversed'
    :balancePaise===0?'Paid'
    :daysOverdue>0?'Overdue'
    :paidPaise>0?'Partially Paid':'Unpaid'
  return {sale,paidPaise,balancePaise,dueDate,daysOverdue,status}
}
export function activeInvoices(records:FinanceRecords){
  return records.sales.filter(sale=>sale.status==='Completed').map(sale=>invoiceFinance(sale,records))
}
export function customerOutstanding(customerId:string,records:FinanceRecords){
  return activeInvoices(records).filter(item=>item.sale.customerId===customerId).reduce((sum,item)=>sum+item.balancePaise,0)
}
export function latestReconciliation(paymentId:string,records:FinanceRecords){
  return records.paymentReconciliations.filter(item=>item.paymentId===paymentId).sort((a,b)=>b.date.localeCompare(a.date))[0]
}
export function paymentStoreId(payment:Payment,records:FinanceRecords){
  if(payment.storeId)return payment.storeId
  const allocation=allocationsForPayment(payment,records)[0]
  return records.sales.find(sale=>sale.invoiceNumber===allocation?.invoiceId)?.storeId||''
}
export function paymentStatus(payment:Payment,records:FinanceRecords){
  if(reversed(payment.id,records.paymentReversals))return 'Reversed'
  return latestReconciliation(payment.id,records)?.status||'Recorded'
}
export function paymentIsActive(payment:Payment,records:FinanceRecords){
  return !reversed(payment.id,records.paymentReversals)
}
export function paymentSnapshot(sale:Sale,records:FinanceRecords):Sale{
  if(sale.status==='Reversed')return {...sale,balancePaise:0}
  const paidPaise=invoiceFinance(sale,records).paidPaise
  return {...sale,paidPaise,balancePaise:Math.max(0,sale.totalPaise-paidPaise),
    paymentStatus:paidPaise>=sale.totalPaise?'Paid':paidPaise?'Partially paid':'Unpaid'}
}
export function inDateRange(value:string,range:string){
  if(range==='All dates')return true
  const days=range==='Last 7 days'?7:range==='Last 30 days'?30:range==='Last 90 days'?90:Infinity
  return daysBetween(value)<=days&&daysBetween(value)>=0
}
export function agingBucket(days:number):'Current'|'1–30 days'|'31–60 days'|'61–90 days'|'Over 90 days'{
  if(days<=0)return 'Current'
  if(days<=30)return '1–30 days'
  if(days<=60)return '31–60 days'
  if(days<=90)return '61–90 days'
  return 'Over 90 days'
}
