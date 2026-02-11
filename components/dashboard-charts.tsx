"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts"

interface ChartData {
  categoria: string
  valor: number
}

interface DashboardChartsProps {
  data: ChartData[]
}

const COLORS = [
  "oklch(0.5 0.15 250)",  // primary blue
  "oklch(0.55 0.18 160)", // accent green
  "oklch(0.6 0.15 80)",   // yellow
  "oklch(0.55 0.22 25)",  // red
  "oklch(0.5 0.12 300)",  // purple
  "oklch(0.6 0.1 200)",   // cyan
]

const CATEGORY_LABELS: Record<string, string> = {
  Diesel: "Diesel",
  Pedagio: "Pedagio",
  Diarias: "Diarias",
  Comissao: "Comissao",
  Arla: "Arla",
  Outros: "Outros",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const chartData = data.map((item) => ({
    name: CATEGORY_LABELS[item.categoria] || item.categoria,
    value: item.valor,
  }))

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  if (chartData.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Custos por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Nenhum custo registrado neste periodo
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Custos por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    className="stroke-card stroke-2"
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]
                    const percent = ((data.value as number) / total * 100).toFixed(1)
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-popover-foreground">{data.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(data.value as number)} ({percent}%)
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total de Custos</span>
            <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
