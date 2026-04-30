'use client'
import { useEffect } from 'react'

export default function FridgePage() {
  useEffect(() => {
    window.location.replace('/index.html')
  }, [])
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif',color:'#9ca3af'}}>Loading...</div>
}
