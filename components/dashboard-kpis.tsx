"use client"

import { Card, CardContent } from "@/components/ui/card"
import { 
  DollarSign, 
  TrendingUp, 
  Truck, 
  Route,
  Fuel,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
} from "lucide-react"
import type { DashboardKPIs as KPIType } from "@/lib/types"

interface DashboardKPIsProps {
  kpis: KPIType
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatNumber(value: number, decimals = 0) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function DashboardKPIs({ kpis }: DashboardKPIsProps) {
  const cards = [
    {
      title: "Faturamento do Mes",
      value: formatCurrency(kpis.faturamento_mes),
      icon: DollarSign,
      color: "bg-primary/10 text-primary",
      trend: null,
    },
    {
      title: "Lucro Liquido",
      value: formatCurrency(kpis.lucro_liquido),
      icon: TrendingUp,
      color: kpis.lucro_liquido >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      trend: kpis.margem_operacional,
      trendLabel: "margem",
    },
    {
      title: "Viagens no Mes",
      value: formatNumber(kpis.viagens_mes),
      icon: Route,
      color: "bg-chart-2/10 text-chart-2",
      trend: null,
    },
    {
      title: "KM Rodados",
      value: formatNumber(kpis.km_rodados),
      icon: Truck,
      color: "bg-chart-3/10 text-chart-3",
      trend: null,
    },
    {
      title: "Media KM/L",
      value: formatNumber(kpis.media_km_litro, 2),
      icon: Fuel,
      color: "bg-chart-5/10 text-chart-5",
      trend: null,
    },
    {
      title: "A Receber",
      value: formatCurrency(kpis.contas_receber_total),
      icon: Wallet,
      color: "bg-success/10 text-success",
      trend: null,
    },
    {
      title: "A Pagar",
      value: formatCurrency(kpis.contas_pagar_total),
      icon: CreditCard,
      color: "bg-destructive/10 text-destructive",
      trend: null,
    },
    {
      title: "Veiculos Ativos",
      value: formatNumber(kpis.veiculos_ativos),
      icon: Truck,
      color: "bg-primary/10 text-primary",
      trend: null,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                {card.trend !== null && (
                  <div className="flex items-center gap-1 text-xs">
                    {card.trend >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <span className={card.trend >= 0 ? "text-success" : "text-destructive"}>
                      {formatNumber(Math.abs(card.trend), 1)}% {card.trendLabel}
                    </span>
                  </div>
                )}
              </div>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
