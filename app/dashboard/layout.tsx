'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/Toast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string>('')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    const checkAuth = async () => {
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
    }
    checkAuth()
  }, [router])

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    showToast('Berhasil logout', 'info')
    router.push('/login')
  }

  const allMenuItems = [
    { name: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { name: 'Kasir', icon: '🛒', path: '/dashboard/kasir', roles: ['admin_kasir'] },
    { name: 'Stok Barang', icon: '📦', path: '/dashboard/stok', roles: ['pengelola_stok'] },
    { name: 'Laporan', icon: '📊', path: '/dashboard/laporan', roles: ['pemilik'] },
    { name: 'Hutang', icon: '📝', path: '/dashboard/hutang', roles: ['admin_kasir', 'pemilik'] },
  ]

  const menuItems = allMenuItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const roleLabels: Record<string, string> = {
    admin_kasir: 'Kasir',
    pemilik: 'Pemilik',
    pengelola_stok: 'Pengelola Stok',
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between gap-2">
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">🛒</span>
          {!collapsed && <span className="text-lg font-bold truncate">Kasir Warung</span>}
        </Link>
        {collapsed && (
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.path
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="text-xl w-6 text-center shrink-0">{item.icon}</span>
              {!collapsed && <span className="font-medium truncate">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-700 space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
            {(user.email || '?')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-semibold truncate text-sm">{user.email}</p>
              <p className="text-xs text-gray-400">{roleLabels[role] || role}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition flex items-center justify-center gap-2"
        >
          <span>🚪</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-[72px]' : 'w-64'
        } bg-gray-900 text-white transition-all duration-300 hidden lg:flex flex-col fixed inset-y-0 left-0 z-40`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full text-gray-400 hover:text-white text-xs flex items-center justify-center z-10"
        >
          {collapsed ? '▶' : '◀'}
        </button>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (off-canvas) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-gray-900 text-white flex flex-col animate-fade-in shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile Topbar */}
        <header className="bg-gray-900 text-white p-3 flex items-center gap-3 lg:hidden sticky top-0 z-30 shadow-md">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-xl p-1 hover:bg-gray-800 rounded"
            aria-label="Buka menu"
          >
            ☰
          </button>
          <span className="font-bold truncate">🛒 Kasir Warung</span>
          <div className="ml-auto w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
            {(user.email || '?')[0].toUpperCase()}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

