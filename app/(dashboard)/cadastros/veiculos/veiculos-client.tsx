"use client"

import React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DataTable } from "@/components/data-table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { Veiculo } from "@/lib/types"
import { Truck } from "lucide-react"

interface VeiculosClientProps {
  initialVeiculos: Veiculo[]
}

export function VeiculosClient({ initialVeiculos }: VeiculosClientProps) {
  const [veiculos, setVeiculos] = useState(initialVeiculos)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    placa_cavalo: "",
    placa_carreta: "",
    modelo: "",
    ano: "",
    hodometro_atual: "",
    meta_consumo: "",
    intervalo_manutencao: "20000",
  })

  const resetForm = () => {
    setFormData({
      placa_cavalo: "",
      placa_carreta: "",
      modelo: "",
      ano: "",
      hodometro_atual: "",
      meta_consumo: "",
      intervalo_manutencao: "20000",
    })
    setSelectedVeiculo(null)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo)
    setFormData({
      placa_cavalo: veiculo.placa_cavalo,
      placa_carreta: veiculo.placa_carreta || "",
      modelo: veiculo.modelo || "",
      ano: veiculo.ano?.toString() || "",
      hodometro_atual: veiculo.hodometro_atual?.toString() || "",
      meta_consumo: veiculo.meta_consumo?.toString() || "",
      intervalo_manutencao: veiculo.intervalo_manutencao?.toString() || "20000",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedVeiculo) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("veiculos")
      .delete()
      .eq("id", selectedVeiculo.id)

    if (!error) {
      setVeiculos(veiculos.filter(v => v.id !== selectedVeiculo.id))
    }
    setIsDeleteDialogOpen(false)
    setSelectedVeiculo(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setIsLoading(false)
      return
    }

    const veiculoData = {
      placa_cavalo: formData.placa_cavalo.toUpperCase(),
      placa_carreta: formData.placa_carreta?.toUpperCase() || null,
      modelo: formData.modelo || null,
      ano: formData.ano ? parseInt(formData.ano) : null,
      hodometro_atual: formData.hodometro_atual ? parseFloat(formData.hodometro_atual) : 0,
      meta_consumo: formData.meta_consumo ? parseFloat(formData.meta_consumo) : null,
      intervalo_manutencao: formData.intervalo_manutencao ? parseInt(formData.intervalo_manutencao) : 20000,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (selectedVeiculo) {
      const { data, error } = await supabase
        .from("veiculos")
        .update(veiculoData)
        .eq("id", selectedVeiculo.id)
        .select()
        .single()

      if (!error && data) {
        setVeiculos(veiculos.map(v => v.id === selectedVeiculo.id ? data : v))
      }
    } else {
      const { data, error } = await supabase
        .from("veiculos")
        .insert(veiculoData)
        .select()
        .single()

      if (!error && data) {
        setVeiculos([...veiculos, data])
      }
    }

    setIsLoading(false)
    setIsDialogOpen(false)
    resetForm()
  }

  const columns = [
    { key: "placa_cavalo" as const, label: "Placa Cavalo" },
    { key: "placa_carreta" as const, label: "Placa Carreta" },
    { key: "modelo" as const, label: "Modelo" },
    { key: "ano" as const, label: "Ano" },
    { 
      key: "hodometro_atual" as const, 
      label: "Hodometro",
      render: (v: Veiculo) => v.hodometro_atual?.toLocaleString("pt-BR") + " km"
    },
    { 
      key: "meta_consumo" as const, 
      label: "Meta KM/L",
      render: (v: Veiculo) => v.meta_consumo?.toFixed(2) || "-"
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Truck className="h-7 w-7 text-primary" />
          Veiculos
        </h1>
        <p className="text-muted-foreground">
          Gerencie a frota de veiculos da sua transportadora
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable
            data={veiculos}
            columns={columns}
            searchKey="placa_cavalo"
            searchPlaceholder="Buscar por placa..."
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            addLabel="Novo Veiculo"
            emptyMessage="Nenhum veiculo cadastrado"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedVeiculo ? "Editar Veiculo" : "Novo Veiculo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="placa_cavalo">Placa Cavalo *</Label>
                <Input
                  id="placa_cavalo"
                  value={formData.placa_cavalo}
                  onChange={(e) => setFormData({ ...formData, placa_cavalo: e.target.value })}
                  placeholder="ABC-1234"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="placa_carreta">Placa Carreta</Label>
                <Input
                  id="placa_carreta"
                  value={formData.placa_carreta}
                  onChange={(e) => setFormData({ ...formData, placa_carreta: e.target.value })}
                  placeholder="XYZ-5678"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="modelo">Modelo</Label>
                <Input
                  id="modelo"
                  value={formData.modelo}
                  onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  placeholder="Scania R450"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ano">Ano</Label>
                <Input
                  id="ano"
                  type="number"
                  value={formData.ano}
                  onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                  placeholder="2023"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hodometro_atual">Hodometro Atual (km)</Label>
                <Input
                  id="hodometro_atual"
                  type="number"
                  value={formData.hodometro_atual}
                  onChange={(e) => setFormData({ ...formData, hodometro_atual: e.target.value })}
                  placeholder="150000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta_consumo">Meta Consumo (km/l)</Label>
                <Input
                  id="meta_consumo"
                  type="number"
                  step="0.01"
                  value={formData.meta_consumo}
                  onChange={(e) => setFormData({ ...formData, meta_consumo: e.target.value })}
                  placeholder="2.5"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="intervalo_manutencao">Intervalo Manutencao (km)</Label>
              <Input
                id="intervalo_manutencao"
                type="number"
                value={formData.intervalo_manutencao}
                onChange={(e) => setFormData({ ...formData, intervalo_manutencao: e.target.value })}
                placeholder="20000"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o veiculo {selectedVeiculo?.placa_cavalo}?
              Esta acao nao pode ser desfeita.
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
