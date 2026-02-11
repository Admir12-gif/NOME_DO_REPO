import { createClient } from "@/lib/supabase/server"
import { ContasPagarClient } from "./pagar-client"

export default async function ContasPagarPage() {
  const supabase = await createClient()
  
  const [contasRes, motoristasRes] = await Promise.all([
    supabase
      .from("contas_pagar")
      .select("*, motorista:motoristas(*)")
      .order("data_vencimento", { ascending: true }),
    supabase.from("motoristas").select("*").order("nome"),
  ])

  return (
    <ContasPagarClient 
      initialContas={contasRes.data || []}
      motoristas={motoristasRes.data || []}
    />
  )
}
