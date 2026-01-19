'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppLoader from '@/components/AppLoader'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/auth/login')
      }
    }
    checkSession()
  }, [router])

  return <AppLoader message="กำลังตรวจสอบการเข้าสู่ระบบ..." />
}
