'use client'
import {Plus,Trash2} from 'lucide-react'
import {Panel} from '../analytics-controls'
import {Selector} from '../foundation'
import {Button} from '../ui/button'
import {Input} from '../ui/input'
import {currency} from '@/lib/phase3-data'
import type {SplitPayment} from './pos-types'

export const paymentModes=['Cash','UPI','Debit/Credit Card','Bank Transfer','Financing / EMI']
type Props={
  totalPaise:number;mode:string;amount:string;reference:string;financier:string;split:SplitPayment[]
  onMode:(value:string)=>void;onAmount:(value:string)=>void;onReference:(value:string)=>void;onFinancier:(value:string)=>void
  onSplit:(id:string,key:keyof SplitPayment,value:string)=>void;onAddSplit:()=>void;onRemoveSplit:(id:string)=>void
}
function paise(input:string){const parts=input.trim().split('.');if(!input.trim())return 0;if(parts.length>2||!/^\d+$/.test(parts[0])||parts[1]&&!/^\d{1,2}$/.test(parts[1]))return NaN;return Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'))}
export function collectPaymentAmount(mode:string,amount:string,split:SplitPayment[]){
  return mode==='Split Payment'?split.reduce((sum,item)=>sum+paise(item.amount),0):paise(amount)
}
export default function PaymentCollection(props:Props){
  const splitMode=props.mode==='Split Payment'
  const amount=collectPaymentAmount(props.mode,props.amount,props.split)
  const validAmount=Number.isFinite(amount)&&amount>=0&&amount<=props.totalPaise
  const paid=validAmount?amount:0
  return <Panel title="Collect payment" meta="No payment gateway is connected. Entries are fictional demo records.">
    <div className="pos-payment-mode"><Selector label="Payment mode" value={props.mode} options={[...paymentModes,'Split Payment']} onChange={props.onMode}/></div>
    {!splitMode?<div className="pos-payment-fields">
      <label className="crm-field">Amount received (₹)<Input aria-label="Amount received in rupees" inputMode="decimal" placeholder={(props.totalPaise/100).toFixed(2)} value={props.amount} onChange={event=>props.onAmount(event.target.value)}/></label>
      <label className="crm-field">Payment reference<Input aria-label="Payment reference" value={props.reference} onChange={event=>props.onReference(event.target.value)} placeholder="Receipt, UPI or bank reference"/></label>
      {props.mode==='Financing / EMI'&&<label className="crm-field">Financier name<Input aria-label="Financier name" required value={props.financier} onChange={event=>props.onFinancier(event.target.value)} placeholder="Demo finance partner"/></label>}
    </div>:<div className="pos-split-list">
      {props.split.map((item,index)=><div className="pos-split-row" key={item.id}>
        <Selector label={`Payment method ${index+1}`} value={item.mode} options={paymentModes} onChange={value=>props.onSplit(item.id,'mode',value)}/>
        <label className="crm-field">Amount (₹)<Input aria-label={`Split payment ${index+1} amount in rupees`} inputMode="decimal" value={item.amount} onChange={event=>props.onSplit(item.id,'amount',event.target.value)}/></label>
        <label className="crm-field">Reference<Input aria-label={`Split payment ${index+1} reference`} value={item.reference} onChange={event=>props.onSplit(item.id,'reference',event.target.value)}/></label>
        {item.mode==='Financing / EMI'&&<label className="crm-field">Financier<Input aria-label={`Split payment ${index+1} financier`} value={item.financier} onChange={event=>props.onSplit(item.id,'financier',event.target.value)}/></label>}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove split payment ${index+1}`} disabled={props.split.length===1} onClick={()=>props.onRemoveSplit(item.id)}><Trash2 size={15}/></Button>
      </div>)}
      <Button type="button" variant="outline" onClick={props.onAddSplit}><Plus size={14}/>Add payment line</Button>
    </div>}
    <div className="pos-payment-balance"><div><span>Invoice total</span><strong>{currency(props.totalPaise)}</strong></div><div><span>Amount received</span><strong>{currency(paid)}</strong></div><div className="balance-due"><span>Balance due</span><strong>{currency(Math.max(0,props.totalPaise-paid))}</strong></div></div>
    {(!validAmount||splitMode&&props.split.some(item=>!Number.isFinite(paise(item.amount))))&&<p role="alert" className="crm-error">Enter valid payment amounts that do not exceed the invoice total.</p>}
    {props.mode==='Financing / EMI'&&<p className="crm-note">Financier and reference details are mock information only.</p>}
  </Panel>
}
