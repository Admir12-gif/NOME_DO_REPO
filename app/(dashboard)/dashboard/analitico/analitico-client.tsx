// app/(dashboard)/dashboard/analitico/analitico-client.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  obterRentabilidadePorCliente,
  obterRentabilidadePorRota,
  obterRentabilidadePorVeiculo,
  obterKpisAvancados,
  type RentabilidadeCliente,
  type RentabilidadeRota,
  type RentabilidadeVeiculo,
  type KpisAvancados
} from '@/lib/supabase/analytics'
import { DollarSign, TrendingUp, TrendingDown, Banknote } from 'lucide-react'

interface AnaliticoClientProps {
  userId: string
}

export function AnaliticoClient({ userId }: AnaliticoClientProps) {
  const [clientesData, setClientesData] = useState<RentabilidadeCliente[]>([])
  const [rotasData, setRotasData] = useState<RentabilidadeRota[]>([])
  const [veiculosData, setVeiculosData] = useState<RentabilidadeVeiculo[]>([])
  const [kpis, setKpis] = useState<KpisAvancados | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')

  useEffect(() => {
    carregarDados()
  }, [userId, periodo])

  const getDataRange = () => {
    const now = new Date()
    let inicio: Date

    switch (periodo) {
      case 'mes':
        inicio = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'trimestre':
        inicio = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        break
      case 'semestre':
        inicio = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        break
      case 'ano':
        inicio = new Date(now.getFullYear(), 0, 1)
        break
      default:
        inicio = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    return {
      inicio: inicio.toISOString(),
      fim: now.toISOString()
    }
  }

  const carregarDados = async () => {
    try {
      setLoading(true)
      const { inicio, fim } = getDataRange()

      const [clientes, rotas, veiculos, kpisData] = await Promise.all([
        obterRentabilidadePorCliente(userId, inicio, fim),
        obterRentabilidadePorRota(userId, inicio, fim),
        obterRentabilidadePorVeiculo(userId, inicio, fim),
        obterKpisAvancados(userId, inicio, fim)
      ])

      setClientesData(clientes)
      setRotasData(rotas)
      setVeiculosData(veiculos)
      setKpis(kpisData)
    } catch (error) {
      console.error('Erro ao carregar dados analíticos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando análises...</div>
  }

  return (
    <div className="space-y-5">
      {/* Seletor de período */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Período:</span>
        {[
          { id: 'mes', label: 'Este Mês' },
          { id: 'trimestre', label: 'Trimestre' },
          { id: 'semestre', label: 'Semestre' },
          { id: 'ano', label: 'Este Ano' },
        ].map(option => (
          <button
            key={option.id}
            onClick={() => setPeriodo(option.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              periodo === option.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="kpi-card border border-blue-100 bg-blue-50">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-xl font-bold text-blue-700 tabular">{formatCurrency(kpis.faturamento_mes)}</p>
            <p className="text-xs font-medium text-blue-600 mt-0.5">Faturamento</p>
            <p className="kpi-card-label mt-0.5">{kpis.viagens_mes} viagens</p>
          </div>

          <div className="kpi-card border border-amber-100 bg-amber-50">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-xl font-bold text-amber-700 tabular">{formatCurrency(kpis.custos_mes)}</p>
            <p className="text-xs font-medium text-amber-600 mt-0.5">Custos</p>
            <p className="kpi-card-label mt-0.5">
              {kpis.faturamento_mes > 0 ? ((kpis.custos_mes / kpis.faturamento_mes) * 100).toFixed(1) : '0'}% do faturamento
            </p>
          </div>

          <div className={`kpi-card border ${kpis.lucro_mes >= 0 ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpis.lucro_mes >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                <TrendingDown className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className={`text-xl font-bold tabular ${kpis.lucro_mes >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(kpis.lucro_mes)}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${kpis.lucro_mes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Lucro Líquido</p>
            <p className="kpi-card-label mt-0.5">Margem: {kpis.margem_mes.toFixed(1)}%</p>
          </div>

          <div className="kpi-card border border-violet-100 bg-violet-50">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 rounded-lg bg-violet-500 flex items-center justify-center">
                <Banknote className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-xl font-bold text-violet-700 tabular">{formatCurrency(kpis.ticket_medio)}</p>
            <p className="text-xs font-medium text-violet-600 mt-0.5">Ticket Médio</p>
            <p className="kpi-card-label mt-0.5">Por viagem</p>
          </div>
        </div>
      )}

      {/* Drilldown */}
      <Tabs defaultValue="clientes">
        <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-0 border-b border-border/60">
            <TabsList className="h-8 bg-transparent gap-1">
              <TabsTrigger value="clientes" className="text-xs h-7">Clientes <span className="ml-1 tabular font-semibold">({clientesData.length})</span></TabsTrigger>
              <TabsTrigger value="rotas" className="text-xs h-7">Rotas <span className="ml-1 tabular font-semibold">({rotasData.length})</span></TabsTrigger>
              <TabsTrigger value="veiculos" className="text-xs h-7">Veículos <span className="ml-1 tabular font-semibold">({veiculosData.length})</span></TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="clientes" className="mt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Cliente</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Viagens</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Faturamento</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Custos</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Lucro</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesData.map((cliente, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 font-medium">{cliente.cliente_nome}</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{cliente.quantidade_viagens}</td>
                      <td className="px-4 py-3 text-right tabular">{formatCurrency(cliente.valor_frete_total)}</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{formatCurrency(cliente.custos_total)}</td>
                      <td className="px-4 py-3 text-right tabular font-semibold">
                        <span className={cliente.lucro_liquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {formatCurrency(cliente.lucro_liquido)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          cliente.margem_percentual >= 20 ? 'badge-concluida' : 'badge-planejada'
                        }`}>
                          {cliente.margem_percentual.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="rotas" className="mt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Rota</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Viagens</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Distância</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Faturamento</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Lucro</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {rotasData.map((rota, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 font-medium">{rota.rota_nome}</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{rota.quantidade_viagens}</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{rota.distancia_km} km</td>
                      <td className="px-4 py-3 text-right tabular">{formatCurrency(rota.valor_frete_total)}</td>
                      <td className="px-4 py-3 text-right tabular font-semibold">
                        <span className={rota.lucro_liquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {formatCurrency(rota.lucro_liquido)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          rota.margem_percentual >= 20 ? 'badge-concluida' : 'badge-planejada'
                        }`}>
                          {rota.margem_percentual.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="veiculos" className="mt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Veículo</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Viagens</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">KM</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Consumo</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Faturamento</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Lucro</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {veiculosData.map((veiculo, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 font-medium">{veiculo.veiculo_placa}</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{veiculo.quantidade_viagens}</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{veiculo.km_rodados}</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{veiculo.consumo_medio.toFixed(2)} km/l</td>
                      <td className="px-4 py-3 text-right tabular">{formatCurrency(veiculo.valor_frete_total)}</td>
                      <td className="px-4 py-3 text-right tabular font-semibold">
                        <span className={veiculo.lucro_liquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {formatCurrency(veiculo.lucro_liquido)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          veiculo.margem_percentual >= 20 ? 'badge-concluida' : 'badge-planejada'
                        }`}>
                          {veiculo.margem_percentual.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
