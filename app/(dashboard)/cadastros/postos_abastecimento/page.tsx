"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PostoAbastecimento } from "@/lib/types"
import { Plus, Pencil, Trash2 } from "lucide-react"

export default function PostosAbastecimentoPage() {
  const [postos, setPostos] = useState<PostoAbastecimento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPostoId, setSelectedPostoId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ nome: "", localidade: "", referencia: "" })

  const supabase = createClient()

  useEffect(() => {
    loadPostos()
  }, [])

  const loadPostos = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from("postos_abastecimento")
      .select("*")
      .order("nome")

    if (data) {
      setPostos(data as PostoAbastecimento[])
    }
    setIsLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nome) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    if (selectedPostoId) {
      // Update
      const { error } = await supabase
        .from("postos_abastecimento")
        .update({
          nome: formData.nome,
          localidade: formData.localidade || null,
          referencia: formData.referencia || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPostoId)

      if (!error) {
        setPostos((prev) =>
          prev.map((p) =>
            p.id === selectedPostoId
              ? {
                  ...p,
                  nome: formData.nome,
                  localidade: formData.localidade || null,
                  referencia: formData.referencia || null,
                }
              : p
          )
        )
        resetForm()
      }
    } else {
      // Create
      const { data: newPosto, error } = await supabase
        .from("postos_abastecimento")
        .insert([
          {
            user_id: userData.user.id,
            nome: formData.nome,
            localidade: formData.localidade || null,
            referencia: formData.referencia || null,
          },
        ])
        .select()

      if (!error && newPosto) {
        setPostos((prev) => [...prev, newPosto[0] as PostoAbastecimento])
        resetForm()
      }
    }

    setDialogOpen(false)
  }

  const handleDelete = async () => {
    if (!selectedPostoId) return

    const { error } = await supabase
      .from("postos_abastecimento")
      .delete()
      .eq("id", selectedPostoId)

    if (!error) {
      setPostos((prev) => prev.filter((p) => p.id !== selectedPostoId))
      setDeleteDialogOpen(false)
      setSelectedPostoId(null)
    }
  }

  const handleEdit = (posto: PostoAbastecimento) => {
    setSelectedPostoId(posto.id)
    setFormData({
      nome: posto.nome,
      localidade: posto.localidade || "",
      referencia: posto.referencia || "",
    })
    setDialogOpen(true)
  }

  const resetForm = () => {
    setSelectedPostoId(null)
    setFormData({ nome: "", localidade: "", referencia: "" })
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Postos de Abastecimento</h1>
          <p className="text-muted-foreground mt-1">Cadastro de locais de abastecimento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Posto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedPostoId ? "Editar Posto" : "Novo Posto"}
              </DialogTitle>
              <DialogDescription>
                {selectedPostoId ? "Atualize os dados do posto" : "Cadastre um novo local de abastecimento"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Posto *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Posto BR KM 200"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="localidade">Localidade</Label>
                <Input
                  id="localidade"
                  placeholder="Ex: Sorocaba/SP"
                  value={formData.localidade}
                  onChange={(e) => setFormData({ ...formData, localidade: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="referencia">Referência</Label>
                <Textarea
                  id="referencia"
                  placeholder="Ex: Próximo ao retorno da BR"
                  value={formData.referencia}
                  onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedPostoId ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Postos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : postos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum posto cadastrado</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Localidade</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead className="text-right w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postos.map((posto) => (
                    <TableRow key={posto.id}>
                      <TableCell className="font-medium">{posto.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {posto.localidade || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {posto.referencia || "—"}
                      </TableCell>
                      <TableCell className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(posto)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPostoId(posto.id)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este posto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
