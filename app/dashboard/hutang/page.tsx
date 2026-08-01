'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { formatRupiah, formatDate } from '@/lib/utils'

export default function HutangPage() {
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [filter, setFilter] = useState<'semua' | 'belum_lunas' | 'lunas'>('belum_lunas')
  const [searchTerm, setSearchTerm] = useState('')

  // Partial payment state
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  const router = useRouter()
  const { showToast } = useToast()

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

      if (!['admin_kasir', 'pemilik'].includes(profile?.role || '')) {
        showToast('Akses ditolak!', 'error')
        router.push('/dashboard')
        return
      }

      setUser(user)
    }
    checkAuth()
  }, [router, showToast])

  const fetchDebts = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('debts')
      .select(`
        *,
        transactions (
          transaction_date,
          transaction_items (
            products (name),
            quantity
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (filter !== 'semua') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error:', error)
      showToast('Gagal memuat data hutang', 'error')
    } else {
      setDebts(data || [])
    }
    setLoading(false)
  }, [filter, showToast])

  useEffect(() => {
    if (user) {
      fetchDebts()
    }
  }, [user, fetchDebts])

  const handleMarkAsPaid = async (debt: any) => {
    if (!confirm(`Tandai hutang ${debt.customer_name} sebesar Rp ${debt.remaining_debt.toLocaleString('id-ID')} sebagai LUNAS?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('debts')
        .update({
          status: 'lunas',
          paid_amount: debt.total_debt,
          remaining_debt: 0,
        })
        .eq('id', debt.id)

      if (error) throw error
      showToast(`Hutang ${debt.customer_name} telah lunas! 🎉`)
      fetchDebts()
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error')
    }
  }

  const openPayModal = (debt: any) => {
    setSelectedDebt(debt)
    setPaymentAmount('')
    setPayModalOpen(true)
  }

  const handlePartialPayment = async () => {
    if (!selectedDebt) return

    const amount = parseInt(paymentAmount || '0', 10)
    if (!amount || amount <= 0) {
      showToast('Masukkan nominal pembayaran yang valid!', 'error')
      return
    }
    if (amount > selectedDebt.remaining_debt) {
      showToast('Nominal melebihi sisa hutang!', 'error')
      return
    }

    setProcessing(true)
    try {
      const newPaid = selectedDebt.paid_amount + amount
      const newRemaining = selectedDebt.remaining_debt - amount
      const isPaidOff = newRemaining <= 0

      const { error } = await supabase
        .from('debts')
        .update({
          paid_amount: newPaid,
          remaining_debt: isPaidOff ? 0 : newRemaining,
          status: isPaidOff ? 'lunas' : 'belum_lunas',
        })
        .eq('id', selectedDebt.id)

      if (error) throw error

      showToast(
        isPaidOff
          ? `Pembayaran diterima! Hutang ${selectedDebt.customer_name} lunas 🎉`
          : `Pembayaran ${formatRupiah(amount)} diterima. Sisa: ${formatRupiah(newRemaining)}`
      )
      setPayModalOpen(false)
      setSelectedDebt(null)
      fetchDebts()
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  const filteredDebts = debts.filter((debt) =>
    debt.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (debt.customer_phone && debt.customer_phone.includes(searchTerm))
  )

  const totalDebt = debts.reduce((sum, d) => sum + (d.remaining_debt || 0), 0)
  const totalPaid = debts.reduce((sum, d) => sum + (d.paid_amount || 0), 0)
  const totalAll = debts.reduce((sum, d) => sum + (d.total_debt || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📝 Manajemen Hutang</h1>
        <p className="text-gray-500 text-sm">Kelola hutang pelanggan warung</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Total Belum Lunas</p>
          <p className="text-2xl font-bold text-red-600 truncate">{formatRupiah(totalDebt)}</p>
          <p className="text-xs text-gray-400">{debts.length} catatan</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Total Dibayar</p>
          <p className="text-2xl font-bold text-green-600 truncate">{formatRupiah(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Total Keseluruhan</p>
          <p className="text-2xl font-bold text-blue-600 truncate">{formatRupiah(totalAll)}</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['semua', 'belum_lunas', 'lunas'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f === 'semua' ? 'Semua' : f === 'belum_lunas' ? 'Belum Lunas' : 'Lunas'}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau nomor telepon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* List Hutang */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredDebts.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-500 text-lg">Tidak ada data hutang</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDebts.map((debt) => (
            <div key={debt.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-800 truncate">{debt.customer_name}</h3>
                  <p className="text-gray-600 text-sm">📞 {debt.customer_phone}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tanggal: {formatDate(debt.transactions?.transaction_date)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
                  debt.status === 'lunas'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {debt.status === 'lunas' ? '✓ Lunas' : '⏳ Belum Lunas'}
                </span>
              </div>

              {/* Detail Barang */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-1.5">Detail Pembelian:</p>
                {debt.transactions?.transaction_items?.length ? (
                  debt.transactions.transaction_items.map((item: any, idx: number) => (
                    <p key={idx} className="text-sm text-gray-600">
                      • {item.products?.name} x{item.quantity}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">-</p>
                )}
              </div>

              {/* Payment info */}
              <div className="mb-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Hutang:</span>
                  <span className="font-bold text-gray-800">{formatRupiah(debt.total_debt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sudah Dibayar:</span>
                  <span className="font-semibold text-green-600">{formatRupiah(debt.paid_amount)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold text-gray-700">Sisa:</span>
                  <span className="font-bold text-red-600 text-lg">{formatRupiah(debt.remaining_debt)}</span>
                </div>
              </div>

              {debt.status !== 'lunas' ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => openPayModal(debt)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold transition"
                  >
                    💸 Bayar Sebagian
                  </button>
                  <button
                    onClick={() => handleMarkAsPaid(debt)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-semibold transition"
                  >
                    ✓ Tandai Lunas
                  </button>
                </div>
              ) : (
                <div className="bg-green-50 rounded-lg p-3 text-center text-green-700 font-semibold">
                  ✓ Sudah Lunas
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Pembayaran Sebagian */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => {
          setPayModalOpen(false)
          setSelectedDebt(null)
          setPaymentAmount('')
        }}
        title="💸 Pembayaran Hutang"
      >
        {selectedDebt && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Pelanggan</p>
              <p className="text-lg font-bold text-gray-800">{selectedDebt.customer_name}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Sisa Hutang</p>
              <p className="text-3xl font-bold text-red-600">{formatRupiah(selectedDebt.remaining_debt)}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nominal Pembayaran
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Masukkan nominal"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                autoFocus
                min={1}
                max={selectedDebt.remaining_debt}
              />
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap gap-2">
              {[50000, 100000, 200000, 500000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setPaymentAmount(amount.toString())}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition"
                >
                  {formatRupiah(amount)}
                </button>
              ))}
            </div>

            <button
              onClick={handlePartialPayment}
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  Memproses...
                </>
              ) : (
                '💾 Bayar Sekarang'
              )}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

