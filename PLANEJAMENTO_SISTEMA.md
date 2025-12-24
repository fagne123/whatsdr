# Planejamento do Sistema LigAI - Nurturing Completo

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Fluxo de Nurturing](#3-fluxo-de-nurturing)
4. [Sistema de Fila Automática](#4-sistema-de-fila-automática)
5. [Flow Builder](#5-flow-builder)
6. [Monitoramento de Ligações](#6-monitoramento-de-ligações)
7. [Interface do CRM](#7-interface-do-crm)
8. [Integrações Externas](#8-integrações-externas)
9. [Banco de Dados](#9-banco-de-dados)
10. [Estrutura de Arquivos](#10-estrutura-de-arquivos)
11. [API Endpoints](#11-api-endpoints)
12. [Fases de Implementação](#12-fases-de-implementação)
13. [Variáveis de Ambiente](#13-variáveis-de-ambiente)

---

## 1. Visão Geral

### 1.1 Objetivo

Expandir o LigAI existente (sistema de ligações com IA via Asterisk) para um **sistema completo de nurturing de leads**, integrando múltiplas plataformas e canais de comunicação.

### 1.2 Filosofia do Sistema

> **"Ligação SEMPRE primeiro. WhatsApp apenas como fallback quando o lead não atende OU quando a IA não consegue convencer através da ligação."**

### 1.3 Componentes Principais

| Componente | Função |
|------------|--------|
| **LigAI (existente)** | Ligações com IA via Asterisk/AudioSocket |
| **Queue Service** | Fila automática com regras de processamento |
| **Nurturing Engine** | Controle de timing e status dos leads |
| **Flow Builder** | Automação visual de mensagens WhatsApp |
| **CRM Interno** | Interface para acompanhamento de leads |

### 1.4 Integrações

| Sistema | Função |
|---------|--------|
| **ABC Station** | Fonte de leads (webhook de entrada) |
| **Belle Software** | CRM externo para agendamentos |
| **WhatsApp Meta Cloud API** | Canal de fallback para mensagens |
| **Asterisk PBX** | Sistema de telefonia (já integrado) |

---

## 2. Arquitetura do Sistema

### 2.1 Diagrama Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ENTRADA DE LEADS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ABC Station ──────► POST /api/webhooks/abc-station                          │
│  WhatsApp ─────────► POST /api/webhooks/whatsapp                             │
│  Manual ───────────► POST /api/leads                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       QUEUE SERVICE (Fila Automática)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Lead entra na fila com status "AGUARDANDO_INICIO"                         │
│  • Verifica regras: horário comercial, limite simultâneo, intervalo          │
│  • Se OK → Inicia Passo 1 automaticamente                                    │
│  • Se não → Agenda para próximo horário válido                               │
│  • Controla ligações ativas em tempo real                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NURTURING ENGINE (Lógica Fixa)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Controla timing (0h, 24h, 48h, 72h, Loop)                                 │
│  • Executa ligações via LigAI                                                │
│  • Detecta: atendeu+agendou / atendeu+não convenceu / não atendeu            │
│  • Se não atendeu OU não convenceu → DISPARA FLOW BUILDER                    │
│  • Gerencia status do lead                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│      CANAL: TELEFONE         │     │        FLOW BUILDER         │
│      (LigAI Existente)       │     │        (Configurável)       │
├─────────────────────────────┤     ├─────────────────────────────┤
│ • AudioSocket (port 9092)    │     │ • Templates WhatsApp        │
│ • Groq Whisper STT           │     │ • Mídia (texto/vídeo/img)   │
│ • OpenRouter AI (Claude)     │     │ • Janelas de horário        │
│ • Murf TTS                   │     │ • Botões interativos        │
│ • AMI (Asterisk Manager)     │     │ • Condições e delays        │
└─────────────────────────────┘     └─────────────────────────────┘
             │                                    │
             │                                    ▼
             │                      ┌─────────────────────────────┐
             │                      │      WHATSAPP SERVICE       │
             │                      │      (Meta Cloud API)       │
             │                      ├─────────────────────────────┤
             │                      │ • Envio de mensagens        │
             │                      │ • Recebimento (webhook)     │
             │                      │ • Mídia (vídeo/imagem)      │
             │                      │ • Botões interativos        │
             │                      └─────────────────────────────┘
             │                                    │
             │                                    ▼
             │                      ┌─────────────────────────────┐
             │                      │      Lead respondeu?        │
             │                      └─────────────────────────────┘
             │                           │              │
             │                          SIM            NÃO
             │                           ▼              ▼
             │                ┌──────────────┐  ┌──────────────────┐
             │                │  IA ASSUME   │  │ Aguarda timeout  │
             │                │  CONVERSA    │  │ → Próximo passo  │
             │                └──────────────┘  └──────────────────┘
             │                           │
             └───────────────────────────┴───────────────┐
                                                         ▼
                                 ┌─────────────────────────────────────┐
                                 │         BELLE SOFTWARE (CRM)        │
                                 ├─────────────────────────────────────┤
                                 │ • Criar/Atualizar Clientes          │
                                 │ • Criar Agendamentos                │
                                 │ • Consultar Serviços/Planos         │
                                 └─────────────────────────────────────┘
```

### 2.2 Fluxo de Dados

```
Lead ABC Station
       │
       ▼
  [Webhook] ──► [Database: leads] ──► [Queue Service]
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
             [Aguarda Regras]         [Inicia Ligação]        [Agenda Futuro]
                    │                       │
                    └───────────────────────┤
                                            ▼
                                    [Nurturing Engine]
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
              [Atendeu+Agendou]    [Atendeu+Não Conv.]      [Não Atendeu]
                    │                       │                       │
                    ▼                       └───────────┬───────────┘
              [Belle: Agenda]                           ▼
                    │                          [Flow Builder]
                    ▼                                   │
                  [FIM]                                 ▼
                                              [WhatsApp Fallback]
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    ▼                   ▼                   ▼
                              [Respondeu]         [Não Resp.]          [Recusou]
                                    │                   │                   │
                                    ▼                   ▼                   ▼
                              [IA Conversa]      [Próximo Passo]          [FIM]
                                    │
                                    ▼
                              [Belle: Agenda]
                                    │
                                    ▼
                                  [FIM]
```

---

## 3. Fluxo de Nurturing

### 3.1 Timeline dos 5 Passos

```
     0h         24h         48h         72h         96h        144h        192h
     │           │           │           │           │           │           │
     ▼           ▼           ▼           ▼           ▼           ▼           ▼
  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
  │PASSO1│   │PASSO2│   │PASSO3│   │PASSO4│   │PASSO5│   │PASSO5│   │PASSO5│
  └──────┘   └──────┘   └──────┘   └──────┘   └──────┘   └──────┘   └──────┘
     │           │           │           │           │           │           │
     ▼           ▼           ▼           ▼           ▼           ▼           ▼
  📞 + 📝     📞 + 🎬     📞 + 🖼️     📞 + 📝       📞          📞          📞
  TEXTO      VÍDEO      IMAGEM     FINAL       LOOP        LOOP        LOOP
```

### 3.2 Detalhamento por Passo

#### PASSO 1 (Hora 0) - Primeiro Contato

```
📞 LIGAÇÃO IA (automática quando regras OK)
│
├── ✅ ATENDEU + AGENDOU:
│   └── IA conversa → Qualifica → Agenda Belle
│       └── Status: "AGENDADO_SUCESSO_VOZ_P1" → FIM
│
├── ⚠️ ATENDEU + NÃO CONVENCEU:
│   └── IA conversou mas não conseguiu agendar
│       └── Status: "NAO_CONVENCEU_P1"
│           ↓
│       ┌────────────────────────────────────────────────────┐
│       │  🔧 FLOW BUILDER DISPARA                           │
│       │  ├── Aguarda janela: 07-09h | 11-13h | 17-20h     │
│       │  └── 📱 WhatsApp: TEXTO (script configurável)      │
│       └────────────────────────────────────────────────────┘
│           ↓
│       ├── 💬 Respondeu → IA assume conversa → Agenda Belle → FIM
│       └── ⏰ Não respondeu (24h) → Vai para PASSO 2
│
└── ❌ NÃO ATENDEU:
    └── Status: "NAO_ATENDEU_P1"
        ↓
    ┌────────────────────────────────────────────────────┐
    │  🔧 FLOW BUILDER DISPARA                           │
    │  ├── Aguarda janela: 07-09h | 11-13h | 17-20h     │
    │  └── 📱 WhatsApp: TEXTO (script configurável)      │
    └────────────────────────────────────────────────────┘
        ↓
    ├── 💬 Respondeu → IA assume conversa → Agenda Belle → FIM
    └── ⏰ Não respondeu (24h) → Vai para PASSO 2
```

#### PASSO 2 (Hora 24) - Segunda Tentativa

```
📞 LIGAÇÃO IA
│
├── ✅ ATENDEU + AGENDOU → Status: "AGENDADO_SUCESSO_VOZ_P2" → FIM
│
├── ⚠️ ATENDEU + NÃO CONVENCEU → Status: "NAO_CONVENCEU_P2"
│   └── WhatsApp: VÍDEO + Botões (Sim/Não)
│       ├── Respondeu "Sim" → IA assume → Agenda Belle → FIM
│       ├── Respondeu "Não" → Status: "RECUSOU" → FIM
│       └── Não respondeu (24h) → Vai para PASSO 3
│
└── ❌ NÃO ATENDEU → Status: "NAO_ATENDEU_P2"
    └── WhatsApp: VÍDEO + Botões (Sim/Não)
        ├── Respondeu "Sim" → IA assume → Agenda Belle → FIM
        ├── Respondeu "Não" → Status: "RECUSOU" → FIM
        └── Não respondeu (24h) → Vai para PASSO 3
```

#### PASSO 3 (Hora 48) - Terceira Tentativa

```
📞 LIGAÇÃO IA
│
├── ✅ ATENDEU + AGENDOU → Status: "AGENDADO_SUCESSO_VOZ_P3" → FIM
│
├── ⚠️ ATENDEU + NÃO CONVENCEU → Status: "NAO_CONVENCEU_P3"
│   └── WhatsApp: IMAGEM + Botões (Sim/Não)
│       ├── Respondeu "Sim" → IA assume → Agenda Belle → FIM
│       ├── Respondeu "Não" → Status: "RECUSOU" → FIM
│       └── Não respondeu (24h) → Vai para PASSO 4
│
└── ❌ NÃO ATENDEU → Status: "NAO_ATENDEU_P3"
    └── WhatsApp: IMAGEM + Botões (Sim/Não)
        ├── Respondeu "Sim" → IA assume → Agenda Belle → FIM
        ├── Respondeu "Não" → Status: "RECUSOU" → FIM
        └── Não respondeu (24h) → Vai para PASSO 4
```

#### PASSO 4 (Hora 72) - Última Tentativa com WhatsApp

```
📞 LIGAÇÃO IA
│
├── ✅ ATENDEU + AGENDOU → Status: "AGENDADO_SUCESSO_VOZ_P4" → FIM
│
├── ⚠️ ATENDEU + NÃO CONVENCEU → Status: "NAO_CONVENCEU_P4"
│   └── WhatsApp: TEXTO FINAL (despedida)
│       └── 🚫 BLOQUEIA WHATSAPP para este lead
│           └── Vai para LOOP DE VOZ
│
└── ❌ NÃO ATENDEU → Status: "NAO_ATENDEU_P4_ENCERRA_MSG"
    └── WhatsApp: TEXTO FINAL (despedida)
        └── 🚫 BLOQUEIA WHATSAPP para este lead
            └── Vai para LOOP DE VOZ
```

#### PASSO 5 (Hora 96+) - Loop de Voz

```
🔄 LOOP ANTI-SPAM
│
├── ❌ Nenhum WhatsApp (bloqueado)
├── 📞 Ligações periódicas a cada 48h
├── 🕐 Apenas em horário comercial
└── 🔁 Continua até:
    ├── Lead atender e agendar → FIM
    └── Cancelamento manual → FIM
```

### 3.3 Janelas de Horário para WhatsApp

| Período | Horário | Pode Enviar? |
|---------|---------|--------------|
| Madrugada | 00:00 - 07:00 | ❌ Não |
| **Manhã** | **07:00 - 09:00** | ✅ Sim |
| Manhã | 09:00 - 11:00 | ❌ Não |
| **Almoço** | **11:00 - 13:00** | ✅ Sim |
| Tarde | 13:00 - 17:00 | ❌ Não |
| **Noite** | **17:00 - 20:00** | ✅ Sim |
| Noite | 20:00 - 00:00 | ❌ Não |

### 3.4 Tabela de Status do Lead

| Status | Descrição | Próxima Ação |
|--------|-----------|--------------|
| `AGUARDANDO_INICIO` | Lead na fila, aguardando regras | Sistema verifica automaticamente |
| `EM_LIGACAO` | Ligação em andamento | Aguardar resultado |
| `NAO_ATENDEU_P1` | Não atendeu passo 1 | Flow Builder → WhatsApp TEXTO |
| `NAO_ATENDEU_P2` | Não atendeu passo 2 | Flow Builder → WhatsApp VÍDEO |
| `NAO_ATENDEU_P3` | Não atendeu passo 3 | Flow Builder → WhatsApp IMAGEM |
| `NAO_ATENDEU_P4_ENCERRA_MSG` | Não atendeu passo 4 | Flow Builder → WhatsApp FINAL + Bloqueia |
| `NAO_CONVENCEU_P1` | Atendeu P1 mas não agendou | Flow Builder → WhatsApp TEXTO |
| `NAO_CONVENCEU_P2` | Atendeu P2 mas não agendou | Flow Builder → WhatsApp VÍDEO |
| `NAO_CONVENCEU_P3` | Atendeu P3 mas não agendou | Flow Builder → WhatsApp IMAGEM |
| `NAO_CONVENCEU_P4` | Atendeu P4 mas não agendou | Flow Builder → WhatsApp FINAL + Loop |
| `AGENDADO_SUCESSO_VOZ_P1` | Agendou por voz no passo 1 | FIM |
| `AGENDADO_SUCESSO_VOZ_P2` | Agendou por voz no passo 2 | FIM |
| `AGENDADO_SUCESSO_VOZ_P3` | Agendou por voz no passo 3 | FIM |
| `AGENDADO_SUCESSO_VOZ_P4` | Agendou por voz no passo 4 | FIM |
| `AGENDADO_SUCESSO_WA` | Agendou via WhatsApp | FIM |
| `RECUSOU` | Lead disse "não" | FIM |
| `LOOP_VOZ` | Em loop de ligações | Ligação periódica a cada 48h |
| `WA_BLOQUEADO` | WhatsApp bloqueado | Apenas ligações |

---

## 4. Sistema de Fila Automática

### 4.1 Fluxo de Entrada

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ENTRADA DE LEAD (ABC Station Webhook)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Lead registrado no sistema                                               │
│     Status: "AGUARDANDO_INICIO"                                              │
│     Entra na FILA DE PROCESSAMENTO                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. Verificação de Regras                                                    │
│                                                                              │
│     ├── Está dentro do horário comercial?                                   │
│     ├── Número de ligações simultâneas < limite?                            │
│     └── Passou o intervalo mínimo desde última ligação?                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              [TODAS SIM]                    [ALGUMA NÃO]
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐  ┌───────────────────────────────────────────┐
│  3A. INICIA PASSO 1           │  │  3B. AGUARDA NA FILA                      │
│      Status: "EM_ANDAMENTO"   │  │      Agenda para próximo horário válido   │
│      Liga para o lead         │  │      Continua verificando a cada minuto   │
└───────────────────────────────┘  └───────────────────────────────────────────┘
```

### 4.2 Interface de Configurações

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Configurações > Fluxo Automático                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MODO DE OPERAÇÃO:                                                          │
│  ● Automático com regras (recomendado)                                      │
│  ○ Manual (leads aguardam ação do operador)                                 │
│  ○ Desativado (apenas recebe leads, não processa)                           │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  HORÁRIO DE LIGAÇÕES:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Início: [09:00]     Fim: [18:00]                                   │    │
│  │                                                                      │    │
│  │  Dias ativos:                                                        │    │
│  │  ☑️ Segunda  ☑️ Terça  ☑️ Quarta  ☑️ Quinta  ☑️ Sexta               │    │
│  │  ☐ Sábado   ☐ Domingo                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  LIMITES DE PROCESSAMENTO:                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Ligações simultâneas máximas:    [2]                               │    │
│  │  Intervalo entre ligações:        [3] minutos                       │    │
│  │  Máximo de ligações por hora:     [15]                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  COMPORTAMENTO FORA DO HORÁRIO:                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Quando lead chegar fora do horário comercial:                      │    │
│  │                                                                      │    │
│  │  ● Aguardar próximo horário comercial para ligar                    │    │
│  │  ○ Enviar WhatsApp imediato, ligar no horário comercial             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│                                                    [Cancelar] [💾 Salvar]   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Exemplos de Funcionamento

| Cenário | Lead Chega | Ação do Sistema |
|---------|------------|-----------------|
| Horário OK, sem ligações ativas | 10:30 (terça) | Inicia Passo 1 imediatamente |
| Horário OK, 2 ligações ativas (limite) | 10:35 (terça) | Aguarda uma terminar, depois inicia |
| Fora do horário | 23:00 (terça) | Agenda para 09:00 (quarta) |
| Fim de semana | 15:00 (sábado) | Agenda para 09:00 (segunda) |
| Intervalo não respeitado | 10:31 (3 min após última) | Aguarda até 10:33 |

---

## 5. Flow Builder

### 5.1 Visão Geral

O Flow Builder é um **editor visual drag-and-drop** baseado em React Flow que permite criar fluxos de automação personalizados para WhatsApp e outras integrações.

### 5.2 Estatísticas do Sistema

| Aspecto | Valor |
|---------|-------|
| Tipos de Gatilho | 7 |
| Tipos de Nós | 12 |
| Status de Fluxo | 4 (draft, active, paused, archived) |
| Operadores de Condição | 15+ |

### 5.3 Tipos de Gatilhos

| Gatilho | Descrição | Configuração |
|---------|-----------|--------------|
| **Não Atendeu Ligação** | Quando lead não atende | `step` (1, 2, 3, 4) |
| **Não Convenceu Ligação** | Quando atendeu mas IA não convenceu | `step` (1, 2, 3, 4) |
| **Palavra-chave** | Palavra na mensagem recebida | `keywords[]`, `matchType` |
| **Novo Lead** | Quando lead é criado | Automático |
| **Tag Adicionada** | Quando tag é adicionada | `tags[]` |
| **Agendamento** | Execução por CRON | `expression` |
| **Manual** | Execução via API/UI | Nenhuma |

### 5.4 Tipos de Nós

#### Categoria: Gatilhos 🟡

| Nó | Tipo | Descrição |
|----|------|-----------|
| Trigger | `trigger` | Ponto de entrada do fluxo |

#### Categoria: WhatsApp 🟢

| Nó | Tipo | Descrição |
|----|------|-----------|
| Mensagem | `whatsapp_message` | Envia texto ou mídia |
| Botões | `whatsapp_buttons` | Mensagem com botões interativos (máx 3) |
| Lista | `whatsapp_list` | Mensagem com lista de opções (máx 10) |

#### Categoria: Lógica 🟣

| Nó | Tipo | Descrição |
|----|------|-----------|
| Condição | `condition` | Avalia condições e roteia |
| Delay | `delay` | Aguarda um período |
| Set Variable | `set_variable` | Define uma variável |

#### Categoria: Ações 🔵

| Nó | Tipo | Descrição |
|----|------|-----------|
| Atualizar Lead | `update_lead` | Atualiza dados do lead |
| Agendar Belle | `schedule_belle` | Cria agendamento no CRM |
| Add Tag | `add_tag` | Adiciona tags ao lead |
| Remove Tag | `remove_tag` | Remove tags do lead |
| Chamar IA | `ai_response` | IA gera resposta |

#### Categoria: Finalização ⚫

| Nó | Tipo | Descrição |
|----|------|-----------|
| Fim | `end` | Finaliza o fluxo |

### 5.5 Configuração dos Nós

#### WhatsApp Message
```json
{
  "message": "Olá {{lead.name}}! Tudo bem?",
  "mediaType": "image",
  "mediaUrl": "https://...",
  "mediaCaption": "Confira nossa promoção!"
}
```

#### WhatsApp Buttons
```json
{
  "message": "Como posso ajudar?",
  "buttons": [
    { "id": "btn_sim", "text": "Quero agendar" },
    { "id": "btn_nao", "text": "Agora não" },
    { "id": "btn_info", "text": "Mais informações" }
  ]
}
```

#### Condition
```json
{
  "conditions": [
    {
      "field": "{{lead.service_interest}}",
      "operator": "equals",
      "value": "Depilação"
    }
  ],
  "logicOperator": "and"
}
```

#### Delay
```json
{
  "duration": 2,
  "unit": "hours",
  "respectTimeWindows": true,
  "timeWindows": [
    { "start": "07:00", "end": "09:00" },
    { "start": "11:00", "end": "13:00" },
    { "start": "17:00", "end": "20:00" }
  ]
}
```

#### AI Response
```json
{
  "prompt": "Responda a mensagem do cliente de forma amigável: {{message.content}}",
  "maxTokens": 150,
  "saveResponseTo": "ai_response"
}
```

### 5.6 Sistema de Variáveis

**Sintaxe:** `{{variavel}}` ou `{{objeto.campo}}`

| Fonte | Prefixo | Exemplos |
|-------|---------|----------|
| Lead | `lead` | `{{lead.name}}`, `{{lead.phone}}`, `{{lead.service_interest}}` |
| Mensagem | `message` | `{{message.content}}`, `{{message.buttonId}}` |
| Config | `config` | `{{config.unit_name}}`, `{{config.attendant_name}}` |
| Variável Custom | (nome) | `{{minha_variavel}}` |
| Resposta IA | (nome) | `{{ai_response}}` |

### 5.7 Operadores de Condição

#### String
| Operador | Descrição |
|----------|-----------|
| `equals` | Igual (case-insensitive) |
| `not_equals` | Diferente |
| `contains` | Contém |
| `not_contains` | Não contém |
| `starts_with` | Começa com |
| `ends_with` | Termina com |
| `is_empty` | Está vazio |
| `is_not_empty` | Não está vazio |

#### Numérico
| Operador | Descrição |
|----------|-----------|
| `greater_than` | Maior que |
| `less_than` | Menor que |
| `greater_or_equal` | Maior ou igual |
| `less_or_equal` | Menor ou igual |

#### Lista
| Operador | Descrição |
|----------|-----------|
| `in_list` | Está na lista |
| `not_in_list` | Não está na lista |

### 5.8 Interface Visual

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  🔧 Flow Builder - Fallback Passo 2                    [Salvar] [Publicar] [⋮]         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌────────────────┐  ┌─────────────────────────────────────────┐  ┌─────────────────┐  │
│  │                │  │                                         │  │                 │  │
│  │  📋 NÓS       │  │              CANVAS                     │  │  ⚙️ CONFIGURAR  │  │
│  │                │  │                                         │  │                 │  │
│  │  ─────────────│  │       ┌──────────────┐                  │  │  Mensagem       │  │
│  │  🟡 Gatilhos  │  │       │   Trigger    │                  │  │                 │  │
│  │  ├─ Trigger   │  │       │ Não Atendeu  │                  │  │  Tipo:          │  │
│  │               │  │       │    P2        │                  │  │  [Vídeo ▼]      │  │
│  │  ─────────────│  │       └──────┬───────┘                  │  │                 │  │
│  │  🟢 WhatsApp  │  │              │                          │  │  URL:           │  │
│  │  ├─ Mensagem  │  │              ▼                          │  │  [https://...]  │  │
│  │  ├─ Botões    │  │       ┌──────────────┐                  │  │                 │  │
│  │  └─ Lista     │  │       │   Delay      │                  │  │  Legenda:       │  │
│  │               │  │       │  Aguardar    │                  │  │  ┌───────────┐  │  │
│  │  ─────────────│  │       │  janela WA   │                  │  │  │Oi {{nome}}│  │  │
│  │  🟣 Lógica    │  │       └──────┬───────┘                  │  │  │Tudo bem?  │  │  │
│  │  ├─ Condição  │  │              │                          │  │  └───────────┘  │  │
│  │  ├─ Delay     │  │              ▼                          │  │                 │  │
│  │  └─ Variável  │  │       ┌──────────────┐                  │  │  Botões:        │  │
│  │               │  │       │  WhatsApp    │◄─── selecionado  │  │  [+ Adicionar]  │  │
│  │  ─────────────│  │       │   Vídeo +    │                  │  │                 │  │
│  │  🔵 Ações     │  │       │   Botões     │                  │  │  ┌───────────┐  │  │
│  │  ├─ Atualizar │  │       └──────┬───────┘                  │  │  │Sim, quero!│  │  │
│  │  ├─ Agendar   │  │              │                          │  │  │Ação: [IA] │  │  │
│  │  ├─ Add Tag   │  │       ┌──────┴──────┐                   │  │  └───────────┘  │  │
│  │  └─ IA        │  │       │             │                   │  │                 │  │
│  │               │  │       ▼             ▼                   │  │  ┌───────────┐  │  │
│  │  ─────────────│  │  ┌─────────┐  ┌─────────┐              │  │  │Não, obrig.│  │  │
│  │  ⚫ Final     │  │  │ Condição│  │ Timeout │              │  │  │Ação:[Recu]│  │  │
│  │  └─ Fim       │  │  │respondeu│  │  24h    │              │  │  └───────────┘  │  │
│  │               │  │  └────┬────┘  └────┬────┘              │  │                 │  │
│  │               │  │       │            │                    │  │  ─────────────  │  │
│  │               │  │       ▼            ▼                    │  │                 │  │
│  │               │  │  ┌─────────┐  ┌─────────┐              │  │  {{}} Variáveis │  │
│  │               │  │  │IA Assume│  │Próx Step│              │  │  ├─ lead.name   │  │
│  │               │  │  │ Conversa│  │         │              │  │  ├─ lead.phone  │  │
│  │               │  │  └─────────┘  └─────────┘              │  │  └─ config.*    │  │
│  │               │  │                                         │  │                 │  │
│  └────────────────┘  └─────────────────────────────────────────┘  └─────────────────┘  │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  MiniMap: [▓▓░░░░░░░░]                              Zoom: 100%  │  Auto-save: ✓ Salvo  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Monitoramento de Ligações

### 6.1 Página Fila - Visão Geral

A página Fila possui **duas abas principais**: Tempo Real e Histórico.

### 6.2 Aba Tempo Real

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 Fila de Processamento                        🟢 Sistema Ativo (2/2)     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [🔴 Tempo Real]  [📊 Histórico]                      ← Abas de navegação   │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  🔴 EM LIGAÇÃO (2)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📞 João Silva      │ Passo 1 │ 02:34 ⏱️          [Ver Conversa]    │    │
│  │ 📞 Maria Santos    │ Passo 2 │ 01:12 ⏱️          [Ver Conversa]    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Ao clicar em "Ver Conversa" (Modal de Monitoramento):                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🎙️ LIGAÇÃO AO VIVO - João Silva                      [✕ Fechar]   │    │
│  │ ───────────────────────────────────────────────────────────────────│    │
│  │ 🤖 IA: Olá João, aqui é da Addebitare...                           │    │
│  │ 👤 Lead: Oi, tudo bem?                                              │    │
│  │ 🤖 IA: Tudo ótimo! Estou ligando porque...                         │    │
│  │ 👤 Lead: Ah sim, eu tenho um precatório...                         │    │
│  │ 🤖 IA: Que bom! Posso agendar uma reunião... █                     │    │
│  │                                   (transcrevendo ao vivo)           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ⏳ AGUARDANDO (15)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  #1 │ Ana Costa      │ 84 99777-5678 │ Chegou há 2 min  │ [⏭ Pular] │    │
│  │  #2 │ Pedro Lima     │ 84 99666-9012 │ Chegou há 5 min  │ [⏭ Pular] │    │
│  │  #3 │ Lucas Souza    │ 84 99555-3456 │ Chegou há 8 min  │ [⏭ Pular] │    │
│  │  ... mais 12                                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  🕐 AGENDADOS PARA DEPOIS                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Carla Dias    │ Amanhã 09:00 │ Chegou fora do horário              │    │
│  │  Bruno Torres  │ Amanhã 09:00 │ Chegou fora do horário              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ✅ PROCESSADOS HOJE (23)                                   [Ver Todos →]   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Pedro Lima     │ Passo 1 │ ✅ Converteu      │ 14:20               │    │
│  │  Julia Santos   │ Passo 2 │ ❌ Não atendeu    │ 14:15               │    │
│  │  Roberto Dias   │ Passo 1 │ ⚠️ Não convenceu  │ 14:10               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  CONTROLES:                                                                  │
│  [⏸️ Pausar Sistema] [🔄 Reprocessar Fila] [⚙️ Configurações]              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Aba Histórico (com Filtros)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 Fila de Processamento                        🟢 Sistema Ativo (2/2)     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [🔴 Tempo Real]  [📊 Histórico]                      ← Abas de navegação   │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  ┌─── FILTROS ────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  📅 Período:  [Hoje ▼]   ou   De: [15/12/2024] Até: [23/12/2024]   │     │
│  │                                                                     │     │
│  │  ┌────────────────────────────────────────────────────────────┐    │     │
│  │  │ Hoje │ Ontem │ Últimos 7 dias │ Este mês │ Personalizado   │    │     │
│  │  └────────────────────────────────────────────────────────────┘    │     │
│  │                                                                     │     │
│  │  📋 Resultado:  [Todos ▼]        🔢 Passo:  [Todos ▼]             │     │
│  │                                                                     │     │
│  │  ┌─────────────┐                 ┌─────────────┐                   │     │
│  │  │ ✅ Converteu │                 │ Passo 1     │                   │     │
│  │  │ ❌ Não atendeu│                │ Passo 2     │                   │     │
│  │  │ ⚠️ Não convenceu│              │ Passo 3     │                   │     │
│  │  │ 🔄 Em andamento│               │ Passo 4     │                   │     │
│  │  └─────────────┘                 └─────────────┘                   │     │
│  │                                                                     │     │
│  │  🔍 Buscar lead: [________________________]       [🔍 Filtrar]     │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─── ESTATÍSTICAS DO PERÍODO ────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │   📞 Total: 156    ✅ Convertidos: 42 (27%)    ❌ Não atendeu: 67  │     │
│  │   ⚠️ Não convenceu: 38    ⏱️ Duração média: 3m 24s                 │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─── RESULTADOS (156 ligações) ──────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  Lead            │ Passo │ Resultado      │ Duração │ Data/Hora    │     │
│  │  ─────────────────────────────────────────────────────────────────  │     │
│  │  Pedro Lima      │   1   │ ✅ Converteu   │  5:12   │ 23/12 14:20  │     │
│  │  Julia Santos    │   2   │ ❌ Não atendeu │  0:45   │ 23/12 14:15  │     │
│  │  Roberto Dias    │   1   │ ⚠️ Não conv.  │  4:33   │ 23/12 14:10  │     │
│  │  Carla Mendes    │   3   │ ✅ Converteu   │  6:01   │ 23/12 13:45  │     │
│  │  André Costa     │   1   │ ❌ Não atendeu │  0:30   │ 23/12 13:30  │     │
│  │  ...                                                                │     │
│  │                                                                     │     │
│  │                   [← Anterior]  1 2 3 4 5  [Próximo →]              │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Modal de Detalhes da Ligação

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📞 DETALHES DA LIGAÇÃO                                       [✕ Fechar]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  👤 Lead: Pedro Lima                                       [Ver Lead →]     │
│  📱 Telefone: (11) 99999-9999                                               │
│  📋 Passo: 1 - Primeiro Contato                                             │
│  📅 Data: 23/12/2024 às 14:15                                               │
│  ⏱️ Duração: 5 minutos e 12 segundos                                        │
│  ✅ Resultado: CONVERTEU                                                     │
│                                                                              │
│  ┌─── 🔊 ÁUDIO ───────────────────────────────────────────────────────┐     │
│  │  [▶️ Play]  ▬▬▬▬▬▬▬●▬▬▬▬▬▬▬▬▬▬▬▬▬▬  2:34 / 5:12   🔊 ━━━━━━━○     │     │
│  │                                                                     │     │
│  │  [⏪ -10s]  [⏩ +10s]  [⬇️ Download]  [1x ▼]                        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─── 💬 TRANSCRIÇÃO ─────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  14:15:03  🤖 IA                                                   │     │
│  │  Olá Pedro, aqui é da Addebitare. Tudo bem com você?               │     │
│  │                                                                     │     │
│  │  14:15:08  👤 Pedro                                                │     │
│  │  Oi, tudo bem sim. Quem é?                                         │     │
│  │                                                                     │     │
│  │  14:15:12  🤖 IA                                                   │     │
│  │  Meu nome é Sofia, sou assistente virtual da Addebitare.           │     │
│  │  Estou entrando em contato porque identificamos que você           │     │
│  │  possui precatórios a receber. Posso falar sobre isso?             │     │
│  │                                                                     │     │
│  │  14:15:25  👤 Pedro                                                │     │
│  │  Ah sim, eu tenho um precatório do estado de São Paulo.            │     │
│  │  Faz tempo que estou esperando...                                  │     │
│  │                                                                     │     │
│  │  ... (scroll para ver mais)                                        │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─── 📊 ANÁLISE DA IA ───────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  😊 Sentimento: Positivo                                           │     │
│  │  🎯 Objeções identificadas: Tempo de espera                        │     │
│  │  ✅ Técnicas utilizadas: Empatia, Urgência, Agendamento direto     │     │
│  │  📝 Resumo: Lead receptivo, demonstrou interesse após              │     │
│  │     explicação sobre antecipação. Agendou reunião para 24/12.      │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Filtros Disponíveis

| Filtro | Opções |
|--------|--------|
| **Período** | Hoje, Ontem, Últimos 7 dias, Este mês, Personalizado (data início/fim) |
| **Resultado** | Converteu, Não atendeu, Não convenceu, Em andamento, Todos |
| **Passo** | Passo 1, Passo 2, Passo 3, Passo 4, Todos |
| **Busca** | Nome do lead, telefone |

### 6.6 Funcionalidades do Modal de Detalhes

| Funcionalidade | Descrição |
|----------------|-----------|
| ▶️ Reproduzir áudio | Player de áudio com controles (play, pause, seek) |
| 📝 Transcrição | Conversa completa com timestamps |
| 📊 Análise IA | Sentimento, objeções, técnicas usadas, resumo |
| ⬇️ Download | Baixar áudio da ligação |
| 🔗 Ver Lead | Link direto para página de detalhes do lead |

### 6.7 Resumo: Onde Acessar Cada Informação

| Informação | Aba Tempo Real | Aba Histórico | Detalhes Lead |
|------------|----------------|---------------|---------------|
| Conversa ao vivo | ✅ | ❌ | ❌ |
| Ligações do dia (resumo) | ✅ | ✅ | ✅ |
| Histórico completo com filtros | ❌ | ✅ | ❌ |
| Reproduzir áudio | ❌ | ✅ | ✅ |
| Transcrição completa | ✅ (ao vivo) | ✅ | ✅ |
| Análise de sentimento | ❌ | ✅ | ✅ |
| Timeline completa (WhatsApp + Ligação) | ❌ | ❌ | ✅ |

---

## 7. Interface do CRM

### 7.1 Estrutura de Navegação

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  🏠 LigAI                                                          👤 Operador     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────┬────────┬────────┬──────────┬──────────┬────────┬──────────┬────────┐ │
│  │Dashboard │  Fila  │ Leads  │  Funil   │Conversas │ Flows  │Instâncias│   ⚙️   │ │
│  └──────────┴────────┴────────┴──────────┴──────────┴────────┴──────────┴────────┘ │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Páginas do Sistema

| Página | Função |
|--------|--------|
| **Dashboard** | Métricas em tempo real, atividade recente |
| **Fila** | Tempo Real (ligações ativas, fila, monitoramento ao vivo) + Histórico (todas ligações com filtros) |
| **Leads** | Lista de todos os leads com filtros |
| **Funil** | Visão Kanban por passo do nurturing |
| **Conversas** | Chat estilo WhatsApp |
| **Flows** | Flow Builder visual |
| **Instâncias** | Gerenciar conexões WhatsApp |
| **⚙️** | Configurações do sistema |

### 7.3 Dashboard Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Dashboard                                          Hoje: 23/12/2024     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  📞 Hoje    │ │  ✅ Conv.   │ │  📈 Taxa    │ │  ⏱️ Média   │           │
│  │    156      │ │    42       │ │   27%       │ │   3:24      │           │
│  │  ligações   │ │  conversões │ │  conversão  │ │  duração    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                             │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────────┐   │
│  │ 📈 Ligações por Hora (Hoje)     │ │ 🥧 Resultados (Hoje)            │   │
│  │                                  │ │                                 │   │
│  │   ▓▓                            │ │    ✅ Converteu: 27%            │   │
│  │   ▓▓▓▓                          │ │    ❌ Não atendeu: 43%          │   │
│  │   ▓▓▓▓▓▓▓                       │ │    ⚠️ Não convenceu: 24%        │   │
│  │   ▓▓▓▓▓▓▓▓▓▓                    │ │    🔄 Em andamento: 6%          │   │
│  │  ───────────────────            │ │                                 │   │
│  │  09  10  11  12  13  14         │ │                                 │   │
│  └─────────────────────────────────┘ └─────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔴 Atividade em Tempo Real                                          │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ 14:25  📞 João Silva atendeu ligação (Passo 1)                      │   │
│  │ 14:23  ✅ Maria Santos agendou via WhatsApp                         │   │
│  │ 14:20  📱 Pedro Lima recebeu vídeo (Passo 2)                        │   │
│  │ 14:18  ❌ Ana Costa não atendeu (Passo 3)                           │   │
│  │ 14:15  📥 Novo lead: Carlos Oliveira (ABC Station)                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Página de Leads

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  👥 Leads                                              [+ Novo Lead]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔍 [Buscar por nome, telefone, email...]                                  │
│                                                                             │
│  Filtros: [Status ▼] [Passo ▼] [Origem ▼] [Período ▼]      📊 Total: 1.234 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Nome          │ Telefone      │ Status       │ Passo │ Última Ação  │   │
│  │ ────────────────────────────────────────────────────────────────────│   │
│  │ João Silva    │ 11 99999-1111 │ EM_LIGACAO   │   1   │ Agora        │   │
│  │ Maria Santos  │ 11 99999-2222 │ AGENDADO     │   2   │ Há 5 min     │   │
│  │ Pedro Lima    │ 11 99999-3333 │ NAO_ATENDEU  │   3   │ Há 15 min    │   │
│  │ Ana Costa     │ 11 99999-4444 │ LOOP_VOZ     │   5   │ Há 1 hora    │   │
│  │ Carlos Dias   │ 11 99999-5555 │ AGUARDANDO   │   1   │ Há 2 horas   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [← Anterior]  Página 1 de 62  [Próximo →]                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.5 Visão Kanban (Funil)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Funil de Nurturing                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ PASSO 1  │ │ PASSO 2  │ │ PASSO 3  │ │ PASSO 4  │ │  LOOP    │          │
│  │   (45)   │ │   (23)   │ │   (12)   │ │   (8)    │ │   (15)   │          │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤          │
│  │          │ │          │ │          │ │          │ │          │          │
│  │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │          │
│  │ │João S│ │ │ │Maria │ │ │ │Pedro │ │ │ │Ana   │ │ │ │Lucas │ │          │
│  │ │📞 Lig│ │ │ │📱 WA │ │ │ │⏳ Ag │ │ │ │📞 Lig│ │ │ │🔄 48h│ │          │
│  │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │          │
│  │          │ │          │ │          │ │          │ │          │          │
│  │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │          │
│  │ │Carlos│ │ │ │Julia │ │ │ │Carla │ │ │ │Bruno │ │ │ │Paula │ │          │
│  │ │⏳ 2m │ │ │ │📱 Leu│ │ │ │📞 5h │ │ │ │⏳ Ag │ │ │ │🔄 24h│ │          │
│  │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │          │
│  │          │ │          │ │          │ │          │ │          │          │
│  │ ┌──────┐ │ │          │ │          │ │          │ │          │          │
│  │ │...   │ │ │          │ │          │ │          │ │          │          │
│  │ └──────┘ │ │          │ │          │ │          │ │          │          │
│  │          │ │          │ │          │ │          │ │          │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.6 Página de Conversas (WhatsApp)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  💬 Conversas                                                               │
├───────────────────────┬─────────────────────────────────────────────────────┤
│                       │                                                     │
│  🔍 [Buscar...]       │  👤 Maria Santos                    [Ver Lead →]   │
│                       │  📱 11 99999-2222  │  Passo 2                       │
│  ──────────────────── │  ─────────────────────────────────────────────────  │
│                       │                                                     │
│  ┌─────────────────┐  │           14:20                                    │
│  │ 🟢 Maria Santos │  │           ┌─────────────────────┐                  │
│  │    Oi, sim!     │  │           │ Olá Maria! Tudo bem?│                  │
│  │    Há 2 min     │  │           │ Você tem interesse  │                  │
│  └─────────────────┘  │           │ em agendar?         │                  │
│                       │           └─────────────────────┘                  │
│  ┌─────────────────┐  │                                                     │
│  │ 🟡 João Silva   │  │  ┌─────────────────────┐                           │
│  │    Aguardando   │  │  │ Oi, sim! Pode ser   │           14:22           │
│  │    Há 15 min    │  │  │ amanhã às 10h?      │                           │
│  └─────────────────┘  │  └─────────────────────┘                           │
│                       │                                                     │
│  ┌─────────────────┐  │           14:23                                    │
│  │ ⚪ Pedro Lima   │  │           ┌─────────────────────┐                  │
│  │    Visualizou   │  │           │ Perfeito! Agendado  │                  │
│  │    Há 1 hora    │  │           │ para amanhã às 10h. │                  │
│  └─────────────────┘  │           └─────────────────────┘                  │
│                       │                                                     │
│                       │  ─────────────────────────────────────────────────  │
│                       │                                                     │
│                       │  [📎] [Digite uma mensagem...              ] [➤]   │
│                       │                                                     │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 8. Integrações Externas

### 8.1 ABC Station (Fonte de Leads)

**Tipo:** Webhook de entrada

**Endpoint:** `POST /api/webhooks/abc-station`

**Payload Esperado:**
```json
{
  "lead_id": "abc-123456",
  "name": "João Silva",
  "phone": "+5511999999999",
  "email": "joao@email.com",
  "service_interest": "Depilação a Laser",
  "source": "landing_page",
  "created_at": "2024-12-23T14:00:00Z"
}
```

**Resposta:**
```json
{
  "success": true,
  "lead_id": "ligai-uuid-123",
  "status": "AGUARDANDO_INICIO",
  "message": "Lead recebido e adicionado à fila de processamento"
}
```

### 8.2 Belle Software (CRM de Agendamentos)

**Tipo:** API REST com token de autenticação

**Base URL:** `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0`

**Endpoints Utilizados:**

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/listarServicos` | Lista serviços disponíveis |
| GET | `/listarPlanos` | Lista planos de tratamento |
| POST | `/gravarLead` | Cria ou atualiza cliente |
| POST | `/gravarAgendamento` | Cria agendamento |

**Exemplo - Criar Agendamento:**
```json
POST /gravarAgendamento
{
  "cliente_id": "belle-123",
  "servico_id": "srv-456",
  "data": "2024-12-24",
  "hora": "10:00",
  "observacao": "Agendado via LigAI"
}
```

### 8.3 WhatsApp Meta Cloud API

**Tipo:** API REST + Webhook de entrada

**Documentação:** https://developers.facebook.com/docs/whatsapp/cloud-api

#### Configuração Necessária

1. **Business Account** no Meta Business Suite
2. **WhatsApp Business Account ID**
3. **Phone Number ID**
4. **Access Token** (permanente ou de 60 dias)
5. **Webhook URL** verificado

#### Envio de Mensagens

**Texto Simples:**
```json
POST https://graph.facebook.com/v18.0/{phone_id}/messages
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Olá! Tudo bem?"
  }
}
```

**Mensagem com Botões:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": {
      "text": "Você gostaria de agendar?"
    },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn_sim", "title": "Sim, quero!" } },
        { "type": "reply", "reply": { "id": "btn_nao", "title": "Agora não" } }
      ]
    }
  }
}
```

**Mensagem com Vídeo:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "video",
  "video": {
    "link": "https://exemplo.com/video.mp4",
    "caption": "Confira nosso vídeo!"
  }
}
```

#### Webhook de Recebimento

**Endpoint:** `POST /api/webhooks/whatsapp`

**Payload de Mensagem Recebida:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "5511999999999",
          "phone_number_id": "PHONE_ID"
        },
        "contacts": [{
          "profile": { "name": "João Silva" },
          "wa_id": "5511888888888"
        }],
        "messages": [{
          "from": "5511888888888",
          "id": "wamid.xxx",
          "timestamp": "1703343600",
          "type": "text",
          "text": { "body": "Olá, quero agendar!" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### 8.4 Gerenciamento de Múltiplas Instâncias WhatsApp

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📱 Instâncias WhatsApp                                    [+ Nova Instância]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🟢 Principal - Clínica Centro                                      │    │
│  │  ───────────────────────────────────────────────────────────────── │    │
│  │  📞 +55 11 99999-1111                                               │    │
│  │  📊 Hoje: 45 msgs enviadas │ Limite: 1000/dia                       │    │
│  │  🔄 Última atividade: há 2 minutos                                  │    │
│  │                                                    [⚙️] [⏸️] [🗑️] │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🟢 Filial - Shopping Norte                                         │    │
│  │  ───────────────────────────────────────────────────────────────── │    │
│  │  📞 +55 11 99999-2222                                               │    │
│  │  📊 Hoje: 23 msgs enviadas │ Limite: 1000/dia                       │    │
│  │  🔄 Última atividade: há 15 minutos                                 │    │
│  │                                                    [⚙️] [⏸️] [🗑️] │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Banco de Dados

### 9.1 Diagrama ER Simplificado

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   leads     │────<│  lead_interactions  │     │ whatsapp_flows  │
└─────────────┘     └─────────────────────┘     └─────────────────┘
      │                                                  │
      │             ┌─────────────────────┐              │
      └────────────<│   call_records      │              │
                    └─────────────────────┘              │
                           │                             │
                           │                   ┌─────────────────────┐
                    ┌──────┴──────┐            │whatsapp_flow_steps  │
                    │             │            └─────────────────────┘
           ┌────────────────┐ ┌────────────────┐
           │call_transcripts│ │  call_events   │
           └────────────────┘ └────────────────┘
```

### 9.2 Tabela: leads

```sql
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  external_id TEXT,                    -- ID do ABC Station
  source TEXT NOT NULL,                -- 'abc_station', 'whatsapp', 'manual'

  -- Status do Nurturing
  status TEXT DEFAULT 'NOVO_LEAD',
  current_step INTEGER DEFAULT 1,      -- 1, 2, 3, 4, 5
  whatsapp_blocked BOOLEAN DEFAULT 0,  -- Bloqueia após passo 4

  -- Dados do Lead
  name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  service_interest TEXT,               -- Interesse informado

  -- Datas
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_call_at DATETIME,
  last_whatsapp_at DATETIME,
  next_action_at DATETIME,

  -- Belle Software
  belle_client_id TEXT,
  belle_appointment_id TEXT
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_step ON leads(current_step);
```

### 9.3 Tabela: lead_interactions

```sql
CREATE TABLE lead_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  step INTEGER NOT NULL,               -- 1, 2, 3, 4, 5
  channel TEXT NOT NULL,               -- 'phone', 'whatsapp'
  direction TEXT NOT NULL,             -- 'outbound', 'inbound'
  type TEXT NOT NULL,                  -- 'call', 'text', 'video', 'image'

  -- Resultado
  status TEXT,                         -- 'answered', 'no_answer', 'delivered', 'read', 'replied'
  content TEXT,                        -- Transcrição ou mensagem
  duration_seconds INTEGER,            -- Para chamadas

  -- Referências
  call_id TEXT,
  whatsapp_message_id TEXT,
  flow_step_id TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX idx_interactions_lead ON lead_interactions(lead_id);
CREATE INDEX idx_interactions_channel ON lead_interactions(channel);
```

### 9.4 Tabela: call_records

```sql
CREATE TABLE call_records (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,

  -- Contexto
  nurture_step INTEGER NOT NULL,           -- 1, 2, 3 ou 4
  script_id TEXT,                          -- Script/flow usado

  -- Timing
  started_at DATETIME NOT NULL,
  answered_at DATETIME,                    -- Quando atendeu (null se não atendeu)
  ended_at DATETIME,
  duration_seconds INTEGER,
  ring_duration_seconds INTEGER,           -- Tempo tocando antes de atender

  -- Resultado
  status TEXT NOT NULL,                    -- 'completed', 'no_answer', 'busy', 'failed', 'canceled'
  result TEXT,                             -- 'converted', 'not_convinced', 'callback_requested', 'not_interested'
  end_reason TEXT,                         -- 'hangup_lead', 'hangup_ai', 'timeout', 'error'

  -- Áudio
  audio_file_path TEXT,                    -- Caminho do arquivo de áudio
  audio_duration_seconds INTEGER,
  audio_size_bytes INTEGER,

  -- Análise IA
  sentiment TEXT,                          -- 'positive', 'neutral', 'negative'
  sentiment_score REAL,                    -- 0.0 a 1.0
  objections_detected TEXT,                -- JSON array: ["preço", "tempo"]
  techniques_used TEXT,                    -- JSON array: ["empatia", "urgência"]
  ai_summary TEXT,                         -- Resumo gerado pela IA
  conversion_probability REAL,             -- 0.0 a 1.0

  -- Metadados
  asterisk_channel TEXT,                   -- ID do canal Asterisk
  phone_number TEXT,                       -- Número discado
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX idx_call_records_lead ON call_records(lead_id);
CREATE INDEX idx_call_records_started ON call_records(started_at);
CREATE INDEX idx_call_records_status ON call_records(status);
CREATE INDEX idx_call_records_result ON call_records(result);
CREATE INDEX idx_call_records_step ON call_records(nurture_step);
```

### 9.5 Tabela: call_transcripts

```sql
CREATE TABLE call_transcripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,

  -- Conteúdo
  role TEXT NOT NULL,                      -- 'ai', 'lead'
  content TEXT NOT NULL,

  -- Timing
  timestamp DATETIME NOT NULL,
  start_ms INTEGER,                        -- Posição no áudio (ms)
  end_ms INTEGER,

  -- Metadados STT
  confidence REAL,                         -- Confiança do Whisper (0.0 a 1.0)
  language TEXT DEFAULT 'pt-BR',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (call_id) REFERENCES call_records(id)
);

CREATE INDEX idx_call_transcripts_call ON call_transcripts(call_id);
CREATE INDEX idx_call_transcripts_timestamp ON call_transcripts(timestamp);
```

### 9.6 Tabela: call_events

```sql
CREATE TABLE call_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,

  event_type TEXT NOT NULL,                -- 'dial', 'ring', 'answer', 'speech_start', 'speech_end', 'ai_processing', 'ai_response', 'hangup', 'dtmf', 'error'
  event_data TEXT,                         -- JSON com dados do evento

  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (call_id) REFERENCES call_records(id)
);

CREATE INDEX idx_call_events_call ON call_events(call_id);
```

### 9.7 Tabela: whatsapp_flows

```sql
CREATE TABLE whatsapp_flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                  -- "Fallback P1", "Fallback P2"...
  trigger_status TEXT NOT NULL UNIQUE, -- "NAO_ATENDEU_P1", "NAO_ATENDEU_P2"...
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 9.8 Tabela: whatsapp_flow_steps

```sql
CREATE TABLE whatsapp_flow_steps (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  step_order INTEGER DEFAULT 1,

  -- Tipo de mensagem
  message_type TEXT NOT NULL,          -- 'text', 'video', 'image'
  message_content TEXT NOT NULL,       -- Script com variáveis {{nome}}, {{servico}}
  media_url TEXT,                      -- URL do vídeo/imagem

  -- Botões interativos
  has_buttons BOOLEAN DEFAULT 0,
  buttons_config TEXT,                 -- JSON: [{"text":"Sim","action":"ai_takeover"},{"text":"Não","action":"mark_refused"}]

  -- Janelas de horário
  time_windows TEXT NOT NULL,          -- JSON: [{"start":"07:00","end":"09:00"},...]

  -- Timeout
  response_timeout_hours INTEGER DEFAULT 24,
  on_timeout_action TEXT DEFAULT 'next_step', -- 'next_step', 'end_flow', 'loop'

  -- Ao responder
  on_response_action TEXT DEFAULT 'ai_takeover', -- 'ai_takeover', 'fixed_message', 'next_step'
  on_response_fixed_message TEXT,

  -- Flags especiais
  block_whatsapp_after BOOLEAN DEFAULT 0, -- Para passo 4

  FOREIGN KEY (flow_id) REFERENCES whatsapp_flows(id)
);
```

### 9.9 Tabela: whatsapp_instances

```sql
CREATE TABLE whatsapp_instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- "Clínica Centro"

  -- Credenciais Meta
  phone_number TEXT NOT NULL,            -- "+5584991516506"
  phone_id TEXT NOT NULL,                -- ID do número no Meta
  business_id TEXT NOT NULL,             -- WhatsApp Business Account ID
  access_token TEXT NOT NULL,            -- Token de acesso (criptografado)
  token_expires_at DATETIME,             -- Data de expiração do token

  -- Webhook
  webhook_verify_token TEXT NOT NULL,    -- Token de verificação
  webhook_verified BOOLEAN DEFAULT 0,    -- Se o webhook foi verificado

  -- Status
  status TEXT DEFAULT 'pending',         -- 'online', 'offline', 'pending', 'expired', 'blocked'
  quality_rating TEXT DEFAULT 'unknown', -- 'high', 'medium', 'low', 'unknown'
  messaging_tier TEXT,                   -- 'TIER_1K', 'TIER_10K', etc.

  -- Configurações
  is_active BOOLEAN DEFAULT 1,           -- Instância ativa para envio
  receive_messages BOOLEAN DEFAULT 1,    -- Receber mensagens
  daily_limit INTEGER DEFAULT 1000,      -- Limite diário configurado

  -- Métricas
  messages_sent_today INTEGER DEFAULT 0,
  messages_sent_month INTEGER DEFAULT 0,
  last_message_at DATETIME,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  connected_at DATETIME
);
```

### 9.10 Tabela: system_config

```sql
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configurações padrão
INSERT INTO system_config (key, value, description) VALUES
  ('auto_mode', 'automatic', 'Modo: automatic, manual, disabled'),
  ('business_hours_start', '09:00', 'Início do horário comercial'),
  ('business_hours_end', '18:00', 'Fim do horário comercial'),
  ('business_days', '1,2,3,4,5', 'Dias ativos (1=seg, 7=dom)'),
  ('max_simultaneous_calls', '2', 'Máximo de ligações simultâneas'),
  ('call_interval_minutes', '3', 'Intervalo mínimo entre ligações'),
  ('max_calls_per_hour', '15', 'Máximo de ligações por hora'),
  ('out_of_hours_behavior', 'wait', 'wait ou whatsapp_first');
```

### 9.11 Tabela: processing_queue

```sql
CREATE TABLE processing_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL UNIQUE,
  priority INTEGER DEFAULT 0,           -- Maior = mais prioritário
  scheduled_for DATETIME,               -- Quando deve ser processado
  status TEXT DEFAULT 'waiting',        -- 'waiting', 'processing', 'completed', 'skipped'
  attempts INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX idx_queue_status ON processing_queue(status);
CREATE INDEX idx_queue_scheduled ON processing_queue(scheduled_for);
```

---

## 10. Estrutura de Arquivos

```
/root/ligai-server/
├── index.js                          [MODIFICAR: +25 linhas]
├── src/
│   ├── call-manager.js               [MODIFICAR: +50 linhas]
│   ├── audiosocket-server.js         [NÃO MODIFICAR]
│   │
│   ├── api/
│   │   ├── routes.js                 [MODIFICAR: +15 linhas]
│   │   ├── webhooks.js               [NOVO: ABC Station + WhatsApp webhooks]
│   │   ├── leads-routes.js           [NOVO: CRUD de leads]
│   │   ├── flows-routes.js           [NOVO: CRUD do Flow Builder]
│   │   ├── instances-routes.js       [NOVO: CRUD instâncias WhatsApp]
│   │   └── call-records-routes.js    [NOVO: histórico de ligações]
│   │
│   ├── services/
│   │   ├── groq-service.js           [NÃO MODIFICAR]
│   │   ├── openrouter-service.js     [NÃO MODIFICAR]
│   │   ├── murf-service.js           [NÃO MODIFICAR]
│   │   ├── ami-service.js            [NÃO MODIFICAR]
│   │   │
│   │   ├── belle-service.js          [NOVO: integração Belle Software]
│   │   ├── whatsapp-service.js       [NOVO: Meta Cloud API]
│   │   ├── queue-service.js          [NOVO: fila de processamento automático]
│   │   ├── nurturing-engine.js       [NOVO: controle de timing/status]
│   │   ├── flow-builder-service.js   [NOVO: execução dos fluxos]
│   │   └── call-records-service.js   [NOVO: histórico, transcrições, análise]
│   │
│   ├── agents/
│   │   ├── agent-router.js           [NOVO: roteamento por serviço]
│   │   └── prompts/
│   │       ├── depilacao-agent.js    [NOVO]
│   │       ├── estetica-agent.js     [NOVO]
│   │       └── default-agent.js      [NOVO]
│   │
│   └── db/
│       └── database.js               [MODIFICAR: +300 linhas]
│
├── client/                           [MODIFICAR: novas telas]
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx         [NOVO: métricas em tempo real]
│       │   ├── Queue.jsx             [NOVO: abas Tempo Real + Histórico]
│       │   ├── Leads.jsx             [NOVO: lista de leads com filtros]
│       │   ├── LeadDetail.jsx        [NOVO: timeline completa do lead]
│       │   ├── Conversations.jsx     [NOVO: chat estilo WhatsApp]
│       │   ├── Funnel.jsx            [NOVO: visão Kanban]
│       │   ├── FlowBuilder.jsx       [NOVO: configurador de fluxos]
│       │   ├── Instances.jsx         [NOVO: gerenciar conexões WhatsApp]
│       │   ├── Settings.jsx          [NOVO: configurações do sistema]
│       │   └── Reports.jsx           [NOVO: relatórios de conversão]
│       │
│       └── components/
│           ├── chat/
│           │   ├── ChatList.jsx      [NOVO: lista de conversas lateral]
│           │   ├── ChatWindow.jsx    [NOVO: área de mensagens]
│           │   ├── ChatInput.jsx     [NOVO: input com anexos/emoji]
│           │   ├── MessageBubble.jsx [NOVO: balão de mensagem]
│           │   └── ChatHeader.jsx    [NOVO: header com info do lead]
│           │
│           ├── leads/
│           │   ├── LeadCard.jsx      [NOVO: card do lead no Kanban]
│           │   ├── LeadTimeline.jsx  [NOVO: timeline de interações]
│           │   └── LeadActions.jsx   [NOVO: botões de ação]
│           │
│           ├── queue/
│           │   ├── QueueRealTime.jsx     [NOVO: aba tempo real]
│           │   ├── QueueHistory.jsx      [NOVO: aba histórico com filtros]
│           │   ├── ActiveCallCard.jsx    [NOVO: card de ligação ativa]
│           │   ├── LiveTranscript.jsx    [NOVO: transcrição ao vivo]
│           │   ├── CallDetailModal.jsx   [NOVO: modal com áudio/transcrição]
│           │   ├── AudioPlayer.jsx       [NOVO: player de áudio]
│           │   ├── TranscriptViewer.jsx  [NOVO: visualizador transcrição]
│           │   ├── CallFilters.jsx       [NOVO: filtros data/resultado]
│           │   ├── CallStats.jsx         [NOVO: estatísticas do período]
│           │   └── SentimentBadge.jsx    [NOVO: badge de sentimento]
│           │
│           ├── instances/
│           │   ├── InstanceCard.jsx  [NOVO: card de instância WA]
│           │   ├── InstanceModal.jsx [NOVO: modal nova instância]
│           │   ├── InstanceConfig.jsx[NOVO: configurações]
│           │   └── InstanceMetrics.jsx[NOVO: métricas de uso]
│           │
│           └── common/
│               ├── StatusBadge.jsx   [NOVO: indicadores visuais]
│               └── Notifications.jsx [NOVO: notificações tempo real]
```

---

## 11. API Endpoints

### 11.1 Webhooks

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/webhooks/abc-station` | Recebe leads do ABC Station |
| POST | `/api/webhooks/whatsapp` | Recebe mensagens do WhatsApp |
| GET | `/api/webhooks/whatsapp` | Verificação do webhook Meta |

### 11.2 Leads

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/leads` | Lista leads com filtros e paginação |
| GET | `/api/leads/:id` | Detalhes de um lead |
| POST | `/api/leads` | Cria lead manualmente |
| PUT | `/api/leads/:id` | Atualiza lead |
| DELETE | `/api/leads/:id` | Remove lead |
| GET | `/api/leads/:id/interactions` | Histórico de interações |
| GET | `/api/leads/:id/timeline` | Timeline completa |

### 11.3 Ligações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/calls` | Lista ligações com filtros |
| GET | `/api/calls/:id` | Detalhes de uma ligação |
| GET | `/api/calls/:id/transcript` | Transcrição completa |
| GET | `/api/calls/:id/audio` | Stream do áudio |
| GET | `/api/calls/:id/events` | Timeline técnica |
| GET | `/api/calls/stats` | Estatísticas com filtros |
| GET | `/api/calls/active` | Ligações em andamento |
| WS | `/ws/calls/:id/live` | WebSocket transcrição ao vivo |

### 11.4 Flow Builder

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/flows` | Lista todos os fluxos |
| GET | `/api/flows/:id` | Detalhes de um fluxo |
| POST | `/api/flows` | Cria novo fluxo |
| PUT | `/api/flows/:id` | Atualiza fluxo |
| DELETE | `/api/flows/:id` | Remove fluxo |
| POST | `/api/flows/:id/trigger` | Dispara fluxo manualmente |
| POST | `/api/flows/:id/publish` | Publica fluxo |
| POST | `/api/flows/:id/pause` | Pausa fluxo |

### 11.5 Instâncias WhatsApp

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/instances` | Lista instâncias |
| GET | `/api/instances/:id` | Detalhes da instância |
| POST | `/api/instances` | Cria nova instância |
| PUT | `/api/instances/:id` | Atualiza instância |
| DELETE | `/api/instances/:id` | Remove instância |
| POST | `/api/instances/:id/test` | Testa conexão |

### 11.6 Fila de Processamento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/queue` | Status da fila |
| GET | `/api/queue/active` | Ligações ativas |
| GET | `/api/queue/waiting` | Leads aguardando |
| POST | `/api/queue/pause` | Pausa processamento |
| POST | `/api/queue/resume` | Retoma processamento |
| POST | `/api/queue/:leadId/skip` | Pula lead na fila |
| POST | `/api/queue/:leadId/prioritize` | Prioriza lead |

### 11.7 Configurações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/config` | Todas as configurações |
| PUT | `/api/config` | Atualiza configurações |
| GET | `/api/config/:key` | Valor de uma configuração |

---

## 12. Fases de Implementação

### Fase 1: Infraestrutura Base
**Prioridade:** Alta | **Impacto no LigAI:** Nenhum

**Arquivos:**
- `database.js` - Adicionar novas tabelas
- `leads-routes.js` - CRUD de leads
- `webhooks.js` - Endpoint ABC Station

**Tarefas:**
1. Criar migrations para novas tabelas
2. Implementar CRUD de leads
3. Criar webhook para receber leads do ABC Station
4. Testar recebimento de leads

---

### Fase 2: Integração Belle Software
**Prioridade:** Alta | **Impacto no LigAI:** Nenhum

**Arquivos:**
- `belle-service.js`

**Tarefas:**
1. Implementar autenticação com token
2. Buscar estabelecimento automaticamente
3. Métodos: listarServicos(), listarPlanos(), gravarLead(), gravarAgendamento()
4. Testar criação de cliente/agendamento

---

### Fase 3: Integração WhatsApp
**Prioridade:** Alta | **Impacto no LigAI:** Nenhum

**Arquivos:**
- `whatsapp-service.js`
- `webhooks.js` (adicionar endpoint WhatsApp)

**Tarefas:**
1. Configurar webhook Meta
2. Implementar envio: texto, vídeo, imagem, botões interativos
3. Implementar recebimento de mensagens
4. Gerenciar sessões de conversa

---

### Fase 4: Flow Builder Backend
**Prioridade:** Alta | **Impacto no LigAI:** Nenhum

**Arquivos:**
- `flow-builder-service.js`
- `flows-routes.js`

**Tarefas:**
1. CRUD de fluxos e passos
2. Motor de execução de fluxos
3. Substituição de variáveis {{nome}}, {{servico}}
4. Validação de janelas de horário
5. Gerenciamento de timeout

---

### Fase 5: Nurturing Engine
**Prioridade:** Alta | **Impacto no LigAI:** Mínimo (~20 linhas)

**Arquivos:**
- `nurturing-engine.js`
- `index.js` (inicialização)
- `call-manager.js` (injeção de dados do lead)

**Tarefas:**
1. Scheduler para processar fila
2. Lógica de transição de status
3. Integração com LigAI para originar chamadas
4. Integração com Flow Builder para disparar WhatsApp
5. Detecção de atendimento/não atendimento/não convencimento

---

### Fase 6: Sistema de Agentes IA
**Prioridade:** Média | **Impacto no LigAI:** Mínimo

**Arquivos:**
- `agent-router.js`
- `prompts/*.js`

**Tarefas:**
1. Templates de prompts por tipo de serviço
2. Roteamento baseado em lead.service_interest
3. Integração com openrouter-service

---

### Fase 7: Flow Builder UI
**Prioridade:** Média | **Impacto no LigAI:** Nenhum

**Arquivos:**
- `client/src/pages/FlowBuilder.jsx`

**Tarefas:**
1. Interface visual para configurar fluxos
2. Upload de mídia (vídeo/imagem)
3. Editor de scripts com variáveis
4. Preview de mensagens

---

### Fase 8: Dashboard de Leads e CRM
**Prioridade:** Média | **Impacto no LigAI:** Nenhum

**Arquivos:**
- `client/src/pages/Dashboard.jsx`
- `client/src/pages/Leads.jsx`
- `client/src/pages/LeadDetail.jsx`
- `client/src/pages/Conversations.jsx`
- `client/src/pages/Funnel.jsx`
- `client/src/pages/Reports.jsx`

**Tarefas:**
1. Dashboard com métricas em tempo real
2. Lista de leads com filtros e busca
3. Timeline completa do lead
4. Página de conversas estilo WhatsApp
5. Visão de funil (Kanban)
6. Relatórios de conversão

---

### Fase 9: Histórico e Monitoramento de Ligações
**Prioridade:** Alta | **Impacto no LigAI:** Moderado (~50 linhas em call-manager.js)

**Arquivos Backend:**
- `call-records-service.js` - CRUD e estatísticas
- `call-records-routes.js` - API endpoints
- `call-recording-service.js` - Gravação de áudio
- `call-analysis-service.js` - Análise de sentimento

**Arquivos Frontend:**
- `client/src/pages/Queue.jsx` - Página com abas
- `client/src/components/queue/*.jsx` - Componentes

**Tarefas:**
1. Gravar transcrições em tempo real durante a ligação
2. Salvar áudio da ligação ao finalizar
3. Implementar WebSocket para transcrição ao vivo
4. Criar modal de detalhes com player de áudio
5. Filtros por período, resultado, passo
6. Estatísticas do período selecionado
7. Análise de sentimento pós-ligação (opcional)

---

## 13. Variáveis de Ambiente

```env
# ══════════════════════════════════════════════════════════════════════════════
# EXISTENTES (MANTER)
# ══════════════════════════════════════════════════════════════════════════════

OPENROUTER_API_KEY=...
GROQ_API_KEY=...
MURF_API_KEY=...
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USERNAME=ligai
AMI_PASSWORD=ligai2025

# ══════════════════════════════════════════════════════════════════════════════
# BELLE SOFTWARE
# ══════════════════════════════════════════════════════════════════════════════

BELLE_API_URL=https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0
BELLE_TOKEN=76683f1105194b9f9544cb9f1b356a5b

# ══════════════════════════════════════════════════════════════════════════════
# WHATSAPP META CLOUD API
# ══════════════════════════════════════════════════════════════════════════════

WHATSAPP_TOKEN=<INFORMAR>
WHATSAPP_PHONE_ID=<INFORMAR>
WHATSAPP_VERIFY_TOKEN=<CRIAR_TOKEN_ALEATORIO>

# ══════════════════════════════════════════════════════════════════════════════
# ABC STATION
# ══════════════════════════════════════════════════════════════════════════════

ABC_STATION_WEBHOOK_SECRET=<CRIAR_TOKEN_ALEATORIO>

# ══════════════════════════════════════════════════════════════════════════════
# NURTURING ENGINE
# ══════════════════════════════════════════════════════════════════════════════

NURTURE_CHECK_INTERVAL=60000           # Verifica fila a cada 1 minuto
NURTURE_STEP_TIMEOUT=86400000          # 24 horas entre passos
NURTURE_LOOP_INTERVAL=172800000        # 48 horas entre ligações no loop

# ══════════════════════════════════════════════════════════════════════════════
# FLOW BUILDER
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_RESPONSE_TIMEOUT=24            # Horas para timeout de resposta

# ══════════════════════════════════════════════════════════════════════════════
# ARMAZENAMENTO DE ÁUDIO DAS LIGAÇÕES
# ══════════════════════════════════════════════════════════════════════════════

CALL_RECORDINGS_PATH=/root/ligai-server/data/recordings
CALL_RECORDINGS_ENABLED=true           # Salvar áudio das ligações
CALL_RECORDINGS_FORMAT=wav             # Formato: wav, mp3
CALL_RECORDINGS_MAX_DAYS=90            # Dias para manter gravações (0 = indefinido)
CALL_ANALYSIS_ENABLED=true             # Análise de sentimento via IA
```

---

## Resumo de Impacto no Código Existente

| Arquivo | Modificações | Descrição |
|---------|-------------|-----------|
| `index.js` | +25 linhas | Inicializar novos serviços |
| `call-manager.js` | +50 linhas | Eventos, gravação de áudio, salvar transcrições |
| `routes.js` | +15 linhas | Incluir novos routers |
| `database.js` | +300 linhas | Novas tabelas e métodos |
| **audiosocket-server.js** | **0** | Não modificar |
| **groq-service.js** | **0** | Não modificar |
| **murf-service.js** | **0** | Não modificar |
| **ami-service.js** | **0** | Não modificar |
| **openrouter-service.js** | **0** | Não modificar |

### Totais

- **Modificações em código existente:** ~390 linhas
- **Código novo (backend):** ~2000-2500 linhas
- **Código novo (frontend):** ~3000-3500 linhas
- **Total código novo:** ~5000-6000 linhas

---

## Dependências NPM Adicionais

```json
{
  "dependencies": {
    "node-cron": "^3.0.3",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "reactflow": "^11.10.1"
  }
}
```

---

*Documento gerado em 23/12/2024*
*Versão: 1.0*
