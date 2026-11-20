import {categories, endDay, invoices, initialBrands, type Row} from './demo-data'
import type {FinancialAuditEntry, PaymentAllocation, PaymentReconciliation, PaymentReversal, RecoveryActivity, RecoveryCase} from './finance-types'

export type Customer = {
  id: string
  name: string
  mobile: string
  alternateMobile: string
  email: string
  address: string
  city: string
  state: string
  pinCode: string
  type: string
  notes: string
  status: 'Active' | 'Inactive'
  since: string
}

export type Product = {
  id: string
  name: string
  brandId: string
  sku: string
  model: string
  category: string
  productType: 'Serialized' | 'Quantity-based'
  purchasePricePaise: number
  pricePaise: number
  gstRate: number
  serialRequired: boolean
  status: 'Active' | 'Inactive'
}

export type InventoryStock = {productId: string; storeId: string; quantity: number}
export type SerialRecord = {
  serial: string; productId: string; storeId: string
  status: 'In Transit' | 'Available' | 'Reserved' | 'Sold' | 'Returned' | 'Under Service' | 'Scrapped' | 'Transferred' | 'Unavailable'
  invoiceId?: string; grnReference?: string; purchaseDate?: string; warrantyUntil?: string
}
export type WalkIn = {id: string; name: string; mobile: string; storeId: string; visitedAt: string; executive: string; interest: string; status: string; followUp: string; notes: string; customerId?: string}
export type Enquiry = {id: string; customerName: string; mobile: string; storeId: string; createdAt: string; executive: string; interest: string; status: string; followUp: string; notes: string; walkInId?: string}
export type SaleLine = {productId: string; name: string; brandId: string; sku: string; model: string; category: string; quantity: number; unitPricePaise: number; itemDiscountPct: number; itemDiscountPaise: number; cartDiscountPaise: number; taxablePaise: number; gstRate: number; taxPaise: number; serials: string[]}
export type Payment = {id: string; invoiceId: string; customerId: string; date: string; amountPaise: number; mode: string; reference: string; financier: string; storeId?: string; collectedBy?: string; notes?: string}
export type Sale = {
  id: string; invoiceNumber: string; date: string; storeId: string; customerId: string; customerName: string
  salesperson: string; payment: string; lines: SaleLine[]; grossPaise: number; itemDiscountPaise: number; cartDiscountPaise: number
  taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; taxPaise: number
  roundOffPaise: number; totalPaise: number; paidPaise: number; balancePaise: number
  paymentStatus: 'Paid' | 'Partially paid' | 'Unpaid'; paymentIds: string[]; status: 'Completed' | 'Reversed'
  reversalReason: string; reversedAt: string; reversedBy: string; createdAt: string; createdBy: string
}
export type Delivery = {id: string; saleId: string; customerId: string; storeId: string; products: string; status: string; scheduledDate: string}
export type Installation = {id: string; saleId: string; customerId: string; product: string; scheduledDate: string; status: string}
export type AuditEntry = {id: string; date: string; action: string; actor: string; reference: string; detail: string}
export type Phase3State = {
  customers: Customer[]
  products: Product[]
  inventory: InventoryStock[]
  serials: SerialRecord[]
  walkIns: WalkIn[]
  enquiries: Enquiry[]
  sales: Sale[]
  payments: Payment[]
  paymentAllocations: PaymentAllocation[]
  paymentReversals: PaymentReversal[]
  paymentReconciliations: PaymentReconciliation[]
  recoveryCases: RecoveryCase[]
  recoveryActivities: RecoveryActivity[]
  financialAudit: FinancialAuditEntry[]
  deliveries: Delivery[]
  installations: Installation[]
  audit: AuditEntry[]
}

const firstNames = ['Aarav','Nisha','Kabir','Meera','Rohan','Diya','Ishaan','Kavya','Arjun','Tara']
const surnames = ['Sharma','Batra','Sethi','Kapoor','Malhotra','Khanna','Rao','Mehta','Iyer','Chawla']
const cities = [
  ['New Delhi','Delhi'],['Noida','Uttar Pradesh'],['Ghaziabad','Uttar Pradesh'],['Faridabad','Haryana'],['Gurugram','Haryana'],['Greater Noida','Uttar Pradesh']
]

