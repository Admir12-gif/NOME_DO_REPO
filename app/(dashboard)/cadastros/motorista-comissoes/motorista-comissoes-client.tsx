// app/(dashboard)/cadastros/motorista-comissoes/motorista-comissoes-client.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { DataTable } from '@/components/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2 } from 'lucide-react'
import type { MotoristaComissao, Motorista } from '@/lib/types'

interface MotoristaComissoesClientProps {
  userId: string
}

export function MotoristaComissoesClient({ userId }: MotoristaComissoesClientProps) {
  const supabase = createClient()
  const [comissoes, setComissoes] = useState<MotoristaComissao[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    motorista_id: '',
    percentual_comissao: '',
    tipo_comissao: 'Variavel' as 'Fixa' | 'Variavel',
    observacao: ''
  })

  useEffect(() => {
    carregarDados()
  }, [userId])

  const carregarDados = async () => {
    try {
      setLoading(true)

      // Carregar comissões
      const { data: comissoesData, error: errComissoes } = await supabase
        .from('motorista_comissoes')
        .select(`
          *,
          motorista:motorista_id(id, nome, tipo, custo_fixo_mensal, custo_variavel_padrao)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!errComissoes && comissoesData) {
        setComissoes(comissoesData as MotoristaComissao[])
      }

      // Carregar motoristas
      const { data: motoristasData } = await supabase
        .from('motoristas')
        .select('*')
        .eq('user_id', userId)
        .order('nome', { ascending: true })

      if (motoristasData) {
        setMotoristas(motoristasData as Motorista[])
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSalvar = async () => {
    try {
      if (!formData.motorista_id || !formData.percentual_comissao) {
        alert('Informe motorista e percentual')
        return
      }

      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('motorista_comissoes')
          .update({
            percentual_comissao: parseFloat(formData.percentual_comissao),
            tipo_comissao: formData.tipo_comissao,
            observacao: formData.observacao || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .eq('user_id', userId)

        if (error) throw error
      } else {
        // Inserir
        const { error } = await supabase
          .from('motorista_comissoes')
          .insert({
            user_id: userId,
            motorista_id: formData.motorista_id,
            percentual_comissao: parseFloat(formData.percentual_comissao),
            tipo_comissao: formData.tipo_comissao,
            observacao: formData.observacao || null
          })

        if (error) throw error
      }

      // Limpar form e recarregar
      setFormData({
        motorista_id: '',
        percentual_comissao: '',
        tipo_comissao: 'Variavel',
        observacao: ''
      })
      setEditingId(null)
      setShowDialog(false)
      await carregarDados()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar comissão')
    }
  }

  const handleEditar = (comissao: MotoristaComissao) => {
    setFormData({
      motorista_id: comissao.motorista_id,
      percentual_comissao: comissao.percentual_comissao.toString(),
      tipo_comissao: comissao.tipo_comissao as 'Fixa' | 'Variavel',
      observacao: comissao.observacao || ''
    })
    setEditingId(comissao.id)
    setShowDialog(true)
  }

  const handleDeletar = async (id: string) => {
    if (!confirm('Confirmar exclusão?')) return

    try {
      const { error } = await supabase
        .from('motorista_comissoes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      await carregarDados()
    } catch (error) {
      console.error('Erro ao deletar:', error)
      alert('Erro ao deletar comissão')
    }
  }

  const handleNovoDialog = () => {
    setFormData({
      motorista_id: '',
      percentual_comissao: '',
      tipo_comissao: 'Variavel',
      observacao: ''
    })
    setEditingId(null)
    setShowDialog(true)
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-4">
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button onClick={handleNovoDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Comissão
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Comissão' : 'Nova Comissão de Motorista'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="motorista">Motorista</Label>
              <select
                id="motorista"
                className="w-full px-3 py-2 border rounded-md"
                value={formData.motorista_id}
                onChange={e => setFormData({ ...formData, motorista_id: e.target.value })}
                disabled={!!editingId}
              >
                <option value="">Selecione...</option>
                {motoristas.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="percentual">Percentual de Comissão (%)</Label>
              <Input
                id="percentual"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="5.00"
                value={formData.percentual_comissao}
                onChange={e => setFormData({ ...formData, percentual_comissao: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo de Comissão</Label>
              <select
                id="tipo"
                className="w-full px-3 py-2 border rounded-md"
                value={formData.tipo_comissao}
                onChange={e =>
                  setFormData({
                    ...formData,
                    tipo_comissao: e.target.value as 'Fixa' | 'Variavel'
                  })
                }
              >
                <option value="Variavel">Variável (% do frete)</option>
                <option value="Fixa">Fixa (valor fixo)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input
                id="observacao"
                placeholder="Notas sobre a comissão"
                value={formData.observacao}
                onChange={e => setFormData({ ...formData, observacao: e.target.value })}
              />
            </div>

            <Button onClick={handleSalvar} className="w-full">
              {editingId ? 'Atualizar' : 'Criar'} Comissão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabela */}
      <div className="rounded-md border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">Motorista</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Percentual</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Tipo</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {comissoes.map(comissao => (
              <tr key={comissao.id} className="border-t hover:bg-muted/50">
                <td className="px-6 py-3 text-sm">
                  {comissao.motorista?.nome || 'N/A'}
                </td>
                <td className="px-6 py-3 text-sm font-semibold">
                  {comissao.percentual_comissao.toFixed(2)}%
                </td>
                <td className="px-6 py-3 text-sm">{comissao.tipo_comissao}</td>
                <td className="px-6 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    comissao.ativo
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {comissao.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditar(comissao)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletar(comissao.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comissoes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma comissão cadastrada. Crie uma nova para começar.
        </div>
      )}
    </div>
  )
}
