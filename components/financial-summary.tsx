"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ContaReceber, ContaPagar } from "@/lib/types"
import { ArrowUpRight, ArrowDownRight, Calendar } from "lucide-react"

interface FinancialSummaryProps {
  contasReceber: ContaReceber[]
  contasPagar: ContaPagar[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date()
}

export function FinancialSummary({ contasReceber, contasPagar }: FinancialSummaryProps) {
  const totalReceber = contasReceber.reduce((sum, c) => sum + c.valor, 0)
  const totalPagar = contasPagar.reduce((sum, c) => sum + c.valor, 0)
  const saldo = totalReceber - totalPagar

  const proximasReceber = contasReceber
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())
    .slice(0, 3)

  const proximasPagar = contasPagar
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())
    .slice(0, 3)

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">A Receber</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totalReceber)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <p className="text-xs text-muted-foreground">A Pagar</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalPagar)}</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${saldo >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-lg font-bold ${saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(saldo)}
            </p>
          </div>
        </div>

        {/* Upcoming receivables */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight className="h-4 w-4 text-success" />
            <h4 className="text-sm font-medium text-foreground">Proximas a Receber</h4>
          </div>
          {proximasReceber.length > 0 ? (
            <div className="space-y-2">
              {proximasReceber.map((conta) => (
                <div key={conta.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-foreground">{formatDate(conta.data_vencimento)}</span>
                    {isOverdue(conta.data_vencimento) && (
                      <Badge variant="destructive" className="text-xs">Vencida</Badge>
                    )}
                  </div>
                  <span className="text-sm font-medium text-success">{formatCurrency(conta.valor)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma conta a receber</p>
          )}
        </div>

        {/* Upcoming payables */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownRight className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-medium text-foreground">Proximas a Pagar</h4>
          </div>
          {proximasPagar.length > 0 ? (
            <div className="space-y-2">
              {proximasPagar.map((conta) => (
                <div key={conta.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-foreground">{formatDate(conta.data_vencimento)}</span>
                    {isOverdue(conta.data_vencimento) && (
                      <Badge variant="destructive" className="text-xs">Vencida</Badge>
                    )}
                  </div>
                  <span className="text-sm font-medium text-destructive">{formatCurrency(conta.valor)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma conta a pagar</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
