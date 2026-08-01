'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatRupiah, greeting, todayISO } from '@/lib/utils'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState('')
  const [stats, setStats] = useState({
    todayTransactions: 0,
    todayRevenue: 0,
    totalProducts: 0,
    lowStock: 0,
    activeDebts: 0,
    unpaidDebtAmount: 0,
  })
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setRole(profile?.role || '')

      // Fetch stats in parallel
      const today = todayISO()
      const startOfDay = `${today}T00:00:00`
      const endOfDay = `${today}T23:59:59`

      const [txRes, prodRes, debtRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('total_amount')
          .gte('transaction_date', startOfDay)
          .lte('transaction_date', endOfDay),
        supabase.from('products').select('id, stock'),
        supabase
          .from('debts')
          .select('remaining_debt, status')
          .eq('status', 'belum_lunas'),
      ])

      const transactions = txRes.data || []
      const products = prodRes.data || []
      const debts = debtRes.data || []

      setStats({
        todayTransactions: transactions.length,
        todayRevenue: transactions.reduce(
          (sum: number, tx: any) => sum + (tx.total_amount || 0),
          0
        ),
        totalProducts: products.length,
        lowStock: products.filter((p: any) => p.stock < 10).length,
        activeDebts: debts.length,
        unpaidDebtAmount: debts.reduce(
          (sum: number, d: any) => sum + (d.remaining_debt || 0),
          0
        ),
      })
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Transaksi Hari Ini',
      value: `${stats.todayTransactions}`,
      sub: 'transaksi',
      icon: '🧾',
      color: 'bg-blue-50 text-blue-600',
      visible: true,
    },
    {
      title: 'Omset Hari Ini',
      value: formatRupiah(stats.todayRevenue),
      sub: 'pendapatan',
      icon: '💰',
      color: 'bg-green-50 text-green-600',
      visible: true,
    },
    {
      title: 'Total Produk',
      value: `${stats.totalProducts}`,
      sub: `${stats.lowStock} stok menipis`,
      icon: '📦',
      color: 'bg-purple-50 text-purple-600',
      visible: role === 'pengelola_stok' || role === 'pemilik',
    },
    {
      title: 'Hutang Belum Lunas',
      value: `${stats.activeDebts}`,
      sub: formatRupiah(stats.unpaidDebtAmount),
      icon: '📝',
      color: 'bg-red-50 text-red-600',
      visible: role === 'admin_kasir' || role === 'pemilik',
    },
  ].filter((c) => c.visible)

  const quickLinks = [
    { name: 'Buka Kasir', desc: 'Mulai transaksi', path: '/dashboard/kasir', icon: '🛒', roles: ['admin_kasir'] },
    { name: 'Kelola Stok', desc: 'Atur produk & stok', path: '/dashboard/stok', icon: '📦', roles: ['pengelola_stok'] },
    { name: 'Lihat Laporan', desc: 'Analisis penjualan', path: '/dashboard/laporan', icon: '📊', roles: ['pemilik'] },
    { name: 'Manajemen Hutang', desc: 'Kelola hutang pelanggan', path: '/dashboard/hutang', icon: '📝', roles: ['admin_kasir', 'pemilik'] },
  ].filter((l) => l.roles.includes(role))

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h1 className="text-2xl md:text-3xl font-bold">{greeting()}! 👋</h1>
        <p className="text-white/80 mt-1">
          {user?.email} — Selamat datang di dashboard Kasir Warung
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl shadow p-5 flex items-start gap-4 hover:shadow-md transition"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${card.color}`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">{card.title}</p>
              <p className="text-xl font-bold text-gray-800 truncate">{card.value}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Akses Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className="border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:bg-blue-50 transition group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition">
                {link.icon}
              </div>
              <h3 className="font-bold text-gray-800">{link.name}</h3>
              <p className="text-sm text-gray-500">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

