'use client'
import { useRouter } from 'next/navigation'

const features = [
  { icon: '🛒', title: 'Kasir Cepat', desc: 'Transaksi mudah dan cepat dengan tampilan produk yang jelas.' },
  { icon: '📦', title: 'Manajemen Stok', desc: 'Pantau stok barang, peringatan stok menipis, dan kelola produk.' },
  { icon: '📊', title: 'Laporan Otomatis', desc: 'Laporan omset dan transaksi harian untuk pengambilan keputusan.' },
  { icon: '📝', title: 'Catat Hutang', desc: 'Catat transaksi hutang pelanggan dan pantau pelunasannya.' },
]

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700 flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 text-white">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span>🛒</span>
          <span>Kasir Warung</span>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="bg-white/20 hover:bg-white/30 backdrop-blur px-5 py-2 rounded-lg font-semibold transition"
        >
          Masuk
        </button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 max-w-lg w-full text-center animate-fade-in">
          <div className="text-6xl mb-4">🏪</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">
            Kasir Warung
          </h1>
          <p className="text-gray-600 mb-8">
            Sistem Kasir Modern & Mudah untuk Warung Anda
          </p>

          <button
            onClick={() => router.push('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Login / Masuk
          </button>

          <div className="text-sm text-gray-500 mt-6">
            <p>Login sebagai Admin untuk akses semua fitur</p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10 max-w-5xl w-full">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white/10 backdrop-blur rounded-xl p-5 text-white border border-white/20 hover:bg-white/20 transition"
            >
              <div className="text-3xl mb-2">{f.icon}</div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm text-white/80">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-white/70 text-sm py-4">
        © {new Date().getFullYear()} Kasir Warung — Sistem Kasir Modern
      </footer>
    </div>
  )
}

