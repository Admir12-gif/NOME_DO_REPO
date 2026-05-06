// app/(dashboard)/financeiro/acerto-caixa/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AcertoCaixaClient } from './acerto-caixa-client'

export default async function AcertoCaixaPage() {
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
          <h1 className="page-title">Acerto de Caixa</h1>
          <p className="page-subtitle">Reconciliação de contas e controle do fluxo de caixa</p>
        </div>
      </div>
      <AcertoCaixaClient userId={user.id} />
    </div>
  )
}
