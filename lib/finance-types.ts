export type PaymentAllocation = {
  id: string
  paymentId: string
  invoiceId: string
  amountPaise: number
  createdAt: string
  createdBy: string
}

export type PaymentReversal = {
  id: string
  paymentId: string
  amountPaise: number
  date: string
  actor: string
  reason: string
}

export type ReconciliationStatus = 'Unreconciled' | 'Matched' | 'Needs review'
export type PaymentReconciliation = {
  id: string
  paymentId: string
  status: Exclude<ReconciliationStatus, 'Unreconciled'>
  date: string
  actor: string
  note: string
}

export type RecoveryStatus =
  | 'Not Contacted'
  | 'Contacted'
  | 'Promised to Pay'
  | 'Partially Recovered'
  | 'Fully Recovered'
  | 'Disputed'
  | 'Escalated'

export type RecoveryCase = {
  id: string
  customerId: string
  storeId: string
  assignedExecutive: string
  status: RecoveryStatus
  lastContactAt: string
  nextFollowUpAt: string
  promisedPaymentAt: string
  notes: string
  createdAt: string
}

export type RecoveryActivity = {
  id: string
  caseId: string
  date: string
  type: 'Call' | 'Visit' | 'Note'
  actor: string
  notes: string
  promisedPaymentAt: string
  nextFollowUpAt: string
  status: RecoveryStatus
}

export type FinancialAuditEntry = {
  id: string
  reference: string
  activity: 'Payment recorded' | 'Payment allocated' | 'Payment reversed' | 'Collection adjusted' | 'Invoice reversed' | 'Recovery activity recorded' | 'Reconciliation updated'
  date: string
  actor: string
  reason: string
  customerId?: string
  invoiceId?: string
}
