'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Transaction } from '@/lib/supabase'
import { syncService } from '@/lib/sync-service'
import { offlineDB } from '@/lib/offline-db'
import BottomNavigation from '@/components/BottomNavigation'
import CategoryIcon from '@/components/CategoryIcon'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })

  // หมวดหมู่สำหรับ dropdown
  const incomeCategories = [
    'เงินเดือน',
    'โบนัส',
    'รายได้เสริม',
    'เงินปันผล',
    'ดอกเบี้ย',
    'รายได้อื่นๆ'
  ]

  const expenseCategories = [
    'อาหาร',
    'ค่าเดินทาง',
    'ที่พัก/ค่าเช่า',
    'สาธารณูปโภค',
    'สุขภาพ',
    'บันเทิง',
    'การศึกษา',
    'ช้อปปิ้ง',
    'โทรศัพท์/อินเทอร์เน็ต',
    'ผ่อนชำระหนี้',
    'ลงทุน',
    'ออมเงิน',
    'อื่นๆ'
  ]

  const loadTransactions = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }

    try {
      // Try to load from online first
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error && navigator.onLine) {
        throw error
      }

      // Get offline transactions (only unsynced ones)
      const offlineTransactions = await offlineDB.getTransactions(session.user.id)
      const unsyncedOffline = offlineTransactions.filter(t => !t.synced)
      
      // Get online transaction IDs to avoid duplicates
      const onlineIds = new Set((data || []).map(t => t.id))
      
      // Merge online and offline transactions, avoiding duplicates
      // CRITICAL: Only show offline transactions that haven't been synced
      // CRITICAL: Use DB id for display, never local_id
      const offlineToShow = unsyncedOffline
        .filter(t => {
          // If it has a DB id, check if it's already in online data
          if (t.id) {
            return !onlineIds.has(t.id)
          }
          // If no DB id, it's a new transaction that hasn't been synced
          return true
        })
        .map(t => ({
          // CRITICAL: Use DB id if available, otherwise use local_id for display
          // But mark it so we know it's not synced yet
          id: t.id || `local_${t.local_id}`, // Prefix local_id so we can identify it
          user_id: t.user_id || session.user.id,
          type: t.type,
          amount: t.amount,
          category: t.category,
          description: t.description,
          date: t.date,
          created_at: t.created_at,
          updated_at: t.updated_at,
          _isLocal: !t.id, // Flag to indicate this is local-only
          _localId: t.local_id, // Store local_id for reference
        }))
      
      const allTransactions = [
        ...(data || []),
        ...offlineToShow
      ]

      // Sort by date
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })

      setTransactions(allTransactions as Transaction[])

      // Cache online data
      if (data && navigator.onLine) {
        await offlineDB.cacheData(`transactions_${session.user.id}`, data)
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
      
      // If offline, try to load from cache
      if (!navigator.onLine) {
        try {
          const cached = await offlineDB.getCachedData(`transactions_${session.user.id}`)
          if (cached) {
            setTransactions(cached)
          } else {
            // Load from offline DB
            const offlineTransactions = await offlineDB.getTransactions(session.user.id)
            setTransactions(offlineTransactions.map(t => ({
              id: t.id || t.local_id || `temp_${Date.now()}`,
              user_id: t.user_id || session.user.id,
              type: t.type,
              amount: t.amount,
              category: t.category,
              description: t.description,
              date: t.date,
              created_at: t.created_at,
              updated_at: t.updated_at,
            })) as Transaction[])
          }
        } catch (offlineError) {
          console.error('Error loading offline transactions:', offlineError)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const initSync = async () => {
      await loadTransactions()
      
      // Try to sync when page loads if online
      if (navigator.onLine) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            console.log('[Transactions] Attempting to sync on page load...')
            await syncService.syncAll()
            // Reload transactions after sync
            await loadTransactions()
          }
        } catch (err) {
          console.error('[Transactions] Sync error on page load:', err)
        }
      }
    }
    
    initSync()
  }, [loadTransactions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('Form submitted:', formData)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('กรุณาเข้าสู่ระบบก่อน')
      return
    }

    // Validation
    if (!formData.category || formData.category === '') {
      alert('กรุณาเลือกหมวดหมู่')
      return
    }

    const amount = Number(formData.amount)
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      alert('กรุณากรอกจำนวนเงินที่มากกว่า 0')
      return
    }

    if (!formData.date) {
      alert('กรุณาเลือกวันที่')
      return
    }

    try {
      const isOnline = navigator.onLine

      if (editingTransaction) {
        // อัปเดต
        console.log('Updating transaction:', editingTransaction.id)
        
        if (isOnline) {
          const { error } = await supabase
            .from('transactions')
            .update({
              type: formData.type,
              amount: amount,
              category: formData.category || null,
              description: formData.description || null,
              date: formData.date,
            })
            .eq('id', editingTransaction.id)

          if (error) {
            console.error('Update error:', error)
            throw error
          }
          console.log('Transaction updated successfully')
        } else {
          // Save offline
          await syncService.saveTransactionOffline({
            id: editingTransaction.id,
            user_id: session.user.id,
            type: formData.type,
            amount: amount,
            category: formData.category,
            description: formData.description,
            date: formData.date,
          })
          alert('บันทึกข้อมูลออฟไลน์แล้ว จะ sync อัตโนมัติเมื่อกลับมาออนไลน์')
        }
      } else {
        // สร้างใหม่
        console.log('Creating new transaction')
        
        if (isOnline) {
          const { error } = await supabase
            .from('transactions')
            .insert({
              user_id: session.user.id,
              type: formData.type,
              amount: amount,
              category: formData.category || null,
              description: formData.description || null,
              date: formData.date,
            })

          if (error) {
            console.error('Insert error:', error)
            throw error
          }
          console.log('Transaction created successfully')
        } else {
          // Save offline
          await syncService.saveTransactionOffline({
            user_id: session.user.id,
            type: formData.type,
            amount: amount,
            category: formData.category,
            description: formData.description,
            date: formData.date,
          })
          alert('บันทึกข้อมูลออฟไลน์แล้ว จะ sync อัตโนมัติเมื่อกลับมาออนไลน์')
        }
      }

      // Reset form and close modal
      setEditingTransaction(null)
      setShowModal(false)
      setFormData({
        type: 'expense',
        amount: '',
        category: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
      })
      
      // Reload transactions
      await loadTransactions()
    } catch (error: any) {
      console.error('Error saving transaction:', error)
      
      // If online error, try to save offline
      if (navigator.onLine) {
        try {
          await syncService.saveTransactionOffline({
            user_id: session.user.id,
            type: formData.type,
            amount: amount,
            category: formData.category,
            description: formData.description,
            date: formData.date,
          })
          alert('บันทึกข้อมูลออฟไลน์แล้ว จะ sync อัตโนมัติเมื่อกลับมาออนไลน์')
          
          // Reset form and close modal
          setEditingTransaction(null)
          setShowModal(false)
          setFormData({
            type: 'expense',
            amount: '',
            category: '',
            description: '',
            date: format(new Date(), 'yyyy-MM-dd'),
          })
          
          await loadTransactions()
        } catch (offlineError) {
          alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถบันทึกข้อมูลได้'))
        }
      } else {
        alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถบันทึกข้อมูลได้'))
      }
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category || '',
      description: (transaction as any).description || '',
      date: transaction.date,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('กรุณาเข้าสู่ระบบก่อน')
        return
      }

      // CRITICAL: Check if this is a local-only transaction (not synced yet)
      // If it starts with "local_", it's a local_id and we should delete from IndexedDB only
      if (id.startsWith('local_')) {
        const localId = id.replace('local_', '')
        console.log(`[Transactions] Deleting local-only transaction: ${localId}`)
        
        // Delete from IndexedDB using local_id
        await offlineDB.deleteTransactionByLocalId(localId)
        console.log(`[Transactions] ✅ Deleted local transaction ${localId} from IndexedDB`)
        
        await loadTransactions()
        return
      }

      // This is a real DB transaction - delete from Supabase
      // CRITICAL: Only use real UUIDs, never local_id
      console.log(`[Transactions] Deleting transaction from Supabase: ${id}`)
      
      if (navigator.onLine) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id) // id should be a UUID, not local_id

        if (error) {
          console.error(`[Transactions] Delete error:`, error)
          throw error
        }
        
        console.log(`[Transactions] ✅ Deleted transaction ${id} from Supabase`)
      } else {
        // If offline, mark for deletion in IndexedDB
        // Find the transaction and mark it for deletion
        const offlineTransactions = await offlineDB.getTransactions(session.user.id)
        const txToDelete = offlineTransactions.find(t => t.id === id)
        
        if (txToDelete) {
          // Mark as deleted (or actually delete if it's local-only)
          if (txToDelete.local_id) {
            await offlineDB.deleteTransactionByLocalId(txToDelete.local_id)
          }
          console.log(`[Transactions] ✅ Marked transaction ${id} for deletion (offline)`)
        }
      }
      
      await loadTransactions()
    } catch (error: any) {
      console.error(`[Transactions] Delete failed:`, error)
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถลบรายการได้'))
    }
  }

  const handleCancel = () => {
    setEditingTransaction(null)
    setShowModal(false)
    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
    })
  }

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth)
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1)
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1)
    }
    setSelectedMonth(newMonth)
  }

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      alert('คุณกำลังออฟไลน์ กรุณาเชื่อมต่ออินเทอร์เน็ตก่อน')
      return
    }

    setSyncing(true)
    try {
      console.log('[Transactions] Manual sync started...')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('กรุณาเข้าสู่ระบบก่อน')
        return
      }

      // Check unsynced transactions
      const unsynced = await offlineDB.getUnsyncedTransactions()
      const userUnsynced = unsynced.filter((t) => t.user_id === session.user.id)
      console.log(`[Transactions] Found ${userUnsynced.length} unsynced transactions`)

      if (userUnsynced.length === 0) {
        alert('ไม่มีข้อมูลที่ต้อง sync')
        setSyncing(false)
        return
      }

      await syncService.syncAll()
      await loadTransactions()
      alert(`ซิงค์ข้อมูลสำเร็จ ${userUnsynced.length} รายการ`)
    } catch (error: any) {
      console.error('[Transactions] Manual sync error:', error)
      alert('เกิดข้อผิดพลาดในการ sync: ' + (error.message || 'ไม่ทราบสาเหตุ'))
    } finally {
      setSyncing(false)
    }
  }

  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  const currentMonthName = monthNames[selectedMonth.getMonth()]
  const currentYear = selectedMonth.getFullYear() + 543

  // Filter transactions by selected month
  const filteredTransactions = transactions.filter(t => {
    const tDate = new Date(t.date)
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)
    return tDate >= monthStart && tDate <= monthEnd
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold">รายรับรายจ่าย</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/auth/login')
              router.refresh()
            }}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="ออกจากระบบ"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Month Selector */}
        <div className="bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
          <button onClick={() => changeMonth('prev')} className="p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-medium">{currentMonthName} {currentYear}</span>
          <button onClick={() => changeMonth('next')} className="p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Add Item Button and Sync Button */}
        <div className="space-y-2 mb-4">
          <button
            onClick={() => {
              setEditingTransaction(null)
              setFormData({
                type: 'expense',
                amount: '',
                category: '',
                description: '',
                date: format(new Date(), 'yyyy-MM-dd'),
              })
              setShowModal(true)
            }}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            + เพิ่มรายการ
          </button>
          <button
            onClick={handleManualSync}
            disabled={syncing || !navigator.onLine}
            className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังซิงค์...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                ซิงค์ข้อมูล
              </>
            )}
          </button>
        </div>

        {/* Transactions List */}
        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm text-center text-gray-500">
              ยังไม่มีรายการในเดือนนี้
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${
                    transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <CategoryIcon category={transaction.category || ''} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {transaction.category || '-'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(transaction.date), 'yyyy-MM-dd')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`text-sm font-semibold ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {Number(transaction.amount).toLocaleString('th-TH')}
                  </p>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center z-10">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingTransaction ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
              </h2>
              <button
                onClick={handleCancel}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
              <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-8">
              {/* Type Tabs */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    formData.type === 'expense'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  รายจ่าย
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    formData.type === 'income'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  รายรับ
                </button>
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หมวดหมู่
                </label>
                <div className="relative">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 appearance-none bg-white"
                    required
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {(formData.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="0"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  วันที่
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </div>

              {/* Save Button */}
              <button
                type="submit"
                className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!formData.category || !formData.amount || Number(formData.amount) <= 0 || !formData.date}
              >
                บันทึก
              </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  )
}
