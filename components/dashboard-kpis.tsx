"use client"

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
import Link from "next/link"

interface DashboardKPIsProps {
  kpis: KPIType
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
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
      title: "Faturamento do Mês",
      value: formatCurrency(kpis.faturamento_mes),
      icon: DollarSign,
      iconBg: "bg-blue-500",
      cardBg: "bg-blue-50 border-blue-100",
      valueColor: "text-blue-700",
      trend: null,
      href: "/financeiro/receber",
    },
    {
      title: "Lucro Líquido",
      value: formatCurrency(kpis.lucro_liquido),
      icon: TrendingUp,
      iconBg: kpis.lucro_liquido >= 0 ? "bg-emerald-500" : "bg-rose-500",
      cardBg: kpis.lucro_liquido >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100",
      valueColor: kpis.lucro_liquido >= 0 ? "text-emerald-700" : "text-rose-700",
      trend: kpis.margem_operacional,
      trendLabel: "margem",
      href: "/financeiro/receber",
    },
    {
      title: "Viagens no Mês",
      value: formatNumber(kpis.viagens_mes),
      icon: Route,
      iconBg: "bg-violet-500",
      cardBg: "bg-violet-50 border-violet-100",
      valueColor: "text-violet-700",
      trend: null,
      href: "/viagens",
    },
    {
      title: "KM Rodados",
      value: formatNumber(kpis.km_rodados),
      icon: Truck,
      iconBg: "bg-amber-500",
      cardBg: "bg-amber-50 border-amber-100",
      valueColor: "text-amber-700",
      trend: null,
      href: "/frota/abastecimentos",
    },
    {
      title: "Média KM/L",
      value: formatNumber(kpis.media_km_litro, 2),
      icon: Fuel,
      iconBg: "bg-cyan-500",
      cardBg: "bg-cyan-50 border-cyan-100",
      valueColor: "text-cyan-700",
      trend: null,
      href: "/custos-consumo",
    },
    {
      title: "A Receber",
      value: formatCurrency(kpis.contas_receber_total),
      icon: Wallet,
      iconBg: "bg-emerald-500",
      cardBg: "bg-emerald-50 border-emerald-100",
      valueColor: "text-emerald-700",
      trend: null,
      href: "/financeiro/receber",
    },
    {
      title: "A Pagar",
      value: formatCurrency(kpis.contas_pagar_total),
      icon: CreditCard,
      iconBg: "bg-rose-500",
      cardBg: "bg-rose-50 border-rose-100",
      valueColor: "text-rose-700",
      trend: null,
      href: "/financeiro/pagar",
    },
    {
      title: "Veículos Ativos",
      value: formatNumber(kpis.veiculos_ativos),
      icon: Truck,
      iconBg: "bg-indigo-500",
      cardBg: "bg-indigo-50 border-indigo-100",
      valueColor: "text-indigo-700",
      trend: null,
      href: "/cadastros/veiculos",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Link
          key={card.title}
          href={card.href || "#"}
          className={`kpi-card border card-interactive group ${card.cardBg}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center shadow-sm flex-shrink-0`}>
              <card.icon className="h-4 w-4 text-white" />
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
          <p className={`text-xl font-bold tabular ${card.valueColor}`}>{card.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{card.title}</p>
          {card.trend !== null && card.trend !== undefined && (
            <div className={`flex items-center gap-0.5 mt-1.5 ${card.trend >= 0 ? "trend-up" : "trend-down"}`}>
              {card.trend >= 0
                ? <ArrowUpRight className="h-3 w-3" />
                : <ArrowDownRight className="h-3 w-3" />
              }
              {formatNumber(Math.abs(card.trend), 1)}% {card.trendLabel}
            </div>
          )}
        </Link>
      ))}
    </div>
  )
}
