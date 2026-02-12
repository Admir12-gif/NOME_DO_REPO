"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MonthlySeriesItem {
  month: string
  faturamento: number
  custos: number
}

interface TripsSeriesItem {
  month: string
  viagens: number
}

interface TicketSeriesItem {
  month: string
  ticket: number
}

interface KmSeriesItem {
  month: string
  km_medio: number
}

interface VolumeSeriesItem {
  month: string
  volume: number
}

interface MargemSeriesItem {
  month: string
  margem: number
}

interface PieSeriesItem {
  categoria: string
  valor: number
}

interface WaterfallItem {
  etapa: string
  base: number
  valor: number
}

interface StackedSeriesItem {
  month: string
  [categoria: string]: number | string
}

interface TopClientItem {
  cliente: string
  valor: number
}

interface StatusSeriesItem {
  status: string
  valor: number
}

interface TopRouteItem {
  rota: string
  valor: number
}

interface AdvancedDashboardChartsProps {
  monthlySeries: MonthlySeriesItem[]
  pieSeries: PieSeriesItem[]
  waterfallSeries: WaterfallItem[]
  stackedSeries: StackedSeriesItem[]
  stackedCategories: string[]
  topClients: TopClientItem[]
  tripsSeries: TripsSeriesItem[]
  ticketSeries: TicketSeriesItem[]
  kmSeries: KmSeriesItem[]
  volumeSeries: VolumeSeriesItem[]
  margemSeries: MargemSeriesItem[]
  statusSeries: StatusSeriesItem[]
  topRoutes: TopRouteItem[]
}

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

