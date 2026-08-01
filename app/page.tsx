'use client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2"> Kasir Warung</h1>
        <p className="text-gray-600 mb-8">Sistem Kasir Modern & Mudah</p>
        
        <button
          onClick={() => router.push('/login')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105"
        >
           Login
        </button>
        
        <div className="text-sm text-gray-500 mt-6">
          <p>Login sebagai Admin untuk akses semua fitur</p>
        </div>
      </div>
    </div>
  )
}