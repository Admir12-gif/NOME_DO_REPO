# 📊 ANÁLISE COMPLETA - SISTEMA TMS (Transportation Management System)

**Data**: Abril 2026 | **Status**: Análise de Requisitos | **Responsável**: Tech Lead

---

## 📋 EXECUTIVO

Seu TMS tem **60% da funcionalidade de um ERP de transporte implementada**. O cockpit operacional de viagens é **robusto e completo**. Os principais gaps são:

- ⚠️ **Inconsistências no banco** (acentuação, schema incompleto)
- ⚠️ **Faltam automações críticas** (alertas manutenção, comissões, fluxo caixa)
- ⚠️ **Analytics superficial** (KPIs básicos, falta drilldown/relatórios)
- ⚠️ **Sem integração externa** (documentos fiscais, GPS, bancos)

**Investimento necessário**: 6-8 semanas para tornar "pronto para produção".

---

## 1️⃣ O QUE JÁ EXISTE (IMPLEMENTADO)

### ✅ CORE OPERACIONAL - Viagens (100%)

**Nível de Detalhe: EXCELENTE**

```
VIAGEM (entrada)
  ├─ Cliente + Veiculo + Motorista + Rota
  ├─ Origem/Destino planejado + realizado
  ├─ KM planejado vs KM realizado
  └─ 5 Status: Planejada → Em andamento → Concluída (ou Cancelada)

COCKPIT OPERACIONAL (durante viagem):
  ├─ Timeline de 8 tipos de eventos
  │  ├─ Chegada (carregar/ descarregar)
  │  ├─ Saída
  │  ├─ Abastecimento (Diesel, ARLA, Termoking)
  │  ├─ Ocorrência (problema mecânico/ acidente)
  │  ├─ Pedágio
  │  ├─ Parada (descanso)
  │  ├─ Espera (cliente atrasado)
  │  └─ Nova Viagem (acerto de ciclo)
  │
  ├─ Modo PLANEJADO vs REALIZADO (cada evento)
  ├─ Sincronização de tempo real
  │  ├─ Chegada carregar → Fim carregamento
  │  ├─ Chegada descarregar → Fim descarga
  │  └─ Velocidade média (km/h)
  │
  ├─ ETA INTELIGENTE
  │  ├─ Cálculo de atraso estimado
  │  ├─ Reajuste por tempo parado
  │  └─ Atualização contínua
  │
  └─ DOCUMENTAÇÃO INTEGRADA
     ├─ NFe, CTE, MDFE (uploads)
     ├─ Fotos de prova
     └─ Comprovantes

ANÁLISE AUTOMÁTICA:
  ├─ Consumo real (km/l)
  ├─ Tempo parado vs tempo movimento
  ├─ Desvio de km vs planejado
  └─ Atraso acumulado por ponto intermediário

FLUXO COMPLETO:
  1. Criar viagem com cliente/rota/veiculo
  2. Registrar inicio carregamento/fim carregamento
  3. Sair (saída evento)
  4. Registrar abastecimentos en route
  5. Registrar ocorrências (se houver)
  6. Chegada destino
  7. Registrar descarga
  8. Fechar viagem
  9. Gerar ciclo se múltiplas viagens
```

**Resultado**: Operador consegue gerir viagem COMPLETA sem sair da tela.

---

### ✅ MASTER DATA - Cadastros (95%)

| Módulo | Campos | Completude |
|--------|--------|-----------|
| **Clientes** | Nome, Cidade, Estado, Cond. Pag., Forma Pag., Obs | ✅ 100% |
| **Veículos** | Placa, Modelo, Ano, Hodômetro, Meta KM/L, Intervalo Manut | ✅ 100% |
| **Motoristas** | Nome, Tipo (CLT/Agregado/Terceiro), Custo Fixo, Custo Variável | ⚠️ 80% (falta CNH, validade) |
| **Rotas** | Origem/Destino, KM, Pedágio, Tempo ciclo, **Pontos intermediários** | ✅ 100% |
| **Postos** | Nome, Localidade, Localização, Associação com rotas | ✅ 100% |

**Todos com CRUD completo e validações**.

---

### ✅ FINANCEIRO - Contas (85%)

#### **Contas a Receber**
- ✅ Cliente, Viagem, Valor, Datas (emissão/vencimento/recebimento)
- ✅ Status: Em aberto, Recebido, Atrasado
- ✅ Forma pagamento (Boleto, Depósito, PIX, Transferência, Cartão)
- ✅ Dashboard mostra total "A Receber"
- ⚠️ FALTA: Descontos/Acréscimos, Integração com cobrador

