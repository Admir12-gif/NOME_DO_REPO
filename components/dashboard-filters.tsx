"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface FilterOption {
  value: string
  label: string
}

interface DashboardFiltersProps {
  period: string
  from: string
  to: string
  status: string
  clienteId: string
  rotaId: string
  carretaId: string
  statusOptions: FilterOption[]
  clienteOptions: FilterOption[]
  rotaOptions: FilterOption[]
  carretaOptions: FilterOption[]
}

export function DashboardFilters({
  period,
  from,
  to,
  status,
  clienteId,
  rotaId,
  carretaId,
  statusOptions,
  clienteOptions,
  rotaOptions,
  carretaOptions,
}: DashboardFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const currentSearch = useSearchParams()

  const baseParams = useMemo(() => new URLSearchParams(currentSearch?.toString() || ""), [currentSearch])

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(baseParams.toString())
    if (!value || value === "all") {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const handlePeriodChange = (value: string) => {
    const params = new URLSearchParams(baseParams.toString())
    if (value === "6m") {
      params.delete("period")
    } else {
      params.set("period", value)
    }

    if (value !== "custom") {
      params.delete("from")
      params.delete("to")
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const clearFilters = () => {
    router.replace(pathname)
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Período</p>
            <Select value={period || "6m"} onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="12m">Últimos 12 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Status da viagem</p>
            <Select value={status || "all"} onValueChange={(value) => updateParam("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Cliente</p>
            <Select value={clienteId || "all"} onValueChange={(value) => updateParam("cliente", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clienteOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Rota</p>
            <Select value={rotaId || "all"} onValueChange={(value) => updateParam("rota", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {rotaOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Carreta / Cavalo</p>
            <Select value={carretaId || "all"} onValueChange={(value) => updateParam("carreta", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {carretaOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(period || "6m") === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Data inicial</p>
              <Input
                type="date"
                value={from}
                onChange={(event) => updateParam("from", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Data final</p>
              <Input
                type="date"
                value={to}
                onChange={(event) => updateParam("to", event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          </div>
        )}

        {(period || "6m") !== "custom" && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
