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
const screens:Record<string,React.ReactNode>={
  '/analytics/executive-dashboard':<Executive/>,'/analytics/store-performance':<Performance/>,'/analytics/alerts-notifications':<Alerts/>,'/analytics/executive-kpis':<Kpis/>,
  '/administration/users-roles':<Directory kind="users"/>,'/administration/stores':<Directory kind="stores"/>,'/administration/brands':<Directory kind="brands"/>,'/administration/settings':<Settings/>,
  '/customers/customer-directory':<CustomerDirectory/>,'/customers/footfall':<FootfallManagement mode="footfall"/>,'/customers/enquiries':<FootfallManagement mode="enquiries"/>,'/sales/pos-billing':<POSCheckout/>,'/sales/sales-history':<SalesHistory/>,
  '/products/product-catalogue':<ProductCatalogue/>,'/products/serial-registry':<SerialRegistry/>,
  '/inventory/stock-overview':<StockOverview/>,'/inventory/stock-ledger':<StockLedger/>,'/inventory/stock-adjustments':<StockAdjustments/>,'/inventory/transfers':<Transfers/>,'/inventory/inventory-aging':<InventoryAging/>,'/inventory/product-outstanding':<ProductOutstanding/>,
  '/warehouse/grn':<GRNManagement/>,'/warehouse/serial-scanning':<SerialScanning/>,'/warehouse/warehouse-operations':<WarehouseOperations/>,'/warehouse/buyback-scrap':<BuybackManagement/>,
  '/finance/finance-dashboard':<FinanceDashboard/>,'/finance/payment-analysis':<PaymentAnalysis/>,'/finance/receivables':<ReceivablesDirectory/>,
  '/finance/invoice-receivables':<InvoiceReceivables/>,'/finance/receivables-aging':<ReceivablesAging/>,'/finance/collections':<Collections/>,
  '/finance/payment-allocation':<PaymentAllocation/>,'/finance/due-recovery':<DueRecovery/>,'/finance/recovery-performance':<RecoveryPerformance/>,
  '/finance/invoice-monitoring':<InvoiceMonitoring/>,'/finance/payment-reconciliation':<PaymentReconciliation/>,'/finance/financial-audit-history':<FinancialAuditHistory/>
}
export function generateStaticParams(){return routes.map(r=>({group:r.href.split('/')[1],page:r.href.split('/')[2]}))}
export default async function Page({params}:{params:Promise<{group:string;page:string}>}){const {group,page}=await params;const href=`/${group}/${page}`;if(!routes.some(r=>r.href===href))notFound();return screens[href]??<ModulePage key={href} href={href}/>}
