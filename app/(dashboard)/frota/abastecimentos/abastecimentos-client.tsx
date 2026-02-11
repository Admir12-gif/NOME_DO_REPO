"use client"

import React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { Plus, Fuel, TrendingDown, Calculator } from "lucide-react"
import type { Abastecimento, Veiculo } from "@/lib/types"

export function AbastecimentosClient() {
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAbastecimento, setEditingAbastecimento] = useState<Abastecimento | null>(null)
  const [deletingAbastecimento, setDeletingAbastecimento] = useState<Abastecimento | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    veiculo_id: "",
    data: "",
    hodometro: "",
    litros: "",
    valor_total: "",
    posto: "",
    observacao: "",
  })

  useEffect(() => {
    fetchAbastecimentos()
    fetchVeiculos()
  }, [])

  async function fetchAbastecimentos() {
    const { data, error } = await supabase
      .from("abastecimentos")
      .select("*, veiculo:veiculos(placa_cavalo, modelo)")
      .order("data", { ascending: false })

    if (!error && data) {
      setAbastecimentos(data as Abastecimento[])
    }
    setLoading(false)
  }

  async function fetchVeiculos() {
    const { data } = await supabase.from("veiculos").select("id, placa_cavalo, modelo").order("placa_cavalo")
    if (data) setVeiculos(data as Veiculo[])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setIsSubmitting(false)
      return
    }

    const abastecimentoData = {
      user_id: userData.user.id,
      veiculo_id: formData.veiculo_id,
      data: formData.data,
      hodometro: Number.parseFloat(formData.hodometro),
      litros: Number.parseFloat(formData.litros),
      valor_total: Number.parseFloat(formData.valor_total),
      posto: formData.posto || null,
      observacao: formData.observacao || null,
    }

    if (editingAbastecimento) {
      await supabase.from("abastecimentos").update(abastecimentoData).eq("id", editingAbastecimento.id)
    } else {
      await supabase.from("abastecimentos").insert(abastecimentoData)
    }

    setDialogOpen(false)
    resetForm()
    fetchAbastecimentos()
    setIsSubmitting(false)
  }

  async function confirmDelete() {
    if (!deletingAbastecimento) return
    await supabase.from("abastecimentos").delete().eq("id", deletingAbastecimento.id)
    setDeleteDialogOpen(false)
    setDeletingAbastecimento(null)
    fetchAbastecimentos()
  }

  function resetForm() {
    setFormData({
      veiculo_id: "",
      data: "",
      hodometro: "",
      litros: "",
      valor_total: "",
      posto: "",
      observacao: "",
    })
    setEditingAbastecimento(null)
  }

  function openEdit(abastecimento: Abastecimento) {
    setEditingAbastecimento(abastecimento)
    setFormData({
      veiculo_id: abastecimento.veiculo_id,
      data: abastecimento.data,
      hodometro: abastecimento.hodometro.toString(),
      litros: abastecimento.litros.toString(),
      valor_total: abastecimento.valor_total.toString(),
      posto: abastecimento.posto || "",
      observacao: abastecimento.observacao || "",
    })
    setDialogOpen(true)
  }

  function openDelete(abastecimento: Abastecimento) {
    setDeletingAbastecimento(abastecimento)
    setDeleteDialogOpen(true)
  }

  const totalLitros = abastecimentos.reduce((acc, a) => acc + a.litros, 0)
  const totalValor = abastecimentos.reduce((acc, a) => acc + a.valor_total, 0)
  const mediaPrecoLitro = totalLitros > 0 ? totalValor / totalLitros : 0

  const columns = [
    {
      key: "data" as const,
      label: "Data",
      render: (a: Abastecimento) => new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR"),
    },
    {
      key: "veiculo_id" as const,
      label: "Veiculo",
      render: (a: Abastecimento) => {
        const v = a.veiculo
        return v ? `${v.placa_cavalo} - ${v.modelo || ""}` : "-"
      },
    },
    {
      key: "hodometro" as const,
      label: "Hodometro",
      render: (a: Abastecimento) => `${a.hodometro.toLocaleString("pt-BR")} km`,
    },
    {
      key: "litros" as const,
      label: "Litros",
      render: (a: Abastecimento) => `${a.litros.toLocaleString("pt-BR")} L`,
    },
    {
      key: "valor_total" as const,
      label: "Valor",
      render: (a: Abastecimento) =>
        a.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
    {
      key: "posto" as const,
      label: "Posto",
      render: (a: Abastecimento) => a.posto || "-",
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Abastecido</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalLitros.toLocaleString("pt-BR")} L</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preco Medio/L</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {mediaPrecoLitro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={abastecimentos}
        columns={columns}
        searchPlaceholder="Buscar abastecimentos..."
        onAdd={() => {
          resetForm()
          setDialogOpen(true)
        }}
        addLabel="Novo Abastecimento"
        onEdit={(a) => openEdit(a)}
        onDelete={(a) => openDelete(a)}
        emptyMessage="Nenhum abastecimento registrado"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAbastecimento ? "Editar Abastecimento" : "Novo Abastecimento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="veiculo_id">Veiculo *</Label>
                <Select
                  value={formData.veiculo_id}
                  onValueChange={(v) => setFormData({ ...formData, veiculo_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o veiculo" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.placa_cavalo} - {v.modelo || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  required
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hodometro">Hodometro (km) *</Label>
                <Input
                  id="hodometro"
                  type="number"
                  step="0.01"
                  required
                  value={formData.hodometro}
                  onChange={(e) => setFormData({ ...formData, hodometro: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="litros">Litros *</Label>
                <Input
                  id="litros"
                  type="number"
                  step="0.01"
                  required
                  value={formData.litros}
                  onChange={(e) => setFormData({ ...formData, litros: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_total">Valor Total (R$) *</Label>
                <Input
                  id="valor_total"
                  type="number"
                  step="0.01"
                  required
                  value={formData.valor_total}
                  onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="posto">Posto</Label>
                <Input
                  id="posto"
                  value={formData.posto}
                  onChange={(e) => setFormData({ ...formData, posto: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observacao">Observacao</Label>
                <Input
                  id="observacao"
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : editingAbastecimento ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir abastecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita. O registro sera permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
