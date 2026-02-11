"use client"

import React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { Plus, Wrench, AlertTriangle, Clock, DollarSign } from "lucide-react"
import type { Manutencao, Veiculo } from "@/lib/types"

const TIPO_OPTIONS = ["Preventiva", "Corretiva"] as const
const SISTEMA_OPTIONS = ["Motor", "Freios", "Pneus", "Eletrica", "Suspensao", "Outros"] as const

export function ManutencoesClient() {
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingManutencao, setEditingManutencao] = useState<Manutencao | null>(null)
  const [deletingManutencao, setDeletingManutencao] = useState<Manutencao | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    veiculo_id: "",
    data: "",
    hodometro: "",
    tipo: "",
    sistema: "",
    descricao: "",
    custo: "",
    oficina: "",
    veiculo_parado: false,
    dias_parado: "0",
  })

  useEffect(() => {
    fetchManutencoes()
    fetchVeiculos()
  }, [])

  async function fetchManutencoes() {
    const { data, error } = await supabase
      .from("manutencoes")
      .select("*, veiculo:veiculos(placa_cavalo, modelo)")
      .order("data", { ascending: false })

    if (!error && data) {
      setManutencoes(data as Manutencao[])
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

    const manutencaoData = {
      user_id: userData.user.id,
      veiculo_id: formData.veiculo_id,
      data: formData.data,
      hodometro: Number.parseFloat(formData.hodometro),
      tipo: formData.tipo || null,
      sistema: formData.sistema || null,
      descricao: formData.descricao || null,
      custo: Number.parseFloat(formData.custo),
      oficina: formData.oficina || null,
      veiculo_parado: formData.veiculo_parado,
      dias_parado: parseInt(formData.dias_parado) || 0,
    }

    if (editingManutencao) {
      await supabase.from("manutencoes").update(manutencaoData).eq("id", editingManutencao.id)
    } else {
      await supabase.from("manutencoes").insert(manutencaoData)
    }

    setDialogOpen(false)
    resetForm()
    fetchManutencoes()
    setIsSubmitting(false)
  }

  async function confirmDelete() {
    if (!deletingManutencao) return
    await supabase.from("manutencoes").delete().eq("id", deletingManutencao.id)
    setDeleteDialogOpen(false)
    setDeletingManutencao(null)
    fetchManutencoes()
  }

  function resetForm() {
    setFormData({
      veiculo_id: "",
      data: "",
      hodometro: "",
      tipo: "",
      sistema: "",
      descricao: "",
      custo: "",
      oficina: "",
      veiculo_parado: false,
      dias_parado: "0",
    })
    setEditingManutencao(null)
  }

  function openEdit(manutencao: Manutencao) {
    setEditingManutencao(manutencao)
    setFormData({
      veiculo_id: manutencao.veiculo_id,
      data: manutencao.data,
      hodometro: manutencao.hodometro.toString(),
      tipo: manutencao.tipo || "",
      sistema: manutencao.sistema || "",
      descricao: manutencao.descricao || "",
      custo: manutencao.custo.toString(),
      oficina: manutencao.oficina || "",
      veiculo_parado: manutencao.veiculo_parado,
      dias_parado: manutencao.dias_parado.toString(),
    })
    setDialogOpen(true)
  }

  function openDelete(manutencao: Manutencao) {
    setDeletingManutencao(manutencao)
    setDeleteDialogOpen(true)
  }

  const custoTotal = manutencoes.reduce((acc, m) => acc + m.custo, 0)
  const totalPreventivas = manutencoes.filter((m) => m.tipo === "Preventiva").length
  const totalCorretivas = manutencoes.filter((m) => m.tipo === "Corretiva").length
  const totalDiasParado = manutencoes.reduce((acc, m) => acc + m.dias_parado, 0)

  const tipoColor: Record<string, string> = {
    Preventiva: "bg-primary/10 text-primary",
    Corretiva: "bg-warning/10 text-warning-foreground",
  }

  const columns = [
    {
      key: "data" as const,
      label: "Data",
      render: (m: Manutencao) => new Date(m.data + "T12:00:00").toLocaleDateString("pt-BR"),
    },
    {
      key: "veiculo_id" as const,
      label: "Veiculo",
      render: (m: Manutencao) => {
        const v = m.veiculo
        return v ? `${v.placa_cavalo} - ${v.modelo || ""}` : "-"
      },
    },
    {
      key: "tipo" as const,
      label: "Tipo",
      render: (m: Manutencao) =>
        m.tipo ? (
          <Badge className={tipoColor[m.tipo] || "bg-muted text-muted-foreground"}>
            {m.tipo}
          </Badge>
        ) : "-",
    },
    {
      key: "sistema" as const,
      label: "Sistema",
      render: (m: Manutencao) => m.sistema || "-",
    },
    {
      key: "descricao" as const,
      label: "Descricao",
      render: (m: Manutencao) => (
        <span className="max-w-[200px] truncate block">
          {m.descricao || "-"}
        </span>
      ),
    },
    {
      key: "custo" as const,
      label: "Custo",
      render: (m: Manutencao) =>
        m.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
    {
      key: "dias_parado" as const,
      label: "Dias Parado",
      render: (m: Manutencao) =>
        m.veiculo_parado ? (
          <Badge variant="destructive">{m.dias_parado} dias</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preventivas</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalPreventivas}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corretivas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalCorretivas}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dias Parado</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalDiasParado}</div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={manutencoes}
        columns={columns}
        searchPlaceholder="Buscar manutencoes..."
        onAdd={() => {
          resetForm()
          setDialogOpen(true)
        }}
        addLabel="Nova Manutencao"
        onEdit={(m) => openEdit(m)}
        onDelete={(m) => openDelete(m)}
        emptyMessage="Nenhuma manutencao registrada"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingManutencao ? "Editar Manutencao" : "Nova Manutencao"}
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
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sistema">Sistema</Label>
                <Select
                  value={formData.sistema}
                  onValueChange={(v) => setFormData({ ...formData, sistema: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o sistema" />
                  </SelectTrigger>
                  <SelectContent>
                    {SISTEMA_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custo">Custo (R$) *</Label>
                <Input
                  id="custo"
                  type="number"
                  step="0.01"
                  required
                  value={formData.custo}
                  onChange={(e) => setFormData({ ...formData, custo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oficina">Oficina</Label>
                <Input
                  id="oficina"
                  value={formData.oficina}
                  onChange={(e) => setFormData({ ...formData, oficina: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dias_parado">Dias Parado</Label>
                <Input
                  id="dias_parado"
                  type="number"
                  value={formData.dias_parado}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dias_parado: e.target.value,
                    veiculo_parado: parseInt(e.target.value) > 0
                  })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="descricao">Descricao</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : editingManutencao ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir manutencao?</AlertDialogTitle>
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