export const initialCustomers: Customer[] = Array.from({length: 300}, (_, i) => {
  const first = firstNames[i % firstNames.length]
  const last = surnames[Math.floor(i / firstNames.length) % surnames.length]
  const [city, state] = cities[i % cities.length]
  return {
    id: `CUS-${String(i + 1).padStart(4, '0')}`,
    name: `${first} ${last}`,
    mobile: `98${String(10000000 + i).padStart(8, '0')}`,
    alternateMobile: i % 4 === 0 ? `97${String(10000000 + i).padStart(8, '0')}` : '',
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@customer.example`,
    address: `${12 + i % 87}, ${['Park Street','Market Road','Lake View Road','Sector Road'][i % 4]}`,
    city,
    state,
    pinCode: String(110001 + i % 80),
    type: i % 9 === 0 ? 'Business' : 'Individual',
    notes: '',
    status: i % 31 === 30 ? 'Inactive' : 'Active',
    since: new Date(Date.UTC(2024, i % 12, 1 + i % 27)).toISOString()
  }
})

const productNames = [
  ['Astra X5 5G','Astra Lite 5G','Nova Pro 256 GB','Nova Max 512 GB','Orbit Fold'],
  ['CoolHome 550 L Refrigerator','FrostLine Double Door','Breeze 1.5T Inverter AC','WashPro 8 kg Front Load','AquaClean 7 kg Top Load'],
  ['Vista QLED 55 inch','Vista UHD 43 inch','SoundBar 500','Cinema OLED 65 inch','Smart LED 32 inch'],
  ['OrbitBook 14 Pro','OrbitBook Air 13','Vector Gaming 16','TabNote 11','DeskMate All-in-One'],
  ['QuickChef Air Fryer','DailyBrew Coffee Maker','SteamEase Iron','MixPro 750 W','PureSip Water Purifier']
]
const prices = [
  [42999,18999,64999,84999,109999],
  [62999,34999,44999,58999,31999],
  [69999,37999,12999,119999,18999],
  [74999,59999,109999,29999,52999],
  [8999,6499,3299,4999,14999]
]

export const initialProducts: Product[] = categories.flatMap((category, c) =>
  productNames[c].map((name, p) => {
    const brand = initialBrands[(c * 3 + p) % initialBrands.length]
    const serialRequired = (c === 0 && p < 3) || (c === 1 && p < 4) || (c === 2 && p === 3) || (c === 3 && p < 3)
    return {
      id: `PR-${String(c * 5 + p + 1).padStart(3, '0')}`,
      name,
      brandId: brand.id,
      sku: `SE-${String(c + 1).padStart(2, '0')}${String(p + 1).padStart(3, '0')}`,
      model: `SH-${String(260 + c * 10 + p)}`,
      category,
      productType: serialRequired ? 'Serialized' : 'Quantity-based',
      purchasePricePaise: Math.round(prices[c][p] * 0.78) * 100,
      pricePaise: prices[c][p] * 100,
      gstRate: c === 4 ? 12 : 18,
      serialRequired,
      status: 'Active'
    }
  })
)

const serialized = new Set(initialProducts.filter(p => p.serialRequired).map(p => p.id))
export const initialInventory: InventoryStock[] = Array.from({length: 10}, (_, storeIndex) =>
  initialProducts.map((product, productIndex) => ({
    productId: product.id,
    storeId: `S${storeIndex}`,
    quantity: product.serialRequired ? 5 + (storeIndex + productIndex) % 4 : 7 + (storeIndex * 3 + productIndex * 5) % 18
  }))
).flat().concat(initialProducts.map(product => ({productId: product.id, storeId: 'W0', quantity: 0})))
const seededReceiptDate = (storeIndex: number) => new Date(Date.UTC(2026, 6, 15 + storeIndex)).toISOString()
export const initialSerials: SerialRecord[] = initialInventory
  .filter(stock => serialized.has(stock.productId) && stock.storeId !== 'W0')
  .flatMap(stock => Array.from({length: stock.quantity}, (_, i) => ({
    serial: `${stock.productId}-${stock.storeId}-${String(i + 1).padStart(3, '0')}`,
    productId: stock.productId,
    storeId: stock.storeId,
    status: 'Available' as const,
    grnReference: `GRN-OPENING-${stock.storeId}`,
    purchaseDate: seededReceiptDate(Number(stock.storeId.slice(1))),
    warrantyUntil: new Date(Date.UTC(2027, 6, 15 + Number(stock.storeId.slice(1)))).toISOString()
  })))

const demoDate = (age: number) => new Date(endDay - age * 86400000).toISOString()
export const initialWalkIns: WalkIn[] = Array.from({length: 24}, (_, i) => ({
  id: `WALK-${String(1001 + i)}`,
  name: i % 3 === 0 ? 'Walk-in visitor' : i % 3 === 2 ? initialCustomers[i].name : `${firstNames[i % firstNames.length]} ${surnames[i % surnames.length]}`,
  mobile: i % 3 === 0 ? '' : i % 3 === 2 ? initialCustomers[i].mobile : `96${String(10000000 + i).padStart(8, '0')}`,
  storeId: `S${i % 10}`,
  visitedAt: demoDate(i % 14),
  executive: `${firstNames[(i + 2) % firstNames.length]} ${surnames[i % 4]}`,
  interest: categories[i % categories.length],
  status: ['New','Follow-up','Converted'][i % 3],
  followUp: demoDate(i % 7),
  notes: '',
  customerId: i % 3 === 2 ? initialCustomers[i].id : undefined
}))
export const initialEnquiries: Enquiry[] = Array.from({length: 18}, (_, i) => ({
  id: `ENQ-${String(2001 + i)}`,
  customerName: `${firstNames[(i + 3) % firstNames.length]} ${surnames[(i + 1) % surnames.length]}`,
  mobile: `95${String(10000000 + i).padStart(8, '0')}`,
  storeId: `S${(i + 2) % 10}`,
  createdAt: demoDate(i % 20),
  executive: `${firstNames[i % firstNames.length]} ${surnames[(i + 2) % surnames.length]}`,
  interest: categories[(i + 2) % categories.length],
  status: ['Open','Contacted','Qualified','Won','Lost'][i % 5],
  followUp: demoDate(i % 10),
  notes: ''
}))

const seedSalesPlan: Array<{
  invoiceNumber: string; date: string; storeId: string; customerId: string; productId: string
  status?: Sale['status']; reversalReason?: string
  payments: Array<{amountPaise: number; mode: string; reference: string; date: string; financier?: string}>
}> = [
  {invoiceNumber:'INV-DEMO-2401',date:'2026-11-17T10:20:00.000Z',storeId:'S0',customerId:'CUS-0001',productId:'PR-010',payments:[
    {amountPaise:1000000,mode:'UPI',reference:'UPI-DEMO-2401-A',date:'2026-11-17T10:24:00.000Z'},
    {amountPaise:500000,mode:'Cash',reference:'CASH-DEMO-2401-B',date:'2026-11-18T08:30:00.000Z'}
  ]},
  {invoiceNumber:'INV-DEMO-2402',date:'2026-09-10T09:15:00.000Z',storeId:'S1',customerId:'CUS-0002',productId:'PR-013',payments:[]},
  {invoiceNumber:'INV-DEMO-2403',date:'2026-10-11T11:05:00.000Z',storeId:'S2',customerId:'CUS-0003',productId:'PR-025',payments:[
    {amountPaise:500000,mode:'UPI',reference:'UPI-DEMO-2403-A',date:'2026-10-12T08:00:00.000Z'}
  ]},
  {invoiceNumber:'INV-DEMO-2404',date:'2026-11-19T13:40:00.000Z',storeId:'S0',customerId:'CUS-0004',productId:'PR-005',payments:[
    {amountPaise:12979900,mode:'Debit/Credit Card',reference:'CARD-DEMO-2404-A',date:'2026-11-19T13:44:00.000Z'}
  ]},
  {invoiceNumber:'INV-DEMO-2405',date:'2026-11-20T12:10:00.000Z',storeId:'S3',customerId:'CUS-0001',productId:'PR-015',payments:[
    {amountPaise:1000000,mode:'Financing / EMI',reference:'EMI-DEMO-2405-A',date:'2026-11-20T12:20:00.000Z',financier:'Northstar Demo Finance'}
  ]},
  {invoiceNumber:'INV-DEMO-2406',date:'2026-08-20T10:10:00.000Z',storeId:'S1',customerId:'CUS-0005',productId:'PR-010',status:'Reversed',reversalReason:'Duplicate demonstration invoice',payments:[]},
  {invoiceNumber:'INV-DEMO-2407',date:'2026-08-20T15:15:00.000Z',storeId:'S4',customerId:'CUS-0006',productId:'PR-013',payments:[
    {amountPaise:800000,mode:'Bank Transfer',reference:'BANK-DEMO-2407-A',date:'2026-08-21T07:45:00.000Z'}
  ]},
  {invoiceNumber:'INV-DEMO-2408',date:'2026-07-10T09:00:00.000Z',storeId:'S5',customerId:'CUS-0007',productId:'PR-025',payments:[]}
]

export const initialSales: Sale[] = seedSalesPlan.map((plan,index) => {
  const product=initialProducts.find(item=>item.id===plan.productId)!
  const customer=initialCustomers.find(item=>item.id===plan.customerId)!
  const calculation=calculateInvoice([{quantity:1,unitPricePaise:product.pricePaise,itemDiscountPct:0,gstRate:product.gstRate}],0,'',false)
  const paymentIds=plan.payments.map((_,paymentIndex)=>`PAY-DEMO-${2401+index}-${paymentIndex+1}`)
  const paidPaise=plan.status==='Reversed'?0:plan.payments.reduce((sum,payment)=>sum+payment.amountPaise,0)
  const line=calculation.lines[0]
  const reversed=plan.status==='Reversed'
  return {
    id:`sale-demo-${2401+index}`,invoiceNumber:plan.invoiceNumber,date:plan.date,storeId:plan.storeId,
    customerId:customer.id,customerName:customer.name,salesperson:'Aarav Sharma',
    payment:plan.payments.length>1?'Split payment':plan.payments[0]?.mode||'Unpaid',
    lines:[{productId:product.id,name:product.name,brandId:product.brandId,sku:product.sku,model:product.model,category:product.category,
      quantity:1,unitPricePaise:product.pricePaise,itemDiscountPct:0,itemDiscountPaise:line.itemDiscountPaise,
      cartDiscountPaise:line.cartDiscountPaise,taxablePaise:line.taxablePaise,gstRate:product.gstRate,taxPaise:line.taxPaise,serials:[]}],
    grossPaise:calculation.grossPaise,itemDiscountPaise:calculation.itemDiscountPaise,cartDiscountPaise:calculation.cartDiscountPaise,
    taxablePaise:calculation.taxablePaise,cgstPaise:calculation.cgstPaise,sgstPaise:calculation.sgstPaise,igstPaise:calculation.igstPaise,
    taxPaise:calculation.taxPaise,roundOffPaise:calculation.roundOffPaise,totalPaise:calculation.totalPaise,
    paidPaise,balancePaise:reversed?0:calculation.totalPaise-paidPaise,
    paymentStatus:paidPaise>=calculation.totalPaise?'Paid':paidPaise?'Partially paid':'Unpaid',
    paymentIds,status:plan.status||'Completed',reversalReason:plan.reversalReason||'',
    reversedAt:reversed?'2026-08-20T10:30:00.000Z':'',reversedBy:reversed?'Aarav Sharma':'',
    createdAt:plan.date,createdBy:'Aarav Sharma · Finance Executive'
  }
})

export const initialPayments: Payment[] = seedSalesPlan.flatMap((plan,index) => plan.payments.map((payment,paymentIndex) => ({
  id:`PAY-DEMO-${2401+index}-${paymentIndex+1}`,invoiceId:plan.invoiceNumber,customerId:plan.customerId,
  date:payment.date,amountPaise:payment.amountPaise,mode:payment.mode,reference:payment.reference,
  financier:payment.financier||'',storeId:plan.storeId,collectedBy:'Aarav Sharma'
})))
export const initialPaymentAllocations: PaymentAllocation[] = initialPayments.map(payment => ({
  id:`ALLOC-${payment.id}`,paymentId:payment.id,invoiceId:payment.invoiceId,amountPaise:payment.amountPaise,
  createdAt:payment.date,createdBy:payment.collectedBy||'Aarav Sharma'
}))
export const initialFinancialAudit: FinancialAuditEntry[] = [
  ...initialPayments.flatMap<FinancialAuditEntry>(payment => [
    {id:`AUDIT-REC-${payment.id}`,reference:payment.reference,activity:'Payment recorded',date:payment.date,actor:payment.collectedBy||'Aarav Sharma',reason:'Seeded fictional demo collection',customerId:payment.customerId,invoiceId:payment.invoiceId},
    {id:`AUDIT-ALLOC-${payment.id}`,reference:payment.reference,activity:'Payment allocated',date:payment.date,actor:payment.collectedBy||'Aarav Sharma',reason:'Allocated to the source invoice',customerId:payment.customerId,invoiceId:payment.invoiceId}
  ]),
  {id:'AUDIT-REV-INV-DEMO-2406',reference:'INV-DEMO-2406',activity:'Invoice reversed',date:'2026-08-20T10:30:00.000Z',actor:'Aarav Sharma',reason:'Duplicate demonstration invoice',customerId:'CUS-0005',invoiceId:'INV-DEMO-2406'}
]
export const initialRecoveryCases: RecoveryCase[] = [
  {id:'REC-DEMO-2402',customerId:'CUS-0002',storeId:'S1',assignedExecutive:'Nisha Batra',status:'Contacted',lastContactAt:'2026-11-18T10:00:00.000Z',nextFollowUpAt:'2026-11-21T04:30:00.000Z',promisedPaymentAt:'',notes:'Customer requested a call after the weekend.',createdAt:'2026-10-15T10:00:00.000Z'},
  {id:'REC-DEMO-2403',customerId:'CUS-0003',storeId:'S2',assignedExecutive:'Rohan Khanna',status:'Promised to Pay',lastContactAt:'2026-11-19T08:30:00.000Z',nextFollowUpAt:'2026-11-21T04:30:00.000Z',promisedPaymentAt:'2026-11-24T06:30:00.000Z',notes:'Customer confirmed an expected transfer.',createdAt:'2026-10-20T10:00:00.000Z'},
  {id:'REC-DEMO-2407',customerId:'CUS-0006',storeId:'S4',assignedExecutive:'Nisha Batra',status:'Not Contacted',lastContactAt:'',nextFollowUpAt:'2026-11-20T04:30:00.000Z',promisedPaymentAt:'',notes:'',createdAt:'2026-08-25T10:00:00.000Z'},
  {id:'REC-DEMO-2408',customerId:'CUS-0007',storeId:'S5',assignedExecutive:'Rohan Khanna',status:'Escalated',lastContactAt:'2026-11-14T09:00:00.000Z',nextFollowUpAt:'2026-11-21T04:30:00.000Z',promisedPaymentAt:'',notes:'Older balance referred for manager review.',createdAt:'2026-08-15T10:00:00.000Z'}
]

export const initialPhase3State: Phase3State = {
  customers: initialCustomers,
  products: initialProducts,
  inventory: initialInventory.map(stock => {
    const sold=initialSales.filter(sale=>sale.status==='Completed'&&sale.storeId===stock.storeId)
      .reduce((sum,sale)=>sum+sale.lines.filter(line=>line.productId===stock.productId).reduce((quantity,line)=>quantity+line.quantity,0),0)
    return {...stock,quantity:stock.quantity-sold}
  }),
  serials: initialSerials,
  walkIns: initialWalkIns,
  enquiries: initialEnquiries,
  sales: initialSales,
  payments: initialPayments,
  paymentAllocations: initialPaymentAllocations,
  paymentReversals: [],
  paymentReconciliations: [],
  recoveryCases: initialRecoveryCases,
  recoveryActivities: [],
  financialAudit: initialFinancialAudit,
  deliveries: [],
  installations: [],
  audit: []
}

export type InvoiceDraftLine = {quantity: number; unitPricePaise: number; itemDiscountPct: number; gstRate: number}
export type InvoiceCalculation = {
  grossPaise: number
  itemDiscountPaise: number
  cartDiscountPaise: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  taxPaise: number
  roundOffPaise: number
  totalPaise: number
  lines: Array<{itemDiscountPaise: number; cartDiscountPaise: number; taxablePaise: number; taxPaise: number}>
}

export function calculateInvoice(lines: InvoiceDraftLine[], cartDiscountPct: number, discountCode: string, interstate: boolean): InvoiceCalculation {
  if (!lines.length) throw new Error('Add at least one product before checkout.')
  if (!Number.isFinite(cartDiscountPct) || cartDiscountPct < 0 || cartDiscountPct > 30) throw new Error('Cart discount must be between 0% and 30%.')
  const amounts = lines.map(line => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Each product must have a valid quantity.')
    if (!Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) throw new Error('Product price is invalid.')
    if (!Number.isFinite(line.itemDiscountPct) || line.itemDiscountPct < 0 || line.itemDiscountPct > 30) throw new Error('Item discounts must be between 0% and 30%.')
    if (!Number.isFinite(line.gstRate) || line.gstRate < 0 || line.gstRate > 100) throw new Error('GST rate is invalid.')
    return {
      grossPaise: line.quantity * line.unitPricePaise,
      discountPaise: Math.round(line.quantity * line.unitPricePaise * line.itemDiscountPct / 100)
    }
  })
  const requiresApproval = cartDiscountPct > 10 || lines.some(line => line.itemDiscountPct > 10)
  if (requiresApproval && discountCode.trim() !== 'MANAGER-OK') throw new Error('Discounts above 10% require the demo approval code MANAGER-OK.')
  const afterItems = amounts.map((amount, index) => amount.grossPaise - amount.discountPaise)
  const grossAfterItems = afterItems.reduce((sum, amount) => sum + amount, 0)
  const cartDiscountPaise = Math.round(grossAfterItems * cartDiscountPct / 100)
  let allocated = 0
  const resultLines = lines.map((line, index) => {
    const share = index === lines.length - 1
      ? cartDiscountPaise - allocated
      : grossAfterItems ? Math.floor(cartDiscountPaise * afterItems[index] / grossAfterItems) : 0
    allocated += share
    const taxablePaise = afterItems[index] - share
    const taxPaise = Math.round(taxablePaise * line.gstRate / 100)
    return {itemDiscountPaise: amounts[index].discountPaise, cartDiscountPaise: share, taxablePaise, taxPaise}
  })
  const grossPaise = amounts.reduce((sum, amount) => sum + amount.grossPaise, 0)
  const itemDiscountPaise = amounts.reduce((sum, amount) => sum + amount.discountPaise, 0)
  const taxablePaise = resultLines.reduce((sum, line) => sum + line.taxablePaise, 0)
  const taxPaise = resultLines.reduce((sum, line) => sum + line.taxPaise, 0)
  const intraTax = interstate ? 0 : taxPaise
  const cgstPaise = interstate ? 0 : Math.floor(intraTax / 2)
  const sgstPaise = interstate ? 0 : intraTax - cgstPaise
  const igstPaise = interstate ? taxPaise : 0
  const rawTotal = taxablePaise + taxPaise
  const totalPaise = Math.round(rawTotal / 100) * 100
  return {
    grossPaise, itemDiscountPaise, cartDiscountPaise, taxablePaise,
    cgstPaise, sgstPaise, igstPaise, taxPaise, roundOffPaise: totalPaise - rawTotal,
    totalPaise,
    lines: resultLines
  }
}

export function toAnalyticsInvoice(sale: Sale) {
  const first = sale.lines[0]
  const age = Math.max(0, Math.floor((endDay - new Date(sale.date).getTime()) / 86400000))
  return {
    id: sale.invoiceNumber, age, store: sale.storeId, brand: first.brandId, category: first.category,
    gross: Math.round((sale.grossPaise + sale.taxPaise) / 100),
    net: Math.round(sale.totalPaise / 100),
    paid: Math.round(sale.paidPaise / 100),
    cost: Math.round(sale.taxablePaise * 0.78 / 100),
    customer: Number.parseInt(sale.customerId.replace(/^CUS-/, '').slice(-8), 16) || 0,
    payment: sale.payment,
    delivery: 'Complete',
    installation: 'Not required'
  }
}

export function findStoreState(store: Row | undefined): string {
  const city = store?.city.toLowerCase() || ''
  if (city.includes('noida') || city.includes('ghaziabad')) return 'Uttar Pradesh'
  if (city.includes('faridabad') || city.includes('gurugram') || city.includes('gurgaon')) return 'Haryana'
  return 'Delhi'
}

export const productBrandName = (product: Product, brands: Row[]) =>
  brands.find(brand => brand.id === product.brandId)?.name || 'House collection'

export const staticCustomerInvoices = (customerId: string) => {
  const customerNumber = Number(customerId.replace('CUS-', ''))
  return invoices.filter(invoice => invoice.customer === customerNumber)
}

export const currency = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
export const dateTimeInIndia = (value: string) => new Date(value).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'})
export const dateInIndia = (value: string) => new Date(value).toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric'})
