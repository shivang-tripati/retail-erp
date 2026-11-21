export type FulfilmentMode = 'Delivery' | 'Counter pickup'
export type DeliveryStatus =
  | 'Pending'
  | 'Scheduled'
  | 'Ready for Dispatch'
  | 'Dispatched'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Failed'
  | 'Rescheduled'
  | 'Cancelled'
export type DeliveryPriority = 'Standard' | 'High' | 'Urgent'

export type DeliveryItem = {
  id: string
  saleLineId: string
  productId: string
  name: string
  sku: string
  quantity: number
  serials: string[]
  dispatchedQuantity: number
  dispatchedSerials: string[]
  deliveredQuantity: number
  deliveredSerials: string[]
}

export type Delivery = {
  id: string
  orderNumber: string
  saleId: string
  customerId: string
  storeId: string
  items: DeliveryItem[]
  status: DeliveryStatus
  deliveryAddress: string
  scheduledDate: string
  timeSlot: string
  deliveryTeamId: string
  vehicleId: string
  priority: DeliveryPriority
  instructions: string
  createdAt: string
  createdBy: string
  dispatchedAt: string
  dispatchedBy: string
  manifestId: string
  updatedAt: string
}

export type DeliveryTeam = {
  id: string
  name: string
  lead: string
  mobile: string
  status: 'Available' | 'Inactive'
}

export type DeliveryVehicle = {
  id: string
  registration: string
  type: string
  capacity: string
  status: 'Available' | 'Inactive'
}

export type DeliveryManifest = {
  id: string
  manifestNumber: string
  createdAt: string
  createdBy: string
  storeId: string
  deliveryTeamId: string
  vehicleId: string
  deliveryIds: string[]
  status: 'Draft' | 'Dispatched' | 'Cancelled'
  dispatchedAt: string
  dispatchedBy: string
}

export type DeliveryActivity = {
  id: string
  deliveryId: string
  type:
    | 'Order created'
    | 'Scheduled'
    | 'Manifest created'
    | 'Dispatched'
    | 'Status updated'
    | 'Exception recorded'
    | 'Rescheduled'
    | 'Proof of delivery'
    | 'Delivery completed'
    | 'Cancelled'
    | 'Order split'
    | 'Contact recorded'
  date: string
  actor: string
  status: DeliveryStatus
  notes: string
  exceptionId?: string
  contactMethod?: 'Call' | 'Visit'
}

export type DeliveryExceptionReason =
  | 'Customer unavailable'
  | 'Incorrect address'
  | 'Product damaged'
  | 'Vehicle issue'
  | 'Delivery postponed'
  | 'Customer refused delivery'
  | 'Other'

export type DeliveryException = {
  id: string
  deliveryId: string
  reason: DeliveryExceptionReason
  notes: string
  date: string
  actor: string
  followUpDate: string
  status: 'Open' | 'Resolved' | 'Escalated'
}

export type DeliveryProofLine = {
  deliveryItemId: string
  quantity: number
  serials: string[]
}

export type DeliveryProof = {
  id: string
  reference: string
  deliveryId: string
  date: string
  actor: string
  recipientName: string
  recipientMobile: string
  notes: string
  conditionConfirmed: boolean
  lines: DeliveryProofLine[]
}
