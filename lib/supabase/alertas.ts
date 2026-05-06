// lib/supabase/alertas.ts
// Utilities for automated alerts (maintenance, delays, etc)

import { createClient } from '@supabase/supabase-js'
import type { Alerta, Veiculo, Viagem, Manutencao } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function verificarManutencaoVencida(
  userId: string,
  veiculo: Veiculo
): Promise<boolean> {
  // Verifica se hodômetro atual ultrapassou intervalo de manutenção
  if (!veiculo.intervalo_manutencao) {
    return false
  }

  // Buscar última manutenção
  const { data: ultimaManutencao, error } = await supabase
    .from('manutencoes')
    .select('hodometro')
    .eq('user_id', userId)
    .eq('veiculo_id', veiculo.id)
    .order('hodometro', { ascending: false })
    .limit(1)
    .single()

  if (error || !ultimaManutencao) {
    // Se não há manutenção registrada, é urgente
    return veiculo.hodometro_atual > veiculo.intervalo_manutencao
  }

  // Proximidade para próxima manutenção
  const proximoIntervalo = ultimaManutencao.hodometro + veiculo.intervalo_manutencao
  return veiculo.hodometro_atual >= proximoIntervalo
}

export async function criarAlertaManutencao(
  userId: string,
  veiculo: Veiculo,
  descricao?: string
): Promise<string | null> {
  // Verificar se alerta já existe
  const { data: existente } = await supabase
    .from('alertas')
    .select('id')
    .eq('user_id', userId)
    .eq('tipo_alerta', 'Manutencao vencida')
    .eq('entidade_id', veiculo.id)
    .eq('resolvido', false)
    .limit(1)

  if (existente && existente.length > 0) {
    return existente[0].id
  }

  // Criar novo alerta
  const { data, error } = await supabase
    .from('alertas')
    .insert({
      user_id: userId,
      tipo_alerta: 'Manutencao vencida',
      entidade_tipo: 'Veiculo',
      entidade_id: veiculo.id,
      titulo: `Manutenção vencida - ${veiculo.placa_cavalo}`,
      descricao: descricao || `Veículo ${veiculo.placa_cavalo} necessita manutenção preventiva`,
      severity: 'alto'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar alerta manutenção:', error)
    return null
  }

  return data?.id || null
}

export async function verificarViagemAtrasada(
  viagem: Viagem,
  atrasoMaximoMinutos: number = 30
): Promise<boolean> {
  return (viagem.atraso_estimado_minutos || 0) > atrasoMaximoMinutos
}

export async function criarAlertaViagemAtrasada(
  userId: string,
  viagem: Viagem,
  atrasoMinutos: number
): Promise<string | null> {
  // Verificar se alerta já existe
  const { data: existente } = await supabase
    .from('alertas')
    .select('id')
    .eq('user_id', userId)
    .eq('tipo_alerta', 'Viagem atrasada')
    .eq('entidade_id', viagem.id)
    .eq('resolvido', false)
    .limit(1)

  if (existente && existente.length > 0) {
    return existente[0].id
  }

  const severity = atrasoMinutos > 120 ? 'critico' : atrasoMinutos > 60 ? 'alto' : 'normal'

  const { data, error } = await supabase
    .from('alertas')
    .insert({
      user_id: userId,
      tipo_alerta: 'Viagem atrasada',
      entidade_tipo: 'Viagem',
      entidade_id: viagem.id,
      titulo: `Viagem atrasada - ${atrasoMinutos} min`,
      descricao: `Viagem ${viagem.numero || viagem.id.slice(0, 8)} está ${atrasoMinutos} minutos atrasada`,
      severity
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar alerta viagem atrasada:', error)
    return null
  }

  return data?.id || null
}

export async function obterAlertasAtivos(
  userId: string,
  severidadeMinima: 'critico' | 'alto' | 'normal' | 'info' = 'normal'
): Promise<Alerta[]> {
  const { data, error } = await supabase
    .from('alertas')
    .select('*')
    .eq('user_id', userId)
    .eq('resolvido', false)
    .in('severity', getNiveisMinimos(severidadeMinima))
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.warn('Erro ao obter alertas ativos:', error)
    return []
  }

  return (data || []) as Alerta[]
}

function getNiveisMinimos(severidade: string): string[] {
  const niveis: Record<string, string[]> = {
    critico: ['critico'],
    alto: ['critico', 'alto'],
    normal: ['critico', 'alto', 'normal'],
    info: ['critico', 'alto', 'normal', 'info']
  }
  return niveis[severidade] || niveis.normal
}

export async function resolverAlerta(
  userId: string,
  alertaId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('alertas')
    .update({
      resolvido: true,
      data_resolucao: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('id', alertaId)

  if (error) {
    console.error('Erro ao resolver alerta:', error)
    return false
  }

  return true
}

export async function obterContagemAlertas(userId: string): Promise<{
  criticos: number
  altos: number
  normais: number
  total: number
}> {
  const { data, error } = await supabase
    .from('alertas')
    .select('severity')
    .eq('user_id', userId)
    .eq('resolvido', false)

  if (error) {
    console.warn('Erro ao obter contagem de alertas:', error)
    return { criticos: 0, altos: 0, normais: 0, total: 0 }
  }

  const alertas = (data || []) as Array<{ severity: string }>
  return {
    criticos: alertas.filter(a => a.severity === 'critico').length,
    altos: alertas.filter(a => a.severity === 'alto').length,
    normais: alertas.filter(a => a.severity === 'normal').length,
    total: alertas.length
  }
}

export async function limparAlertasResolvidosAntigos(
  userId: string,
  diasRetencao: number = 30
): Promise<number> {
  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() - diasRetencao)

  const { data: deleted, error } = await supabase
    .from('alertas')
    .delete()
    .eq('user_id', userId)
    .eq('resolvido', true)
    .lt('data_resolucao', dataLimite.toISOString())
    .select('id')

  if (error) {
    console.error('Erro ao limpar alertas antigos:', error)
    return 0
  }

  return deleted?.length || 0
}
