// app/(dashboard)/cadastros/motorista-comissoes/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MotoristaComissoesClient } from './motorista-comissoes-client'

export default async function MotoristaComissoesPage() {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comissões de Motoristas</h1>
          <p className="page-subtitle">Defina percentuais de comissão por motorista</p>
        </div>
      </div>
      <MotoristaComissoesClient userId={user.id} />
    </div>
  )
}
