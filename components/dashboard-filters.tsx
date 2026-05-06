"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, X } from "lucide-react"

interface FilterOption {
  value: string
  label: string
}

interface DashboardFiltersProps {
  period?: string
  from?: string
  to?: string
  status?: string
  clienteId?: string
  rotaId?: string
  carretaId?: string
  statusOptions?: FilterOption[]
  clienteOptions?: FilterOption[]
  rotaOptions?: FilterOption[]
  carretaOptions?: FilterOption[]
}

export function DashboardFilters({
  period,
  from,
  to,
  status,
  clienteId,
  rotaId,
  carretaId,
  statusOptions = [],
  clienteOptions = [],
  rotaOptions = [],
  carretaOptions = [],
}: DashboardFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const currentSearch = useSearchParams()
  const baseParams = useMemo(() => new URLSearchParams(currentSearch?.toString() || ""), [currentSearch])

  const hasActiveFilters =
    (period && period !== "6m") || status || clienteId || rotaId || carretaId || from || to

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

  const clearFilters = () => router.replace(pathname)

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground flex-shrink-0">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
        </div>

        <div className="flex-shrink-0 w-40">
          <Select value={period || "6m"} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 text-xs">
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

        <div className="flex-shrink-0 w-36">
          <Select value={status || "all"} onValueChange={(v) => updateParam("status", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {clienteOptions.length > 0 && (
          <div className="flex-shrink-0 w-44">
            <Select value={clienteId || "all"} onValueChange={(v) => updateParam("cliente", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clienteOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {rotaOptions.length > 0 && (
          <div className="flex-shrink-0 w-44">
            <Select value={rotaId || "all"} onValueChange={(v) => updateParam("rota", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Rota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas rotas</SelectItem>
                {rotaOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {carretaOptions.length > 0 && (
          <div className="flex-shrink-0 w-40">
            <Select value={carretaId || "all"} onValueChange={(v) => updateParam("carreta", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos veículos</SelectItem>
                {carretaOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 ml-auto flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {(period || "6m") === "custom" && (
        <div className="flex items-center gap-3 px-4 pb-3 flex-wrap border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">De</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => updateParam("from", e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Até</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => updateParam("to", e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
        </div>
      )}
    </div>
  )
}
