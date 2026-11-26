import { initialBrands } from './demo-data'
import { initialCustomers, initialProducts, initialSales } from './phase3-data'
import { initialPhase6State } from './phase6-data'
import type { Installation, InstallationActivity, ServiceActivity, ServiceTicket, Technician, WarrantyPlan, WarrantyRegistration } from './phase7-types'

const demoCreatedAt = '2026-11-20T09:00:00.000Z'
const productCategories = [...new Set(initialProducts.map(product => product.category))]
const brandIds = initialBrands.map(brand => brand.id)

export const initialTechnicians: Technician[] = [
  { id: 'TECH-101', technicianId: 'SE-T101', name: 'Vikram Sethi', mobile: '9811000311', skills: ['Home appliances', 'Small appliances'], serviceArea: 'Central Delhi', availability: 'Available', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'TECH-102', technicianId: 'SE-T102', name: 'Pooja Khanna', mobile: '9811000312', skills: ['TV & audio', 'Computers'], serviceArea: 'North Delhi · Rohini', availability: 'Busy', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'TECH-103', technicianId: 'SE-T103', name: 'Aman Rao', mobile: '9811000313', skills: ['Home appliances', 'Cooling appliances'], serviceArea: 'Noida · Ghaziabad', availability: 'Available', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'TECH-104', technicianId: 'SE-T104', name: 'Simran Kapoor', mobile: '9811000314', skills: ['TV & audio', 'Mobile phones'], serviceArea: 'South Delhi · Faridabad', availability: 'Available', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'TECH-105', technicianId: 'SE-T105', name: 'Dev Malhotra', mobile: '9811000315', skills: ['Home appliances', 'Small appliances'], serviceArea: 'Gurugram · Dwarka', availability: 'Available', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'TECH-106', technicianId: 'SE-T106', name: 'Nitin Chawla', mobile: '9811000316', skills: ['Computers', 'Mobile phones'], serviceArea: 'West Delhi · Janakpuri', availability: 'Unavailable', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'TECH-107', technicianId: 'SE-T107', name: 'Farah Iyer', mobile: '9811000317', skills: ['TV & audio', 'Home appliances'], serviceArea: 'East Delhi · Ghaziabad', availability: 'Available', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'TECH-108', technicianId: 'SE-T108', name: 'Karan Mehta', mobile: '9811000318', skills: productCategories, serviceArea: 'Delhi NCR', availability: 'Available', status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt }
]

export const initialWarrantyPlans: WarrantyPlan[] = [
  { id: 'WPLAN-12', name: 'Sharma Care 12', code: 'SC-12', brandIds, categories: productCategories, durationMonths: 12, description: 'Retailer-managed extended repair cover after the applicable manufacturer term.', exclusions: 'Accidental damage, consumables, misuse and unauthorised repair.', pricePaise: 249900, status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'WPLAN-24', name: 'Sharma Care 24', code: 'SC-24', brandIds, categories: ['Home appliances', 'TV & audio', 'Computers'], durationMonths: 24, description: 'Two-year retailer-managed extended repair cover.', exclusions: 'Accidental damage, consumables, misuse and unauthorised repair.', pricePaise: 449900, status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'WPLAN-MAJOR', name: 'Sharma Care Major Appliance', code: 'SC-MA', brandIds, categories: ['Home appliances', 'Cooling appliances'], durationMonths: 36, description: 'Three-year retailer-managed cover for eligible major appliances.', exclusions: 'Cosmetic damage, consumables, misuse and unauthorised repair.', pricePaise: 699900, status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'WPLAN-AV', name: 'Sharma Care AV', code: 'SC-AV', brandIds, categories: ['TV & audio'], durationMonths: 24, description: 'Retailer-managed extended repair cover for eligible audio and visual products.', exclusions: 'Accidental panel damage, consumables and unauthorised repair.', pricePaise: 529900, status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'WPLAN-COMPUTE', name: 'Sharma Care Computing', code: 'SC-PC', brandIds, categories: ['Computers'], durationMonths: 24, description: 'Retailer-managed extended repair cover for eligible computers.', exclusions: 'Data loss, consumables, accidental damage and unauthorised repair.', pricePaise: 349900, status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt },
  { id: 'WPLAN-12-MOBILE', name: 'Sharma Care Mobile', code: 'SC-MOB', brandIds, categories: ['Mobile phones'], durationMonths: 12, description: 'Retailer-managed extended repair cover for eligible mobile devices.', exclusions: 'Screen breakage, liquid damage and unauthorised repair.', pricePaise: 199900, status: 'Active', createdAt: demoCreatedAt, updatedAt: demoCreatedAt }
]

