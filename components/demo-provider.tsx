'use client'
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {initialStores,initialBrands,initialUsers,initialAlerts,initialSettings} from '@/lib/demo-data'
import {initialPhase3State,type Product} from '@/lib/phase3-data'
import {initialPhase4State,warehouseLocationId} from '@/lib/phase4-data'
const seed={stores:initialStores,brands:initialBrands,users:initialUsers,alerts:initialAlerts,settings:initialSettings,...initialPhase3State,...initialPhase4State};type State=typeof seed
const C=createContext<{data:State;update:<K extends keyof State>(k:K,v:State[K])=>void;transact:(prepare:(current:State)=>State)=>void}|null>(null)
function restore(saved:string):State{
  const parsed=JSON.parse(saved) as Partial<State>,merged={...seed,...parsed}
  const productSeeds=new Map(seed.products.map(item=>[item.id,item]))
  const products=merged.products.map(item=>{
    const defaults=productSeeds.get(item.id)
    const serialRequired=item.serialRequired??defaults?.serialRequired??(item.productType==='Serialized')
    const productType:Product['productType']=serialRequired?'Serialized':'Quantity-based'
    return {...defaults,...item,
      productType,
      serialRequired,
      purchasePricePaise:item.purchasePricePaise??defaults?.purchasePricePaise??Math.round(item.pricePaise*.78),
      status:item.status||defaults?.status||'Active'
    }
  })
  const inventory=[...merged.inventory]
  for(const product of products)for(const location of [...merged.stores.map(item=>item.id),warehouseLocationId]){
    if(!inventory.some(row=>row.productId===product.id&&row.storeId===location))inventory.push({productId:product.id,storeId:location,quantity:0})
  }
  const serialSeeds=new Map(seed.serials.map(item=>[item.serial,item]))
  const serials=merged.serials.map(item=>({...serialSeeds.get(item.serial),...item}))
  const grns=merged.grns.map(grn=>({...grn,items:grn.items.map(line=>{
    const serialRecords=grn.status==='Received'&&products.find(item=>item.id===line.productId)?.serialRequired
      ?serials.filter(record=>record.grnReference===grn.id&&record.productId===line.productId)
      :[]
    return {
      ...line,
      serials:[...new Set([...(line.serials||[]),...serialRecords.filter(record=>record.status!=='Unavailable').map(record=>record.serial)])],
      damagedSerials:[...new Set([...(line.damagedSerials||[]),...serialRecords.filter(record=>record.status==='Unavailable').map(record=>record.serial)])]
    }
  })}))
  const openingReferences=new Set(seed.grns.map(grn=>grn.id))
  const movements=[
    ...merged.movements.filter(movement=>!(openingReferences.has(movement.reference)&&!movement.serial&&products.find(item=>item.id===movement.productId)?.serialRequired)),
    ...seed.movements.filter(movement=>openingReferences.has(movement.reference)&&movement.serial&&!merged.movements.some(existing=>existing.id===movement.id))
  ]
  return {...merged,products,inventory,serials,grns,movements}
}
export function DemoProvider({children}:{children:ReactNode}){
  const [data,setData]=useState(seed),[ready,setReady]=useState(false),state=useRef<State>(seed)
  useEffect(()=>{
    try{
      const saved=sessionStorage.getItem('retailos-phase2-v1')
      if(saved){state.current=restore(saved);setData(state.current)}
    }catch(error){console.error('Unable to restore the demo session.',error)}
    setReady(true)
  },[])
  useEffect(()=>{
    if(!ready)return
    try{sessionStorage.setItem('retailos-phase2-v1',JSON.stringify(data))}
    catch(error){console.error('Unable to persist the demo session.',error)}
  },[data,ready])
  function commit(next:State){
    try{sessionStorage.setItem('retailos-phase2-v1',JSON.stringify(next))}
    catch(error){throw new Error('Could not save this demo session in browser storage.',{cause:error})}
    state.current=next
    setData(next)
  }
  function update<K extends keyof State>(key:K,value:State[K]){commit({...state.current,[key]:value})}
  function transact(prepare:(current:State)=>State){commit(prepare(state.current))}
  return <C.Provider value={{data,update,transact}}>{children}</C.Provider>
}
export function useDemo(){const c=useContext(C);if(!c)throw new Error('Demo provider required');return c}
