'use client'
import type {SerialRecord,Product} from '@/lib/phase3-data'
import type {CartLine} from './pos-types'
import {SearchableSelector,ScanField} from '../foundation'
import {useState} from 'react'

type Props={product:Product;line:CartLine;serials:SerialRecord[];allLines:CartLine[];onSelect:(index:number,serial:string)=>void}
export default function SerialAssignment({product,line,serials,allLines,onSelect}:Props){
  const [scan,setScan]=useState('')
  const [scanError,setScanError]=useState('')
  const claimed=new Set(allLines.flatMap(item=>item.productId===line.productId?item.serials:[]))
  const available=serials.filter(record=>record.productId===product.id&&record.status==='Available')
  function applyScan(){
    const serial=scan.trim()
    const record=available.find(item=>item.serial===serial&&!claimed.has(item.serial))
    if(!record){setScanError('Serial is not available for sale at this store or is already assigned.');return}
    const emptyIndex=Array.from({length:line.quantity},(_,index)=>index).find(index=>!line.serials[index])
    if(emptyIndex!==undefined)onSelect(emptyIndex,serial)
    setScan('')
    setScanError('')
  }
  return <div className="serial-assignment">
    <strong>Serial number required for each unit</strong>
    <ScanField label="Scan serial number" value={scan} onChange={setScan} placeholder="Scan or enter an available serial" onScan={applyScan}/>
    {scanError&&<p role="alert" className="crm-error">{scanError}</p>}
    {Array.from({length:line.quantity},(_,index)=>{
      const current=line.serials[index]||''
      const options=available.filter(record=>record.serial===current||!claimed.has(record.serial))
      return <div className="serial-unit" key={`${product.id}-${index}`}><SearchableSelector label={`Unit ${index+1}`} required value={current} placeholder={`Search ${product.name} serial`} onChange={value=>onSelect(index,value)} options={options.map(record=>({value:record.serial,label:record.serial,meta:`${record.status} · ${record.storeId}`}))}/></div>
    })}
    {line.serials.filter(Boolean).length!==new Set(line.serials.filter(Boolean)).size&&<p role="alert">Each unit must use a different serial number.</p>}
    {available.length<line.quantity&&<p role="alert">Only {available.length} unassigned serial numbers remain at this store.</p>}
  </div>
}