export const initialInstallations: Installation[] = initialPhase6State.installations.map(installation => {
  const delivery = initialPhase6State.deliveries.find(item => item.id === installation.deliveryId)
  const sale = initialSales.find(item => item.id === installation.saleId)
  const customer = initialCustomers.find(item => item.id === installation.customerId)
  const item = delivery?.items.find(record => record.name === installation.product)
  const line = sale?.lines.find(record => record.productId === item?.productId)
  const product = initialProducts.find(record => record.id === line?.productId)
  return {
    ...installation,
    productId: line?.productId || item?.productId,
    storeId: delivery?.storeId || sale?.storeId,
    deliveryItemId: item?.id,
    serials: [...(item?.deliveredSerials || [])],
    quantity: item?.deliveredQuantity || 1,
    address: customer ? `${customer.address}, ${customer.city}, ${customer.state} ${customer.pinCode}` : '',
    status: 'Pending',
    scheduledDate: '',
    preferredDate: '',
    timeSlot: '',
    technicianId: '',
    serviceType: 'On-site',
    instructions: '',
    createdAt: delivery?.updatedAt || sale?.date || demoCreatedAt,
    updatedAt: delivery?.updatedAt || sale?.date || demoCreatedAt,
    checklist: [],
    customerConfirmed: false,
    reportReference: '',
    product: product?.name || installation.product
  }
})

export const initialInstallationActivities: InstallationActivity[] = initialInstallations.map(installation => ({
  id: `IHA-${installation.id}-ELIGIBLE`,
  installationId: installation.id,
  action: 'Eligibility recorded',
  date: installation.createdAt || demoCreatedAt,
  actor: 'Prince Tiwari',
  notes: 'Delivered product entered the installation queue from its linked delivery record.'
}))

const seededSaleRows = initialSales.filter(sale => sale.status === 'Completed').slice(0, 3)
const ticketDescriptions = [
  'Customer reports intermittent operation and requests a technician inspection.',
  'Product performance changed after a recent power fluctuation; diagnosis requested.',
  'Customer would like an in-home check of the product settings and operating cycle.'
]
const ticketStatuses: ServiceTicket['status'][] = ['Open', 'In Progress', 'Waiting for Parts']
const ticketDates = ['2026-11-17T10:00:00.000Z', '2026-11-18T11:30:00.000Z', '2026-11-19T13:15:00.000Z']

export const initialServiceTickets: ServiceTicket[] = seededSaleRows.map((sale, index) => {
  const line = sale.lines[0]
  return {
    id: `TICKET-DEMO-${index + 1}`,
    ticketNumber: `SR-2026-${String(4101 + index)}`,
    customerId: sale.customerId,
    productId: line.productId,
    serial: line.serials[0] || '',
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    warrantyId: '',
    installationId: '',
    category: index === 0 ? 'Product malfunction' : index === 1 ? 'Electrical issue' : 'Other',
    issue: ticketDescriptions[index],
    priority: index === 0 ? 'High' : 'Normal',
    serviceType: 'On-site',
    preferredVisitDate: `2026-11-${String(22 + index).padStart(2, '0')}`,
    storeId: sale.storeId,
    contactMobile: initialCustomers.find(customer => customer.id === sale.customerId)?.mobile || '',
    assignedTechnicianId: initialTechnicians[index]?.id || '',
    status: ticketStatuses[index],
    warrantyCoverage: 'Pending review',
    serviceChargePaise: 0,
    diagnosis: index === 1 ? 'Demo inspection identified a component requiring replacement.' : '',
    workPerformed: '',
    partsUsed: index === 1 ? 'Demo replacement component · not an inventory movement' : '',
    resolution: '',
    customerFeedback: '',
    createdAt: ticketDates[index],
    updatedAt: ticketDates[index],
    resolutionAt: '',
    followUpDate: '',
    escalationReason: '',
    escalationNotes: ''
  }
})

export const initialServiceActivities: ServiceActivity[] = initialServiceTickets.map((ticket, index): ServiceActivity[] => {
  const created: ServiceActivity = {
    id: `SHA-${ticket.id}-CREATED`,
    ticketId: ticket.id,
    action: 'Ticket created',
    date: ticket.createdAt,
    actor: 'Nisha Batra',
    notes: 'Fictional demo service request linked to a completed sale.'
  }
  if (index === 0) return [created]
  return [created, {
    id: `SHA-${ticket.id}-STATUS`,
    ticketId: ticket.id,
    action: 'Status changed',
    date: ticket.updatedAt,
    actor: initialTechnicians[index].name,
    notes: index === 1 ? 'Technician started a demo inspection.' : 'A replacement component is noted as required.',
    fromStatus: index === 1 ? 'Assigned' : 'In Progress',
    toStatus: ticket.status
  }]
}).flat()

export const initialPhase7State = {
  installations: initialInstallations,
  installationActivities: initialInstallationActivities,
  technicians: initialTechnicians,
  warrantyPlans: initialWarrantyPlans,
  warranties: [] as WarrantyRegistration[],
  serviceTickets: initialServiceTickets,
  serviceActivities: initialServiceActivities
}
