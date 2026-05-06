import { createClient } from "@/lib/supabase/server"
import { DashboardFilters } from "@/components/dashboard-filters"
import { DashboardAlerts } from "@/components/dashboard-alerts"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Truck,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Route,
  Calendar,
  DollarSign,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

function normalizeViagemStatus(status?: string | null) {
  if (!status) return "Planejada"
  if (status === "Concluída") return "Concluida"
  return status
}

type DashboardSearchParams = {
  period?: string
  from?: string
  to?: string
  status?: string
  cliente?: string
  rota?: string
  carreta?: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const period = params.period || "6m"
  const statusFilter = params.status || ""

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const { data: viagens = [] } = await supabase
    .from("viagens")
    .select(`id, status, valor_frete, eta_destino_em, atraso_estimado_minutos, data_inicio, data_fim, origem_real, destino_real, tipo_carga,
      cliente:clientes(nome), motorista:motoristas(nome), veiculo:veiculos(placa_cavalo)`)
    .gte("data_inicio", sixMonthsAgo.toISOString())
    .lte("data_inicio", now.toISOString())
    .order("data_inicio", { ascending: false })

  const viagensEmAndamento = viagens.filter((v) => normalizeViagemStatus(v.status) === "Em andamento")
  const viagensPlanejadas = viagens.filter((v) => normalizeViagemStatus(v.status) === "Planejada")
  const viagensConcluidas = viagens.filter((v) => normalizeViagemStatus(v.status) === "Concluida")

  const proximoEta = viagensEmAndamento
    .filter((v) => v.eta_destino_em)
    .sort((a, b) => new Date(a.eta_destino_em || 0).getTime() - new Date(b.eta_destino_em || 0).getTime())[0]

  const comAtraso = viagensEmAndamento.filter((v) => (v.atraso_estimado_minutos || 0) > 0)
  const atrasoMedioMin = comAtraso.length > 0
    ? Math.round(comAtraso.reduce((sum, v) => sum + (v.atraso_estimado_minutos || 0), 0) / comAtraso.length)
    : 0

  const faturamentoTotal = viagens.reduce((sum, v) => sum + (v.valor_frete || 0), 0)
  const faturamentoMes = viagens
    .filter((v) => v.data_inicio && new Date(v.data_inicio) >= thisMonthStart)
    .reduce((sum, v) => sum + (v.valor_frete || 0), 0)

  const taxaConclusao = viagens.length > 0
    ? Math.round((viagensConcluidas.length / viagens.length) * 100)
    : 0

  const recentes = viagens.slice(0, 6)

  const kpis = [
    {
      label: "Em Andamento",
      value: viagensEmAndamento.length,
      icon: Truck,
      color: "bg-blue-500",
      bg: "bg-blue-50 border-blue-100",
      textColor: "text-blue-700",
      sub: "viagens ativas agora",
      href: "/viagens",
    },
    {
      label: "Planejadas",
      value: viagensPlanejadas.length,
      icon: Calendar,
      color: "bg-amber-500",
      bg: "bg-amber-50 border-amber-100",
      textColor: "text-amber-700",
      sub: "aguardando início",
      href: "/viagens",
    },
    {
      label: "Faturamento do Mês",
      value: formatCurrency(faturamentoMes),
      icon: DollarSign,
      color: "bg-emerald-500",
      bg: "bg-emerald-50 border-emerald-100",
      textColor: "text-emerald-700",
      sub: "receita no mês atual",
      href: "/financeiro/receber",
    },
    {
      label: "Taxa de Conclusão",
      value: `${taxaConclusao}%`,
      icon: CheckCircle2,
      color: "bg-violet-500",
      bg: "bg-violet-50 border-violet-100",
      textColor: "text-violet-700",
      sub: `${viagensConcluidas.length} de ${viagens.length} viagens`,
      href: "/viagens",
    },
  ]

  const statusConfig: Record<string, { label: string; className: string }> = {
    "Em andamento": { label: "Em Andamento", className: "badge-andamento" },
    Planejada: { label: "Planejada", className: "badge-planejada" },
    Concluida: { label: "Concluída", className: "badge-concluida" },
    Cancelada: { label: "Cancelada", className: "badge-cancelada" },
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel Operacional</h1>
          <p className="page-subtitle">
            {sixMonthsAgo.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
            {" — "}
            {now.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <Link
          href="/viagens"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Ver todas as viagens
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Filters */}
      <DashboardFilters period={period} />

      {/* Alerts */}
      {user && <DashboardAlerts userId={user.id} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className={`kpi-card border card-interactive group ${kpi.bg}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`h-9 w-9 rounded-lg ${kpi.color} flex items-center justify-center shadow-sm`}>
                <kpi.icon className="h-4.5 w-4.5 text-white h-[18px] w-[18px]" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="kpi-card-value tabular">{kpi.value}</p>
            <p className={`text-xs font-semibold mt-1 ${kpi.textColor}`}>{kpi.label}</p>
            <p className="kpi-card-label mt-0.5">{kpi.sub}</p>
          </Link>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Próximo ETA */}
        <div className="kpi-card border border-border/60 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="kpi-card-label">Próximo ETA</p>
            <p className="text-base font-bold text-foreground tabular truncate">
              {proximoEta ? formatDate(proximoEta.eta_destino_em) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">próxima chegada esperada</p>
          </div>
        </div>

        {/* Atraso médio */}
        <div className={`kpi-card border flex items-center gap-4 ${atrasoMedioMin > 0 ? "border-amber-200 bg-amber-50" : "border-border/60"}`}>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${atrasoMedioMin > 0 ? "bg-amber-500" : "bg-muted"}`}>
            <AlertTriangle className={`h-5 w-5 ${atrasoMedioMin > 0 ? "text-white" : "text-muted-foreground"}`} />
          </div>
          <div className="min-w-0">
            <p className="kpi-card-label">Atraso Médio</p>
            <p className={`text-base font-bold tabular ${atrasoMedioMin > 0 ? "text-amber-700" : "text-foreground"}`}>
              {atrasoMedioMin > 0 ? `+${atrasoMedioMin} min` : "No prazo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {comAtraso.length} viagem(ns) atrasada(s)
            </p>
          </div>
        </div>

        {/* Faturamento total */}
        <div className="kpi-card border border-emerald-200 bg-emerald-50 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="kpi-card-label">Faturamento Total</p>
            <p className="text-base font-bold text-emerald-700 tabular truncate">
              {formatCurrency(faturamentoTotal)}
            </p>
            <p className="text-xs text-muted-foreground">últimos 6 meses</p>
          </div>
        </div>
      </div>

      {/* Recent Trips */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Viagens Recentes</h2>
          </div>
          <Link href="/viagens" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1">
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentes.length > 0 ? (
          <div className="divide-y divide-border/60">
            {recentes.map((v: any) => {
              const statusNorm = normalizeViagemStatus(v.status)
              const config = statusConfig[statusNorm] || { label: statusNorm, className: "badge-planejada" }

              return (
                <Link
                  key={v.id}
                  href={`/viagens/${v.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {v.tipo_carga || "—"}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${config.className} flex-shrink-0`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {v.origem_real || "—"} → {v.destino_real || "—"}
                      {v.motorista?.nome && ` · ${v.motorista.nome}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-sm font-semibold text-foreground tabular">
                      {v.valor_frete ? formatCurrency(v.valor_frete) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(v.data_inicio)}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Route className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma viagem no período</p>
          </div>
        )}
      </div>
    </div>
  )
}
