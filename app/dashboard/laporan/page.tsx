'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { formatRupiah, formatDate, todayISO } from '@/lib/utils'

export default function LaporanPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [range, setRange] = useState<'hari' | 'minggu' | 'bulan' | 'kustom'>('hari')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [report, setReport] = useState({
    totalTransactions: 0,
    totalRevenue: 0,
    totalCash: 0,
    totalDebt: 0,
    transactions: [] as any[],
  })
  const router = useRouter()
  const { showToast } = useToast()

  const applyRange = useCallback((r: typeof range) => {
    const today = new Date()
    const end = todayISO()
    let start = todayISO()

    if (r === 'minggu') {
      const d = new Date(today)
      d.setDate(d.getDate() - 7)
      start = d.toISOString().split('T')[0]
    } else if (r === 'bulan') {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 1)
      start = d.toISOString().split('T')[0]
    }

    setStartDate(start)
    setEndDate(end)
    setRange(r)
    return { start, end }
  }, [])

  const fetchReport = useCallback(async (start: string, end: string) => {
    setLoading(true)
    const startOfDay = `${start}T00:00:00`
    const endOfDay = `${end}T23:59:59`

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (
          product_id,
          quantity,
          subtotal_price,
          products (name)
        )
      `)
      .gte('transaction_date', startOfDay)
      .lte('transaction_date', endOfDay)
      .order('transaction_date', { ascending: false })

    if (error) {
      console.error('Error fetching transactions:', error)
      showToast('Gagal memuat laporan', 'error')
      setReport({
        totalTransactions: 0,
        totalRevenue: 0,
        totalCash: 0,
        totalDebt: 0,
        transactions: [],
      })
    } else {
      const transactions = data || []
      const totalRevenue = transactions.reduce((sum: number, tx: any) => sum + (tx.total_amount || 0), 0)
      const totalCash = transactions
        .filter((tx: any) => tx.payment_method === 'tunai')
        .reduce((sum: number, tx: any) => sum + (tx.total_amount || 0), 0)
      const totalDebt = transactions
        .filter((tx: any) => tx.payment_method === 'hutang')
        .reduce((sum: number, tx: any) => sum + (tx.total_amount || 0), 0)

      setReport({
        totalTransactions: transactions.length,
        totalRevenue,
        totalCash,
        totalDebt,
        transactions,
      })
    }
    setLoading(false)
  }, [showToast])

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
        showToast('Akses ditolak! Hanya pemilik yang bisa mengakses halaman ini.', 'error')
        router.push('/dashboard')
        return
      }

      setUser(user)
      const { start, end } = applyRange('hari')
      fetchReport(start, end)
    }
    checkAuth()
  }, [router, showToast, applyRange, fetchReport])

  const handleRangeChange = (r: typeof range) => {
    const { start, end } = applyRange(r)
    fetchReport(start, end)
  }

  const handleCustomFilter = () => {
    if (!startDate || !endDate) {
      showToast('Pilih tanggal awal dan akhir!', 'error')
      return
    }
    setRange('kustom')
    fetchReport(startDate, endDate)
  }

  const statCards = [
    {
      title: 'Total Transaksi',
      value: `${report.totalTransactions}`,
      sub: 'transaksi',
      icon: '🧾',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Total Omset',
      value: formatRupiah(report.totalRevenue),
      sub: 'semua pembayaran',
      icon: '💰',
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Pembayaran Tunai',
      value: formatRupiah(report.totalCash),
      sub: 'cash',
      icon: '💵',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Penjualan Hutang',
      value: formatRupiah(report.totalDebt),
      sub: 'kredit',
      icon: '📝',
      color: 'bg-red-50 text-red-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📊 Laporan Penjualan</h1>
        <p className="text-gray-500 text-sm">Pantau omset dan transaksi warung</p>
      </div>

      {/* Range Filter */}
      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['hari', 'minggu', 'bulan', 'kustom'] as const).map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                range === r
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {r === 'hari' ? 'Hari Ini' : r === 'minggu' ? '7 Hari' : r === 'bulan' ? '30 Hari' : 'Kustom'}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-600 shrink-0">Dari:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-600 shrink-0">Sampai:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={handleCustomFilter}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Terapkan
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl shadow p-5 flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${card.color}`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">{card.title}</p>
              <p className="text-lg font-bold text-gray-800 truncate">{card.value}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daftar Transaksi */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Daftar Transaksi</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : report.transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500 text-lg">Belum ada transaksi pada periode ini</p>
          </div>
        ) : (
          <div className="space-y-3">
            {report.transactions.map((tx: any) => (
              <div key={tx.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                  <div>
                    <span className="font-semibold text-sm text-gray-700">
                      #{tx.id ? tx.id.slice(0, 8) : 'Unknown'}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      tx.payment_method === 'hutang'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {tx.payment_method === 'hutang' ? 'Hutang' : 'Tunai'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(tx.transaction_date)}</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                  {tx.transaction_items?.map((item: any, idx: number) => (
                    <span key={idx} className="text-sm text-gray-600">
                      {item.products?.name || 'Produk'} x{item.quantity}
                    </span>
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
    </div>
  )
}

