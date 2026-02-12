import { createClient } from "@/lib/supabase/server"
import { AdvancedDashboardCharts } from "@/components/advanced-dashboard-charts"

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthLabel(date: Date) {
  return date
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
}

export default async function DashboardAnaliticoPage() {
  const supabase = await createClient()

  const now = new Date()
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [viagensRes, custosRes] = await Promise.all([
    supabase
      .from("viagens")
      .select("id, data_inicio, valor_frete, km_real, volume_toneladas, status, cliente:clientes(nome), rota:rotas(nome)")
      .gte("data_inicio", rangeStart.toISOString())
      .lte("data_inicio", rangeEnd.toISOString()),
    supabase
      .from("custos_viagem")
      .select("data, categoria, valor")
      .gte("data", rangeStart.toISOString().split("T")[0])
      .lte("data", rangeEnd.toISOString().split("T")[0]),
  ])

  const viagens = viagensRes.data || []
  const custos = custosRes.data || []

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    return {
      key: monthKey(date),
      label: formatMonthLabel(date),
    }
  })

  const revenueByMonth = new Map(months.map((m) => [m.key, 0]))
  const costsByMonth = new Map(months.map((m) => [m.key, 0]))
  const tripsByMonth = new Map(months.map((m) => [m.key, 0]))
  const kmByMonth = new Map(months.map((m) => [m.key, 0]))
  const volumeByMonth = new Map(months.map((m) => [m.key, 0]))

  viagens.forEach((viagem) => {
    if (!viagem.data_inicio) return
    const key = monthKey(new Date(viagem.data_inicio))
    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + (viagem.valor_frete || 0))
    tripsByMonth.set(key, (tripsByMonth.get(key) || 0) + 1)
    kmByMonth.set(key, (kmByMonth.get(key) || 0) + (viagem.km_real || 0))
    volumeByMonth.set(key, (volumeByMonth.get(key) || 0) + (viagem.volume_toneladas || 0))
  })

  custos.forEach((custo) => {
    if (!custo.data) return
    const key = monthKey(new Date(custo.data))
    costsByMonth.set(key, (costsByMonth.get(key) || 0) + (custo.valor || 0))
  })

  const monthlySeries = months.map((month) => ({
    month: month.label,
    faturamento: revenueByMonth.get(month.key) || 0,
    custos: costsByMonth.get(month.key) || 0,
  }))

  const tripsSeries = months.map((month) => ({
    month: month.label,
    viagens: tripsByMonth.get(month.key) || 0,
  }))

  const ticketSeries = months.map((month) => {
    const trips = tripsByMonth.get(month.key) || 0
    const revenue = revenueByMonth.get(month.key) || 0
    return {
      month: month.label,
      ticket: trips > 0 ? revenue / trips : 0,
    }
  })

  const kmSeries = months.map((month) => {
    const trips = tripsByMonth.get(month.key) || 0
    const km = kmByMonth.get(month.key) || 0
    return {
      month: month.label,
      km_medio: trips > 0 ? km / trips : 0,
    }
  })

  const volumeSeries = months.map((month) => ({
    month: month.label,
    volume: volumeByMonth.get(month.key) || 0,
  }))

  const margemSeries = months.map((month) => ({
    month: month.label,
    margem: (revenueByMonth.get(month.key) || 0) - (costsByMonth.get(month.key) || 0),
  }))

  const custosPorCategoria = custos.reduce((acc, c) => {
    const categoria = c.categoria || "Outros"
    acc[categoria] = (acc[categoria] || 0) + (c.valor || 0)
    return acc
  }, {} as Record<string, number>)

  const pieSeries = Object.entries(custosPorCategoria).map(([categoria, valor]) => ({
    categoria,
    valor,
  }))

  const statusSeries = Object.entries(
    viagens.reduce((acc, v) => {
      const status = v.status || "Planejada"
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  ).map(([status, valor]) => ({ status, valor }))

  const faturamentoTotal = viagens.reduce((sum, v) => sum + (v.valor_frete || 0), 0)
  const custosTotal = custos.reduce((sum, c) => sum + (c.valor || 0), 0)
  const lucro = faturamentoTotal - custosTotal

  const waterfallSeries = [
    { etapa: "Faturamento", base: 0, valor: faturamentoTotal },
    { etapa: "Custos", base: faturamentoTotal, valor: -custosTotal },
    { etapa: "Lucro", base: 0, valor: lucro },
  ]

  const stackedMonths = months.slice(-4)
  const categoryOrder = ["Diesel", "Pedagio", "Diarias", "Comissao", "Arla", "Outros"]
  const stackedCategories = Array.from(
    new Set([
      ...categoryOrder,
      ...custos.map((c) => c.categoria || "Outros"),
    ]),
  )

  const custosPorMesECategoria = custos.reduce((acc, c) => {
    if (!c.data) return acc
    const key = monthKey(new Date(c.data))
    if (!acc[key]) acc[key] = {}
    const categoria = c.categoria || "Outros"
    acc[key][categoria] = (acc[key][categoria] || 0) + (c.valor || 0)
    return acc
  }, {} as Record<string, Record<string, number>>)

  const stackedSeries = stackedMonths.map((month) => {
    const monthData = custosPorMesECategoria[month.key] || {}
    const base: Record<string, number | string> = { month: month.label }
    stackedCategories.forEach((categoria) => {
      base[categoria] = monthData[categoria] || 0
    })
    return base
  })

  const topClients = Object.entries(
    viagens.reduce((acc, v) => {
      const nome = v.cliente?.nome || "Sem cliente"
      acc[nome] = (acc[nome] || 0) + (v.valor_frete || 0)
      return acc
    }, {} as Record<string, number>),
  )
    .map(([cliente, valor]) => ({ cliente, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  const topRoutes = Object.entries(
    viagens.reduce((acc, v) => {
      const nome = v.rota?.nome || "Rota avulsa"
      acc[nome] = (acc[nome] || 0) + (v.valor_frete || 0)
      return acc
    }, {} as Record<string, number>),
  )
    .map(([rota, valor]) => ({ rota, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Analitico</h1>
        <p className="text-muted-foreground">
          Analise visual dos ultimos 6 meses
        </p>
      </div>

      <AdvancedDashboardCharts
        monthlySeries={monthlySeries}
        pieSeries={pieSeries}
        waterfallSeries={waterfallSeries}
        stackedSeries={stackedSeries}
        stackedCategories={stackedCategories}
        topClients={topClients}
        tripsSeries={tripsSeries}
        ticketSeries={ticketSeries}
        kmSeries={kmSeries}
        volumeSeries={volumeSeries}
        margemSeries={margemSeries}
        statusSeries={statusSeries}
        topRoutes={topRoutes}
      />
    </div>
  )
}
