import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Fuel, Truck } from "lucide-react"

export default async function CustosConsumoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Custos e Consumo</CardTitle>
            <CardDescription>Faça login para acessar os dados.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [abastecimentosData, manutencoesData] = await Promise.all([
    supabase
      .from("abastecimentos")
      .select(`
        id,
        data,
        litros,
        valor_total,
        hodometro,
        veiculo_id,
        veiculo:veiculo_id(id, placa_cavalo),
        posto:posto_id(id, nome)
      `)
      .eq("user_id", user.id)
      .order("data", { ascending: false }),
    supabase
      .from("manutencoes")
      .select(`
        id,
        data,
        custo,
        veiculo_id,
        veiculo:veiculo_id(id, placa_cavalo),
        tipo,
        sistema,
        oficina
      `)
      .eq("user_id", user.id)
      .order("data", { ascending: false }),
  ])

  const rows = abastecimentosData.data || []
  const manutencoes = manutencoesData.data || []
  const error = abastecimentosData.error || manutencoesData.error

  const resumo = rows.reduce(
    (acc, item) => {
      acc.totalGasto += item.valor_total || 0
      acc.totalLitros += item.litros || 0
      acc.totalAbastecimentos += 1
      return acc
    },
    {
      totalGasto: 0,
      totalLitros: 0,
      totalAbastecimentos: 0,
    }
  )

  const resumoManutencao = manutencoes.reduce(
    (acc, item) => {
      acc.totalCusto += item.custo || 0
      acc.totalManutencoes += 1
      return acc
    },
    {
      totalCusto: 0,
      totalManutencoes: 0,
    }
  )

  const totalGeral = resumo.totalGasto + resumoManutencao.totalCusto
  const custoPorLitro = resumo.totalLitros > 0 ? totalGeral / resumo.totalLitros : 0

  const createMonthKey = (value?: string | null) => {
    if (!value) return "unknown"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "unknown"
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }

  const createMonthLabel = (key: string) => {
    if (key === "unknown") return "Sem data"
    const [year, month] = key.split("-")
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
  }

  const fuelByMonth = new Map<string, { monthKey: string; litros: number; gasto: number; registros: number }>()
  const maintenanceByMonth = new Map<string, { monthKey: string; custo: number; registros: number }>()

  rows.forEach((item) => {
    const key = createMonthKey(item.data)
    const existing = fuelByMonth.get(key)

    if (existing) {
      existing.litros += item.litros || 0
      existing.gasto += item.valor_total || 0
      existing.registros += 1
    } else {
      fuelByMonth.set(key, {
        monthKey: key,
        litros: item.litros || 0,
        gasto: item.valor_total || 0,
        registros: 1,
      })
    }
  })

  manutencoes.forEach((item) => {
    const key = createMonthKey(item.data)
    const existing = maintenanceByMonth.get(key)

    if (existing) {
      existing.custo += item.custo || 0
      existing.registros += 1
    } else {
      maintenanceByMonth.set(key, {
        monthKey: key,
        custo: item.custo || 0,
        registros: 1,
      })
    }
  })

  const monthSummaries = Array.from(
    new Map(
      [...fuelByMonth.entries(), ...maintenanceByMonth.entries()].map(([key]) => [
        key,
        {
          monthKey: key,
          label: createMonthLabel(key),
          fuelGasto: fuelByMonth.get(key)?.gasto || 0,
          fuelLitros: fuelByMonth.get(key)?.litros || 0,
          fuelRegistros: fuelByMonth.get(key)?.registros || 0,
          manutencaoCusto: maintenanceByMonth.get(key)?.custo || 0,
          manutencaoRegistros: maintenanceByMonth.get(key)?.registros || 0,
          total: (fuelByMonth.get(key)?.gasto || 0) + (maintenanceByMonth.get(key)?.custo || 0),
        },
      ])
    ).values()
  ).sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))

  const porVeiculo = new Map<
    string,
    {
      veiculoNome: string
      abastecimentos: number
      litros: number
      gasto: number
      custoMedio: number
    }
  >()

  rows.forEach((item) => {
    const veiculoId = item.veiculo_id || "sem_veiculo"
    const veiculoNome = item.veiculo?.[0]?.placa_cavalo || "N/A"

    if (!porVeiculo.has(veiculoId)) {
      porVeiculo.set(veiculoId, {
        veiculoNome,
        abastecimentos: 0,
        litros: 0,
        gasto: 0,
        custoMedio: 0,
      })
    }

    const stats = porVeiculo.get(veiculoId)!
    stats.abastecimentos += 1
    stats.litros += item.litros || 0
    stats.gasto += item.valor_total || 0
  })

  const veiculos = Array.from(porVeiculo.values()).map((item) => ({
    ...item,
    custoMedio: item.abastecimentos > 0 ? item.gasto / item.abastecimentos : 0,
  }))

  const maisGastou = [...veiculos].sort((a, b) => b.gasto - a.gasto).slice(0, 3)
  const maisAbasteceu = [...veiculos].sort((a, b) => b.litros - a.litros).slice(0, 3)

  const manutencaoPorVeiculo = new Map<
    string,
    {
      veiculoNome: string
      manutencoes: number
      custo: number
    }
  >()

  manutencoes.forEach((item) => {
    const veiculoId = item.veiculo_id || "sem_veiculo"
    const veiculoNome = item.veiculo?.[0]?.placa_cavalo || "N/A"

    if (!manutencaoPorVeiculo.has(veiculoId)) {
      manutencaoPorVeiculo.set(veiculoId, {
        veiculoNome,
        manutencoes: 0,
        custo: 0,
      })
    }

    const stats = manutencaoPorVeiculo.get(veiculoId)!
    stats.manutencoes += 1
    stats.custo += item.custo || 0
  })

  const topManutencao = Array.from(manutencaoPorVeiculo.values())
    .sort((a, b) => b.custo - a.custo)
    .slice(0, 3)

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Custos & Consumo</h1>
          <p className="page-subtitle">Análise de combustível e manutenções por veículo</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card border border-blue-100 bg-blue-50">
          <p className="kpi-card-label mb-2">Total Combustível</p>
          <p className="text-xl font-bold text-blue-700 tabular">{formatCurrency(resumo.totalGasto)}</p>
        </div>
        <div className="kpi-card border border-amber-100 bg-amber-50">
          <p className="kpi-card-label mb-2">Total Manutenção</p>
          <p className="text-xl font-bold text-amber-700 tabular">{formatCurrency(resumoManutencao.totalCusto)}</p>
        </div>
        <div className="kpi-card border border-rose-100 bg-rose-50">
          <p className="kpi-card-label mb-2">Gasto Geral</p>
          <p className="text-xl font-bold text-rose-700 tabular">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="kpi-card border border-border/60">
          <p className="kpi-card-label mb-2">Custo por Litro</p>
          <p className="text-xl font-bold text-foreground tabular">
            {resumo.totalLitros > 0 ? formatCurrency(custoPorLitro) : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card border border-border/60">
          <p className="kpi-card-label mb-2">Total Litros</p>
          <p className="text-xl font-bold text-foreground tabular">{resumo.totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L</p>
        </div>
        <div className="kpi-card border border-border/60">
          <p className="kpi-card-label mb-2">Abastecimentos</p>
          <p className="text-xl font-bold text-foreground tabular">{resumo.totalAbastecimentos}</p>
        </div>
        <div className="kpi-card border border-border/60">
          <p className="kpi-card-label mb-2">Manutenções</p>
          <p className="text-xl font-bold text-foreground tabular">{resumoManutencao.totalManutencoes}</p>
        </div>
        <div className="kpi-card border border-border/60">
          <p className="kpi-card-label mb-2">Custo Médio Manutenção</p>
          <p className="text-xl font-bold text-foreground tabular">
            {resumoManutencao.totalManutencoes > 0
              ? formatCurrency(resumoManutencao.totalCusto / resumoManutencao.totalManutencoes)
              : "—"}
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Fuel className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Maior Gasto Combustível</h2>
          </div>
          {maisGastou.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de abastecimento.</p>
          ) : (
            <div className="space-y-2">
              {maisGastou.map((item) => (
                <div key={item.veiculoNome} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.veiculoNome}</p>
                      <p className="text-xs text-muted-foreground">{item.abastecimentos} abastecimentos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground tabular">{formatCurrency(item.gasto)}</p>
                    <p className="text-xs text-muted-foreground tabular">{item.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Fuel className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Maior Volume Abastecido</h2>
          </div>
          {maisAbasteceu.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de abastecimento.</p>
          ) : (
            <div className="space-y-2">
              {maisAbasteceu.map((item) => (
                <div key={item.veiculoNome} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.veiculoNome}</p>
                      <p className="text-xs text-muted-foreground">{item.abastecimentos} abastecimentos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground tabular">{item.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L</p>
                    <p className="text-xs text-muted-foreground tabular">{formatCurrency(item.custoMedio)} / reg.</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top manutenção por veículo</CardTitle>
            <CardDescription>Os veículos com maior custo de manutenção.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topManutencao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada.</p>
            ) : (
              <div className="space-y-3">
                {topManutencao.map((item) => (
                  <div key={item.veiculoNome} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="font-medium">{item.veiculoNome}</p>
                      <p className="text-sm text-muted-foreground">{item.manutencoes} manutenções</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.custo)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por mês</CardTitle>
            <CardDescription>Resumo mensal de combustível e manutenção.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-muted-foreground">Mês</th>
                  <th className="px-4 py-3 text-right text-muted-foreground">Diesel</th>
                  <th className="px-4 py-3 text-right text-muted-foreground">Manutenção</th>
                  <th className="px-4 py-3 text-right text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthSummaries.slice(0, 6).map((item) => (
                  <tr key={item.monthKey} className="hover:bg-muted/50">
                    <td className="px-4 py-3">{item.label}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.fuelGasto)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.manutencaoCusto)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
                {monthSummaries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum dado mensal disponível.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Histórico de abastecimentos</CardTitle>
              <CardDescription>Veja cada carga de combustível, veículo, quantidade e custo.</CardDescription>
            </div>
            <Badge variant="secondary">Últimos registros</Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-muted-foreground">Veículo</th>
                <th className="px-4 py-3 text-muted-foreground">Posto</th>
                <th className="px-4 py-3 text-muted-foreground">Hodômetro</th>
                <th className="px-4 py-3 text-muted-foreground">Litros</th>
                <th className="px-4 py-3 text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((item) => (
                <tr key={item.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">{formatDate(item.data)}</td>
                  <td className="px-4 py-3">{item.veiculo?.[0]?.placa_cavalo || "N/A"}</td>
                  <td className="px-4 py-3">{item.posto?.[0]?.nome || "Sem posto"}</td>
                  <td className="px-4 py-3">{item.hodometro?.toLocaleString("pt-BR")} km</td>
                  <td className="px-4 py-3">{item.litros?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L</td>
                  <td className="px-4 py-3">{formatCurrency(item.valor_total || 0)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum abastecimento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar os dados</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
