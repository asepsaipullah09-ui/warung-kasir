'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { formatRupiah } from '@/lib/utils'
import { printReceipt } from '@/lib/exportUtils'

export default function KasirPage() {
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('semua')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [cartOpen, setCartOpen] = useState(false) // mobile drawer
  const [showPayModal, setShowPayModal] = useState(false)
  const [cashPaid, setCashPaid] = useState('')
  const [processing, setProcessing] = useState(false)

  // State untuk Modal Hutang
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // State untuk struk transaksi terakhir
  const [lastReceipt, setLastReceipt] = useState<any>(null)

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

      if (profile?.role !== 'admin_kasir') {
        showToast('Akses ditolak! Hanya kasir yang bisa mengakses halaman ini.', 'error')
        router.push('/dashboard')
        return
      }

      setUser(user)
      fetchProducts()
    }
    checkAuth()
  }, [router, showToast])

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching products:', error)
      showToast('Gagal memuat produk', 'error')
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  const addToCart = (product: any) => {
    const existingItem = cart.find((item: any) => item.id === product.id)

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        showToast(`Stok ${product.name} tidak mencukupi`, 'warning')
        return
      }
      setCart(cart.map((item: any) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      if (product.stock <= 0) {
        showToast(`Stok ${product.name} habis`, 'warning')
        return
      }
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const decreaseQuantity = (productId: string) => {
    setCart(cart.map((item: any) => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(0, item.quantity - 1) }
      }
      return item
    }).filter((item: any) => item.quantity > 0))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item: any) => item.id !== productId))
  }

  const totalAmount = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
  const totalItems = cart.reduce((sum: number, item: any) => sum + item.quantity, 0)

  // Kembalian
  const cashPaidNum = parseInt(cashPaid || '0', 10) || 0
  const change = cashPaidNum - totalAmount

  const categories = useMemo(() => {
    const cats = products.map((p: any) => p.category).filter(Boolean)
    return ['semua', ...Array.from(new Set(cats))]
  }, [products])

  const filteredProducts = products.filter((product: any) => {
    const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchCategory = category === 'semua' || product.category === category
    return matchSearch && matchCategory
  })

  const handleCashCheckout = async () => {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong!', 'warning')
      return
    }
    if (!cashPaidNum || cashPaidNum < totalAmount) {
      showToast('Jumlah uang tunai kurang dari total!', 'error')
      return
    }
    setProcessing(true)
    const ok = await processTransaction('tunai')
    if (ok) {
      setShowPayModal(false)
      setCashPaid('')
      showToast('Transaksi berhasil! Kembalian: ' + formatRupiah(change))
    }
    setProcessing(false)
  }

  const handleDebtCheckout = async () => {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong!', 'warning')
      return
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      showToast('Nama dan nomor telepon pelanggan wajib diisi!', 'error')
      return
    }
    setProcessing(true)
    const ok = await processTransaction('hutang')
    if (ok) {
      setShowDebtModal(false)
      setCustomerName('')
      setCustomerPhone('')
      showToast('Hutang berhasil dicatat untuk ' + customerName)
    }
    setProcessing(false)
  }

  const processTransaction = async (paymentMethod: string) => {
    try {
      // 1. Kurangi stok produk
      for (const item of cart) {
        const product = products.find((p: any) => p.id === item.id)
        if (!product || product.stock < item.quantity) {
          showToast(`Stok ${item.name} tidak mencukupi!`, 'error')
          return false
        }
        await supabase
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.id)
      }

      // 2. Buat transaksi
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          cashier_id: user.id,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          status: 'completed',
        })
        .select()
        .single()

      if (txError) throw txError

      // 3. Buat detail transaksi
      const transactionItems = cart.map((item: any) => ({
        transaction_id: transaction.id,
        product_id: item.id,
        quantity: item.quantity,
        subtotal_price: item.price * item.quantity,
      }))

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(transactionItems)

      if (itemsError) throw itemsError

      // 4. Jika hutang, catat ke tabel debts
      if (paymentMethod === 'hutang') {
        const { error: debtError } = await supabase
          .from('debts')
          .insert({
            customer_name: customerName,
            customer_phone: customerPhone,
            transaction_id: transaction.id,
            total_debt: totalAmount,
            paid_amount: 0,
            remaining_debt: totalAmount,
            status: 'belum_lunas',
          })

        if (debtError) throw debtError
      }

      setCart([])
      fetchProducts()

      // Siapkan data struk untuk transaksi terakhir
      setLastReceipt({
        id: transaction.id,
        date: transaction.transaction_date || new Date().toISOString(),
        items: cart.map((item: any) => ({
          name: item.name,
          qty: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
        })),
        total: totalAmount,
        method: paymentMethod,
        cash: paymentMethod === 'tunai' ? cashPaidNum : undefined,
        change: paymentMethod === 'tunai' ? change : undefined,
        customerName: paymentMethod === 'hutang' ? customerName : undefined,
      })

      return true
    } catch (error: any) {
      console.error('Error:', error)
      showToast('Terjadi kesalahan: ' + error.message, 'error')
      return false
    }
  }

  const handlePrintLastReceipt = () => {
    if (!lastReceipt) return
    printReceipt(lastReceipt)
    setLastReceipt(null)
  }

  const cartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Keranjang Belanja</h2>
        <span className="bg-blue-600 text-white text-sm px-3 py-1 rounded-full font-semibold">
          {totalItems} item
        </span>
      </div>

      {cart.length === 0 ? (
        <div className="text-gray-500 text-center py-10">
          <div className="text-4xl mb-2">🛒</div>
          <p>Keranjang kosong</p>
          <p className="text-sm text-gray-400">Klik produk untuk menambahkan</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
            {cart.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center gap-2 border-b pb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-sm text-gray-600">
                    {formatRupiah(item.price)} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => decreaseQuantity(item.id)}
                    className="bg-gray-200 hover:bg-gray-300 w-7 h-7 rounded flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="w-7 text-center font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => addToCart(item)}
                    className="bg-gray-200 hover:bg-gray-300 w-7 h-7 rounded flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 ml-1 text-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-bold text-gray-800">Total:</span>
              <span className="text-2xl font-bold text-blue-600">
                {formatRupiah(totalAmount)}
              </span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setShowPayModal(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
              >
                💵 Bayar Tunai
              </button>
              <button
                onClick={() => setShowDebtModal(true)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg transition"
              >
                📝 Catat Hutang
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🛒 Kasir</h1>
          <p className="text-gray-500 text-sm">Pilih produk untuk mulai transaksi</p>
        </div>
        {/* Cart button - mobile */}
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold relative"
        >
          🛒
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {/* Search & Category */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Cari produk / scan barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'semua' ? 'Semua' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Layout: produk + cart */}
      <div className="flex gap-6 items-start">
        {/* Product Grid */}
        <div className="flex-1 min-w-0">
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-12 text-center">
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-gray-500 text-lg">Produk tidak ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {filteredProducts.map((product: any) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-lg transition hover:scale-[1.02] border-t-4 ${
                    product.stock <= 0
                      ? 'border-red-400 opacity-60'
                      : product.stock < 10
                      ? 'border-yellow-400'
                      : 'border-blue-500'
                  }`}
                >
                  <h3 className="font-bold text-gray-800 truncate mb-1">{product.name}</h3>
                  {product.category && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {product.category}
                    </span>
                  )}
                  <p className={`text-sm mt-2 ${product.stock < 10 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    Stok: {product.stock}
                  </p>
                  <p className="text-blue-600 font-bold text-base md:text-lg mt-1">
                    {formatRupiah(product.price)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart - Desktop */}
        <div className="hidden lg:block w-80 xl:w-96 shrink-0">
          <div className="bg-white rounded-xl shadow p-5 sticky top-24">
            {cartContent}
          </div>
        </div>
      </div>

      {/* Cart Drawer - Mobile */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl p-5 overflow-y-auto animate-slide-in-right">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setCartOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            {cartContent}
          </div>
        </div>
      )}

      {/* Modal Pembayaran Tunai */}
      <Modal
        isOpen={showPayModal}
        onClose={() => {
          setShowPayModal(false)
          setCashPaid('')
        }}
        title="💵 Pembayaran Tunai"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Belanja</p>
            <p className="text-3xl font-bold text-blue-600">{formatRupiah(totalAmount)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Uang Diterima
            </label>
            <input
              type="number"
              value={cashPaid}
              onChange={(e) => setCashPaid(e.target.value)}
              placeholder="Masukkan nominal uang"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
              autoFocus
              min={totalAmount}
            />
          </div>

          {/* Quick cash buttons */}
          <div className="flex flex-wrap gap-2">
            {[50000, 100000, 200000, 500000].map((amount) => (
              <button
                key={amount}
                onClick={() => setCashPaid(amount.toString())}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition"
              >
                {formatRupiah(amount)}
              </button>
            ))}
          </div>

          {cashPaidNum > 0 && (
            <div className={`rounded-lg p-4 ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-600 mb-1">Kembalian</p>
              <p className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? formatRupiah(change) : 'Uang kurang ' + formatRupiah(Math.abs(change))}
              </p>
            </div>
          )}

          <button
            onClick={handleCashCheckout}
            disabled={processing || cashPaidNum < totalAmount || cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Memproses...
              </>
            ) : (
              '✔️ Konfirmasi Pembayaran'
            )}
          </button>
        </div>
      </Modal>

      {/* Modal Hutang */}
      <Modal
        isOpen={showDebtModal}
        onClose={() => {
          setShowDebtModal(false)
          setCustomerName('')
          setCustomerPhone('')
        }}
        title="📝 Catat Hutang"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Hutang</p>
            <p className="text-3xl font-bold text-yellow-600">{formatRupiah(totalAmount)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nama Pelanggan
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Masukkan nama pelanggan"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nomor Telepon
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="0812xxxxxxxx"
            />
          </div>

          <button
            onClick={handleDebtCheckout}
            disabled={processing}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Memproses...
              </>
            ) : (
              '💾 Simpan Hutang'
            )}
          </button>
        </div>
      </Modal>

      {/* Modal Cetak Struk */}
      <Modal
        isOpen={!!lastReceipt}
        onClose={() => setLastReceipt(null)}
        title="🖨️ Cetak Struk"
        maxWidth="max-w-sm"
      >
        {lastReceipt && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-300">
              <div className="font-mono text-sm">
                <div className="font-bold text-base mb-1">🛒 KASIR WARUNG</div>
                <div>No: #{lastReceipt.id.slice(0, 8).toUpperCase()}</div>
                <div>{new Date(lastReceipt.date).toLocaleString('id-ID')}</div>
                <div>Metode: {lastReceipt.method === 'hutang' ? 'Hutang' : 'Tunai'}</div>
                {lastReceipt.customerName && <div>Pelanggan: {lastReceipt.customerName}</div>}
              </div>
              <hr className="my-2 border-dashed" />
              {lastReceipt.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between font-mono text-xs">
                  <span>{item.name} x{item.qty}</span>
                  <span>{formatRupiah(item.subtotal)}</span>
                </div>
              ))}
              <hr className="my-2 border-dashed" />
              <div className="flex justify-between font-mono font-bold">
                <span>TOTAL</span>
                <span>{formatRupiah(lastReceipt.total)}</span>
              </div>
              {lastReceipt.cash !== undefined && (
                <div className="flex justify-between font-mono text-xs mt-1">
                  <span>Bayar</span>
                  <span>{formatRupiah(lastReceipt.cash)}</span>
                </div>
              )}
              {lastReceipt.change !== undefined && lastReceipt.change >= 0 && (
                <div className="flex justify-between font-mono text-xs">
                  <span>Kembalian</span>
                  <span>{formatRupiah(lastReceipt.change)}</span>
                </div>
              )}
            </div>
            <button
              onClick={handlePrintLastReceipt}
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

