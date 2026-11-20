import type {Metadata,Viewport} from 'next'
import '@fontsource-variable/inter'
import './globals.css'
import './workspace.css'
import './phase2.css'
import './phase3.css'
import './phase4.css'
import {DemoProvider} from '@/components/demo-provider'
import Workspace from '@/components/workspace'
export const metadata:Metadata={title:'RetailOS | Sharma Electronics',description:'Explore the Sharma Electronics multi-store retail workspace. Interactive demonstration with fictional data.'}
export const viewport:Viewport={colorScheme:'light',themeColor:'#132e50'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-IN" className="light"><body className="antialiased"><DemoProvider><Workspace>{children}</Workspace></DemoProvider></body></html>}
