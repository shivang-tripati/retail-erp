'use client'
import { useMemo, useState, type ReactNode } from 'react'
import { Search, ChevronDown, Store, CalendarDays, Inbox, type LucideIcon } from 'lucide-react'
import { stores } from '@/lib/retail'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet'
export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) { return <header className="pagehead"><small className="kicker">{eyebrow}</small><h1>{title}</h1><p>{description}</p>{children}</header> }
export function IconTile({ icon: Icon, color }: { icon: LucideIcon; color: string }) { return <span className={'tile ' + color}><Icon size={21} strokeWidth={1.7} /></span> }
export function KpiCard({ icon, color, label, value, note, onClick }: { icon: LucideIcon; color: string; label: string; value: string; note: string; onClick: () => void }) { return <button className="metric" onClick={onClick}><div className="metric-label"><IconTile icon={icon} color={color} /><span>{label}</span></div><strong>{value}</strong><small>{note}</small></button> }
export function SearchBar({ value, onChange, label }: { value: string; onChange: (s: string) => void; label: string }) { return <div className="searchbar"><Search size={16} /><Input aria-label={label} placeholder={label} value={value} onChange={e => onChange(e.target.value)} /></div> }
export function Selector({ label, value, options, onChange, icon: Icon }: { label: string; value: string; options: string[]; onChange: (s: string) => void; icon?: LucideIcon }) { return <label className="selector">{Icon && <Icon size={16} />}<select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select><ChevronDown size={13} /></label> }
export type SearchOption = { value: string; label: string; meta?: string; keywords?: string }
export function SearchableSelector({ label, value, options, onChange, placeholder = 'Search and select', required = false }: { label: string; value: string; options: SearchOption[]; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if (!clean) return options.slice(0, 20)
    return options.filter(option => `${option.label} ${option.meta || ''} ${option.keywords || ''}`.toLowerCase().includes(clean)).slice(0, 20)
  }, [options, query])
  return <div className="smart-selector"><label>{label}{required && <span aria-hidden="true"> *</span>}<div className="smart-selector-control"><Search size={15} /><input aria-label={label} required={required} value={open ? query : selected?.label || ''} placeholder={placeholder} onFocus={() => { setOpen(true); setQuery('') }} onChange={event => { setOpen(true); setQuery(event.target.value) }} onBlur={() => window.setTimeout(() => setOpen(false), 120)} />{selected && <button type="button" aria-label={`Clear ${label}`} onClick={() => { onChange(''); setQuery(''); setOpen(true) }}>Clear</button>}</div></label>{open && <div className="smart-selector-menu" role="listbox">{filtered.length ? filtered.map(option => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onMouseDown={event => event.preventDefault()} onClick={() => { onChange(option.value); setQuery(''); setOpen(false) }}><b>{option.label}</b>{option.meta && <small>{option.meta}</small>}</button>) : <p>No matching records</p>}</div>}<input type="hidden" value={value} /></div>
}
export function ScanField({ label, value, onChange, placeholder = 'Scan or type a code', onScan, disabled = false, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; onScan?: () => void; disabled?: boolean; required?: boolean }) {
  return <label className="smart-scan">{label}{required && <span aria-hidden="true"> *</span>}<div><input aria-label={label} value={value} disabled={disabled} required={required} placeholder={placeholder} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onScan?.() } }} />{onScan && <Button type="button" variant="outline" disabled={disabled || !value.trim()} onClick={onScan}>Add</Button>}</div></label>
}
export function StoreSelector({ value, onChange }: { value: string; onChange: (s: string) => void }) { return <Selector label="Store context" value={value} onChange={onChange} options={['All stores', ...stores]} icon={Store} /> }
export function DateRangeSelector({ value, onChange }: { value: string; onChange: (s: string) => void }) { return <Selector label="Date range" value={value} onChange={onChange} options={['Last 7 days', 'Last 30 days', 'All dates']} icon={CalendarDays} /> }
export function StatusBadge({ children }: { children: ReactNode }) { return <Badge variant="secondary">{children}</Badge> }
export function EmptyState({ text }: { text: string }) { return <div className="empty"><Inbox size={25} /><p>{text}</p></div> }
export function DataTable({ columns, rows }: { columns: ReactNode[]; rows: ReactNode[][] }) { return <Table><TableHeader><TableRow>{columns.map((c, i) => <TableHead key={typeof c === 'string' ? c : i}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((v, j) => <TableCell key={j}>{v}</TableCell>)}</TableRow>)}</TableBody></Table> }
export function DetailDrawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) { return <Sheet open={open} onOpenChange={v => !v && onClose()}><SheetContent><SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>Prince Tiwari</SheetDescription></SheetHeader><div className="drawerbody">{children}</div></SheetContent></Sheet> }
export function Confirmation({ open, title, text, onClose, onConfirm }: { open: boolean; title: string; text: string; onClose: () => void; onConfirm: () => void }) { return <Dialog open={open} onOpenChange={v => !v && onClose()}><DialogContent><DialogTitle>{title}</DialogTitle><DialogDescription>{text}</DialogDescription><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onConfirm}>Confirm</Button></DialogFooter></DialogContent></Dialog> }