#### **Contas a Pagar**
- ✅ Fornecedor, Categoria (Diesel, Manutenção, Pedagio, Seguro, Salário, Impostos, etc)
- ✅ Status: Em aberto, Pago, Atrasado
- ✅ Datas (vencimento, pagamento)
- ✅ Motorista e Viagem (opcionais)
- ⚠️ FALTA: Fluxo de acerto de caixa, Reconciliação bancária

---

### ✅ FROTA - Operação (90%)

#### **Abastecimentos**
- ✅ Veiculo, Data, Hodômetro, Litros, Valor
- ✅ Posto (texto livre OU registro de posto_abastecimento)
- ✅ Viagem (vinculação opcional)
- ✅ Cálculo KM/L automático
- ✅ Tipos especiais: ARLA, Termoking (com payload estruturado)

#### **Manutenções**
- ✅ Veiculo, Data, Hodômetro, Tipo (Preventiva/Corretiva)
- ✅ Sistema afetado (Motor, Freios, Pneus, Elétrica, Suspensão, Outros)
- ✅ Descrição, Custo, Oficina, Dias parado
- ⚠️ FALTA: Auto-disparo de alertas (recomendação preventiva)
- ⚠️ FALTA: Integração com Contas a Pagar automática

---

### ✅ DASHBOARD - KPIs Básicos (60%)

**Implementado**:
- Faturamento (mês)
- Lucro operacional
- Viagens (contagem)
- KM rodados
- Media KM/L
- Total A Receber
- Total A Pagar
- Veículos ativos
- Manutenções pendentes

**Gráficos**: Faturamento/Custos mensal, Distribuição de custos (mapa), Status viagens.

**Filtros contextuais**: Período, Status, Cliente, Rota, Placa.

---

## 2️⃣ O QUE FALTA (CRÍTICO → MENOR PRIORIDADE)

### 🔴 CRÍTICOS (Impossibilita operação em produção)

| # | Funcionalidade | Por quê é crítico? | Esforço |
|---|---|---|---|
| **1** | **Schema Inconsistente** (acentuação "Concluída" vs "Concluida") | Bugs aleatórios de validação | 2h |
| **2** | **Tipos de evento incompletos** | Banco rejeita 'nova_viagem', 'manutencao' | 1h |
| **3** | **Tabela rotas.pontos_intermediarios** | Não criada em script 001; app assume existir | 2h |
| **4** | **Zero coerência transacional** | Criar viagem + eventos pode falhar parcialmente | 4h |
| **5** | **Alertas de manutenção preventiva** | Veículo segue rodando após vencer intervalo | 6h |

### 🟠 ALTAS (Limita eficiência operacional)

| # | Funcionalidade | Impacto | Esforço |
|---|---|---|---|
| **6** | **Cálculo auto de comissão motorista** | Acerto manual propenso a erros, motoristas insatisfeitos | 8h |
| **7** | **Controle de carburante** (cartão, limite de compra) | Sem controle de fluxo de combustível | 12h |
| **8** | **Relatório de rentabilidade** (por cliente, rota, veiculo) | Decisões cegas (qual cliente é lucrativo?) | 16h |
| **9** | **Analytics com drilldown** | KPIs superficiais, sem visão profunda | 20h |
| **10** | **Geração de código referência p/ ciclos** | Rastreamento posterior muito difícil | 4h |
| **11** | **Notificações/alertas** (viagem atrasada, manutenção vencida) | Reatividade apenas visual | 12h |
| **12** | **Integração de documentos fiscais** (NFe/CTE com API) | Não-conformidade fiscal | 24h |
| **13** | **Fluxo de acerto de caixa** | Reconciliação manual propensa a erros | 16h |
| **14** | **Gestão de multas/ocorrências** | Sem rastreabilidade legal | 12h |
| **15** | **Integração com sistema de RH** | Dados descorrelacionados | 20h |

### 🟡 MÉDIAS (Melhoram UX e conformidade)