export function AdvancedDashboardCharts({
  monthlySeries,
  pieSeries,
  waterfallSeries,
  stackedSeries,
  stackedCategories,
  topClients,
  tripsSeries,
  ticketSeries,
  kmSeries,
  volumeSeries,
  margemSeries,
  statusSeries,
  topRoutes,
}: AdvancedDashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Faturamento x Custos (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[260px] sm:h-[300px]"
            config={{
              faturamento: { label: "Faturamento", color: "var(--color-chart-1)" },
              custos: { label: "Custos", color: "var(--color-chart-2)" },
            }}
          >
            <BarChart data={monthlySeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="faturamento" radius={[6, 6, 0, 0]} fill="var(--color-faturamento)" />
              <Bar dataKey="custos" radius={[6, 6, 0, 0]} fill="var(--color-custos)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Custos por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {pieSeries.length === 0 ? (
            <div className="h-[260px] sm:h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum custo registrado no periodo
            </div>
          ) : (
            <ChartContainer
              className="h-[260px] sm:h-[300px]"
              config={{
                Diesel: { label: "Diesel", color: "var(--color-chart-1)" },
                Pedagio: { label: "Pedagio", color: "var(--color-chart-2)" },
                Diarias: { label: "Diarias", color: "var(--color-chart-3)" },
                Comissao: { label: "Comissao", color: "var(--color-chart-4)" },
                Arla: { label: "Arla", color: "var(--color-chart-5)" },
                Outros: { label: "Outros", color: "var(--color-chart-2)" },
              }}
            >
              <PieChart>
                <Pie
                  data={pieSeries}
                  dataKey="valor"
                  nameKey="categoria"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {pieSeries.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent nameKey="categoria" />} />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Waterfall (Faturamento → Lucro)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[260px] sm:h-[300px]"
            config={{
              base: { label: "Base", color: "transparent" },
              valor: { label: "Valor", color: "var(--color-chart-1)" },
            }}
          >
            <BarChart data={waterfallSeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="etapa" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <Bar dataKey="base" stackId="a" fill="transparent" />
              <Bar dataKey="valor" stackId="a" radius={[6, 6, 0, 0]}>
                {waterfallSeries.map((item, index) => {
                  const fill =
                    item.etapa === "Lucro"
                      ? "var(--color-chart-2)"
                      : item.valor >= 0
                        ? "var(--color-chart-1)"
                        : "var(--color-chart-5)"
                  return <Cell key={index} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Custos por Categoria (empilhado)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[260px] sm:h-[300px]"
            config={stackedCategories.reduce((acc, categoria, index) => {
              acc[categoria] = {
                label: categoria,
                color: PIE_COLORS[index % PIE_COLORS.length],
              }
              return acc
            }, {} as Record<string, { label: string; color: string }>)}
          >
            <BarChart data={stackedSeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {stackedCategories.map((categoria) => (
                <Bar
                  key={categoria}
                  dataKey={categoria}
                  stackId="a"
                  fill={`var(--color-${categoria})`}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50 md:col-span-2 2xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Top Clientes (barra lateral)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[260px] sm:h-[320px] lg:h-[340px]"
            config={{
              valor: { label: "Faturamento", color: "var(--color-chart-3)" },
            }}
          >
            <BarChart data={topClients} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <YAxis
                dataKey="cliente"
                type="category"
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <Bar dataKey="valor" radius={[6, 6, 6, 6]} fill="var(--color-valor)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Viagens por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[240px] sm:h-[280px]"
            config={{
              viagens: { label: "Viagens", color: "var(--color-chart-4)" },
            }}
          >
            <LineChart data={tripsSeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="viagens"
                stroke="var(--color-viagens)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Ticket Medio (R$)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[240px] sm:h-[280px]"
            config={{
              ticket: { label: "Ticket medio", color: "var(--color-chart-1)" },
            }}
          >
            <AreaChart data={ticketSeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <Area
                dataKey="ticket"
                type="monotone"
                stroke="var(--color-ticket)"
                fill="var(--color-ticket)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Margem por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[240px] sm:h-[280px]"
            config={{
              margem: { label: "Margem", color: "var(--color-chart-2)" },
            }}
          >
            <AreaChart data={margemSeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <Area
                dataKey="margem"
                type="monotone"
                stroke="var(--color-margem)"
                fill="var(--color-margem)"
                fillOpacity={0.18}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Status das Viagens</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[240px] sm:h-[280px]"
            config={{
              Planejada: { label: "Planejada", color: "var(--color-chart-3)" },
              "Em andamento": { label: "Em andamento", color: "var(--color-chart-1)" },
              Concluida: { label: "Concluida", color: "var(--color-chart-2)" },
              Cancelada: { label: "Cancelada", color: "var(--color-chart-5)" },
            }}
          >
            <PieChart>
              <Pie
                data={statusSeries}
                dataKey="valor"
                nameKey="status"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {statusSeries.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">KM Medio por Viagem</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[240px] sm:h-[280px]"
            config={{
              km_medio: { label: "KM medio", color: "var(--color-chart-4)" },
            }}
          >
            <BarChart data={kmSeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${Number(value).toFixed(0)} km`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${Number(value).toFixed(0)} km`}
                  />
                }
              />
              <Bar dataKey="km_medio" radius={[6, 6, 0, 0]} fill="var(--color-km_medio)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Volume Transportado (ton)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[240px] sm:h-[280px]"
            config={{
              volume: { label: "Volume", color: "var(--color-chart-5)" },
            }}
          >
            <AreaChart data={volumeSeries} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="volume"
                type="monotone"
                stroke="var(--color-volume)"
                fill="var(--color-volume)"
                fillOpacity={0.18}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/50 md:col-span-2 2xl:col-span-3">
        <CardHeader>
          <CardTitle className="text-lg">Top Rotas (faturamento)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[260px] sm:h-[320px] lg:h-[360px]"
            config={{
              valor: { label: "Faturamento", color: "var(--color-chart-2)" },
            }}
          >
            <BarChart data={topRoutes} layout="vertical" margin={{ left: 20, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <YAxis
                dataKey="rota"
                type="category"
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              <Bar dataKey="valor" radius={[6, 6, 6, 6]} fill="var(--color-valor)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
