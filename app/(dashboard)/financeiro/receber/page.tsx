import { createClient } from "@/lib/supabase/server"
import { ContasReceberClient } from "./receber-client"

export default async function ContasReceberPage() {
  const supabase = await createClient()
  
  const [contasRes, clientesRes, viagensRes] = await Promise.all([
    supabase
      .from("contas_receber")
      .select("*, cliente:clientes(*), viagem:viagens(*)")
      .order("data_vencimento", { ascending: true }),
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("viagens").select("*").order("data_inicio", { ascending: false }),
  ])

  return (
    <ContasReceberClient 
      initialContas={contasRes.data || []}
      clientes={clientesRes.data || []}
      viagens={viagensRes.data || []}
    />
  )
}
