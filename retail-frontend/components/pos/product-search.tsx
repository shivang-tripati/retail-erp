'use client'
import {useMemo,useState} from 'react'
import {Plus,Search,PackageCheck} from 'lucide-react'
import {Panel} from '../analytics-controls'
import {Selector} from '../foundation'
import {categories,money} from '@/lib/demo-data'
import {productBrandName,type Product} from '@/lib/phase3-data'
import type {Row} from '@/lib/demo-data'

type Props={products:Product[];brands:Row[];stock:Record<string,number>;onAdd:(product:Product)=>void}
export default function ProductSearch({products,brands,stock,onAdd}:Props){
  const [query,setQuery]=useState(''),[category,setCategory]=useState('All categories')
  const filtered=useMemo(()=>products.filter(product=>
    product.status==='Active'&&
    (!query||`${product.name} ${product.sku} ${product.model} ${productBrandName(product,brands)}`.toLowerCase().includes(query.trim().toLowerCase()))&&
    (category==='All categories'||product.category===category)&&stock[product.id]>0
  ),[products,brands,query,category,stock])
  return <Panel title="Product catalogue" meta={`${filtered.length} available at this store`}>
    <div className="pos-search-tools"><label className="searchbar"><Search size={16}/><input aria-label="Search products by name, SKU or model" placeholder="Search name, SKU or model" value={query} onChange={event=>setQuery(event.target.value)}/></label><Selector label="Product category" value={category} options={['All categories',...categories]} onChange={setCategory}/></div>
    <div className="pos-product-list">{filtered.map(product=><article className="pos-product" key={product.id}>
      <div className="pos-product-mark"><PackageCheck size={18}/></div>
      <div className="pos-product-info"><strong>{product.name}</strong><span>{productBrandName(product,brands)} · {product.category}</span><small>SKU {product.sku} · Model {product.model}</small></div>
      <div className="pos-product-price"><strong>{money(product.pricePaise/100)}</strong><small>{stock[product.id]} in stock</small></div>
      <button type="button" className="pos-add" aria-label={`Add ${product.name} to cart`} onClick={()=>onAdd(product)}><Plus size={16}/></button>
    </article>)}
      {!filtered.length&&<p className="pos-no-products">No matching products are in stock at this store.</p>}
    </div>
  </Panel>
}
