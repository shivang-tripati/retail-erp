'use client'
import {useState,type FormEvent} from 'react'
import {toast} from 'sonner'
import {useDemo} from './demo-provider'
import type {Customer} from '@/lib/phase3-data'
import {Input} from './ui/input'
import {Button} from './ui/button'
import {DialogFooter} from './ui/dialog'
import {citiesForState,indianStates} from '@/lib/india-locations'

type Props = {customer?:Customer;initial?:Partial<Customer>;onSave:(customer:Customer)=>void;onCancel:()=>void}
export default function CustomerForm({customer,initial,onSave,onCancel}:Props){
  const {data}=useDemo()
  const [form,setForm]=useState<Customer>({
    id:customer?.id||`CUS-${crypto.randomUUID().replaceAll('-','').toUpperCase()}`,name:customer?.name||initial?.name||'',
    mobile:customer?.mobile||initial?.mobile||'',alternateMobile:customer?.alternateMobile||'',
    email:customer?.email||'',address:customer?.address||'',city:customer?.city||initial?.city||'',
    state:customer?.state||initial?.state||'',pinCode:customer?.pinCode||'',type:customer?.type||'Individual',
    notes:customer?.notes||'',status:customer?.status||'Active',since:customer?.since||new Date().toISOString()
  })
  const [error,setError]=useState('')
  const availableCities=citiesForState(form.state)
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    const mobile=/^[6-9]\d{9}$/
    if(!mobile.test(form.mobile)){setError('Enter a valid 10-digit Indian mobile number.');return}
    if(form.alternateMobile&&!mobile.test(form.alternateMobile)){setError('Enter a valid alternate mobile number or leave it blank.');return}
    if(!/^[1-9]\d{5}$/.test(form.pinCode)){setError('Enter a valid 6-digit PIN code.');return}
    if(form.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)){setError('Enter a valid email address or leave it blank.');return}
    if(data.customers.some(existing=>existing.id!==customer?.id&&existing.mobile===form.mobile)){setError('A customer with this mobile number is already registered.');return}
    const clean={...form,name:form.name.trim(),mobile:form.mobile.trim(),alternateMobile:form.alternateMobile.trim(),email:form.email.trim(),address:form.address.trim(),city:form.city.trim(),state:form.state.trim(),pinCode:form.pinCode.trim(),notes:form.notes.trim()}
    if(!clean.name||!clean.address||!clean.city||!clean.state){setError('Complete all required customer details.');return}
    try{onSave(clean)}
    catch(e){setError(e instanceof Error?e.message:'Could not save this customer.');toast.error('Customer could not be saved.')}
  }
  const field=(key:keyof Customer,label:string,type='text',required=true,pattern?:string)=><label key={key} className="crm-field">{label}{required&&<span aria-hidden="true"> *</span>}<Input aria-label={label} required={required} type={type} pattern={pattern} value={String(form[key]??'')} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}/></label>
  return <form className="crm-form" onSubmit={submit} noValidate>
    <div className="crm-form-grid">
      {field('name','Full name')}
      {field('mobile','Mobile number','tel',true,'[6-9][0-9]{9}')}
      {field('alternateMobile','Alternate mobile','tel',false,'[6-9][0-9]{9}')}
      {field('email','Email address','email',false)}
      {field('address','Address')}
      <label className="crm-field">State<span aria-hidden="true"> *</span><select aria-label="State" required value={form.state} onChange={event=>{const state=event.target.value;setForm(current=>({...current,state,city:citiesForState(state).includes(current.city)?current.city:''}))}}><option value="">Select state</option>{indianStates.map(state=><option key={state} value={state}>{state}</option>)}</select></label>
      <label className="crm-field">City<span aria-hidden="true"> *</span><select aria-label="City" required value={form.city} disabled={!form.state} onChange={event=>setForm(current=>({...current,city:event.target.value}))}><option value="">{form.state?'Select city':'Select a state first'}</option>{availableCities.map(city=><option key={city} value={city}>{city}</option>)}{form.city&&!availableCities.includes(form.city)&&<option value={form.city}>{form.city}</option>}</select></label>
      {field('pinCode','PIN code','text',true,'[1-9][0-9]{5}')}
      <label className="crm-field">Customer type<span aria-hidden="true"> *</span><select aria-label="Customer type" required value={form.type} onChange={event=>setForm(current=>({...current,type:event.target.value}))}><option>Individual</option><option>Business</option></select></label>
      <label className="crm-field crm-field-wide">Notes<textarea aria-label="Notes" rows={3} value={form.notes} onChange={event=>setForm(current=>({...current,notes:event.target.value}))}/></label>
    </div>
    {error&&<p className="crm-error" role="alert">{error}</p>}
    <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">{customer?'Save customer':'Register customer'}</Button></DialogFooter>
  </form>
}
