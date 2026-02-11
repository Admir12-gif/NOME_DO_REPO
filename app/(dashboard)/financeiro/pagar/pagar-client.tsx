"use client"

import React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Check, AlertCircle, Clock, TrendingDown, ArrowDownRight } from "lucide-react"
import type { ContaPagar, Motorista } from "@/lib/types"

const CATEGORIAS = [
  "Diesel", "Manutencao", "Pedagio", "Seguro", "Parcela",
  "Salario", "Impostos", "Adiantamento", "Multa", "Outros",
]

interface ContasPagarClientProps {
  initialContas: ContaPagar[]
  motoristas: Motorista[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function ContasPagarClient({ initialContas, motoristas }: ContasPagarClientProps) {
  const [contas, setContas] = useState(initialContas)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0])
  const [formData, setFormData] = useState({
    fornecedor: "",
    categoria: "",
    data_vencimento: "",
    valor: "",
    status: "Em aberto",
    data_pagamento: "",
    motorista_id: "",
    observacao: "",
  })

  const resetForm = () => {
    setFormData({
      fornecedor: "",
      categoria: "",
      data_vencimento: "",
      valor: "",
      status: "Em aberto",
      data_pagamento: "",
      motorista_id: "",
      observacao: "",
    })
    setSelectedConta(null)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (conta: ContaPagar) => {
    setSelectedConta(conta)
    setFormData({
      fornecedor: conta.fornecedor || "",
      categoria: conta.categoria || "",
      data_vencimento: conta.data_vencimento,
      valor: conta.valor.toString(),
      status: conta.status,
      data_pagamento: conta.data_pagamento || "",
      motorista_id: conta.motorista_id || "",
      observacao: conta.observacao || "",
    })
    setIsDialogOpen(true)
  }

  const handlePay = (conta: ContaPagar) => {
    setSelectedConta(conta)
    setPayDate(new Date().toISOString().split("T")[0])
    setIsPayDialogOpen(true)
  }

  const handleDelete = (conta: ContaPagar) => {
    setSelectedConta(conta)
    setIsDeleteDialogOpen(true)
  }

  const confirmPay = async () => {
    if (!selectedConta) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contas_pagar")
      .update({
        status: "Pago",
        data_pagamento: payDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedConta.id)
      .select("*, motorista:motoristas(*)")
      .single()

    if (!error && data) {
      setContas(contas.map(c => c.id === selectedConta.id ? data : c))
    }
    setIsPayDialogOpen(false)
    setSelectedConta(null)
  }

  const confirmDelete = async () => {
    if (!selectedConta) return
    const supabase = createClient()
    const { error } = await supabase
      .from("contas_pagar")
      .delete()
      .eq("id", selectedConta.id)

    if (!error) {
      setContas(contas.filter(c => c.id !== selectedConta.id))
    }
    setIsDeleteDialogOpen(false)
    setSelectedConta(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const contaData = {
      fornecedor: formData.fornecedor || null,
      categoria: formData.categoria || null,
      data_vencimento: formData.data_vencimento,
      valor: parseFloat(formData.valor),
      status: formData.status as ContaPagar["status"],
      data_pagamento: formData.data_pagamento || null,
      motorista_id: formData.motorista_id || null,
      observacao: formData.observacao || null,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (selectedConta) {
      const { data, error } = await supabase
        .from("contas_pagar")
        .update(contaData)
        .eq("id", selectedConta.id)
        .select("*, motorista:motoristas(*)")
        .single()
      if (!error && data) {
        setContas(contas.map(c => c.id === selectedConta.id ? data : c))
      }
    } else {
      const { data, error } = await supabase
        .from("contas_pagar")
        .insert(contaData)
        .select("*, motorista:motoristas(*)")
        .single()
      if (!error && data) {
        setContas([...contas, data])
      }
    }

    setIsLoading(false)
    setIsDialogOpen(false)
    resetForm()
  }

  const totalEmAberto = contas.filter(c => c.status === "Em aberto").reduce((s, c) => s + c.valor, 0)
  const totalAtrasado = contas.filter(c => c.status === "Atrasado").reduce((s, c) => s + c.valor, 0)
  const totalPago = contas.filter(c => c.status === "Pago").reduce((s, c) => s + c.valor, 0)

  const statusColors: Record<string, string> = {
    "Em aberto": "bg-warning/10 text-warning-foreground",
    Pago: "bg-success/10 text-success",
    Atrasado: "bg-destructive/10 text-destructive",
  }

  const columns = [
    {
      key: "fornecedor" as const,
      label: "Fornecedor",
      render: (c: ContaPagar) => c.fornecedor || "-",
    },
    {
      key: "categoria" as const,
      label: "Categoria",
      render: (c: ContaPagar) => (
        <Badge variant="outline">{c.categoria || "-"}</Badge>
      ),
    },
    {
      key: "data_vencimento" as const,
      label: "Vencimento",
      render: (c: ContaPagar) => new Date(c.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR"),
    },
    {
      key: "valor" as const,
      label: "Valor",
      render: (c: ContaPagar) => formatCurrency(c.valor),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (c: ContaPagar) => (
        <Badge className={statusColors[c.status]}>{c.status}</Badge>
      ),
    },
    {
      key: "actions_pay" as const,
      label: "",
      render: (c: ContaPagar) => c.status !== "Pago" ? (
        <Button size="sm" variant="outline" onClick={() => handlePay(c)}>
          <Check className="h-4 w-4 mr-1" />
          Pagar
        </Button>
      ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <ArrowDownRight className="h-7 w-7 text-destructive" />
          Contas a Pagar
        </h1>
        <p className="text-muted-foreground">
          Gerencie os pagamentos da sua transportadora
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Em Aberto</p>
            <p className="text-2xl font-bold text-warning-foreground">{formatCurrency(totalEmAberto)}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Atrasado</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalAtrasado)}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pago</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalPago)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable
            data={contas}
            columns={columns}
            searchPlaceholder="Buscar conta..."
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            addLabel="Nova Conta"
            emptyMessage="Nenhuma conta a pagar"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedConta ? "Editar Conta" : "Nova Conta a Pagar"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Vencimento *</Label>
                <Input
                  type="date"
                  required
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Motorista (se aplicavel)</Label>
                <Select
                  value={formData.motorista_id}
                  onValueChange={(v) => setFormData({ ...formData, motorista_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {motoristas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observacao</Label>
                <Input
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
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

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Valor a pagar</p>
              <p className="text-2xl font-bold text-destructive">
                {selectedConta && formatCurrency(selectedConta.valor)}
              </p>
              {selectedConta?.fornecedor && (
                <p className="text-sm text-muted-foreground mt-1">{selectedConta.fornecedor}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmPay}>
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta a pagar?
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
