'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { formatRupiah } from '@/lib/utils'

export default function StokPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('semua')

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    stock: '',
    barcode: '',
  })

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

      if (profile?.role !== 'pengelola_stok') {
        showToast('Akses ditolak! Hanya pengelola stok yang bisa mengakses halaman ini.', 'error')
        router.push('/dashboard')
        return
      }

      setUser(user)
      fetchProducts()
    }
    checkAuth()
  }, [router, showToast])

  const fetchProducts = async () => {
    setLoading(true)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const openModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name,
        category: product.category || '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        barcode: product.barcode || '',
      })
    } else {
      setEditingProduct(null)
      setFormData({
        name: '',
        category: '',
        price: '',
        stock: '',
        barcode: '',
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingProduct(null)
    setFormData({
      name: '',
      category: '',
      price: '',
      stock: '',
      barcode: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.price || !formData.stock) {
      showToast('Nama, harga, dan stok wajib diisi!', 'error')
      return
    }

    try {
      const productData = {
        name: formData.name,
        category: formData.category,
        price: parseInt(formData.price),
        stock: parseInt(formData.stock),
        barcode: formData.barcode,
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)

        if (error) throw error
        showToast('Produk berhasil diupdate!')
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData])

        if (error) throw error
        showToast('Produk baru berhasil ditambahkan!')
      }

      closeModal()
      fetchProducts()
    } catch (error: any) {
      console.error('Error:', error)
      showToast('Terjadi kesalahan: ' + error.message, 'error')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('Produk berhasil dihapus!')
      fetchProducts()
    } catch (error: any) {
      console.error('Error:', error)
      showToast('Terjadi kesalahan saat menghapus: ' + error.message, 'error')
    }
  }

  const handleStockAdjustment = async (product: any, adjustment: number) => {
    const newStock = product.stock + adjustment
    if (newStock < 0) {
      showToast('Stok tidak boleh negatif!', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id)

      if (error) throw error
      showToast(`Stok ${product.name} menjadi ${newStock}`)
      fetchProducts()
    } catch (error: any) {
      console.error('Error:', error)
      showToast('Terjadi kesalahan: ' + error.message, 'error')
    }
  }

  const categories = ['semua', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))]

  const filteredProducts = products.filter((product) => {
    const matchSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchCategory = categoryFilter === 'semua' || product.category === categoryFilter
    return matchSearch && matchCategory
  })

  const lowStockProducts = products.filter((p) => p.stock < 10)
  const totalStockValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">📦 Manajemen Stok</h1>
          <p className="text-gray-500 text-sm">Kelola produk dan stok barang warung</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-lg transition whitespace-nowrap"
        >
          + Tambah Produk
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Total Produk</p>
          <p className="text-3xl font-bold text-purple-600">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Stok Menipis {'(< 10)'}</p>
          <p className={`text-3xl font-bold ${lowStockProducts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {lowStockProducts.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Nilai Total Stok</p>
          <p className="text-2xl font-bold text-blue-600 truncate">{formatRupiah(totalStockValue)}</p>
        </div>
      </div>

      {/* Alert Stok Menipis */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
          <strong>⚠️ Peringatan:</strong> Ada {lowStockProducts.length} produk dengan stok menipis!
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStockProducts.slice(0, 8).map((product) => (
              <span key={product.id} className="bg-white px-2 py-1 rounded-lg text-xs font-semibold">
                {product.name} ({product.stock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Cari produk berdasarkan nama atau kategori..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'semua' ? 'Semua' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stok</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada produk ditemukan
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{product.name}</div>
                      {product.barcode && (
                        <div className="text-sm text-gray-500">Barcode: {product.barcode}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-800">
                        {product.category || 'Umum'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-blue-600">{formatRupiah(product.price)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStockAdjustment(product, -1)}
                          className="bg-gray-200 hover:bg-gray-300 w-7 h-7 rounded flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className={`font-semibold w-8 text-center ${product.stock < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.stock}
                        </span>
                        <button
                          onClick={() => handleStockAdjustment(product, 1)}
                          className="bg-gray-200 hover:bg-gray-300 w-7 h-7 rounded flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => openModal(product)} className="text-blue-600 hover:text-blue-900 mr-3 font-medium">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(product.id, product.name)} className="text-red-600 hover:text-red-900 font-medium">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards - Mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow p-8 text-center text-gray-500">
            Tidak ada produk ditemukan
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-800 truncate">{product.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {product.category || 'Umum'}
                  </span>
                </div>
                {product.barcode && (
                  <span className="text-xs text-gray-400 shrink-0">{product.barcode}</span>
                )}
              </div>

              <p className="text-blue-600 font-bold">{formatRupiah(product.price)}</p>

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStockAdjustment(product, -1)}
                    className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className={`font-bold ${product.stock < 10 ? 'text-red-600' : 'text-gray-800'}`}>
                    {product.stock}
                  </span>
                  <button
                    onClick={() => handleStockAdjustment(product, 1)}
                    className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(product)}
                    className="text-blue-600 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id, product.name)}
                    className="text-red-600 text-sm font-semibold"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Tambah/Edit Produk */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nama Produk *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Contoh: Nasi Goreng"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kategori</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Contoh: Makanan, Minuman, Snack"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Harga (Rp) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="15000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Stok Awal *</label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="50"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Barcode (Opsional)</label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Scan atau ketik barcode"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg transition"
            >
              {editingProduct ? 'Update' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2.5 rounded-lg transition"
            >
              Batal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

