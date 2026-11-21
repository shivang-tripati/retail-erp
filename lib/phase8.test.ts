import {describe,expect,it} from 'vitest'
import {initialPhase3State} from './phase3-data'
import {initialPhase4State} from './phase4-data'
import {initialPhase6State} from './phase6-data'
import {initialPhase7State} from './phase7-data'
import {initialStores} from './demo-data'
import {activeValidAllocations,agingBuckets,executiveKpis,storeAnalytics} from './phase8-analytics'

function data(){
  return {...initialPhase3State,...initialPhase4State,...initialPhase6State,...initialPhase7State}
}

describe('Phase 8 executive analytics',()=>{
  it('excludes reversed invoices and reversed payments from active KPI totals',()=>{
    const demo={...data(),stores:initialStores}
    const scope={store:'',brand:'',category:'',days:30}
    const kpis=executiveKpis(demo,scope)
    const reversedInvoice=demo.sales.find(sale=>sale.status==='Reversed')
    expect(reversedInvoice).toBeDefined()
    expect(kpis.sales.some(sale=>sale.status==='Reversed')).toBe(false)
    expect(kpis.outstandingPaise).toBe(demo.sales.filter(sale=>sale.status==='Completed').reduce((sum,sale)=>sum+Math.max(0,sale.balancePaise),0))
  })

  it('keeps advance and reversal rules separate from invoice allocations',()=>{
    const demo={...data(),stores:initialStores}
    const payment=demo.payments[0]
    const reversedPayment={...payment,id:'PAY-REVERSAL-TEST'}
    const allocation={id:'ALLOC-REVERSAL-TEST',paymentId:reversedPayment.id,invoiceId:demo.sales[0].invoiceNumber,amountPaise:100000,createdAt:payment.date,createdBy:'Test'}
    const reversedFixture={...demo,payments:[...demo.payments,reversedPayment],paymentAllocations:[...demo.paymentAllocations,allocation],paymentReversals:[...demo.paymentReversals,{id:'REV-TEST',paymentId:reversedPayment.id,amountPaise:100000,date:payment.date,actor:'Test',reason:'Test reversal'}]}
    expect(activeValidAllocations(reversedFixture).some(item=>item.id===allocation.id)).toBe(false)
  })

  it('returns store metrics and aged active invoice buckets',()=>{
    const demo={...data(),stores:initialStores}
    const scope={store:'',brand:'',category:'',days:30}
    const stores=storeAnalytics(demo,scope)
    const buckets=agingBuckets(demo,scope)
    expect(stores.length).toBeGreaterThan(0)
    expect(buckets.map(bucket=>bucket.name)).toEqual(['Current','1–30 days','31–60 days','61–90 days','Over 90 days'])
    expect(buckets.reduce((sum,bucket)=>sum+bucket.count,0)).toBe(demo.sales.filter(sale=>sale.status==='Completed'&&sale.balancePaise>0).length)
  })
})
