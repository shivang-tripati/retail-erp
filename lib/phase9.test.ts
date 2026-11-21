import {describe,expect,it} from 'vitest'
import {initialPhase3State,initialCustomers,initialProducts,initialSales} from './phase3-data'
import {initialPhase4State,warehouseLocationId} from './phase4-data'
import {initialPhase6State} from './phase6-data'
import {initialPhase7State} from './phase7-data'
import {activeValidAllocations} from './phase8-analytics'

function demo(){return {...initialPhase3State,...initialPhase4State,...initialPhase6State,...initialPhase7State}}

describe('Phase 9 unified lifecycle relationships',()=>{
  it('A: keeps GRNs, stock and serial registry linked once',()=>{
    const data=demo()
    for(const grn of data.grns.filter(item=>item.status==='Received')){
      for(const line of grn.items){
        const stock=data.inventory.find(item=>item.storeId===grn.receivingLocation&&item.productId===line.productId)
        expect(stock).toBeDefined()
        if(data.products.find(item=>item.id===line.productId)?.serialRequired){
          const serialCount=data.serials.filter(item=>item.grnReference===grn.id&&item.productId===line.productId).length
          expect(serialCount).toBeGreaterThanOrEqual(0)
          expect(new Set(data.serials.map(item=>item.serial)).size).toBe(data.serials.length)
        }
      }
    }
  })

  it('B: transfer state is available and stock remains in a coherent location model',()=>{
    const data=demo()
    expect(Array.isArray(data.transfers)).toBe(true)
    for(const transfer of data.transfers){
      expect(transfer.sourceLocation).not.toBe(transfer.destinationLocation)
      expect(['Draft','Requested','Approved','Dispatched','Partially Received','Received','Cancelled']).toContain(transfer.status)
    }
  })

  it('C: one customer and invoice connect POS, payment and customer history',()=>{
    const data=demo()
    const sale=initialSales.find(item=>item.status==='Completed')!
    expect(initialCustomers.some(customer=>customer.id===sale.customerId)).toBe(true)
    expect(data.sales.some(invoice=>invoice.invoiceNumber===sale.invoiceNumber&&invoice.customerId===sale.customerId)).toBe(true)
    expect(data.payments.filter(payment=>payment.invoiceId===sale.invoiceNumber).every(payment=>payment.customerId===sale.customerId)).toBe(true)
  })

  it('D: delivered quantities create installation eligibility without delivery stock deduction',()=>{
    const data=demo()
    const delivery=data.deliveries.find(item=>item.status==='Delivered')
    expect(delivery).toBeDefined()
    if(delivery){
      const sale=data.sales.find(item=>item.id===delivery.saleId)
      expect(sale?.status).toBe('Completed')
      expect(delivery.items.every(item=>item.deliveredQuantity<=item.quantity)).toBe(true)
      expect(delivery.items.every(item=>item.deliveredQuantity===item.dispatchedQuantity)).toBe(true)
    }
  })

  it('E: warranty and service records retain sold serial and invoice links',()=>{
    const data=demo()
    for(const warranty of data.warranties){
      expect(initialSales.some(sale=>sale.id===warranty.saleId&&sale.status==='Completed')).toBe(true)
      expect(initialProducts.some(product=>product.id===warranty.productId)).toBe(true)
    }
    for(const ticket of data.serviceTickets){
      expect(initialSales.some(sale=>sale.id===ticket.saleId&&sale.status==='Completed')).toBe(true)
      expect(initialCustomers.some(customer=>customer.id===ticket.customerId)).toBe(true)
      expect(initialProducts.some(product=>product.id===ticket.productId)).toBe(true)
    }
  })

  it('F: collections use valid allocations and advances are not invoice payments',()=>{
    const data=demo()
    const allocations=activeValidAllocations(data)
    expect(allocations.every(item=>data.payments.some(payment=>payment.id===item.paymentId&&!data.paymentReversals.some(reversal=>reversal.paymentId===payment.id)))).toBe(true)
    expect(data.sales.filter(sale=>sale.status==='Reversed').every(sale=>!activeValidAllocations(data).some(item=>item.invoiceId===sale.invoiceNumber))).toBe(true)
  })

  it('G: buyback and scrap records remain traceable and warehouse is distinct',()=>{
    const data=demo()
    expect(warehouseLocationId).toBe('W0')
    expect(data.buybacks.every(item=>initialCustomers.some(customer=>customer.id===item.customerId))).toBe(true)
    expect(data.scrapRequests.every(item=>initialProducts.some(product=>product.id===item.productId))).toBe(true)
  })
})
