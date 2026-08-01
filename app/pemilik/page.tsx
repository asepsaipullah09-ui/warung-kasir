'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function PemilikPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  // Tambahkan tipe data any[] agar Vercel tidak komplain saat build
  const [dailyReport, setDailyReport] = useState({
    totalTransactions: 0,
    totalRevenue: 0,
    transactions: [] as any[]
  })
  const [debts, setDebts] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'pemilik') {
        alert('Akses ditolak! Hanya pemilik yang bisa mengakses halaman ini.')
        router.push('/login')
        return
      }

      setUser(user)
      fetchDailyReport(selectedDate)
      fetchDebts()
    }

    checkAuth()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ambil laporan harian berdasarkan tanggal
  const fetchDailyReport = async (date: string) => {
    setLoading(true)
    
    const startOfDay = `${date}T00:00:00`
    const endOfDay = `${date}T23:59:59`

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (
          product_id,
          quantity,
          subtotal_price,
          products (
            name
          )
        )
      `)
      .gte('transaction_date', startOfDay)
      .lte('transaction_date', endOfDay)
      .order('transaction_date', { ascending: false })

    if (error) {
      console.error('Error fetching transactions:', error)
      // Pastikan tetap array kosong jika error
      setDailyReport({ totalTransactions: 0, totalRevenue: 0, transactions: [] })
    } else {
      // Gunakan (transactions || []) untuk mencegah error jika data null
      const safeTransactions = transactions || []
      const totalRevenue = safeTransactions.reduce((sum: number, tx: any) => sum + (tx.total_amount || 0), 0)
      
      setDailyReport({
        totalTransactions: safeTransactions.length,
        totalRevenue,
        transactions: safeTransactions
      })
    }
    setLoading(false)
  }

  // Ambil data hutang yang belum lunas
  const fetchDebts = async () => {
    const { data, error } = await supabase
      .from('debts')
      .select(`
        *,
        transactions (
          transaction_date
        )
      `)
      .eq('status', 'belum_lunas')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching debts:', error)
      setDebts([])
    } else {
      // Gunakan (data || []) untuk mencegah error jika data null
      setDebts(data || [])
    }
  }

  const formatRupiah = (amount: number) => {
    return `Rp ${(amount || 0).toLocaleString('id-ID')}`
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard Pemilik Warung</h1>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="container mx-auto p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm mb-2">Total Transaksi Hari Ini</h3>
            <p className="text-3xl font-bold text-blue-600">{dailyReport.totalTransactions}</p>
            <p className="text-sm text-gray-500">transaksi</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm mb-2">Omset Hari Ini</h3>
            <p className="text-3xl font-bold text-green-600">{formatRupiah(dailyReport.totalRevenue)}</p>
            <p className="text-sm text-gray-500">total pendapatan</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm mb-2">Total Hutang Belum Lunas</h3>
            <p className="text-3xl font-bold text-red-600">{debts.length}</p>
            <p className="text-sm text-gray-500">pelanggan</p>
          </div>
        </div>

        {/* Filter Tanggal */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="font-semibold">Pilih Tanggal:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                fetchDailyReport(e.target.value)
              }}
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daftar Transaksi */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Daftar Transaksi</h2>
            
            {(!dailyReport.transactions || dailyReport.transactions.length === 0) ? (
              <p className="text-gray-500 text-center py-8">Belum ada transaksi pada tanggal ini</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dailyReport.transactions.map((tx: any) => (
                  <div key={tx.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm">#{tx.id ? tx.id.slice(0, 8) : 'Unknown'}</span>
                      <span className="text-xs text-gray-500">{formatDate(tx.transaction_date)}</span>
                    </div>
                    
                    <div className="space-y-1 mb-2">
                      {tx.transaction_items?.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-600">
                          {item.products?.name || 'Produk'} x{item.quantity}
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-gray-600">Total:</span>
                      <span className="font-bold text-green-600">{formatRupiah(tx.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daftar Hutang */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Daftar Hutang Pelanggan</h2>
            
            {debts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Tidak ada hutang belum lunas</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {debts.map((debt: any) => (
                  <div key={debt.id} className="border border-red-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold">{debt.customer_name}</h4>
                        <p className="text-sm text-gray-600">{debt.customer_phone}</p>
                      </div>
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                        Belum Lunas
                      </span>
                    </div>
                    
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">
                        Tanggal: {formatDate(debt.transactions?.transaction_date)}
                      </p>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <span className="text-sm">Sisa Hutang:</span>
                        <span className="font-bold text-red-600 text-lg">
                          {formatRupiah(debt.remaining_debt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}