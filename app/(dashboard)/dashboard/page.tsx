import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { Truck, Calendar, DollarSign, CheckCircle2, Route, TrendingUp, ArrowRight, Clock } from "lucide-react"
import Link from "next/link"

function normalizeStatus(s?: string | null) {
  if (!s) return "Planejada"
  if (s === "Concluída" || s === "Concluida") return "Concluida"
  if (s === "Em andamento") return "Em andamento"
  if (s === "Cancelada") return "Cancelada"
  return "Planejada"
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

const statusCfg: Record<string, { label: string; bg: string; text: string }> = {
  "Em andamento": { label: "Em andamento", bg: "bg-blue-100",    text: "text-blue-700"    },
  Planejada:      { label: "Planejada",    bg: "bg-slate-100",   text: "text-slate-600"   },
  Concluida:      { label: "Concluída",    bg: "bg-emerald-100", text: "text-emerald-700" },
  Cancelada:      { label: "Cancelada",    bg: "bg-rose-100",    text: "text-rose-700"    },
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const { data: viagensRaw } = await supabase
    .from("viagens")
    .select("id, status, valor_frete, data_inicio, data_fim, origem_real, destino_real, tipo_carga, cliente:clientes(nome), motorista:motoristas(nome), veiculo:veiculos(placa_cavalo)")
    .gte("data_inicio", sixMonthsAgo.toISOString())
    .order("data_inicio", { ascending: false })

  const viagens: any[] = viagensRaw ?? []

  const emAndamento  = viagens.filter((v: any) => normalizeStatus(v.status) === "Em andamento")
  const planejadas   = viagens.filter(v => normalizeStatus(v.status) === "Planejada")
  const concluidas   = viagens.filter(v => normalizeStatus(v.status) === "Concluida")
  const faturamentoMes = viagens
    .filter(v => v.data_inicio && new Date(v.data_inicio) >= monthStart)
    .reduce((s, v) => s + (v.valor_frete || 0), 0)
  const faturamentoTotal = viagens.reduce((s, v) => s + (v.valor_frete || 0), 0)
  const taxaConclusao = viagens.length > 0 ? Math.round((concluidas.length / viagens.length) * 100) : 0

  const kpis = [
    { label: "Em Andamento",   value: String(emAndamento.length),        sub: "viagens activas",        icon: Truck,        bg: "bg-blue-50 border-blue-100",     color: "bg-blue-500",    text: "text-blue-700"    },
    { label: "Planejadas",     value: String(planejadas.length),          sub: "aguardando início",      icon: Calendar,     bg: "bg-amber-50 border-amber-100",   color: "bg-amber-500",   text: "text-amber-700"   },
    { label: "Faturamento",    value: formatCurrency(faturamentoMes),     sub: "receita neste mês",      icon: DollarSign,   bg: "bg-emerald-50 border-emerald-100", color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Taxa Conclusão", value: `${taxaConclusao}%`,                sub: `${concluidas.length} de ${viagens.length}`, icon: CheckCircle2, bg: "bg-violet-50 border-violet-100", color: "bg-violet-500",  text: "text-violet-700"  },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel</h1>
          <p className="page-subtitle">{now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Link href="/viagens" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
          Ver viagens <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Link key={kpi.label} href="/viagens" className={`kpi-card border card-interactive group ${kpi.bg}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`h-9 w-9 rounded-lg ${kpi.color} flex items-center justify-center shadow-sm`}>
                <kpi.icon className="h-[18px] w-[18px] text-white" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="kpi-card-value tabular">{kpi.value}</p>
            <p className={`text-xs font-semibold mt-1 ${kpi.text}`}>{kpi.label}</p>
            <p className="kpi-card-label mt-0.5">{kpi.sub}</p>
          </Link>
        ))}
      </div>

      {/* Faturamento total */}
      <div className="kpi-card border border-emerald-200 bg-emerald-50 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="kpi-card-label">Faturamento Total</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatCurrency(faturamentoTotal)}</p>
          <p className="text-xs text-muted-foreground">últimos 6 meses · {viagens.length} viagens</p>
        </div>
        <Link href="/financeiro/receber" className="ml-auto shrink-0 text-xs font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
          Financeiro <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Viagens recentes */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Viagens Recentes</h2>
          </div>
          <Link href="/viagens" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {viagens.slice(0, 8).length > 0 ? (
          <div className="divide-y divide-border/50">
            {viagens.slice(0, 8).map((v: any) => {
              const st = normalizeStatus(v.status)
              const cfg = statusCfg[st] || statusCfg["Planejada"]
              const rota = [v.origem_real, v.destino_real].filter(Boolean).join(" → ")
              return (
                <Link
                  key={v.id}
                  href="/viagens"
                  className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      {v.cliente?.nome && <span className="text-sm font-medium text-foreground truncate">{v.cliente.nome}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {rota || v.tipo_carga || "—"}
                      {v.motorista?.nome && ` · ${v.motorista.nome.split(" ")[0]}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm font-semibold tabular-nums">{v.valor_frete ? formatCurrency(v.valor_frete) : "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(v.data_inicio)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Route className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma viagem nos últimos 6 meses</p>
            <Link href="/viagens" className="mt-3 inline-flex text-sm text-primary font-medium">
              Criar viagem →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
