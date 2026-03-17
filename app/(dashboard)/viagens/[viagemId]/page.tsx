import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { ViagemDetalheClient } from "./viagemDetalheClient"

interface ViagemDetalhePageProps {
  params: Promise<{ viagemId: string }>
}

export default async function ViagemDetalhePage({ params }: ViagemDetalhePageProps) {
  const { viagemId } = await params
  const supabase = await createClient()

  const [
    viagemRes,
    eventosRes,
    custosRes,
    receitasRes,
    documentosRes,
    parametrosRes,
    subViagensRes,
  ] = await Promise.all([
    supabase
      .from("viagens")
      .select("*, cliente:clientes(*), veiculo:veiculos(*), motorista:motoristas(*), rota:rotas(*)")
      .eq("id", viagemId)
      .single(),
    supabase
      .from("viagem_eventos")
      .select("*")
      .eq("viagem_id", viagemId)
      .order("ocorrido_em", { ascending: false }),
    supabase
      .from("custos_viagem")
      .select("*")
      .eq("viagem_id", viagemId)
      .order("data", { ascending: false }),
    supabase
      .from("receitas_viagem")
      .select("*")
      .eq("viagem_id", viagemId)
      .order("data", { ascending: false }),
    supabase
      .from("viagem_documentos")
      .select("*")
      .eq("viagem_id", viagemId)
      .order("created_at", { ascending: false }),
    supabase
      .from("eta_parametros")
      .select("*")
      .eq("ativo", true),
    supabase
      .from("viagens")
      .select("id, data_inicio, data_fim, status")
      .eq("viagem_pai_id", viagemId)
      .order("data_inicio", { ascending: false }),
  ])

  if (!viagemRes.data) {
    notFound()
  }

  return (
    <ViagemDetalheClient
      viagem={viagemRes.data}
      initialEventos={eventosRes.data || []}
      initialCustos={custosRes.data || []}
      initialReceitas={receitasRes.data || []}
      initialDocumentos={documentosRes.data || []}
      etaParametros={parametrosRes.data || []}
      initialSubViagens={subViagensRes.data || []}
    />
  )
}
