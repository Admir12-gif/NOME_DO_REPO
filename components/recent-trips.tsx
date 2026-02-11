"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Viagem } from "@/lib/types"
import { MapPin, Truck, User, ArrowRight } from "lucide-react"
import Link from "next/link"

interface RecentTripsProps {
  viagens: Viagem[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

const statusColors: Record<string, string> = {
  Planejada: "bg-muted text-muted-foreground",
  "Em andamento": "bg-primary/10 text-primary",
  Concluida: "bg-success/10 text-success",
  Cancelada: "bg-destructive/10 text-destructive",
}

export function RecentTrips({ viagens }: RecentTripsProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Viagens Recentes</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/viagens" className="text-primary">
            Ver todas
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {viagens.length > 0 ? (
          <div className="space-y-4">
            {viagens.map((viagem) => (
              <div
                key={viagem.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {viagem.origem_real || "Origem"} 
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {viagem.destino_real || "Destino"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {viagem.motorista?.nome || "Sem motorista"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {viagem.veiculo?.placa_cavalo || "Sem veiculo"}
                      </span>
                      <span>{formatDate(viagem.data_inicio)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {formatCurrency(viagem.valor_frete || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {viagem.km_real ? `${viagem.km_real.toLocaleString("pt-BR")} km` : "-"}
                    </p>
                  </div>
                  <Badge className={statusColors[viagem.status]}>
                    {viagem.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma viagem registrada</p>
            <Button variant="outline" size="sm" className="mt-4 bg-transparent" asChild>
              <Link href="/viagens/nova">Criar primeira viagem</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
