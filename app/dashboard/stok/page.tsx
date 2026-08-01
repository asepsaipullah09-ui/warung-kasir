'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function StokPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    stock: '',
    barcode: ''
  })

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

      if (profile?.role !== 'pengelola_stok') {
        alert('Akses ditolak! Hanya pengelola stok yang bisa mengakses halaman ini.')
        router.push('/login')
        return
      }

      setUser(user)
      fetchProducts()
    }

    checkAuth()
  }, [router])

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching products:', error)
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const openModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name,
        category: product.category || '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        barcode: product.barcode || ''
      })
    } else {
      setEditingProduct(null)
      setFormData({
        name: '',
        category: '',
        price: '',
        stock: '',
        barcode: ''
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
      barcode: ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.price || !formData.stock) {
      alert('Nama, harga, dan stok wajib diisi!')
      return
    }

    try {
      const productData = {
        name: formData.name,
        category: formData.category,
        price: parseInt(formData.price),
        stock: parseInt(formData.stock),
        barcode: formData.barcode
      }

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)

        if (error) throw error
        alert('Produk berhasil diupdate!')
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert([productData])

        if (error) throw error
        alert('Produk baru berhasil ditambahkan!')
      }

      closeModal()
      fetchProducts()
    } catch (error: any) {
      console.error('Error:', error)
      alert('Terjadi kesalahan: ' + error.message)
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
      alert('Produk berhasil dihapus!')
      fetchProducts()
    } catch (error: any) {
      console.error('Error:', error)
      alert('Terjadi kesalahan saat menghapus: ' + error.message)
    }
  }

  const handleStockAdjustment = async (product: any, adjustment: number) => {
    const newStock = product.stock + adjustment
    if (newStock < 0) {
      alert('Stok tidak boleh negatif!')
      return
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id)

      if (error) throw error
      alert(`Stok ${product.name} berhasil diubah menjadi ${newStock}`)
      fetchProducts()
    } catch (error: any) {
      console.error('Error:', error)
      alert('Terjadi kesalahan: ' + error.message)
    }
  }

  const formatRupiah = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`
  }

  // Filter produk berdasarkan search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Produk dengan stok menipis (kurang dari 10)
  const lowStockProducts = products.filter(p => p.stock < 10)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-purple-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Manajemen Stok Barang</h1>
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
        {/* Alert Stok Menipis */}
        {lowStockProducts.length > 0 && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>⚠️ Peringatan:</strong> Ada {lowStockProducts.length} produk dengan stok menipis!
            <ul className="mt-2 ml-4 list-disc">
              {lowStockProducts.slice(0, 5).map(product => (
                <li key={product.id}>{product.name} (Stok: {product.stock})</li>
              ))}
            </ul>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex-1 w-full">
            <input
              type="text"
              placeholder="Cari produk berdasarkan nama atau kategori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-lg transition whitespace-nowrap"
          >
            + Tambah Produk
          </button>
        </div>

        {/* Tabel Produk */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Produk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Harga
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
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
                        <span className="font-semibold text-blue-600">
                          {formatRupiah(product.price)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStockAdjustment(product, -1)}
                            className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                          >
                            -
                          </button>
                          <span className={`font-semibold ${product.stock < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stock}
                          </span>
                          <button
                            onClick={() => handleStockAdjustment(product, 1)}
                            className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openModal(product)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          className="text-red-600 hover:text-red-900"
                        >
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
      </div>

      {/* Modal Tambah/Edit Produk */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Nama Produk *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Contoh: Nasi Goreng"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Kategori</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Contoh: Makanan, Minuman, Snack"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Harga (Rp) *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Contoh: 15000"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Stok Awal *</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Contoh: 50"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Barcode (Opsional)</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Scan atau ketik barcode"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded"
                >
                  {editingProduct ? 'Update' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 rounded"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}