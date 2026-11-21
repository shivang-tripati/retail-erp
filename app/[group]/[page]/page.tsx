import {notFound} from 'next/navigation'
import {routes} from '@/lib/retail'
import ModulePage from '@/components/module-page'
import Executive from '@/components/executive'
import Performance from '@/components/store-performance'
import Alerts from '@/components/alerts'
import Kpis from '@/components/kpi-details'
import Directory from '@/components/admin-directory'
import Settings from '@/components/general-settings'
import CustomerDirectory from '@/components/customer-directory'
import FootfallManagement from '@/components/footfall-management'
import POSCheckout from '@/components/pos/pos-checkout'
import SalesHistory from '@/components/sales-history'
import {ProductCatalogue,SerialRegistry} from '@/components/phase4/products'
import {StockOverview,StockLedger,StockAdjustments,Transfers,InventoryAging,ProductOutstanding} from '@/components/phase4/inventory'
import {GRNManagement,SerialScanning,WarehouseOperations,BuybackManagement} from '@/components/phase4/warehouse'
import {FinanceDashboard} from '@/components/finance/dashboard'
import {PaymentAnalysis,InvoiceMonitoring,PaymentReconciliation,FinancialAuditHistory} from '@/components/finance/payments'
import {ReceivablesDirectory,InvoiceReceivables,ReceivablesAging} from '@/components/finance/receivables'
import {Collections,PaymentAllocation} from '@/components/finance/collections'
import {DueRecovery,RecoveryPerformance} from '@/components/finance/recovery'
import {DeliveryDashboard} from '@/components/fulfilment/dashboard'
import {DeliveryOrders} from '@/components/fulfilment/orders'
import {DeliveryScheduling,DispatchPreparation,DispatchManifests} from '@/components/fulfilment/operations'
import {DeliveryTracking,DeliveryExceptions,ProofOfDelivery} from '@/components/fulfilment/tracking'
import {DeliveryDocuments} from '@/components/fulfilment/documents'
import {FulfilmentAnalytics} from '@/components/fulfilment/analytics'
import {InstallationDashboard,InstallationEligibility,InstallationBookings,TechnicianDirectory,InstallationWorklist} from '@/components/aftersales/installations'
import {WarrantyDashboard,WarrantyPlans,WarrantyRegistrationForm,WarrantyDirectory,WarrantyCertificates} from '@/components/aftersales/warranties'
import {ServiceDashboard,ServiceTickets,ServiceEscalations} from '@/components/aftersales/service'
import {AfterSalesAnalytics,AfterSalesDashboard} from '@/components/aftersales/analytics'
import {SalesCustomerAnalytics,InventoryWarehouseAnalytics,FinanceCollectionsAnalytics,FulfilmentAfterSalesAnalytics,Reports} from '@/components/phase8/analytics'
import DemoCentre from '@/components/demo-centre'
const screens:Record<string,React.ReactNode>={
  '/demo/demo-centre':<DemoCentre/>,
  '/analytics/executive-dashboard':<Executive/>,'/analytics/store-performance':<Performance/>,'/analytics/alerts-notifications':<Alerts/>,'/analytics/executive-kpis':<Kpis/>,
  '/analytics/sales-customer-analytics':<SalesCustomerAnalytics/>,'/analytics/inventory-warehouse-analytics':<InventoryWarehouseAnalytics/>,
  '/analytics/finance-collections-analytics':<FinanceCollectionsAnalytics/>,'/analytics/fulfilment-after-sales-analytics':<FulfilmentAfterSalesAnalytics/>,
  '/analytics/reports':<Reports/>,
  '/administration/users-roles':<Directory kind="users"/>,'/administration/stores':<Directory kind="stores"/>,'/administration/brands':<Directory kind="brands"/>,'/administration/settings':<Settings/>,
  '/customers/customer-directory':<CustomerDirectory/>,'/customers/footfall':<FootfallManagement mode="footfall"/>,'/customers/enquiries':<FootfallManagement mode="enquiries"/>,'/sales/pos-billing':<POSCheckout/>,'/sales/sales-history':<SalesHistory/>,
  '/products/product-catalogue':<ProductCatalogue/>,'/products/serial-registry':<SerialRegistry/>,
  '/inventory/stock-overview':<StockOverview/>,'/inventory/stock-ledger':<StockLedger/>,'/inventory/stock-adjustments':<StockAdjustments/>,'/inventory/transfers':<Transfers/>,'/inventory/inventory-aging':<InventoryAging/>,'/inventory/product-outstanding':<ProductOutstanding/>,
  '/warehouse/grn':<GRNManagement/>,'/warehouse/serial-scanning':<SerialScanning/>,'/warehouse/warehouse-operations':<WarehouseOperations/>,'/warehouse/buyback-scrap':<BuybackManagement/>,
  '/finance/finance-dashboard':<FinanceDashboard/>,'/finance/payment-analysis':<PaymentAnalysis/>,'/finance/receivables':<ReceivablesDirectory/>,
  '/finance/invoice-receivables':<InvoiceReceivables/>,'/finance/receivables-aging':<ReceivablesAging/>,'/finance/collections':<Collections/>,
  '/finance/payment-allocation':<PaymentAllocation/>,'/finance/due-recovery':<DueRecovery/>,'/finance/recovery-performance':<RecoveryPerformance/>,
  '/finance/invoice-monitoring':<InvoiceMonitoring/>,'/finance/payment-reconciliation':<PaymentReconciliation/>,'/finance/financial-audit-history':<FinancialAuditHistory/>,
  '/fulfilment/delivery-dashboard':<DeliveryDashboard/>,'/fulfilment/delivery-orders':<DeliveryOrders/>,'/fulfilment/delivery-scheduling':<DeliveryScheduling/>,
  '/fulfilment/dispatch':<DispatchPreparation/>,'/fulfilment/dispatch-manifests':<DispatchManifests/>,'/fulfilment/delivery-tracking':<DeliveryTracking/>,
  '/fulfilment/delivery-exceptions':<DeliveryExceptions/>,'/fulfilment/proof-of-delivery':<ProofOfDelivery/>,'/fulfilment/delivery-documents':<DeliveryDocuments/>,
  '/fulfilment/fulfilment-analytics':<FulfilmentAnalytics/>,
  '/after-sales/after-sales-dashboard':<AfterSalesDashboard/>,'/after-sales/installation-dashboard':<InstallationDashboard/>,'/after-sales/installation-eligibility':<InstallationEligibility/>,
  '/after-sales/installation-bookings':<InstallationBookings/>,'/after-sales/technician-directory':<TechnicianDirectory/>,
  '/after-sales/installation-worklist':<InstallationWorklist/>,'/after-sales/warranty-dashboard':<WarrantyDashboard/>,'/after-sales/warranty-plans':<WarrantyPlans/>,
  '/after-sales/warranty-registration':<WarrantyRegistrationForm/>,'/after-sales/warranty-directory':<WarrantyDirectory/>,
  '/after-sales/warranty-certificates':<WarrantyCertificates/>,'/after-sales/service-dashboard':<ServiceDashboard/>,
  '/after-sales/service-tickets':<ServiceTickets/>,'/after-sales/service-escalations':<ServiceEscalations/>,
  '/after-sales/after-sales-analytics':<AfterSalesAnalytics/>
}
const legacyScreens:Record<string,React.ReactNode>={
  '/after-sales/installation':<InstallationDashboard/>,
  '/after-sales/warranty':<WarrantyDashboard/>,
  '/after-sales/service-desk':<ServiceDashboard/>
}
const allRouteHrefs=[...routes.map(route=>route.href),...Object.keys(legacyScreens)]
export function generateStaticParams(){return allRouteHrefs.map(href=>({group:href.split('/')[1],page:href.split('/')[2]}))}
export default async function Page({params}:{params:Promise<{group:string;page:string}>}){const {group,page}=await params;const href=`/${group}/${page}`;if(!allRouteHrefs.includes(href))notFound();return screens[href]??legacyScreens[href]??<ModulePage key={href} href={href}/>}
