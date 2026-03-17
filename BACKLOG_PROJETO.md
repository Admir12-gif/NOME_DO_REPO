# Backlog do Projeto (TMS)

Data de atualizacao: 2026-03-12
Escopo: cockpit do ciclo, acoes rapidas, eventos de viagem, ETA, abastecimento e documentacao/ocorrencias.

## 1) Ja foi feito

### 1.1 Cockpit e UX operacional
- [x] Reestruturacao do cockpit para layout mais compacto e operacional.
- [x] Ajustes de cards e distribuicao de informacao para reduzir espaco desperdicado.
- [x] Bloco de alertas dinamico (substituindo textos estaticos).
- [x] Remocao de bloco nao utilizado (Gestora de Risco).

### 1.2 Timeline e eventos do ciclo
- [x] Salvamento de eventos com refresh apos create/update para refletir na tela imediatamente.
- [x] Fallback local para eventos quando tabela `viagem_eventos` nao existe no banco.
- [x] Edicao de evento ao clicar na linha da tabela.
- [x] Exclusao de evento no modal de edicao.
- [x] Ordenacao da tabela do mais antigo para o mais recente.
- [x] Cor por status operacional da linha:
  - Planejado: amarelo leve.
  - Realizado: verde leve.
- [x] Status simplificado na tabela para `Planejado` e `Realizado`.
- [x] Correcao de local em Saida/Chegada para respeitar campo editado (origem/destino apenas fallback).

### 1.3 Acoes rapidas
- [x] Consolidacao de fluxo Partida/Chegada/Passagem com seletor no modal.
- [x] Passagem com ponto da rota + opcao "Outro ponto" da viagem.
- [x] Inclusao de acoes rapidas para manutencao e documentacao.
- [x] Acoes rapidas com modo de lancamento no formulario (`Realizado`/`Planejado`).

### 1.4 Abastecimento (fluxo rapido)
- [x] Formulario ampliado com campos principais do modulo:
  - veiculo, hodometro, litros, valor total, posto cadastrado/livre.
- [x] Inclusao de ARLA com regras:
  - SIM/NAO, litros e valor.
- [x] Termokim/Termoking (rotulo de tela) com regras:
  - SIM/NAO, horimetro, litros e valor.
- [x] Persistencia dos campos no payload do evento e reaproveitamento na edicao.
- [x] Upsert em `abastecimentos` integrado ao evento.

### 1.5 Ocorrencias x Documentacao
- [x] Separacao de formularios para evitar mistura de campos.
- [x] Ocorrencia com campos operacionais (categoria, severidade, parada, acao, responsavel etc.).
- [x] Documentacao com campos proprios (tipo, status, numero, emissor, validade, protocolo).
- [x] Validacoes especificas por contexto.

### 1.6 ETA e tempo operacional
- [x] ETA com ajuste por tempo perdido.
- [x] Recalculo automatico periodico do ETA durante viagem em andamento.
- [x] Exibicao de previsao de chegada ao destino no cockpit.
- [x] Tempo de abastecimento incluido no calculo de "Tempo total parado".

### 1.7 Planejado x Realizado do ciclo
- [x] Modal para preencher realizado da timeline planejada.
- [x] Modal para editar timeline planejada.
- [x] Persistencia em `viagens.planejamento_rota` para datas planejadas/realizadas.

---

## 2) Backlog pendente (proximos passos)

### 2.1 Itens macro do projeto
- [ ] Reestruturar cockpit na viagem (acabamento final visual e de fluxo).
- [ ] Aplicar 10 acoes rapidas (revisar lista final e cobertura de todos os cenarios do operador).
- [ ] Adicionar KPIs essenciais (validar definicao final com operacao/gestao).
- [ ] Simplificar lancamento de viagem (reduzir cliques, defaults inteligentes, validacao guiada).
- [ ] Validar build e erros de ponta a ponta (projeto inteiro, nao apenas arquivo alterado).

### 2.2 Melhorias funcionais recomendadas
- [ ] Definir regra de negocio final para "fechamento de ciclo":
  - compactar etapas automaticamente quando status for Concluida;
  - botao "+" para expandir detalhes por etapa.
- [ ] Gerar codigo de referencia unico por ciclo e exibir no cockpit/tabela.
- [ ] Revisar relacao entre eventos planejados e ETA para evitar distorcao em cenarios mistos.
- [ ] Garantir filtros claros para visualizacao operacional (ex.: por tipo, por status, por periodo).

### 2.3 Qualidade e teste
- [ ] Criar checklist de regressao para eventos (create/edit/delete, planejado/realizado, fallback local).
- [ ] Adicionar testes automatizados para regras criticas de payload e validacoes de formulario.
- [ ] Validar comportamento mobile em fluxos de modal e tabela extensa.

---

## 3) Notas tecnicas
- Arquivo principal de evolucao recente:
  - `app/(dashboard)/viagens/[viagemId]/viagem-detalhe-client.tsx`
- Modulo de ETA relacionado:
  - `lib/eta.ts`
- Se a tabela `viagem_eventos` estiver ausente no Supabase, o sistema opera com fallback local no navegador.

## 4) Sugestao de priorizacao imediata
1. Fechar regra de fechamento de ciclo (compactacao + expansao + codigo referencia).
2. Rodar validacao completa de build/lint/testes.
3. Congelar escopo das 10 acoes rapidas e KPI final para evitar retrabalho.
