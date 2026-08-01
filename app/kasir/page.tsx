'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function KasirPage() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    // Cek apakah user sudah login
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Cek role user
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin_kasir') {
        alert('Akses ditolak! Hanya kasir yang bisa mengakses halaman ini.')
        router.push('/login')
        return
      }

      setUser(user)
      fetchProducts()
    }

    checkAuth()
  }, [router])

  // Ambil semua produk dari database
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching products:', error)
    } else {
      setProducts(data)
    }
    setLoading(false)
  }

  // Tambah produk ke keranjang
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id)
    
    if (existingItem) {
      // Jika produk sudah ada di cart, tambah quantity
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      // Jika produk belum ada di cart, tambahkan dengan quantity 1
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  // Kurangi quantity di keranjang
  const decreaseQuantity = (productId) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(0, item.quantity - 1) }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  // Hapus dari keranjang
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId))
  }

  // Hitung total harga
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  // Proses checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Keranjang masih kosong!')
      return
    }

    if (!confirm(`Total pembayaran: Rp ${totalAmount.toLocaleString('id-ID')}\n\nLanjutkan transaksi?`)) {
      return
    }

    try {
      // 1. Kurangi stok produk
      for (const item of cart) {
        const product = products.find(p => p.id === item.id)
        if (product.stock < item.quantity) {
          alert(`Stok ${item.name} tidak mencukupi!`)
          return
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
          payment_method: 'tunai',
          status: 'completed'
        })
        .select()
        .single()

      if (txError) throw txError

      // 3. Buat detail transaksi (transaction_items)
      const transactionItems = cart.map(item => ({
        transaction_id: transaction.id,
        product_id: item.id,
        quantity: item.quantity,
        subtotal_price: item.price * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(transactionItems)

      if (itemsError) throw itemsError

      alert('Transaksi berhasil!')
      setCart([]) // Kosongkan keranjang
      fetchProducts() // Refresh produk (stok updated)

    } catch (error) {
      console.error('Error:', error)
      alert('Terjadi kesalahan saat memproses transaksi!')
    }
  }

  // Filter produk berdasarkan search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Kasir Warung</h1>
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

      <div className="container mx-auto p-4 flex gap-4">
        {/* Daftar Produk */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition hover:scale-105"
              >
                <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                <p className="text-gray-600">Stok: {product.stock}</p>
                <p className="text-blue-600 font-bold text-xl">
                  Rp {product.price.toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Keranjang */}
        <div className="w-96 bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-bold mb-4">Keranjang Belanja</h2>
          
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Keranjang kosong</p>
          ) : (
            <>
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b pb-2">
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Rp {item.price.toLocaleString('id-ID')} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decreaseQuantity(item.id)}
                        className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    Rp {totalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
                >
                  Bayar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}