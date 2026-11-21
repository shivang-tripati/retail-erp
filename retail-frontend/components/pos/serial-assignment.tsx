'use client'
import type {SerialRecord,Product} from '@/lib/phase3-data'
import type {CartLine} from './pos-types'

type Props={product:Product;line:CartLine;serials:SerialRecord[];allLines:CartLine[];onSelect:(index:number,serial:string)=>void}
export default function SerialAssignment({product,line,serials,allLines,onSelect}:Props){
  const claimed=new Set(allLines.flatMap(item=>item.productId===line.productId?item.serials:[]))
  const available=serials.filter(record=>record.productId===product.id&&record.status==='Available')
  return <div className="serial-assignment">
    <strong>Serial number required for each unit</strong>
    {Array.from({length:line.quantity},(_,index)=>{
      const current=line.serials[index]||''
      const options=available.filter(record=>record.serial===current||!claimed.has(record.serial))
      return <label key={`${product.id}-${index}`}>Unit {index+1}
        <select aria-label={`${product.name} serial for unit ${index+1}`} required value={current} onChange={event=>onSelect(index,event.target.value)}>
          <option value="">Select an available serial</option>
          {options.map(record=><option key={record.serial} value={record.serial}>{record.serial}</option>)}
        </select>
      </label>
    })}
    {line.serials.filter(Boolean).length!==new Set(line.serials.filter(Boolean)).size&&<p role="alert">Each unit must use a different serial number.</p>}
    {available.length<line.quantity&&<p role="alert">Only {available.length} unassigned serial numbers remain at this store.</p>}
  </div>
}
