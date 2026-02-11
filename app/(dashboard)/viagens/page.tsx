import { createClient } from "@/lib/supabase/server"
import { ViagensClient } from "./viagens-client"

export default async function ViagensPage() {
  const supabase = await createClient()
  
  const [viagensRes, clientesRes, veiculosRes, motoristasRes, rotasRes] = await Promise.all([
    supabase
      .from("viagens")
      .select("*, cliente:clientes(*), veiculo:veiculos(*), motorista:motoristas(*), rota:rotas(*)")
      .order("data_inicio", { ascending: false }),
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("veiculos").select("*").order("placa_cavalo"),
    supabase.from("motoristas").select("*").order("nome"),
    supabase.from("rotas").select("*").order("nome"),
  ])

  return (
    <ViagensClient 
      initialViagens={viagensRes.data || []}
      clientes={clientesRes.data || []}
      veiculos={veiculosRes.data || []}
      motoristas={motoristasRes.data || []}
      rotas={rotasRes.data || []}
    />
  )
}