| # | Funcionalidade | Impacto | Esforço |
|---|---|---|---|
| **16** | **App mobile** (evento real-time pelo motorista) | Motorista registra via app, não por SMS/chamado | 80h |
| **17** | **Integração WhatsApp/SMS** (notif ao cliente) | Cliente sabe ETA atualizado automaticamente | 16h |
| **18** | **Dados de CNH/RNTRC na plataforma** | Conformidade administrativa, alertas renovação | 12h |
| **19** | **Histórico de preço combustível** | Identificar postos com melhor custo | 8h |
| **20** | **Comparação ETA vs realizado** | Medir precisão de planejamento | 12h |
| **21** | **Gestão automatizada de multas** | Menos manual, mais rastreabilidade | 16h |
| **22** | **Exportação relatórios** (PDF, Excel) | Compartilhamento com clientes/fornecedores | 20h |
| **23** | **Portal do cliente** (tracking + invoice) | Cliente vê sua viagem em tempo real | 40h |
| **24** | **Integração bancária** (cobrança + conciliação) | Automatiza bilhetagem, reconcilia contas | 40h |

---

## 3️⃣ MATRIZ DE COMPLETUDE POR MÓDULO

```
Viagens ████████████████████ 100%   ✅ Robusto
Cadastros ███████████████████░ 95%   ✅ Muito completo
Abastecimentos ██████████████████░░ 90%   ✅ Funcional
Manutencoes ██████████████████░░ 90%   ✅ Funcional
Financeiro ████████████████░░░░  80%   ⚠️ Incompleto
Dashboard ████████████░░░░░░░░░░  60%   ⚠️ Básico
Relatórios ░░░░░░░░░░░░░░░░░░░░  0%    🔴 Não existe
Configurações ░░░░░░░░░░░░░░░░░░░░  0%    🔴 Não existe
Mobile ░░░░░░░░░░░░░░░░░░░░  0%    🔴 Não existe
API/Webhooks ░░░░░░░░░░░░░░░░░░░░  0%    🔴 Não existe
```

---

## 4️⃣ PROBLEMAS NO BANCO E CÓDIGO

### Schema Issues

```sql
-- PROBLEMA 1: Acentuação inconsistente
viagens.status CHECK IN ('Planejada', 'Em andamento', 'Concluida', 'Cancelada')
-- Mas app envia 'Concluída' às vezes → Erro de validação

-- PROBLEMA 2: Table não existe
-- app assumes rotas.pontos_intermediarios (JSONB) mas foi criada?
-- Script 012 adds it IF NOT EXISTS - frágil

-- PROBLEMA 3: Tipos de evento incompletos
viagem_eventos.tipo_evento CHECK IN ('chegada', 'saida', ...)
-- Não inclui 'nova_viagem', 'manutencao' que app usa
-- Inserts falham silenciosamente ou com erro confuso
```

### Code Issues

- **Sem transações**: Operações complexas (criar viagem + 5 eventos + docs) podem falhar no meio
- **Sem audit log**: Se mudou comissão de motorista, histórico fica perdido
- **Sem versionamento**: Dados críticos não têm histórico
- **Validações espalhadas**: Parte frontend, parte backend, parte banco

---

## 5️⃣ RECOMENDAÇÃO DE ROADMAP (6-8 SEMANAS)

### 📌 SEMANA 1-2: Estabilizar Base

```
[ ] Sprint Fix-Schema
  [ ] Migração: Normalizar 'Concluida' (sem acento) em toda base
  [ ] Migração: Adicionar tipos evento faltantes ao CHECK
  [ ] Migração: Adicionar rotas.pontos_intermediarios se não existe
  [ ] Migração: Adicionar constraints FK que faltam (abastecimentos.posto)
  [ ] Teste E2E: Criar viagem → evento → fechar (sem erros)

[ ] Melhorar Validações
  [ ] Consolidar enums em types.ts
  [ ] Validação backend para cada transição de status
  [ ] Feedback claro ao usuário (não "Erro: viagens_status_check")
```

**Resultado**: Sistema estável, sem crashes aleatórios.

---

### 📌 SEMANA 3-4: Features Operacionais Core

```
[ ] Alertas de Manutenção Preventiva
  [ ] Dashboard mostra "Preventiva vencida em X km" por veiculo
  [ ] Bloqueio: não consegue colocar veiculo em viagem se preventiva vencida
  [ ] Email/SMS ao gerente

[ ] Comissão de Motorista Automática
  [ ] Criar labor table: motorista_comissoes
  [ ] Ao fechar viagem: calcular comissão automática
  [ ] Dashboard mostra comissão devida vs paga
  [ ] Integração com Contas a Pagar

[ ] Código de Referência por Ciclo
  [ ] Gerar UUID curto único ao criar ciclo (ex: CYC-2024-001)
  [ ] Mostrar em dashboard de ciclos
  [ ] Facilitador para rastreamento posterior

[ ] Notificações Básicas
  [ ] Toaster no cockpit: "Viagem atrasada em 30 min"
  [ ] Badge no menu: "3 manutenções vencidas"
  [ ] Email simples para gerente se viagem > 1h atrasada
```

