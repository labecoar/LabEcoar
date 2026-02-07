import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

const requirementsDocument = `# Documento de Requisitos - Lab Ecoar

**Versão:** 1.0  
**Data:** 10/12/2024  
**Cliente:** Cuíca x Ecoantes  

---

## 1. VISÃO GERAL

### 1.1 Objetivo do Sistema
O Lab Ecoar é uma plataforma de gamificação desenvolvida para gerenciar e incentivar a participação de influenciadores digitais (Ecoantes) em campanhas de conscientização ambiental promovidas pela Cuíca.

### 1.2 Proposta de Valor
- **Para Ecoantes**: Sistema de pontuação que se converte em remuneração trimestral proporcional ao engajamento
- **Para Administradores**: Ferramenta centralizada para gestão de campanhas, seleção de influenciadores e aprovação de entregas
- **Para Cuíca**: Amplificação do alcance das mensagens ambientais através de uma rede engajada de influenciadores

### 1.3 Escopo
Sistema web responsivo com:
- Interface para Ecoantes (influenciadores)
- Painel administrativo
- Sistema de pontuação e categorização
- Gestão de campanhas e tarefas
- Fórum de comunidade
- Sistema de recompensas

---

## 2. REQUISITOS FUNCIONAIS

### 2.1 Gestão de Usuários

#### RF-001: Cadastro e Autenticação
- Sistema de autenticação integrado Base44
- Convite de usuários por email
- Papéis: Admin e Ecoante (usuário regular)

#### RF-002: Perfil de Usuário
- **Dados obrigatórios**: nome completo, email, Instagram handle
- **Dados opcionais**: bio, avatar, número de seguidores, status de minoria
- **Dados calculados**: pontos totais, categoria atual, trimestre atual
- Edição de perfil pelo próprio usuário

### 2.2 Sistema de Tarefas e Campanhas

#### RF-003: Tipos de Tarefas
O sistema suporta 6 categorias de tarefas:
1. **Campanha** (100 pts): campanhas principais de conscientização
2. **Resposta Rápida** (100 pts): ações urgentes e time-sensitive
3. **Oficina** (50 pts): participação em workshops e treinamentos
4. **Folhetim - Compartilhar** (75 pts): compartilhamento de conteúdo educativo
5. **Folhetim - Criar Ecoante** (75 pts): criação de conteúdo original
6. **Compartilhar Ecoante** (variável): divulgação do movimento

#### RF-004: Atributos de Tarefas
- Título e descrição
- Categoria
- Pontuação
- Prazo de conclusão
- Requisitos (lista)
- Tipo de prova necessária (link, screenshot, vídeo, insights)
- Limite de participantes (opcional)
- Flag de urgência
- **Requer inscrição**: tarefas que necessitam seleção de candidatos

#### RF-005: Criação e Edição de Tarefas
- Apenas administradores podem criar/editar tarefas
- Status: ativa, concluída, expirada
- Contador automático de participantes

### 2.3 Fluxo de Trabalho - Tarefas COM Inscrição

#### RF-006: Candidatura (Ecoante)
**Etapa 1: Envio de Candidatura**
- Formulário com:
  - Justificativa detalhada (obrigatório)
  - Links de portfólio (opcional, múltiplos)
  - Instagram handle (automático do perfil)
  - Número de seguidores (automático do perfil)
- Status inicial: "pendente"

#### RF-007: Seleção de Candidatos (Admin)
**Etapa 2: Análise Administrativa**
- Visualização de todas as candidaturas pendentes
- Filtro por tarefa
- Informações visíveis:
  - Dados do candidato
  - Instagram e alcance
  - Justificativa
  - Portfolio
  - Data de candidatura
- Ações disponíveis:
  - Selecionar candidato (status → "selecionado")
  - Rejeitar candidato (status → "rejeitado")
  - Adicionar notas de seleção

#### RF-008: Realização e Submissão (Ecoante)
**Etapa 3: Envio de Prova (apenas se selecionado)**
- Candidatos selecionados podem enviar prova de conclusão:
  - Link da prova (URL)
  - Upload de arquivo (imagem, vídeo, PDF)
  - Descrição opcional
- Criação de TaskSubmission com status "pendente"
- Trimestre atual automaticamente atribuído

#### RF-009: Aprovação de Prova (Admin)
**Etapa 4: Validação Final**
- Aprovar: adiciona pontos ao usuário, status → "aprovada"
- Rejeitar: adiciona motivo de rejeição, status → "rejeitada"

### 2.4 Fluxo de Trabalho - Tarefas SEM Inscrição

#### RF-010: Aceitação Simplificada
**Etapa 1: Aceitar Tarefa**
- Botão simples "Aceitar esta Tarefa"
- Cria TaskApplication com status "pendente"
- Justificativa padrão: "Tarefa aceita"

#### RF-011: Aprovação de Aceitação (Admin)
**Etapa 2: Aprovação Administrativa**
- Admin revisa e aprova/rejeita aceitação
- Se aprovado: status → "selecionado"

#### RF-012: Submissão e Aprovação Final
**Etapas 3 e 4**: Idênticas ao fluxo com inscrição (RF-008 e RF-009)

### 2.5 Sistema de Pontuação e Categorias

#### RF-013: Categorias de Performance
Sistema de 4 níveis baseado em pontos acumulados no trimestre:

| Categoria | Faixa de Pontos | Remuneração Trimestral | Emoji |
|-----------|----------------|------------------------|-------|
| Voz e Violão | 50-200 pts | R$ 1.000 | 🎸 |
| Dueto | 201-500 pts | R$ 2.000 | 🎤 |
| Fanfarra | 501-1000 pts | R$ 3.500 | 🎺 |
| Carnaval | 1001+ pts | R$ 4.500 | 🎉 |

#### RF-014: Cálculo Automático
- Pontos somados apenas de tarefas aprovadas
- Categoria recalculada automaticamente
- Atualização em tempo real no perfil
- Reinício a cada trimestre (Q1, Q2, Q3, Q4)

### 2.6 Painel Administrativo

#### RF-015: Aprovação de Submissões
- Lista de submissões pendentes
- Visualização de provas (links e arquivos)
- Aprovação em massa ou individual
- Campo para motivo de rejeição

#### RF-016: Seleção de Candidatos
- Página dedicada para análise de candidaturas
- Filtro por tarefa
- Tabs: Pendentes / Selecionados / Rejeitados
- Informações detalhadas de cada candidato

### 2.7 Dashboard do Ecoante

#### RF-017: Visão Geral
- Pontos totais destacados
- Categoria atual com badge visual
- Ganho previsto do trimestre
- Número de tarefas aprovadas
- Número de campanhas participadas

#### RF-018: Progresso Visual
- Barra de progresso entre categorias
- Indicador de posição atual
- Marcos visuais das 4 categorias
- Animações de transição

#### RF-019: Atalhos Rápidos
- Novas Tarefas
- Minhas Submissões (com contador de pendentes)
- Ranking
- Informações do trimestre atual

### 2.8 Sistema de Fórum

#### RF-020: Tópicos
Categorias de discussão:
- Dicas
- Dúvidas
- Conquistas
- Campanhas
- Geral
- Sugestões

#### RF-021: Funcionalidades do Fórum
- Criação de tópicos (título, descrição, categoria)
- Postagem de respostas
- Sistema de likes em posts
- Contador de visualizações
- Ordenação por última atividade
- Tópicos fixados (admin)

### 2.9 Sistema de Recompensas

#### RF-022: Catálogo de Recompensas
Categorias:
- Alimentação
- Educação
- Cultura
- Bem-estar
- Tecnologia
- Outros

#### RF-023: Resgate de Recompensas
- Troca de pontos por recompensas
- Quantidade disponível e já resgatada
- Código de resgate/voucher gerado
- Status: pendente, processando, entregue, cancelado
- Validade em meses
- Termos e condições

#### RF-024: Gestão de Recompensas
- Parceiro/fornecedor
- Ativação/desativação
- Controle de estoque

### 2.10 Sistema de Pagamentos

#### RF-025: Dados Bancários
- Cadastro de informações para pagamento:
  - Tipo de conta (corrente/poupança)
  - Banco e código
  - Agência e conta
  - CPF do titular
  - Nome completo
  - Chave PIX (opcional)
  - Tipo de chave PIX
- Verificação administrativa

#### RF-026: Processamento de Pagamentos
- Pagamentos trimestrais automáticos
- Baseados na categoria alcançada
- Registro de:
  - Trimestre
  - Categoria
  - Pontos acumulados
  - Valor pago
  - Status (pendente, processando, pago, erro)
  - Método (transferência, PIX)
  - ID da transação externa
  - Notas administrativas

#### RF-027: Histórico de Pagamentos
- Visualização para usuário de pagamentos recebidos
- Detalhes: data, valor, categoria, trimestre
- Status de cada pagamento

### 2.11 Ranking (Leaderboard)

#### RF-028: Classificação Geral
- Top 3 destacado com pódio visual
- Lista completa (até posição 20)
- Informações exibidas:
  - Posição
  - Nome e Instagram handle
  - Pontos totais
  - Tarefas completadas
- Ordenação por pontos (maior → menor)
- Atualização em tempo real

---

## 3. REQUISITOS NÃO-FUNCIONAIS

### 3.1 Performance
- **RNF-001**: Tempo de carregamento de páginas < 2 segundos
- **RNF-002**: Suporte a 500 usuários simultâneos
- **RNF-003**: Upload de arquivos até 50MB

### 3.2 Usabilidade
- **RNF-004**: Interface responsiva (mobile, tablet, desktop)
- **RNF-005**: Design intuitivo sem necessidade de treinamento
- **RNF-006**: Feedback visual para todas as ações
- **RNF-007**: Acessibilidade WCAG 2.1 nível AA

### 3.3 Segurança
- **RNF-008**: Autenticação obrigatória
- **RNF-009**: Controle de acesso baseado em papéis (RBAC)
- **RNF-010**: Dados bancários criptografados
- **RNF-011**: Logs de auditoria para ações administrativas

### 3.4 Confiabilidade
- **RNF-012**: Disponibilidade de 99.5%
- **RNF-013**: Backup diário automático
- **RNF-014**: Recuperação de desastres < 4 horas

### 3.5 Manutenibilidade
- **RNF-015**: Código modular e componentizado
- **RNF-016**: Documentação inline
- **RNF-017**: Versionamento de código (Git)

---

## 4. MODELO DE DADOS

### 4.1 Entidades Principais

#### User (Usuário)
\`\`\`
- id (UUID, auto)
- created_date (DateTime, auto)
- updated_date (DateTime, auto)
- created_by (String, auto)
- email (String, único, obrigatório)
- full_name (String, obrigatório)
- role (Enum: 'admin' | 'user')
- bio (String, opcional)
- instagram_handle (String, opcional)
- followers_count (Number, opcional)
- avatar_url (String, opcional)
- is_minority (Boolean, default: false)
- total_points (Number, default: 0, calculado)
- current_category (Enum: voz_e_violao | dueto | fanfarra | carnaval)
- current_quarter (String, ex: "Q1-2025")
- campaigns_participated (Number, default: 0)
\`\`\`

#### Task (Tarefa/Campanha)
\`\`\`
- id (UUID)
- created_date (DateTime)
- updated_date (DateTime)
- created_by (String)
- title (String, obrigatório)
- description (String, obrigatório)
- category (Enum, obrigatório)
- points (Number, obrigatório)
- deadline (Date, opcional)
- status (Enum: ativa | concluida | expirada)
- requirements (Array[String])
- proof_required (Enum: link | screenshot | video | insights)
- max_participants (Number, opcional)
- current_participants (Number, default: 0)
- is_urgent (Boolean, default: false)
- campaign_type (Enum: comum | resposta_rapida | slot_aberto)
- requires_application (Boolean, default: false)
- profile_requirements (String, opcional)
- min_followers (Number, opcional)
- target_audience (String, opcional)
\`\`\`

#### TaskApplication (Inscrição em Tarefa)
\`\`\`
- id (UUID)
- created_date (DateTime)
- task_id (String, FK → Task)
- task_title (String)
- user_email (String, FK → User)
- user_name (String)
- instagram_handle (String)
- followers_count (Number)
- justification (String, obrigatório)
- portfolio_links (Array[String])
- status (Enum: pendente | selecionado | rejeitado)
- selection_notes (String, opcional, admin)
- applied_at (DateTime)
- reviewed_at (DateTime, opcional)
\`\`\`

#### TaskSubmission (Submissão de Prova)
\`\`\`
- id (UUID)
- created_date (DateTime)
- task_id (String, FK → Task)
- task_title (String)
- user_email (String, FK → User)
- user_name (String)
- proof_url (String, opcional)
- proof_file_url (String, opcional)
- insights_file_url (String, opcional)
- description (String, opcional)
- status (Enum: pendente | aprovada | rejeitada)
- rejection_reason (String, opcional)
- points_earned (Number)
- submitted_at (DateTime)
- validated_at (DateTime, opcional)
- quarter (String)
\`\`\`

#### Payment (Pagamento)
\`\`\`
- id (UUID)
- created_date (DateTime)
- user_email (String, FK → User)
- user_name (String)
- quarter (String)
- category (Enum: voz_e_violao | dueto | fanfarra | carnaval)
- points (Number)
- amount (Number, em R$)
- status (Enum: pendente | processando | pago | erro)
- paid_at (DateTime, opcional)
- payment_method (Enum: transferencia | pix)
- transaction_id (String, opcional)
- notes (String, opcional)
\`\`\`

#### PaymentInfo (Dados Bancários)
\`\`\`
- id (UUID)
- user_email (String, FK → User, único)
- account_type (Enum: corrente | poupanca)
- bank_name (String)
- bank_code (String)
- agency (String)
- account_number (String)
- account_digit (String)
- cpf (String)
- full_name (String)
- pix_key (String, opcional)
- pix_type (Enum: cpf | email | telefone | aleatoria)
- is_verified (Boolean, default: false)
\`\`\`

#### ForumTopic (Tópico do Fórum)
\`\`\`
- id (UUID)
- title (String)
- description (String)
- category (Enum: dicas | duvidas | conquistas | campanhas | geral | sugestoes)
- author_email (String, FK → User)
- author_name (String)
- total_posts (Number, default: 0)
- last_activity (DateTime)
- is_pinned (Boolean, default: false)
- views (Number, default: 0)
\`\`\`

#### ForumPost (Post do Fórum)
\`\`\`
- id (UUID)
- topic_id (String, FK → ForumTopic)
- content (String)
- author_email (String, FK → User)
- author_name (String)
- likes (Number, default: 0)
- liked_by (Array[String], emails)
\`\`\`

#### Reward (Recompensa)
\`\`\`
- id (UUID)
- title (String)
- description (String)
- points_required (Number)
- category (Enum: alimentacao | educacao | cultura | bem_estar | tecnologia | outros)
- image_url (String)
- quantity_available (Number)
- quantity_claimed (Number, default: 0)
- is_active (Boolean, default: true)
- partner_name (String)
- validity_months (Number)
- terms (String)
\`\`\`

#### RewardClaim (Resgate de Recompensa)
\`\`\`
- id (UUID)
- reward_id (String, FK → Reward)
- reward_title (String)
- user_email (String, FK → User)
- user_name (String)
- points_spent (Number)
- status (Enum: pendente | processando | entregue | cancelado)
- claimed_at (DateTime)
- delivered_at (DateTime, opcional)
- delivery_code (String, voucher)
- notes (String)
\`\`\`

### 4.2 Relacionamentos

- User 1:N TaskApplication
- User 1:N TaskSubmission
- User 1:1 PaymentInfo
- User 1:N Payment
- User 1:N ForumTopic
- User 1:N ForumPost
- User 1:N RewardClaim
- Task 1:N TaskApplication
- Task 1:N TaskSubmission
- ForumTopic 1:N ForumPost
- Reward 1:N RewardClaim

---

## 5. FLUXOS DE TRABALHO

### 5.1 Fluxo Completo - Tarefa COM Inscrição

\`\`\`
[ECOANTE]                    [SISTEMA]                    [ADMIN]
    |                            |                           |
    |---(1) Candidatar-se------->|                           |
    |    • Justificativa         |                           |
    |    • Portfólio             |                           |
    |                            |                           |
    |                    [TaskApplication criada]           |
    |                    status = "pendente"                 |
    |                            |                           |
    |                            |<---(2) Analisar-----------|
    |                            |    Candidaturas           |
    |                            |                           |
    |                            |-----(Selecionar/-------->|
    |                            |      Rejeitar)            |
    |                            |                           |
    |<-------Notificação---------|                           |
    |   "Você foi selecionado"   |                           |
    |   status = "selecionado"   |                           |
    |                            |                           |
    |---(3) Enviar Prova-------->|                           |
    |    • Link/Arquivo          |                           |
    |                            |                           |
    |                    [TaskSubmission criada]            |
    |                    status = "pendente"                 |
    |                            |                           |
    |                            |<---(4) Aprovar/-----------|
    |                            |      Rejeitar Prova       |
    |                            |                           |
    |<-------Pontos Adicionados--|    (se aprovado)          |
    |   status = "aprovada"      |                           |
    |   User.total_points += X   |                           |
    |   User.category recalculado|                           |
\`\`\`

### 5.2 Fluxo Simplificado - Tarefa SEM Inscrição

\`\`\`
[ECOANTE]                    [SISTEMA]                    [ADMIN]
    |                            |                           |
    |---(1) Aceitar Tarefa------>|                           |
    |                            |                           |
    |                    [TaskApplication criada]           |
    |                    status = "pendente"                 |
    |                    justification = "Tarefa aceita"    |
    |                            |                           |
    |                            |<---(2) Aprovar-----------|
    |                            |    Aceitação              |
    |                            |                           |
    |<-------Notificação---------|                           |
    |   "Aprovado para realizar" |                           |
    |   status = "selecionado"   |                           |
    |                            |                           |
    |---(3) Enviar Prova-------->|                           |
    |                            |                           |
    |                    [Continua igual ao fluxo anterior] |
\`\`\`

### 5.3 Fluxo de Pagamento Trimestral

\`\`\`
[SISTEMA - Fim do Trimestre]      [ADMIN]           [ECOANTE]
         |                            |                 |
    [Cálculo Automático]             |                 |
    • Para cada usuário:             |                 |
      - Soma pontos do trimestre     |                 |
      - Determina categoria          |                 |
      - Calcula valor a pagar        |                 |
         |                            |                 |
    [Payment criado]                 |                 |
    status = "pendente"              |                 |
         |                            |                 |
         |----Notificação------------>|                 |
         |   (lista de pagamentos)    |                 |
         |                            |                 |
         |                            |--Processar----->|
         |                            |  Pagamentos     |
         |                            |                 |
         |<-----Confirmação-----------|                 |
         |      status = "pago"       |                 |
         |                            |                 |
         |----------------Notificação----------------->|
         |         "Pagamento recebido"                 |
\`\`\`

---

## 6. REGRAS DE NEGÓCIO

### RN-001: Pontuação
- Pontos só são creditados após aprovação da prova
- Pontos não podem ser negativos
- Rejeição de prova não remove pontos já acumulados

### RN-002: Categorias
- Categoria é recalculada automaticamente após cada aprovação
- Categoria determina o valor do pagamento trimestral
- Usuários começam sem categoria até atingir 50 pontos

### RN-003: Trimestres
- Q1: Jan-Mar, Q2: Abr-Jun, Q3: Jul-Set, Q4: Out-Dez
- Pontos resetam a cada novo trimestre
- Pagamento ocorre no início do trimestre seguinte

### RN-004: Inscrições
- Usuário pode se candidatar apenas uma vez por tarefa
- Candidatura não pode ser editada após envio
- Apenas candidatos selecionados podem enviar prova

### RN-005: Vagas Limitadas
- Quando max_participants é atingido, tarefa fecha para novas inscrições
- Submissões pendentes não contam para o limite
- Apenas submissões aprovadas incrementam o contador

### RN-006: Provas
- Cada tarefa aceita apenas uma submissão por usuário
- Prova rejeitada pode ser reenviada (criar nova submissão)
- Prova aprovada não pode ser alterada

### RN-007: Recompensas
- Resgate deduz pontos imediatamente
- Pontos deduzidos não afetam a categoria do trimestre
- Quantidade de recompensa decrementada após resgate

### RN-008: Pagamentos
- Pagamento só é processado se dados bancários estiverem verificados
- Valor fixo por categoria, independente de quantos pontos além do mínimo
- Usuário com menos de 50 pontos no trimestre não recebe pagamento

### RN-009: Fórum
- Tópicos podem ser visualizados por todos
- Apenas usuários autenticados podem criar tópicos e posts
- Admins podem fixar/desfixar tópicos
- Likes são únicos por usuário por post

### RN-010: Aprovações Administrativas
- Apenas admins podem aprovar/rejeitar submissões
- Apenas admins podem selecionar/rejeitar candidaturas
- Motivo de rejeição é obrigatório para submissões rejeitadas

---

## 7. INTERFACE E UX

### 7.1 Paleta de Cores

\`\`\`
Verde Escuro: #096e4c (primário)
Marrom Escuro: #3c0b14 (texto)
Roxo: #a6539f (destaque)
Rosa: #e833ae (secundário)
Laranja: #ff6a2d (urgente)
Coral: #ff8677 (suave)
Amarelo: #f6c835 (pontos)
Verde Claro: #00c331 (aprovado)
Verde Lima: #d9f73b (energia)
Azul: #0077ad (informação)
Azul Claro: #00d3fb (hover)
Cinza: #929292 (texto secundário)
Vermelho: #ce161c (rejeitado/erro)
\`\`\`

### 7.2 Componentes Principais

#### Layout
- Sidebar lateral com navegação
- Logo e nome do projeto no topo
- Card de categoria e pontos no sidebar
- Footer com avatar e botão de logout
- SidebarTrigger para mobile

#### Dashboard
- Saudação personalizada
- Pontos em destaque (grande)
- Barra de progresso visual entre categorias
- Cards de ação rápida (Tarefas, Submissões, Ranking)
- Resumo do trimestre
- Atividade recente

#### Tarefas
- Grid de cards responsivo
- Filtros por categoria
- Badges de status
- Indicadores de urgência
- Contador de vagas
- Modal detalhado ao clicar

#### Modal de Tarefa
- Seções numeradas para cada etapa
- Códigos de cor por status:
  - Roxo: candidatura
  - Amarelo: aguardando
  - Verde: aprovado
  - Verde escuro: enviar prova
  - Azul: prova em análise
  - Vermelho: rejeitado

### 7.3 Responsividade
- Breakpoints: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
- Sidebar colapsável em mobile
- Grid adapta colunas por tamanho
- Formulários empilhados verticalmente em mobile

### 7.4 Feedback Visual
- Loading spinners durante requisições
- Alerts para sucesso/erro
- Badges de status coloridos
- Animações suaves (framer-motion)
- Progress bars animadas
- Hover effects em cards e botões

---

## 8. PAPÉIS E PERMISSÕES

### 8.1 Ecoante (User)

**Pode:**
- Visualizar tarefas disponíveis
- Candidatar-se a tarefas com inscrição
- Aceitar tarefas sem inscrição
- Enviar provas (se aprovado)
- Ver suas próprias submissões
- Editar seu perfil
- Cadastrar dados bancários
- Ver histórico de pagamentos
- Criar tópicos e posts no fórum
- Curtir posts
- Resgatar recompensas
- Ver ranking geral

**Não pode:**
- Aprovar/rejeitar submissões
- Selecionar candidatos
- Criar/editar tarefas
- Ver submissões de outros usuários
- Processar pagamentos
- Gerenciar recompensas
- Fixar tópicos

### 8.2 Admin

**Pode fazer tudo que Ecoante +:**
- Criar e editar tarefas
- Aprovar/rejeitar candidaturas
- Aprovar/rejeitar submissões de provas
- Ver todas as submissões
- Ver todas as candidaturas
- Adicionar notas de seleção/rejeição
- Processar pagamentos
- Verificar dados bancários
- Criar e gerenciar recompensas
- Fixar tópicos no fórum
- Visualizar métricas gerais

**Restrições:**
- Não pode enviar provas de tarefas (conflito de interesse)
- Não pode resgatar recompensas

---

## 9. INTEGRAÇÕES

### 9.1 Base44 Platform

#### Autenticação
- Sistema de login/logout gerenciado
- Gestão de sessões
- Convites por email

#### Entities SDK
- CRUD completo de todas as entidades
- Filtros e ordenação
- Relacionamentos automáticos

#### File Upload
- Upload de imagens, vídeos, PDFs
- URLs públicas geradas automaticamente
- Limite de 50MB por arquivo

### 9.2 Bibliotecas Frontend

- **React**: Framework principal
- **Tailwind CSS**: Estilização
- **shadcn/ui**: Componentes UI
- **lucide-react**: Ícones
- **date-fns**: Manipulação de datas
- **framer-motion**: Animações
- **react-query**: Gestão de estado server-side
- **react-router-dom**: Navegação
- **react-markdown**: Renderização de markdown

---

## 10. MÉTRICAS E KPIs

### 10.1 Métricas de Usuário
- Total de pontos acumulados
- Categoria atual
- Taxa de aprovação de submissões
- Tarefas completadas por trimestre
- Média de pontos por tarefa
- Streak de participação

### 10.2 Métricas de Sistema
- Total de usuários ativos
- Tarefas criadas por período
- Taxa de conclusão de tarefas
- Tempo médio de aprovação
- Distribuição por categoria
- Valor total pago por trimestre

### 10.3 Métricas de Engajamento
- Posts no fórum por semana
- Likes por post (média)
- Tempo médio na plataforma
- Taxa de retorno semanal
- Recompensas resgatadas

### 10.4 Métricas Administrativas
- Tempo médio de seleção de candidatos
- Tempo médio de aprovação de provas
- Taxa de rejeição (candidaturas vs provas)
- Campanhas urgentes completadas no prazo
- Satisfação dos Ecoantes (NPS)

---

## 11. PRÓXIMOS PASSOS E ROADMAP

### Fase 1 - MVP (Atual)
✅ Sistema de tarefas e pontuação  
✅ Fluxo de candidatura e seleção  
✅ Aprovação de provas  
✅ Dashboard e perfil  
✅ Fórum de comunidade  
✅ Sistema de recompensas  
✅ Ranking  
✅ Gestão de pagamentos  

### Fase 2 - Melhorias (Q1 2025)
- [ ] Notificações push
- [ ] Email automático para eventos-chave
- [ ] Gamificação adicional (badges, conquistas)
- [ ] Gráficos de progresso temporal
- [ ] Export de relatórios (CSV/PDF)

### Fase 3 - Expansão (Q2 2025)
- [ ] App mobile nativo
- [ ] Integração com Instagram API
- [ ] Sistema de referências
- [ ] Mentorias entre Ecoantes
- [ ] Webinars integrados

### Fase 4 - Escala (Q3 2025)
- [ ] Multi-idioma
- [ ] API pública para parceiros
- [ ] Marketplace de recompensas expandido
- [ ] Analytics avançado com BI
- [ ] Programa de embaixadores

---

## 12. GLOSSÁRIO

- **Ecoante**: Influenciador digital parceiro da Cuíca
- **Lab Ecoar**: Nome da plataforma
- **Cuíca**: Organização cliente/parceira
- **Campanha**: Tarefa/ação ambiental a ser realizada
- **Prova**: Evidência de conclusão de uma tarefa
- **Trimestre**: Período de 3 meses para acúmulo de pontos
- **Categoria**: Nível de performance do Ecoante
- **Application**: Inscrição/candidatura para uma tarefa
- **Submission**: Submissão de prova de conclusão
- **Admin**: Administrador do sistema
- **Slot**: Vaga disponível em tarefa com limite de participantes

---

## 13. CONTATO E SUPORTE

**Equipe de Desenvolvimento**: Lab Ecoar Team  
**Plataforma**: Base44  
**Última Atualização**: 10/12/2024  

---

*Documento de Requisitos - Lab Ecoar v1.0*
`;

export default function Requirements() {
  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([requirementsDocument], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = "Lab_Ecoar_Requisitos.md";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'linear-gradient(to br, #f5fff8, #ffffff, #fff5f8)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}>
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#3c0b14' }}>
                Documento de Requisitos
              </h1>
              <p className="text-sm" style={{ color: '#929292' }}>
                Especificação completa do Lab Ecoar
              </p>
            </div>
          </div>
          <Button
            onClick={handleDownload}
            className="text-white"
            style={{ background: 'linear-gradient(135deg, #a6539f 0%, #e833ae 100%)' }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download .md
          </Button>
        </div>

        <Card className="shadow-xl bg-white">
          <CardContent className="p-8">
            <div 
              className="prose prose-lg max-w-none"
              style={{
                '--tw-prose-headings': '#3c0b14',
                '--tw-prose-body': '#3c0b14',
                '--tw-prose-bold': '#3c0b14',
                '--tw-prose-links': '#096e4c',
                '--tw-prose-code': '#a6539f',
                '--tw-prose-quotes': '#929292',
              }}
            >
              <ReactMarkdown>{requirementsDocument}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}