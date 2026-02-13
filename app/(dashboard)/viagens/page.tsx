import { createClient } from "@/lib/supabase/server"
import { ViagensClient } from "./viagens-client"

export default async function ViagensPage() {
  const supabase = await createClient()
  
  // Fetch viagens with all relationships
  const { data: viagens } = await supabase
    .from("viagens")
    .select("*, cliente:clientes(*), veiculo:veiculos(*), motorista:motoristas(*), rota:rotas(*)")
    .order("data_inicio", { ascending: false })

  // Fetch rota_postos relationships and postos for all rotas
  const rotaIds = viagens?.map(v => v.rota_id).filter(Boolean) || []
  const { data: rotaPostos } = await supabase
    .from("rota_postos")
    .select("rota_id, posto:postos_abastecimento(*), ordem")
    .in("rota_id", rotaIds)
    .order("ordem")

  // Build a map of rota_id -> postos[]
  const rotaPostosMap = new Map()
  rotaPostos?.forEach((rp: any) => {
    if (!rotaPostosMap.has(rp.rota_id)) {
      rotaPostosMap.set(rp.rota_id, [])
    }
    rotaPostosMap.get(rp.rota_id).push(rp.posto)
  })

  // Attach postos to viagens
  const viagensWithPostos = viagens?.map(v => ({
    ...v,
    rota: v.rota ? { ...v.rota, postos: rotaPostosMap.get(v.rota_id) || [] } : null
  }))

  const [clientesRes, veiculosRes, motoristasRes, rotasRes] = await Promise.all([
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("veiculos").select("*").order("placa_cavalo"),
    supabase.from("motoristas").select("*").order("nome"),
    supabase.from("rotas").select("*").order("nome"),
  ])

  return (
    <ViagensClient 
      initialViagens={viagensWithPostos || []}
      clientes={clientesRes.data || []}
      veiculos={veiculosRes.data || []}
      motoristas={motoristasRes.data || []}
      rotas={rotasRes.data || []}
    />
  )
}