**Resultado**: Operação mais automática, menos manual.

---

### 📌 SEMANA 5-6: Analytics & Reporting

```
[ ] Dashboard Analítico (Page new)
  [ ] Rentabilidade por cliente (gráfico)
  [ ] Rentabilidade por rota (tabela)
  [ ] Eficiência de frota (KM/L comparado)
  [ ] Pontualidade (% viagens no prazo vs atrase)
  [ ] Top 5: Clientes, Rotas, Veículos

[ ] Relatórios Exportáveis
  [ ] Relatório de viagem (PDF): timeline + custos + documentos
  [ ] Relatório mensal de ciclos (Excel)
  [ ] Relatório de contas (A Receber, A Pagar)

[ ] Drilldown
  [ ] Clicar em "Rentabilidade/Cliente" → detalhe viagens daquele cliente
  [ ] Clicar em "Frota/KM/L" → histórico abastecimentos daquele veiculo
```

**Resultado**: Visão analítica do negócio, decisões baseadas em dados.

---

### 📌 SEMANA 7-8: Integração & Consolidação

```
[ ] Integração de Documentos Fiscais
  [ ] Upload NFe/CTE/MDFE no cockpit (já existe!)
  [ ] Validação XML básica
  [ ] Armazenamento em bucket (já existe!)
  [ ] Link download em relatório de viagem

[ ] Fluxo de Acerto de Caixa
  [ ] Tela: Contas a Receber + Contas a Pagar lado-a-lado
  [ ] Conciliação manual: marcar como "acertado"
  [ ] Relatório: "Não conciliado desde 01/04"

[ ] Testes de Regressão
  [ ] Nada quebrou, tudo funciona end-to-end
  [ ] Documentação atualizada
```

**Resultado**: Sistema pronto para produção.

---

## 6️⃣ ROADMAP FUTURO (MESES 3-6)

### Pós-MVP (Nice-to-have, Diferencial Competitivo)

1. **App Mobile** (React Native)
   - Motorista registra evento via app (não precisa de escritório)
   - GPS real-time (integração com API)
   - Fotos offline, sync quando conecta
   - Push notifications

2. **Integração WhatsApp/SMS**
   - "Sua viagem será entregue em 14:30"
   - Link de rastreamento para cliente

3. **Portal Cliente**
   - Cliente vê suas viagens (status, ETA)
   - Download de documentos (NF, CTE)
   - Invoice automática

4. **Integração Bancária**
   - API de cobrança (automação de boleto)
   - Reconciliação automática de recebimentos
   - Cash flow visual

5. **API REST/GraphQL**
   - Integradores terceiros (TMS local integrado com seu sistema)
   - Webhooks para eventos críticos

---

## 7️⃣ ESTIMATIVA DE ESFORÇO TOTAL

| Fase | Descrição | Dias (1 dev) | Prioridade |
|------|-----------|--------------|-----------|
| **Fix Base** | Schema + Validações | 5 dias | 🔴 P0 |
| **Operacional** | Alertas + Comissões + Não tifi | 10 dias | 🔴 P0 |
| **Analytics** | Dashboard analítico + Relatórios | 10 dias | 🟠 P1 |
| **Consolidação** | Testes E2E + Documentação | 5 dias | 🟠 P1 |
| **TOTAL MVP Pronto** | | **30 dias (6 semanas)** | |

---

## 📝 PRÓXIMOS PASSOS DE AÇÃO

### Hoje
- [ ] Revisar este documento
- [ ] Priorizar: Quais "FALTAS" são mais críticas para seu negócio?

### Esta semana
- [ ] Planejar sprints de 1 semana
- [ ] Começar por "Fix Schema" (garante estabilidade)

### Próximo mês
- [ ] Ter sistema estável e pronto para pilotar com usuários reais
- [ ] Feedback: o que usuários pedem que falta

---

## 📞 Perguntas para Responder

1. **Prioridade**: Mais importante é estabilidade (fix schema) ou features (comissões)?
2. **Integração**: Já tem sistema de RH / Contabilidade que precisa integrar?
3. **Mobile**: Motoristas podem usar web responsive, ou precisam de app mobile?
4. **Usuários**: Quantos usuários simultâneos esperados? (dimensionamento)
5. **Conformidade**: Precisa integração com órgãos (RNTRC, ANTT)?

---

**Versão**: 1.0  
**Próxima revisão**: Após feedback do usuário  
**Confidencial**: Interno
