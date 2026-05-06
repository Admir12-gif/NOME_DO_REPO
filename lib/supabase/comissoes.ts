// lib/supabase/comissoes.ts
// Utilities for motorista comissão calculations and operations

import { createClient } from '@supabase/supabase-js'
import type { MotoristaComissaoAuditoria, Viagem, ContaPagar } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function obterComissaoMotorista(
  userId: string,
  motoristaId: string
): Promise<{
  percentual: number
  tipo: string
} | null> {
  const { data, error } = await supabase
    .from('motorista_comissoes')
    .select('percentual_comissao, tipo_comissao')
    .eq('user_id', userId)
    .eq('motorista_id', motoristaId)
    .eq('ativo', true)
    .single()

  if (error) {
    console.warn('Erro ao obter comissão motorista:', error)
    return null
  }

  return {
    percentual: data?.percentual_comissao || 0,
    tipo: data?.tipo_comissao || 'Variavel'
  }
}

export async function calcularComissaoViagem(
  viagem: Viagem,
  userId: string
): Promise<number> {
  if (!viagem.motorista_id || !viagem.valor_frete) {
    return 0
  }

  const comissao = await obterComissaoMotorista(userId, viagem.motorista_id)
  if (!comissao) {
    return 0
  }

  return (viagem.valor_frete * comissao.percentual) / 100
}

export async function criarComissaoViagemEmAcerto(
  viagem: Viagem,
  userId: string
): Promise<{
  contaPagerId: string
  valorComissao: number
} | null> {
  if (!viagem.motorista_id || !viagem.valor_frete || viagem.status !== 'Concluida') {
    return null
  }

  try {
    const comissaoValue = await calcularComissaoViagem(viagem, userId)
    if (comissaoValue === 0) {
      return null
    }

    // Criar entrada em contas_pagar
    const { data: contaPagar, error: errorCP } = await supabase
      .from('contas_pagar')
      .insert({
        user_id: userId,
        motorista_id: viagem.motorista_id,
        categoria: 'Comissao motorista',
        data_vencimento: new Date().toISOString(),
        valor: comissaoValue,
        status: 'Em aberto',
        observacao: `Comissão viagem ${viagem.id}`, 
        fornecedor: null
      })
      .select('id')
      .single()

    if (errorCP) {
      console.error('Erro ao criar contaPagar:', errorCP)
      return null
    }

    // Registrar auditoria
    await registrarAuditoriaComissao({
      user_id: userId,
      motorista_id: viagem.motorista_id,
      viagem_id: viagem.id,
      valor_frete: viagem.valor_frete,
      percentual_aplicado: (await obterComissaoMotorista(userId, viagem.motorista_id))?.percentual || 0,
      valor_comissao: comissaoValue,
      data_calculo: new Date().toISOString(),
      contas_pagar_id: contaPagar.id
    })

    return {
      contaPagerId: contaPagar.id,
      valorComissao: comissaoValue
    }
  } catch (error) {
    console.error('Erro ao criar comissão viagem:', error)
    return null
  }
}

async function registrarAuditoriaComissao(
  auditoria: Omit<MotoristaComissaoAuditoria, 'id'>
): Promise<void> {
  const { error } = await supabase
    .from('motorista_comissoes_auditoria')
    .insert(auditoria)

  if (error) {
    console.error('Erro ao registrar auditoria comissão:', error)
  }
}

export async function obterComissoesMotoristaNoMes(
  userId: string,
  motoristaId: string,
  mes: number,
  ano: number
): Promise<number> {
  const inicioDo = new Date(ano, mes - 1, 1).toISOString()
  const fimDo = new Date(ano, mes, 0, 23, 59, 59).toISOString()

  const { data, error } = await supabase
    .from('motorista_comissoes_auditoria')
    .select('valor_comissao')
    .eq('user_id', userId)
    .eq('motorista_id', motoristaId)
    .gte('data_calculo', inicioDo)
    .lte('data_calculo', fimDo)

  if (error) {
    console.warn('Erro ao obter comissões do mês:', error)
    return 0
  }

  return data?.reduce((sum, item) => sum + (item.valor_comissao || 0), 0) || 0
}

export async function atualizarComissaoMotorista(
  userId: string,
  comissaoId: string,
  novoPercentual: number,
  ativo?: boolean
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    percentual_comissao: novoPercentual,
    updated_at: new Date().toISOString()
  }

  if (ativo !== undefined) {
    updateData.ativo = ativo
  }

  const { error } = await supabase
    .from('motorista_comissoes')
    .update(updateData)
    .eq('user_id', userId)
    .eq('id', comissaoId)

  if (error) {
    console.error('Erro ao atualizar comissão motorista:', error)
    return false
  }

  return true
}
