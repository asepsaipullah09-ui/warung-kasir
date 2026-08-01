'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function HutangPage() {
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'semua' | 'belum_lunas' | 'lunas'>('belum_lunas')

  useEffect(() => {
    fetchDebts()
  }, [filter])

  const fetchDebts = async () => {
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
    } else {
      setDebts(data || [])
    }
    setLoading(false)
  }

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
          remaining_debt: 0
        })
        .eq('id', debt.id)

      if (error) throw error
      alert('Hutang berhasil ditandai lunas!')
      fetchDebts()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const formatRupiah = (amount: number) => `Rp ${(amount || 0).toLocaleString('id-ID')}`
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const totalDebt = debts.reduce((sum, d) => sum + (d.remaining_debt || 0), 0)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">📝 Manajemen Hutang</h1>
        <p className="text-gray-600">Kelola hutang pelanggan warung</p>
      </div>

      {/* Summary */}
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
        <p className="text-sm text-gray-600">Total Hutang Belum Lunas</p>
        <p className="text-3xl font-bold text-red-600">{formatRupiah(totalDebt)}</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2">
          {(['semua', 'belum_lunas', 'lunas'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f === 'semua' ? 'Semua' : f === 'belum_lunas' ? 'Belum Lunas' : 'Lunas'}
            </button>
          ))}
        </div>
      </div>

      {/* List Hutang */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : debts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">Tidak ada data hutang</p>
        </div>
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => (
            <div key={debt.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{debt.customer_name}</h3>
                  <p className="text-gray-600">📞 {debt.customer_phone}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Tanggal: {formatDate(debt.transactions?.transaction_date)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  debt.status === 'lunas'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {debt.status === 'lunas' ? '✓ Lunas' : '⏳ Belum Lunas'}
                </span>
              </div>

              {/* Detail Barang */}
              <div className="bg-gray-50 rounded p-3 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Detail Pembelian:</p>
                {debt.transactions?.transaction_items?.map((item: any, idx: number) => (
                  <p key={idx} className="text-sm text-gray-600">
                    • {item.products?.name} x{item.quantity}
                  </p>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-600">Total Hutang: <span className="font-bold text-red-600">{formatRupiah(debt.total_debt)}</span></p>
                  <p className="text-sm text-gray-600">Sisa: <span className="font-bold text-red-600 text-lg">{formatRupiah(debt.remaining_debt)}</span></p>
                </div>
                {debt.status !== 'lunas' && (
                  <button
                    onClick={() => handleMarkAsPaid(debt)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition"
                  >
                    Tandai Lunas
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}