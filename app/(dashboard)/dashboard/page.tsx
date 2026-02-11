import { createClient } from "@/lib/supabase/server"
import { DashboardKPIs } from "@/components/dashboard-kpis"
import { DashboardCharts } from "@/components/dashboard-charts"
import { RecentTrips } from "@/components/recent-trips"
import { FinancialSummary } from "@/components/financial-summary"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current month date range
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  // Fetch dashboard data
  const [
    viagensRes,
    custosRes,
    contasReceberRes,
    contasPagarRes,
    veiculosRes,
    abastecimentosRes,
  ] = await Promise.all([
    supabase
      .from("viagens")
      .select("*, cliente:clientes(*), veiculo:veiculos(*), motorista:motoristas(*)")
      .gte("data_inicio", startOfMonth)
      .lte("data_inicio", endOfMonth)
      .order("data_inicio", { ascending: false }),
    supabase
      .from("custos_viagem")
      .select("*")
      .gte("data", startOfMonth.split("T")[0])
      .lte("data", endOfMonth.split("T")[0]),
    supabase
      .from("contas_receber")
      .select("*")
      .eq("status", "Em aberto"),
    supabase
      .from("contas_pagar")
      .select("*")
      .eq("status", "Em aberto"),
    supabase
      .from("veiculos")
      .select("*"),
    supabase
      .from("abastecimentos")
      .select("*")
      .gte("data", startOfMonth.split("T")[0])
      .lte("data", endOfMonth.split("T")[0]),
  ])

  const viagens = viagensRes.data || []
  const custos = custosRes.data || []
  const contasReceber = contasReceberRes.data || []
  const contasPagar = contasPagarRes.data || []
  const veiculos = veiculosRes.data || []
  const abastecimentos = abastecimentosRes.data || []

  // Calculate KPIs
  const faturamentoMes = viagens.reduce((sum, v) => sum + (v.valor_frete || 0), 0)
  const custosTotais = custos.reduce((sum, c) => sum + (c.valor || 0), 0)
  const lucroLiquido = faturamentoMes - custosTotais
  const margemOperacional = faturamentoMes > 0 ? (lucroLiquido / faturamentoMes) * 100 : 0
  const viagensMes = viagens.length
  const kmRodados = viagens.reduce((sum, v) => sum + (v.km_real || 0), 0)
  const litrosTotais = abastecimentos.reduce((sum, a) => sum + (a.litros || 0), 0)
  const mediaKmLitro = litrosTotais > 0 ? kmRodados / litrosTotais : 0
  const contasReceberTotal = contasReceber.reduce((sum, c) => sum + (c.valor || 0), 0)
  const contasPagarTotal = contasPagar.reduce((sum, c) => sum + (c.valor || 0), 0)

  const kpis = {
    faturamento_mes: faturamentoMes,
    lucro_liquido: lucroLiquido,
    margem_operacional: margemOperacional,
    viagens_mes: viagensMes,
    km_rodados: kmRodados,
    media_km_litro: mediaKmLitro,
    contas_receber_total: contasReceberTotal,
    contas_pagar_total: contasPagarTotal,
    veiculos_ativos: veiculos.length,
    manutencoes_pendentes: 0,
  }

  // Prepare chart data - costs by category
  const custosPorCategoria = custos.reduce((acc, c) => {
    acc[c.categoria] = (acc[c.categoria] || 0) + c.valor
    return acc
  }, {} as Record<string, number>)

  const chartData = Object.entries(custosPorCategoria).map(([categoria, valor]) => ({
    categoria,
    valor,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
        <p className="text-muted-foreground">
          Visao geral do mes de {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>

      <DashboardKPIs kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCharts data={chartData} />
        <FinancialSummary 
          contasReceber={contasReceber} 
          contasPagar={contasPagar} 
        />
      </div>

      <RecentTrips viagens={viagens.slice(0, 5)} />
    </div>
  )
}
