'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { formatRupiah, formatDate, todayISO } from '@/lib/utils'
import BarChart from '@/components/BarChart'
import Modal from '@/components/Modal'
import { exportToExcel, printDocument, printReceipt, formatRupiahExport, formatDateExport } from '@/lib/exportUtils'

export default function LaporanPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [range, setRange] = useState<'hari' | 'minggu' | 'bulan' | 'tahun' | 'kustom'>('hari')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [report, setReport] = useState({
    totalTransactions: 0,
    totalRevenue: 0,
    totalCash: 0,
    totalDebt: 0,
    transactions: [] as any[],
  })
  const [chartPeriod, setChartPeriod] = useState<'harian' | 'bulanan' | 'tahunan'>('harian')
  const [printTx, setPrintTx] = useState<any>(null)

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
    } else if (r === 'tahun') {
      const d = new Date(today)
      d.setFullYear(d.getFullYear() - 1)
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

  // Data grafik
  const chartData = useMemo(() => {
    const txs = report.transactions
    if (chartPeriod === 'harian') {
      const map = new Map<string, number>()
      txs.forEach((tx: any) => {
        const day = tx.transaction_date?.slice(0, 10) || 'Tidak diketahui'
        map.set(day, (map.get(day) || 0) + (tx.total_amount || 0))
      })
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({ label: label.slice(8, 10) + '/' + label.slice(5, 7), value }))
    } else if (chartPeriod === 'bulanan') {
      const map = new Map<string, number>()
      txs.forEach((tx: any) => {
        const d = tx.transaction_date?.slice(0, 7) || 'Tidak diketahui'
        map.set(d, (map.get(d) || 0) + (tx.total_amount || 0))
      })
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => {
          const [y, m] = label.split('-')
          return { label: monthNames[parseInt(m, 10) - 1] + ' ' + y.slice(2), value }
        })
    } else {
      const map = new Map<string, number>()
      txs.forEach((tx: any) => {
        const y = tx.transaction_date?.slice(0, 4) || 'Tidak diketahui'
        map.set(y, (map.get(y) || 0) + (tx.total_amount || 0))
      })
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({ label, value }))
    }
  }, [report.transactions, chartPeriod])

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

  // Export ke Excel
  const handleExportExcel = () => {
    if (report.transactions.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'warning')
      return
    }
    const rows = report.transactions.map((tx: any) => ({
      id: tx.id ? tx.id.slice(0, 8) : '-',
      date: formatDateExport(tx.transaction_date),
      method: tx.payment_method === 'hutang' ? 'Hutang' : 'Tunai',
      items: tx.transaction_items
        ? tx.transaction_items
            .map((i: any) => `${i.products?.name || 'Produk'} x${i.quantity}`)
            .join(', ')
        : '-',
      total: formatRupiahExport(tx.total_amount),
    }))
    exportToExcel(
      `Laporan-Penjualan-${startDate}-sampai-${endDate}`,
      [
        { header: 'ID', key: 'id' },
        { header: 'Tanggal', key: 'date' },
        { header: 'Metode', key: 'method' },
        { header: 'Item', key: 'items' },
        { header: 'Total', key: 'total' },
      ],
      rows
    )
    showToast('Laporan berhasil diekspor ke Excel! 📊')
  }

  // Cetak PDF
  const handleExportPDF = () => {
    if (report.transactions.length === 0) {
      showToast('Tidak ada data untuk dicetak', 'warning')
      return
    }
    const rows = report.transactions
      .map(
        (tx: any) => `
        <tr>
          <td>${tx.id ? tx.id.slice(0, 8) : '-'}</td>
          <td>${formatDateExport(tx.transaction_date)}</td>
          <td>${tx.payment_method === 'hutang' ? 'Hutang' : 'Tunai'}</td>
          <td>${tx.transaction_items
            ? tx.transaction_items
                .map((i: any) => `${i.products?.name || 'Produk'} x${i.quantity}`)
                .join(', ')
            : '-'}</td>
          <td style="text-align:right">${formatRupiahExport(tx.total_amount)}</td>
        </tr>`
      )
      .join('')

    printDocument(
      'Laporan Penjualan',
      `
      <div class="summary">
        <p><strong>Periode:</strong> ${formatDateExport(startDate + 'T00:00:00')} — ${formatDateExport(endDate + 'T23:59:59')}</p>
        <p><strong>Total Transaksi:</strong> ${report.totalTransactions}</p>
        <p><strong>Total Omset:</strong> ${formatRupiah(report.totalRevenue)}</p>
        <p><strong>Tunai:</strong> ${formatRupiah(report.totalCash)} | <strong>Hutang:</strong> ${formatRupiah(report.totalDebt)}</p>
      </div>
      <table>
        <thead>
          <tr><th>ID</th><th>Tanggal</th><th>Metode</th><th>Item</th><th>Total</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`,
      { footerNote: 'Dokumen ini dibuat otomatis oleh Kasir Warung.' }
    )
  }

  const handlePrintReceipt = (tx: any) => {
    const items = (tx.transaction_items || []).map((i: any) => ({
      name: i.products?.name || 'Produk',
      qty: i.quantity,
      price: i.subtotal_price / i.quantity,
      subtotal: i.subtotal_price,
    }))
    printReceipt({
      id: tx.id ? tx.id.slice(0, 8).toUpperCase() : 'UNKNOWN',
      date: tx.transaction_date,
      items,
      total: tx.total_amount,
      method: tx.payment_method,
    })
  }

  const openPrintModal = (tx: any) => setPrintTx(tx)

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
          {(['hari', 'minggu', 'bulan', 'tahun', 'kustom'] as const).map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                range === r
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {r === 'hari' ? 'Hari Ini' : r === 'minggu' ? '7 Hari' : r === 'bulan' ? '30 Hari' : r === 'tahun' ? '1 Tahun' : 'Kustom'}
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
          <div className="flex gap-2 sm:ml-auto">
            <button
              onClick={handleExportExcel}
              disabled={report.transactions.length === 0}
              className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              📗 Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={report.transactions.length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              📄 PDF
            </button>
          </div>
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

      {/* Grafik Omset */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-800">📈 Grafik Omset</h2>
          <div className="flex gap-2">
            {(['harian', 'bulanan', 'tahunan'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  chartPeriod === p
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p === 'harian' ? 'Harian' : p === 'bulanan' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          data={chartData}
          title={
            chartPeriod === 'harian'
              ? 'Omset per Hari'
              : chartPeriod === 'bulanan'
              ? 'Omset per Bulan'
              : 'Omset per Tahun'
          }
          valueFormatter={(v) => formatRupiah(v)}
        />
      </div>

      {/* Daftar Transaksi */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Daftar Transaksi</h2>
          <span className="text-sm text-gray-500">{report.transactions.length} transaksi</span>
        </div>

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
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{formatDate(tx.transaction_date)}</span>
                    <button
                      onClick={() => openPrintModal(tx)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg font-medium transition"
                      title="Cetak struk"
                    >
                      🖨️ Struk
                    </button>
                  </div>
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

      {/* Modal Print Struk */}
      <Modal
        isOpen={!!printTx}
        onClose={() => setPrintTx(null)}
        title="🖨️ Cetak Struk"
        maxWidth="max-w-sm"
      >
        {printTx && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
              <div className="font-mono text-sm">
                <div className="font-bold text-base mb-1">🛒 KASIR WARUNG</div>
                <div>No: #{printTx.id.slice(0, 8).toUpperCase()}</div>
                <div>{formatDate(printTx.transaction_date)}</div>
                <div>Metode: {printTx.payment_method === 'hutang' ? 'Hutang' : 'Tunai'}</div>
              </div>
              <hr className="my-2 border-dashed" />
              {printTx.transaction_items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between font-mono text-xs">
                  <span>{item.products?.name || 'Produk'} x{item.quantity}</span>
                  <span>{formatRupiah(item.subtotal_price)}</span>
                </div>
              ))}
              <hr className="my-2 border-dashed" />
              <div className="flex justify-between font-mono font-bold">
                <span>TOTAL</span>
                <span>{formatRupiah(printTx.total_amount)}</span>
              </div>
            </div>
            <button
              onClick={() => {
                handlePrintReceipt(printTx)
                setPrintTx(null)
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
            >
              🖨️ Cetak Sekarang
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

