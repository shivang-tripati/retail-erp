export type InstallationStatus =
  | 'Pending'
  | 'Scheduled'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Failed'
  | 'Rescheduled'
  | 'Cancelled'
  | 'Awaiting scheduling'
  | 'Cancelled by invoice reversal'

export type InstallationChecklistItem = {
  id: string
  label: string
  checked: boolean
  checkedAt?: string
  checkedBy?: string
}

export type Installation = {
  id: string
  saleId: string
  customerId: string
  product: string
  productId?: string
  storeId?: string
  deliveryId?: string
  deliveryItemId?: string
  serials?: string[]
  quantity?: number
  scheduledDate: string
  status: InstallationStatus
  address?: string
  preferredDate?: string
  timeSlot?: string
  technicianId?: string
  serviceType?: string
  instructions?: string
  createdAt?: string
  updatedAt?: string
  arrivedAt?: string
  completedAt?: string
  checklist?: InstallationChecklistItem[]
  customerConfirmed?: boolean
  failureReason?: string
  cancellationReason?: string
  reportReference?: string
}

export type InstallationActivity = {
  id: string
  installationId: string
  action: 'Eligibility recorded' | 'Booking created' | 'Scheduled' | 'Assigned' | 'Started' | 'Arrived' | 'Checklist updated' | 'Completed' | 'Failed' | 'Rescheduled' | 'Cancelled' | 'Note added'
  date: string
  actor: string
  notes: string
}

export type Technician = {
  id: string
  technicianId: string
  name: string
  mobile: string
  skills: string[]
  serviceArea: string
  availability: 'Available' | 'Busy' | 'Unavailable'
  status: 'Active' | 'Inactive'
  createdAt: string
  updatedAt: string
}

export type WarrantyPlan = {
  id: string
  name: string
  code: string
  brandIds: string[]
  categories: string[]
  durationMonths: number
  description: string
  exclusions: string
  pricePaise: number
  status: 'Active' | 'Inactive'
  createdAt: string
  updatedAt: string
}

export type WarrantyKind = 'Manufacturer' | 'Retailer Extended'
export type WarrantyStatus = 'Pending Registration' | 'Active' | 'Expiring Soon' | 'Expired' | 'Cancelled'

export type WarrantyRegistration = {
  id: string
  reference: string
  kind: WarrantyKind
  customerId: string
  saleId: string
  invoiceNumber: string
  productId: string
  serial: string
  deliveryId: string
  installationId: string
  planId: string
  planName: string
  durationMonths: number
  pricePaise: number
  startDate: string
  endDate: string
  registrationDate: string
  registeredBy: string
  coverage: string
  exclusions: string
  status: WarrantyStatus
  cancellationReason: string
}

export type ServiceCategory =
  | 'Installation issue'
  | 'Product malfunction'
  | 'Physical damage'
  | 'Electrical issue'
  | 'Cooling/heating issue'
  | 'Display issue'
  | 'Other'

export type ServicePriority = 'Low' | 'Normal' | 'High' | 'Urgent'
export type ServiceStatus = 'Open' | 'Assigned' | 'Scheduled' | 'In Progress' | 'Waiting for Parts' | 'Escalated' | 'Resolved' | 'Closed' | 'Cancelled'
export type WarrantyCoverage = 'Covered' | 'Chargeable' | 'Pending review'

export type ServiceTicket = {
  id: string
  ticketNumber: string
  customerId: string
  productId: string
  serial: string
  saleId: string
  invoiceNumber: string
  warrantyId: string
  installationId: string
  category: ServiceCategory
  issue: string
  priority: ServicePriority
  serviceType: 'On-site' | 'Workshop'
  preferredVisitDate: string
  storeId: string
  contactMobile: string
  assignedTechnicianId: string
  status: ServiceStatus
  warrantyCoverage: WarrantyCoverage
  serviceChargePaise: number
  diagnosis: string
  workPerformed: string
  partsUsed: string
  resolution: string
  customerFeedback: string
  createdAt: string
  updatedAt: string
  resolutionAt: string
  followUpDate: string
  escalationReason: string
  escalationNotes: string
}

export type ServiceActivity = {
  id: string
  ticketId: string
  action: 'Ticket created' | 'Assigned' | 'Status changed' | 'Visit scheduled' | 'Diagnosis recorded' | 'Resolution recorded' | 'Escalated' | 'Coverage updated' | 'Priority updated' | 'Ticket closed' | 'Note added' | 'Cancelled'
  date: string
  actor: string
  notes: string
  fromStatus?: ServiceStatus
  toStatus?: ServiceStatus
}
