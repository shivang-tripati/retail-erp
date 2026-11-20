'use client'
import {useState} from 'react'
import {Printer} from 'lucide-react'
import {Button} from '../ui/button'
import {currency,dateTimeInIndia,findStoreState,type Customer,type Payment,type Sale} from '@/lib/phase3-data'
import type {Row} from '@/lib/demo-data'

type Props={sale:Sale;customer:Customer;store?:Row;payments:Payment[];company:string}
export default function InvoicePreview({sale,customer,store,payments,company}:Props){
  const [receipt,setReceipt]=useState(false)
  return <div className={`invoice-preview ${receipt?'thermal-view':''}`}>
    <div className="invoice-tools no-print"><Button type="button" variant="outline" onClick={()=>setReceipt(value=>!value)}>{receipt?'A4 invoice':'80 mm receipt'}</Button><Button type="button" onClick={()=>window.print()}><Printer size={15}/>Print invoice</Button></div>
    <article className={`invoice-sheet ${receipt?'invoice-thermal':''}`}>
      <header className="invoice-header"><div><div className="invoice-brandmark">SE</div><div><h1>{company}</h1><p>{store?.address||'Delhi NCR'} · {store?.city||'Delhi'}, {findStoreState(store)}</p><small>Fictional point-of-sale demonstration</small></div></div><div className="invoice-heading"><span>Tax invoice · Demo</span><strong>{sale.invoiceNumber}</strong><time>{dateTimeInIndia(sale.date)}</time></div></header>
      <div className="invoice-parties"><section><small>Bill to</small><strong>{customer.name}</strong><span>{customer.address}, {customer.city}, {customer.state} {customer.pinCode}</span><span>{customer.mobile}{customer.email?` · ${customer.email}`:''}</span><span>Customer ID {customer.id}</span></section><section><small>Sold by</small><strong>{sale.salesperson}</strong><span>{store?.name||sale.storeId} branch</span><span>POS reference {sale.id}</span><span>Processed by {sale.createdBy}</span></section></div>
      <div className="invoice-table-scroll"><table className="invoice-lines"><thead><tr><th>Product / SKU / model</th><th>Serial number</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Taxable value</th></tr></thead><tbody>{sale.lines.map((line,index)=><tr key={line.productId}><td><strong>{line.name}</strong><small>{line.sku} · {line.model} · {line.gstRate}% GST</small></td><td>{line.serials.length?line.serials.map(serial=><small key={serial}>{serial}</small>):'—'}</td><td>{line.quantity}</td><td>{currency(line.unitPricePaise)}</td><td>{currency(line.itemDiscountPaise+line.cartDiscountPaise)}</td><td>{currency(line.taxablePaise)}</td></tr>)}</tbody></table></div>
      <div className="invoice-bottom"><div className="invoice-payments"><h2>Payment details</h2>{payments.length?<table><thead><tr><th>Date</th><th>Method / reference</th><th>Amount</th></tr></thead><tbody>{payments.map(payment=><tr key={payment.id}><td>{dateTimeInIndia(payment.date)}</td><td>{payment.mode}{payment.financier?` · ${payment.financier}`:''}<small>{payment.reference||'No reference entered'}</small></td><td>{currency(payment.amountPaise)}</td></tr>)}</tbody></table>:<p>No payment received at checkout.</p>}<p className="invoice-status">{sale.paymentStatus}{sale.balancePaise?` · Balance due ${currency(sale.balancePaise)}`:''}</p></div>
        <dl className="invoice-totals"><div><dt>Gross product value</dt><dd>{currency(sale.grossPaise)}</dd></div><div><dt>Item discount</dt><dd>−{currency(sale.itemDiscountPaise)}</dd></div><div><dt>Cart discount</dt><dd>−{currency(sale.cartDiscountPaise)}</dd></div><div><dt>Taxable value</dt><dd>{currency(sale.taxablePaise)}</dd></div>{sale.igstPaise?<div><dt>IGST</dt><dd>{currency(sale.igstPaise)}</dd></div>:<><div><dt>CGST</dt><dd>{currency(sale.cgstPaise)}</dd></div><div><dt>SGST</dt><dd>{currency(sale.sgstPaise)}</dd></div></>}<div><dt>Round-off</dt><dd>{sale.roundOffPaise<0?'−':''}{currency(Math.abs(sale.roundOffPaise))}</dd></div><div className="invoice-grand"><dt>Invoice total</dt><dd>{currency(sale.totalPaise)}</dd></div><div><dt>Amount paid</dt><dd>{currency(sale.paidPaise)}</dd></div><div className="invoice-balance"><dt>Balance due</dt><dd>{currency(sale.balancePaise)}</dd></div></dl>
      </div>
      <footer className="invoice-footer"><p>Prices, serials and tax calculations shown are fictional. GST calculation is illustrative only and is not a GST registration or a production tax invoice. Validate classification, place of supply and statutory requirements with a qualified tax professional before production use.</p><small>Thank you for shopping with {company}. Keep this demo invoice for your records.</small></footer>
    </article>
  </div>
}
