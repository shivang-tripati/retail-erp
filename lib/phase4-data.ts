import {initialBrands, type Row} from './demo-data'
import {initialInventory, initialProducts, initialSerials, type Product} from './phase3-data'
import {initialStores} from './demo-data'

export const warehouseLocationId = 'W0'
export const warehouseLocationName = 'Delhi NCR Central Warehouse'

export type MovementType =
  | 'Purchase Receipt' | 'Sale' | 'Sale Reversal' | 'Customer Return'
  | 'Inter-store Transfer Out' | 'Inter-store Transfer In' | 'Buyback'
  | 'Scrap' | 'Stock Adjustment' | 'Putaway'

export type InventoryMovement = {
  id: string
  reference: string
  productId: string
  sku: string
  serial: string
  fromLocation: string
  toLocation: string
  quantity: number
  type: MovementType
  date: string
  actor: string
  reason: string
}

export type GRNLine = {
  productId: string
  expectedQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  purchasePricePaise: number
  serials: string[]
  damagedSerials?: string[]
}
export type GRN = {
  id: string
  supplier: string
  supplierInvoice: string
  receivingLocation: string
  status: 'Draft' | 'Received'
  items: GRNLine[]
  createdAt: string
  receivedAt: string
  createdBy: string
  notes: string
}

export type TransferLine = {
  productId: string
  quantity: number
  dispatchedQuantity: number
  receivedQuantity: number
  serials: string[]
  receivedSerials: string[]
}
export type StockTransfer = {
  id: string
  sourceLocation: string
  destinationLocation: string
  status: 'Draft' | 'Requested' | 'Approved' | 'Dispatched' | 'Partially Received' | 'Received' | 'Cancelled'
  items: TransferLine[]
  createdAt: string
  dispatchedAt: string
  receivedAt: string
  createdBy: string
  notes: string
}

export type Buyback = {
  id: string
  customerId: string
  productId: string
  storeId: string
  condition: string
  serial: string
  estimatedValuePaise: number
  approvedValuePaise: number
  exchangeCreditPaise: number
  status: 'Pending Approval' | 'Approved' | 'Rejected'
  disposition: 'Pending inspection' | 'Resale stock' | 'Scrapped'
  createdAt: string
  createdBy: string
  notes: string
}

export type ScrapRequest = {
  id: string
  productId: string
  storeId: string
  quantity: number
  serials: string[]
  reason: string
  status: 'Pending Approval' | 'Approved' | 'Rejected'
  date: string
  actor: string
}

const openingDate = (index: number) => new Date(Date.UTC(2026, 6, 15 + index)).toISOString()
const openingGrnId = (storeId: string) => `GRN-OPENING-${storeId}`

export const initialGRNs: GRN[] = initialStores.map((store, index) => ({
  id: openingGrnId(store.id),
  supplier: ['Northstar Distribution','Metro Appliance Supply','Capital Digital Wholesale'][index % 3],
  supplierInvoice: `OPENING-${store.code}`,
  receivingLocation: store.id,
  status: 'Received',
  items: initialInventory.filter(row => row.storeId === store.id && row.quantity > 0).map(row => {
    const product = initialProducts.find(item => item.id === row.productId)!
    return {productId:product.id,expectedQuantity:row.quantity,receivedQuantity:row.quantity,damagedQuantity:0,purchasePricePaise:product.purchasePricePaise,serials:initialSerials.filter(serial=>serial.productId===product.id&&serial.storeId===store.id).map(serial=>serial.serial),damagedSerials:[]}
  }),
  createdAt: openingDate(index),
  receivedAt: openingDate(index),
  createdBy: 'Seeded demo receipt',
  notes: 'Seeded sample stock. Receipt dates are illustrative.'
}))

export const initialMovements: InventoryMovement[] = initialInventory
  .filter(row => row.storeId !== warehouseLocationId && row.quantity > 0)
  .flatMap(row => {
    const product = initialProducts.find(item => item.id === row.productId)!
    const storeIndex = Number(row.storeId.slice(1)) || 0
    const serials=initialSerials.filter(item=>item.productId===product.id&&item.storeId===row.storeId)
    if(product.serialRequired)return serials.map(record=>({
      id:`MOVE-OPEN-${record.serial}`,
      reference:openingGrnId(row.storeId),
      productId:product.id,
      sku:product.sku,
      serial:record.serial,
      fromLocation:'SUPPLIER',
      toLocation:row.storeId,
      quantity:1,
      type:'Purchase Receipt' as const,
      date:openingDate(storeIndex),
      actor:'Seeded demo receipt',
      reason:'Seeded sample opening stock; age is illustrative.'
    }))
    return [{
      id:`MOVE-OPEN-${row.storeId}-${row.productId}`,
      reference:openingGrnId(row.storeId),
      productId:product.id,
      sku:product.sku,
      serial:'',
      fromLocation:'SUPPLIER',
      toLocation:row.storeId,
      quantity:row.quantity,
      type:'Purchase Receipt' as const,
      date:openingDate(storeIndex),
      actor:'Seeded demo receipt',
      reason:'Seeded sample opening stock; age is illustrative.'
    }]
  })

export const initialPhase4State = {
  movements: initialMovements,
  grns: initialGRNs,
  transfers: [] as StockTransfer[],
  buybacks: [] as Buyback[],
  scrapRequests: [] as ScrapRequest[]
}

export function productName(id: string, products: Product[]) {
  return products.find(item => item.id === id)?.name || id
}

export function productBrandName(brandId: string, brands: Row[]) {
  return brands.find(item => item.id === brandId)?.name || brandId
}
