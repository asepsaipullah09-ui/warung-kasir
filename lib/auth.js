import { supabase } from './supabaseClient'

// Fungsi untuk mendapatkan user yang sedang login beserta role-nya
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Ambil data role dari tabel profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    role: profile?.role,
    full_name: profile?.full_name
  }
}

// Fungsi untuk logout
export async function logout() {
  await supabase.auth.signOut()
}