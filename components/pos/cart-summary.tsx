'use client'
import {Minus,Plus,Trash2} from 'lucide-react'
import {Panel} from '../analytics-controls'
import {Button} from '../ui/button'
import {Input} from '../ui/input'
import {Selector} from '../foundation'
import {currency,type InvoiceCalculation,type Product,type SerialRecord} from '@/lib/phase3-data'
import type {FulfilmentMode} from '@/lib/phase6-types'
import type {CartLine} from './pos-types'
import SerialAssignment from './serial-assignment'

type Props={
  cart:CartLine[];products:Product[];stock:Record<string,number>;serials:SerialRecord[]
  calculation:InvoiceCalculation|null;cartDiscountPct:number;discountCode:string
  onQty:(productId:string,quantity:number)=>void;onRemove:(productId:string)=>void
  onItemDiscount:(productId:string,value:number)=>void;onFulfilment:(productId:string,value:FulfilmentMode)=>void;onCartDiscount:(value:number)=>void
  onDiscountCode:(value:string)=>void;onSerial:(productId:string,index:number,serial:string)=>void
}
export default function CartSummary(props:Props){
  const product=(id:string)=>props.products.find(item=>item.id===id)
  return <Panel title="Current sale" meta={`${props.cart.reduce((sum,line)=>sum+line.quantity,0)} units · Cart remains local until confirmation`}>
    {!props.cart.length?<div className="pos-empty-cart">Your cart is empty. Choose products from the catalogue.</div>:<div className="pos-cart-lines">
      {props.cart.map(line=>{const item=product(line.productId);if(!item)return null;return <article className="pos-cart-line" key={line.productId}>
        <div className="pos-cart-title"><strong>{item.name}</strong><small>{item.sku} · {currency(item.pricePaise)} each · {props.stock[item.id]||0} available</small></div>
        <div className="pos-cart-controls"><div className="pos-quantity" aria-label={`Quantity for ${item.name}`}><button type="button" aria-label={`Remove one ${item.name}`} onClick={()=>props.onQty(item.id,line.quantity-1)}><Minus size={13}/></button><span>{line.quantity}</span><button type="button" aria-label={`Add one ${item.name}`} disabled={line.quantity>=props.stock[item.id]} onClick={()=>props.onQty(item.id,line.quantity+1)}><Plus size={13}/></button></div>
          <label className="pos-discount">Item discount %<Input aria-label={`Item discount for ${item.name}`} type="number" min="0" max="30" step="0.5" value={line.itemDiscountPct} onChange={event=>props.onItemDiscount(item.id,Number(event.target.value))}/></label>
          <label className="crm-field pos-fulfilment-mode">Fulfilment<select aria-label={`Fulfilment for ${item.name}`} value={line.fulfilmentMode} onChange={event=>props.onFulfilment(item.id,event.target.value==='Delivery'?'Delivery':'Counter pickup')}><option>Delivery</option><option>Counter pickup</option></select></label>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.name} from cart`} onClick={()=>props.onRemove(item.id)}><Trash2 size={15}/></Button>
        </div>
        {item.serialRequired&&<SerialAssignment product={item} line={line} serials={props.serials} allLines={props.cart} onSelect={(index,serial)=>props.onSerial(item.id,index,serial)}/>}
      </article>})}
    </div>}
    <div className="pos-cart-discount"><label className="crm-field">Cart discount %<Input aria-label="Cart discount percentage" type="number" min="0" max="30" step="0.5" value={props.cartDiscountPct} onChange={event=>props.onCartDiscount(Number(event.target.value))}/></label><label className="crm-field">Discount approval code<Input aria-label="Discount approval code" value={props.discountCode} placeholder="Required above 10%" onChange={event=>props.onDiscountCode(event.target.value)}/></label></div>
    {props.calculation&&<dl className="pos-totals">
      <div><dt>Gross product value</dt><dd>{currency(props.calculation.grossPaise)}</dd></div>
      <div><dt>Item discount</dt><dd>−{currency(props.calculation.itemDiscountPaise)}</dd></div>
      <div><dt>Cart discount</dt><dd>−{currency(props.calculation.cartDiscountPaise)}</dd></div>
      <div><dt>Taxable amount</dt><dd>{currency(props.calculation.taxablePaise)}</dd></div>
      {props.calculation.igstPaise?<div><dt>IGST</dt><dd>{currency(props.calculation.igstPaise)}</dd></div>:<><div><dt>CGST</dt><dd>{currency(props.calculation.cgstPaise)}</dd></div><div><dt>SGST</dt><dd>{currency(props.calculation.sgstPaise)}</dd></div></>}
      <div><dt>Round-off</dt><dd>{props.calculation.roundOffPaise<0?'−':''}{currency(Math.abs(props.calculation.roundOffPaise))}</dd></div>
      <div className="pos-grand-total"><dt>Invoice total</dt><dd>{currency(props.calculation.totalPaise)}</dd></div>
    </dl>}
    <p className="gst-disclaimer">Illustrative GST calculation only. Rates, place of supply and invoice treatment require professional validation before production use.</p>
  </Panel>
}
