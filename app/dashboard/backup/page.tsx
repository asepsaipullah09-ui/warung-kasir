'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/utils'

const BACKUP_KEY = 'warung_kasir_backup_history'
const AUTO_BACKUP_KEY = 'warung_kasir_auto_backup_enabled'
const LAST_BACKUP_KEY = 'warung_kasir_last_backup_at'
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 jam

const TABLES = [
  'products',
  'transactions',
  'transaction_items',
  'debts',
  'profiles',
]

interface BackupRecord {
  id: string
  date: string
  size: number
  auto: boolean
  data?: any
}

export default function BackupPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [history, setHistory] = useState<BackupRecord[]>([])
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  const router = useRouter()
  const { showToast } = useToast()

  const loadHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      setHistory(parsed)
      const last = parsed[0]
      if (last) {
        setLastBackup(last.date)
      }
    } catch {
      setHistory([])
    }
  }, [])

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
      setAutoEnabled(localStorage.getItem(AUTO_BACKUP_KEY) === '1')
      setLastBackup(localStorage.getItem(LAST_BACKUP_KEY))
      loadHistory()
      setLoading(false)
    }
    checkAuth()
  }, [router, showToast, loadHistory])

  const fetchAllData = useCallback(async (): Promise<any> => {
    const result: Record<string, any[]> = {}
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
      if (error) {
        console.error(`Error fetching ${table}:`, error)
        showToast(`Gagal mengambil tabel ${table}`, 'error')
      } else {
        result[table] = data || []
      }
    }
    return result
  }, [showToast])

  const handleBackupNow = useCallback(
    async (auto = false) => {
      setBackingUp(true)
      try {
        const data = await fetchAllData()
        const record: BackupRecord = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          size: new Blob([JSON.stringify(data)]).size,
          auto,
          data,
        }
        const newHistory = [record, ...history]
        localStorage.setItem(BACKUP_KEY, JSON.stringify(newHistory.slice(0, 10)))
        localStorage.setItem(LAST_BACKUP_KEY, record.date)
        setLastBackup(record.date)
        loadHistory()
        showToast(auto ? 'Backup otomatis berhasil dibuat' : 'Backup berhasil dibuat! 💾')
      } catch (error: any) {
        console.error('Backup error:', error)
        showToast('Gagal membuat backup: ' + error.message, 'error')
      } finally {
        setBackingUp(false)
      }
    },
    [fetchAllData, history, loadHistory, showToast]
  )

  // Backup otomatis: cek saat halaman dibuka
  useEffect(() => {
    if (!user) return
    const checkAutoBackup = async () => {
      const enabled = localStorage.getItem(AUTO_BACKUP_KEY) === '1'
      if (!enabled) return
      const last = localStorage.getItem(LAST_BACKUP_KEY)
      const shouldBackup = !last || Date.now() - new Date(last).getTime() >= AUTO_BACKUP_INTERVAL_MS
      if (shouldBackup) {
        await handleBackupNow(true)
      }
    }
    checkAutoBackup()
  }, [user, handleBackupNow])

  const toggleAutoBackup = (enabled: boolean) => {
    localStorage.setItem(AUTO_BACKUP_KEY, enabled ? '1' : '0')
    setAutoEnabled(enabled)
    showToast(enabled ? 'Backup otomatis diaktifkan (setiap 24 jam)' : 'Backup otomatis dimatikan', 'info')
  }

  const handleRestore = async (record: BackupRecord) => {
    if (!record.data) {
      showToast('Data backup tidak tersedia untuk direstorasi', 'warning')
      return
    }
    if (
      !confirm(
        '⚠️ RESTORE AKAN MENIMPA SEMUA DATA SAAT INI!\n\nYakin ingin memulihkan data dari backup ' +
          formatDate(record.date) +
          '?'
      )
    ) {
      return
    }
    setRestoring(true)
    try {
      // Urutan insert: master dulu (products), lalu transaksi, detail, hutang, profiles
      const order = ['products', 'transactions', 'transaction_items', 'debts', 'profiles']
      for (const table of order) {
        const rows = record.data[table]
        if (!rows || rows.length === 0) continue
        const { error } = await supabase.from(table).insert(rows)
        if (error) {
          console.error(`Error restoring ${table}:`, error)
          showToast(`Gagal restore tabel ${table}: ${error.message}`, 'error')
        }
      }
      showToast('Restore data berhasil! 🎉')
    } catch (error: any) {
      console.error('Restore error:', error)
      showToast('Gagal restore: ' + error.message, 'error')
    } finally {
      setRestoring(false)
    }
  }

  const handleDeleteBackup = (id: string) => {
    const newHistory = history.filter((h) => h.id !== id)
    localStorage.setItem(BACKUP_KEY, JSON.stringify(newHistory))
    if (history[0]?.id === id) {
      localStorage.removeItem(LAST_BACKUP_KEY)
      setLastBackup(null)
    }
    setHistory(newHistory)
    showToast('Backup dihapus', 'info')
  }

  const handleExportAll = async () => {
    setBackingUp(true)
    try {
      const data = await fetchAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `backup-warung-kasir-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      showToast('File backup berhasil diunduh! 📥')
    } catch (error: any) {
      showToast('Gagal mengunduh: ' + error.message, 'error')
    } finally {
      setBackingUp(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">💾 Backup Data</h1>
        <p className="text-gray-500 text-sm">Backup dan pulihkan data warung secara otomatis</p>
      </div>

      {/* Stat: Backup Terakhir */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Backup Terakhir</p>
          <p className="text-lg font-bold text-gray-800 truncate">
            {lastBackup ? formatDate(lastBackup) : 'Belum ada'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Total Backup Tersimpan</p>
          <p className="text-3xl font-bold text-green-600">{history.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Backup Otomatis</p>
            <p className={`text-lg font-bold ${autoEnabled ? 'text-green-600' : 'text-gray-400'}`}>
              {autoEnabled ? 'Aktif (24 jam)' : 'Nonaktif'}
            </p>
          </div>
          <button
            onClick={() => toggleAutoBackup(!autoEnabled)}
            className={`w-12 h-7 rounded-full transition relative ${autoEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            aria-label="Toggle backup otomatis"
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${
                autoEnabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Aksi Utama */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Aksi Backup</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleBackupNow(false)}
            disabled={backingUp}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {backingUp ? (
              <>
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Memproses...
              </>
            ) : (
              <>💾 Backup Sekarang</>
            )}
          </button>
          <button
            onClick={handleExportAll}
            disabled={backingUp}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition"
          >
            📥 Download Semua Data (.json)
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Backup disimpan di browser (localStorage) hingga 10 snapshot terakhir. Download untuk menyimpan salinan permanen.
        </p>
      </div>

      {/* Riwayat Backup */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Riwayat Backup</h2>

        {history.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">🗄️</div>
            <p className="text-gray-500">Belum ada backup. Klik tombol Backup Sekarang untuk memulai.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((record) => (
              <div
                key={record.id}
                className="border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${record.auto ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {record.auto ? 'Otomatis' : 'Manual'}
                    </span>
                    <span className="font-semibold text-sm text-gray-800 truncate">
                      {formatDate(record.date)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(record.size / 1024).toFixed(1)} KB • {Object.keys(record.data || {}).length} tabel
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(record)}
                    disabled={restoring}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    {restoring ? 'Restoring...' : '♻️ Restore'}
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(record.id)}
                    className="bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

