import { createClient } from "@/lib/supabase/server"
import { AdvancedDashboardCharts } from "@/components/advanced-dashboard-charts"
import { DashboardFilters } from "@/components/dashboard-filters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthLabel(date: Date) {
  return date
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
}

function normalizeViagemStatus(status?: string | null) {
  if (!status) return "Planejada"
  if (status === "Concluída") return "Concluida"
  return status
}

function normalizeCategoria(categoria?: string | null) {
  if (!categoria) return "Outros"

  const normalized = categoria
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

  if (normalized === "diesel") return "Diesel"
  if (normalized === "pedagio") return "Pedagio"
  if (normalized === "diarias") return "Diarias"
  if (normalized === "comissao" || normalized === "comissao motorista") return "Comissao"
  if (normalized === "arla") return "Arla"
  return "Outros"
}

function getJoinedSingle<T>(record: T | T[] | null | undefined): T | null {
  if (!record) return null
  return Array.isArray(record) ? record[0] || null : record
}

function parseDateValue(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function diffHours(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

function formatHours(value: number) {
  if (!Number.isFinite(value)) return "-"
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

interface PlanejamentoIntermediario {
  cidade?: string | null
  estado?: string | null
  chegada_planejada?: string | null
  chegada_real?: string | null
}

interface PlanejamentoRota {
  origem_partida_planejada?: string | null
  origem_partida_real?: string | null
  destino_chegada_planejada?: string | null
  destino_chegada_real?: string | null
  intermediarios?: PlanejamentoIntermediario[] | null
}

interface SegmentPoint {
  label: string
  planned: Date | null
  real: Date | null
}

type DashboardSearchParams = {
  period?: string
  from?: string
  to?: string
  status?: string
  cliente?: string
  rota?: string
  carreta?: string
  [key: string]: string | undefined
}

function readSearchParam(
  params: DashboardSearchParams,
  key: keyof DashboardSearchParams,
) {
  const value = params[key]
  return typeof value === "string" ? value : ""
}

function toIsoStart(dateText?: string | null) {
  if (!dateText) return null
  const date = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toIsoEnd(dateText?: string | null) {
  if (!dateText) return null
  const date = new Date(`${dateText}T23:59:59.999`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function buildMonthRange(start: Date, end: Date) {
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1)
  const monthEnd = new Date(end.getFullYear(), end.getMonth(), 1)
  const list: { key: string; label: string }[] = []

  const cursor = new Date(monthStart)
  while (cursor <= monthEnd) {
    list.push({
      key: monthKey(cursor),
      label: formatMonthLabel(cursor),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  if (list.length === 0) {
    list.push({
      key: monthKey(new Date()),
      label: formatMonthLabel(new Date()),
    })
  }

  return list
}

function getPeriodWindow(period: string, customFrom?: string, customTo?: string) {
  const now = new Date()

  if (period === "custom") {
    const fromIso = toIsoStart(customFrom)
    const toIso = toIsoEnd(customTo)
    if (fromIso && toIso) {
      return {
        start: new Date(fromIso),
        end: new Date(toIso),
        label: `${new Date(fromIso).toLocaleDateString("pt-BR")} até ${new Date(toIso).toLocaleDateString("pt-BR")}`,
      }
    }
  }

  const periodDays: Record<string, number> = {
    "30d": 30,
    "90d": 90,
  }

  if (period in periodDays) {
    const start = new Date(now)
    start.setDate(now.getDate() - periodDays[period])
    return {
      start,
      end: now,
      label: `Últimos ${periodDays[period]} dias`,
    }
  }

  const periodMonths: Record<string, number> = {
    "6m": 6,
    "12m": 12,
  }
  const months = periodMonths[period] || 6
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  return {
    start,
    end,
    label: `Últimos ${months} meses`,
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const period = readSearchParam(params, "period") || "6m"
  const from = readSearchParam(params, "from")
  const to = readSearchParam(params, "to")
  const statusFilter = readSearchParam(params, "status")
  const clienteIdFilter = readSearchParam(params, "cliente")
  const rotaIdFilter = readSearchParam(params, "rota")
  const carretaIdFilter = readSearchParam(params, "carreta")

  const { start: rangeStart, end: rangeEnd, label: periodLabel } = getPeriodWindow(period, from, to)

  const [clientesRes, rotasRes, veiculosRes] = await Promise.all([
    supabase.from("clientes").select("id, nome").order("nome", { ascending: true }),
    supabase.from("rotas").select("id, nome").order("nome", { ascending: true }),
    supabase.from("veiculos").select("id, placa_cavalo, placa_carreta").order("placa_cavalo", { ascending: true }),
  ])

  let viagensQuery = supabase
    .from("viagens")
    .select("id, cliente_id, rota_id, veiculo_id, data_inicio, data_fim, valor_frete, km_real, volume_toneladas, status, eta_destino_em, atraso_estimado_minutos, planejamento_rota, cliente:clientes(nome), rota:rotas(nome, km_planejado), veiculo:veiculos(placa_cavalo, placa_carreta)")
    .gte("data_inicio", rangeStart.toISOString())
    .lte("data_inicio", rangeEnd.toISOString())

  if (statusFilter) {
    if (statusFilter === "Concluida") {
      viagensQuery = viagensQuery.in("status", ["Concluida", "Concluída"])
    } else {
      viagensQuery = viagensQuery.eq("status", statusFilter)
    }
  }
  if (clienteIdFilter) viagensQuery = viagensQuery.eq("cliente_id", clienteIdFilter)
  if (rotaIdFilter) viagensQuery = viagensQuery.eq("rota_id", rotaIdFilter)
  if (carretaIdFilter) viagensQuery = viagensQuery.eq("veiculo_id", carretaIdFilter)

  const viagensRes = await viagensQuery

  const viagens = viagensRes.data || []
  const tripIds = viagens.map((viagem) => viagem.id)
  const tripVehicleIds = Array.from(new Set(viagens.map((viagem) => viagem.veiculo_id).filter(Boolean))) as string[]
  const effectiveVehicleIds = carretaIdFilter ? [carretaIdFilter] : tripVehicleIds
  const hasTripFilters = Boolean(statusFilter || clienteIdFilter || rotaIdFilter || carretaIdFilter)

  let custos: Array<{ data: string | null; categoria: string | null; valor: number | null }> = []
  let abastecimentos: Array<{ litros: number | null; valor_total: number | null }> = []
  let manutencoes: Array<{ custo: number | null }> = []

  if (!hasTripFilters || tripIds.length > 0 || effectiveVehicleIds.length > 0) {
    let custosQuery = supabase
      .from("custos_viagem")
      .select("data, categoria, valor, viagem_id")
      .gte("data", rangeStart.toISOString().split("T")[0])
      .lte("data", rangeEnd.toISOString().split("T")[0])

    if (hasTripFilters) {
      if (tripIds.length > 0) {
        custosQuery = custosQuery.in("viagem_id", tripIds)
      } else {
        custosQuery = null as unknown as typeof custosQuery
      }
    }

    let abastecimentosQuery = supabase
      .from("abastecimentos")
      .select("data, viagem_id, veiculo_id, litros, valor_total")
      .gte("data", rangeStart.toISOString())
      .lte("data", rangeEnd.toISOString())

    if (hasTripFilters) {
      if (tripIds.length > 0) {
        abastecimentosQuery = abastecimentosQuery.in("viagem_id", tripIds)
      } else if (carretaIdFilter) {
        abastecimentosQuery = abastecimentosQuery.eq("veiculo_id", carretaIdFilter)
      } else {
        abastecimentosQuery = null as unknown as typeof abastecimentosQuery
      }
    }
    if (carretaIdFilter && abastecimentosQuery) {
      abastecimentosQuery = abastecimentosQuery.eq("veiculo_id", carretaIdFilter)
    }

    let manutencoesQuery = supabase
      .from("manutencoes")
      .select("data, veiculo_id, custo")
      .gte("data", rangeStart.toISOString().split("T")[0])
      .lte("data", rangeEnd.toISOString().split("T")[0])

    if (hasTripFilters) {
      if (effectiveVehicleIds.length > 0) {
        manutencoesQuery = manutencoesQuery.in("veiculo_id", effectiveVehicleIds)
      } else {
        manutencoesQuery = null as unknown as typeof manutencoesQuery
      }
    }

    const [custosRes, abastecimentosRes, manutencoesRes] = await Promise.all([
      custosQuery ? custosQuery : Promise.resolve({ data: [] as never[] }),
      abastecimentosQuery ? abastecimentosQuery : Promise.resolve({ data: [] as never[] }),
      manutencoesQuery ? manutencoesQuery : Promise.resolve({ data: [] as never[] }),
    ])

    custos = (custosRes.data || []) as Array<{ data: string | null; categoria: string | null; valor: number | null }>
    abastecimentos = (abastecimentosRes.data || []) as Array<{ litros: number | null; valor_total: number | null }>
    manutencoes = (manutencoesRes.data || []) as Array<{ custo: number | null }>
  }

  const months = buildMonthRange(rangeStart, rangeEnd)

  const statusOptions = [
    { value: "Planejada", label: "Planejada" },
    { value: "Em andamento", label: "Em andamento" },
    { value: "Concluida", label: "Concluída" },
    { value: "Cancelada", label: "Cancelada" },
  ]

  const clienteOptions = (clientesRes.data || []).map((cliente) => ({
    value: cliente.id,
    label: cliente.nome || "Sem nome",
  }))
  const rotaOptions = (rotasRes.data || []).map((rota) => ({
    value: rota.id,
    label: rota.nome || "Sem nome",
  }))
  const carretaOptions = (veiculosRes.data || []).map((veiculo) => ({
    value: veiculo.id,
    label: veiculo.placa_carreta || veiculo.placa_cavalo || "Sem placa",
  }))

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

  const custosMensaisPorCategoria: Record<string, Record<string, number>> = {}

  custos.forEach((custo) => {
    if (!custo.data) return
    const key = monthKey(new Date(custo.data))
    const categoria = normalizeCategoria(custo.categoria)
    costsByMonth.set(key, (costsByMonth.get(key) || 0) + (custo.valor || 0))
    if (!custosMensaisPorCategoria[key]) custosMensaisPorCategoria[key] = {}
    custosMensaisPorCategoria[key][categoria] = (custosMensaisPorCategoria[key][categoria] || 0) + (custo.valor || 0)
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
    const categoria = normalizeCategoria(c.categoria)
    acc[categoria] = (acc[categoria] || 0) + (c.valor || 0)
    return acc
  }, {} as Record<string, number>)

  const pieSeries = Object.entries(custosPorCategoria).map(([categoria, valor]) => ({
    categoria,
    valor,
  }))

  const statusSeries = Object.entries(
    viagens.reduce((acc, v) => {
      const status = normalizeViagemStatus(v.status)
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  ).map(([status, valor]) => ({ status, valor }))

  const faturamentoTotal = viagens.reduce((sum, v) => sum + (v.valor_frete || 0), 0)
  const custosViagemTotal = custos.reduce((sum, c) => sum + (c.valor || 0), 0)
  const custoAbastecimentoTotal = abastecimentos.reduce((sum, a) => sum + (a.valor_total || 0), 0)
  const custoManutencaoTotal = manutencoes.reduce((sum, m) => sum + (m.custo || 0), 0)
  const custoOperacionalTotal = custosViagemTotal + custoAbastecimentoTotal + custoManutencaoTotal
  const lucroOperacional = faturamentoTotal - custoOperacionalTotal

  const viagensEmAndamento = viagens.filter((v) => normalizeViagemStatus(v.status) === "Em andamento")
  const comAtraso = viagensEmAndamento.filter((v) => (v.atraso_estimado_minutos || 0) > 0)
  const atrasoMedioMin = comAtraso.length > 0
    ? Math.round(comAtraso.reduce((sum, v) => sum + (v.atraso_estimado_minutos || 0), 0) / comAtraso.length)
    : 0
  const proximosEta = viagensEmAndamento
    .filter((v) => v.eta_destino_em)
    .sort((a, b) => new Date(a.eta_destino_em || 0).getTime() - new Date(b.eta_destino_em || 0).getTime())
    .slice(0, 1)[0]

  const waterfallSeries = [
    { etapa: "Faturamento", base: 0, valor: faturamentoTotal },
    { etapa: "Custos", base: faturamentoTotal, valor: -custoOperacionalTotal },
    { etapa: "Lucro", base: 0, valor: lucroOperacional },
  ]

  const stackedMonths = months.slice(-4)
  const categoryOrder = ["Diesel", "Pedagio", "Diarias", "Comissao", "Arla", "Outros"]
  const stackedCategories = Array.from(
    new Set([
      ...categoryOrder,
      ...custos.map((c) => normalizeCategoria(c.categoria)),
    ]),
  )

  const stackedSeries = stackedMonths.map((month) => {
    const monthData = custosMensaisPorCategoria[month.key] || {}
    const base: { month: string; [key: string]: number | string } = { month: month.label }
    stackedCategories.forEach((categoria) => {
      base[categoria] = monthData[categoria] || 0
    })
    return base
  })

  const topClients = Object.entries(
    viagens.reduce((acc, v) => {
      const cliente = getJoinedSingle(v.cliente)
      const nome = cliente?.nome || "Sem cliente"
      acc[nome] = (acc[nome] || 0) + (v.valor_frete || 0)
      return acc
    }, {} as Record<string, number>),
  )
    .map(([cliente, valor]) => ({ cliente, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  const topRoutes = Object.entries(
    viagens.reduce((acc, v) => {
      const rota = getJoinedSingle(v.rota)
      const nome = rota?.nome || "Rota avulsa"
      acc[nome] = (acc[nome] || 0) + (v.valor_frete || 0)
      return acc
    }, {} as Record<string, number>),
  )
    .map(([rota, valor]) => ({ rota, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  const cicloPorCarreta = Object.entries(
    viagens.reduce((acc, viagem) => {
      if (!viagem.data_inicio || !viagem.data_fim) return acc
      const inicio = parseDateValue(viagem.data_inicio)
      const fim = parseDateValue(viagem.data_fim)
      if (!inicio || !fim || fim <= inicio) return acc
      const veiculo = getJoinedSingle(viagem.veiculo)
      const carreta = veiculo?.placa_carreta || veiculo?.placa_cavalo || "Sem placa"
      if (!acc[carreta]) {
        acc[carreta] = { carreta, totalHoras: 0, viagens: 0 }
      }
      acc[carreta].totalHoras += diffHours(inicio, fim)
      acc[carreta].viagens += 1
      return acc
    }, {} as Record<string, { carreta: string; totalHoras: number; viagens: number }>),
  )
    .map(([, value]) => ({
      carreta: value.carreta,
      mediaHoras: value.viagens > 0 ? value.totalHoras / value.viagens : 0,
      viagens: value.viagens,
    }))
    .sort((a, b) => b.viagens - a.viagens)
    .slice(0, 8)

  const trechoStats = viagens.reduce((acc, viagem) => {
    const planejamento = (viagem.planejamento_rota || null) as PlanejamentoRota | null
    if (!planejamento) return acc

    const points: SegmentPoint[] = [
      {
        label: "Origem",
        planned: parseDateValue(planejamento.origem_partida_planejada),
        real: parseDateValue(planejamento.origem_partida_real || viagem.data_inicio),
      },
    ]

    ;(planejamento.intermediarios || []).forEach((intermediario, index) => {
      const cidade = intermediario?.cidade || `Ponto ${index + 1}`
      const estado = intermediario?.estado ? `/${intermediario.estado}` : ""
      points.push({
        label: `${cidade}${estado}`,
        planned: parseDateValue(intermediario.chegada_planejada),
        real: parseDateValue(intermediario.chegada_real),
      })
    })

    points.push({
      label: "Destino",
      planned: parseDateValue(planejamento.destino_chegada_planejada),
      real: parseDateValue(planejamento.destino_chegada_real || viagem.data_fim),
    })

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]
      const current = points[index]
      const key = `${previous.label} -> ${current.label}`
      if (!acc[key]) {
        acc[key] = { trecho: key, plannedHoras: 0, realHoras: 0, plannedCount: 0, realCount: 0 }
      }
      if (previous.planned && current.planned && current.planned > previous.planned) {
        acc[key].plannedHoras += diffHours(previous.planned, current.planned)
        acc[key].plannedCount += 1
      }
      if (previous.real && current.real && current.real > previous.real) {
        acc[key].realHoras += diffHours(previous.real, current.real)
        acc[key].realCount += 1
      }
    }

    return acc
  }, {} as Record<string, { trecho: string; plannedHoras: number; realHoras: number; plannedCount: number; realCount: number }>)

  const transitoPorTrecho = Object.values(trechoStats)
    .map((item) => {
      const planejadoMedio = item.plannedCount > 0 ? item.plannedHoras / item.plannedCount : null
      const realizadoMedio = item.realCount > 0 ? item.realHoras / item.realCount : null
      const variacaoPerc = planejadoMedio && realizadoMedio
        ? ((realizadoMedio - planejadoMedio) / planejadoMedio) * 100
        : null
      return {
        trecho: item.trecho,
        planejadoMedio,
        realizadoMedio,
        variacaoPerc,
        base: Math.max(item.plannedCount, item.realCount),
      }
    })
    .sort((a, b) => b.base - a.base)
    .slice(0, 8)

  const kmPlanejadoTotal = viagens.reduce((sum, viagem) => {
    const rota = getJoinedSingle(viagem.rota)
    return sum + (rota?.km_planejado || 0)
  }, 0)
  const kmRealTotal = viagens.reduce((sum, viagem) => sum + (viagem.km_real || 0), 0)
  const desvioKm = kmRealTotal - kmPlanejadoTotal
  const eficienciaPlanejadoReal = kmPlanejadoTotal > 0 ? (kmRealTotal / kmPlanejadoTotal) * 100 : 0

  const viagemComDestinoPlanejado = viagens.filter((viagem) => {
    const planejamento = (viagem.planejamento_rota || null) as PlanejamentoRota | null
    return Boolean(planejamento?.destino_chegada_planejada)
  })

  const pontualidadeDestino = viagemComDestinoPlanejado.length > 0
    ? (viagemComDestinoPlanejado.filter((viagem) => {
      const planejamento = (viagem.planejamento_rota || null) as PlanejamentoRota | null
      const planejado = parseDateValue(planejamento?.destino_chegada_planejada || null)
      const realizado = parseDateValue(planejamento?.destino_chegada_real || viagem.data_fim)
      if (!planejado || !realizado) return false
      return realizado <= planejado
    }).length / viagemComDestinoPlanejado.length) * 100
    : 0

  const litrosTotais = abastecimentos.reduce((sum, abastecimento) => sum + (abastecimento.litros || 0), 0)
  const consumoMedioKmLitro = litrosTotais > 0 ? kmRealTotal / litrosTotais : 0
  const custoPorKm = kmRealTotal > 0 ? custoOperacionalTotal / kmRealTotal : 0
  const custoCombustivelPerc = custoOperacionalTotal > 0 ? (custoAbastecimentoTotal / custoOperacionalTotal) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel</h1>
        <p className="text-muted-foreground">
          Visão operacional e analítica integrada de {periodLabel}
        </p>
      </div>

      <DashboardFilters
        period={period}
        from={from}
        to={to}
        status={statusFilter}
        clienteId={clienteIdFilter}
        rotaId={rotaIdFilter}
        carretaId={carretaIdFilter}
        statusOptions={statusOptions}
        clienteOptions={clienteOptions}
        rotaOptions={rotaOptions}
        carretaOptions={carretaOptions}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Viagens em andamento</p>
            <p className="text-2xl font-semibold">{viagensEmAndamento.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ETA mais próximo</p>
            <p className="text-lg font-semibold">
              {proximosEta?.eta_destino_em
                ? new Date(proximosEta.eta_destino_em).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Atraso médio estimado</p>
            <p className={atrasoMedioMin > 0 ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold"}>
              {atrasoMedioMin > 0 ? `+${atrasoMedioMin} min` : "No prazo"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lucro operacional</p>
            <p className={lucroOperacional >= 0 ? "text-2xl font-semibold" : "text-2xl font-semibold text-destructive"}>
              {formatCurrency(lucroOperacional)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">KM planejado</p>
            <p className="text-xl font-semibold">{kmPlanejadoTotal.toLocaleString("pt-BR")} km</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">KM realizado</p>
            <p className="text-xl font-semibold">{kmRealTotal.toLocaleString("pt-BR")} km</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Desvio de KM</p>
            <p className={desvioKm <= 0 ? "text-xl font-semibold" : "text-xl font-semibold text-destructive"}>
              {desvioKm >= 0 ? "+" : ""}{desvioKm.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Realizado vs planejado</p>
            <p className="text-xl font-semibold">{eficienciaPlanejadoReal.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pontualidade no destino</p>
            <p className="text-xl font-semibold">{pontualidadeDestino.toFixed(1)}%</p>
          </CardContent>
        </Card>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Tempo de ciclo por carreta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cicloPorCarreta.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem viagens concluídas com início e fim no período.</p>
            ) : (
              cicloPorCarreta.map((item) => (
                <div key={item.carreta} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium">{item.carreta}</p>
                    <p className="text-xs text-muted-foreground">{item.viagens} viagem(ns)</p>
                  </div>
                  <p className="text-sm font-semibold">{formatHours(item.mediaHoras)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Trânsito médio entre pontos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transitoPorTrecho.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes de planejado/real por trecho.</p>
            ) : (
              transitoPorTrecho.map((item) => (
                <div key={item.trecho} className="rounded-lg border border-border/50 p-3">
                  <p className="text-sm font-medium">{item.trecho}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Planejado: {item.planejadoMedio ? formatHours(item.planejadoMedio) : "-"}</span>
                    <span>Realizado: {item.realizadoMedio ? formatHours(item.realizadoMedio) : "-"}</span>
                    <span>
                      Variação: {item.variacaoPerc !== null
                        ? `${item.variacaoPerc >= 0 ? "+" : ""}${item.variacaoPerc.toFixed(1)}%`
                        : "-"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo por KM</p>
            <p className="text-xl font-semibold">{formatCurrency(custoPorKm)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Consumo médio (km/L)</p>
            <p className="text-xl font-semibold">{consumoMedioKmLitro.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Peso de combustível no custo</p>
            <p className="text-xl font-semibold">{custoCombustivelPerc.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo operacional total</p>
            <p className="text-xl font-semibold">{formatCurrency(custoOperacionalTotal)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
