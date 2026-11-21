import type {FulfilmentMode} from '@/lib/phase6-types'
export type CartLine = {productId:string;quantity:number;itemDiscountPct:number;serials:string[];fulfilmentMode:FulfilmentMode}
export type SplitPayment = {id:string;mode:string;amount:string;reference:string;financier:string}
