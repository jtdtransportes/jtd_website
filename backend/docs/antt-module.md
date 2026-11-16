# Módulo ANTT — Monitoramento e Reajuste de Fretes

## Colocar no ar
1. `cd backend && npm install` (dependência do módulo: `exceljs`, leitura/geração de XLSX).
2. `npm run migrate:antt` — cria/atualiza as tabelas `antt_*` (idempotente; não altera tabelas existentes do sistema).
3. Subir o backend. A sincronização automática roda 30 s após o start e depois a cada `sync_intervalo_horas` (padrão 6 h);
   a cada 30 min o servidor também recalcula os indicadores (mês parcial/completo). Desativar: `ANTT_SYNC_DISABLED=true`.
4. Nada precisa ser digitado: na primeira sincronização são importadas todas as semanas de 2026, calculados os meses,
   criado o marco inicial (média NE/NO de jan/2026) e avaliados os gatilhos.
5. Frontend: usa a mesma base de API do `authService`. Para apontar só o ANTT para outro backend: `REACT_APP_ANTT_API_BASE_URL`.

## Publicação no Render (atualização automática sem depender de nenhum computador)
1. Deploy do backend normalmente. Na inicialização o servidor cria/atualiza as tabelas `antt_*` sozinho
   (desligar com `ANTT_AUTO_MIGRATE=false`) e liga o agendador interno.
2. Agendador interno: funciona enquanto a instância está ativa (planos pagos ficam sempre ativos).
3. Plano gratuito (instância hiberna após ~15 min sem acesso): use o workflow `.github/workflows/antt-sync.yml`,
   que roda nos servidores do GitHub a cada 6 h, acorda o Render e dispara `POST /api/antt/cron/sync`.
   Configuração única:
   - Render → Environment: `ANTT_CRON_SECRET` = valor aleatório com 24+ caracteres.
   - GitHub → Settings → Secrets and variables → Actions: `ANTT_API_URL` = `https://jtd-website.onrender.com` e
     `ANTT_CRON_SECRET` = o mesmo valor. Teste em Actions → "ANTT - sincronizar precos ANP" → Run workflow.
   Sem os segredos o workflow apenas informa que está desativado; sem `ANTT_CRON_SECRET` o endpoint responde 404.
4. Falhas de acesso à ANP: os últimos dados válidos são mantidos (nada é zerado), o erro fica no log e em um aviso discreto,
   e a próxima execução tenta de novo. A importação manual (XLSX, em Configurações › Dados da ANP) é só contingência.
5. Monitoramento: a tela mostra a data da última sincronização **bem-sucedida** e o aviso "dados desatualizados" quando
   ela passou de 36 h ou a última pesquisa importada terminou há mais de 13 dias (`GET /api/antt/sync/versao`).
6. A tela aberta se atualiza sozinha: consulta a versão dos dados a cada 2 min e ao voltar para a aba.

## Desenvolvimento local
O front usa `REACT_APP_API_BASE_URL` quando definido (padrão: Render). O arquivo `frontend/jtd/.env.development.local`
(fora do git) aponta o `npm start` para `http://localhost:4000`. Apague-o para voltar a usar o Render localmente.
O login local usa as contas do banco local (o token do Render não vale no backend local e vice-versa).

## Importação (planilha da empresa: BA, NE, NO e NE/NO)
- **Escopo:** somente ÓLEO DIESEL S10, pesquisas com data inicial ≥ 01/01/2026: estado da **Bahia** (aba ESTADOS da ANP,
  preço estadual oficial — nunca derivado do NE ou do NE/NO) e regiões **Nordeste** e **Norte** (aba REGIÕES). NE/NO = média
  simples das médias mensais NE e NO. Dados fora do escopo são removidos a cada sincronização.
- **Localidade nova no escopo** (ex.: Bahia): se alguma localidade não tem nenhuma semana, a sincronização roda na hora (sem
  esperar o intervalo) e relê uma vez todos os arquivos de 2026, mesmo com hash inalterado.
- **Fonte principal (obrigatória):** página *Levantamento de preços — últimas semanas pesquisadas* (planilhas `resumo_semanal_*.xlsx`).
  Nomes irregulares são reconhecidos; republicações (`…-1.xlsx`) são processadas depois da original e prevalecem.
- **Complemento:** `semanal-regioes-desde-2013.xlsx` e `semanal-estados-desde-2013.xlsx` (séries históricas oficiais) — usado só para semanas ausentes da fonte
  principal; divergências são registradas no log, sem sobrescrever a fonte principal.
- **Sem duplicidade:** chave única (semana, escopo, localidade); arquivos com hash SHA-256. As 6 planilhas mais recentes são sempre
  reverificadas (correções); "Reverificar todas as semanas de 2026" força a checagem completa.
- Correções de semanas já publicadas sobrescrevem o valor, são contadas no log e disparam o recálculo de meses, marco
  inicial automático e gatilhos. Semanas faltantes geram alerta de pendência.
- Upload manual aceita apenas planilhas oficiais XLSX com preços regionais (mesmo filtro de escopo).

## Regras de cálculo (backend, decimais exatos)
1. Semana → mês pela **data inicial** da pesquisa (ex.: 29/03–04/04 conta em março).
2. Média mensal da região = média aritmética simples dos preços médios semanais do mês.
3. Média NE/NO = (média NE + média NO) / 2 — indicador **gerencial** da empresa (reproduz a planilha), não é média oficial ponderada da ANP.
4. Mês parcial enquanto não encerrado ou enquanto falta a pesquisa iniciada no último domingo do mês (tolerância de 14 dias).
5. Diferença mensal = preço − preço do mês anterior; variação mensal = (preço / anterior − 1) × 100.
6. Variação acumulada = (preço / preço do marco − 1) × 100; diferença acumulada = preço − preço do marco (nunca soma de %).
7. Marco aplicável a um mês = marco mais recente com referência ≤ mês; um novo marco zera o acumulado a partir do seu mês.
8. Gatilho gerencial sobre a média NE/NO: ≥ +5% → aumento; ≤ −5% → redução (inclusive; limite configurável).

## Gatilhos e marcos
- Marco inicial automático = média NE/NO de jan/2026 (acompanha correções de janeiro).
- **Marco zero automático:** o mês cuja variação acumulada contra o marco em vigor atinge ≥ +5% ou ≤ −5% vira
  automaticamente o novo marco zero (origem `GATILHO_AUTOMATICO`, preço = média NE/NO do próprio mês) e o acumulado
  recomeça nele. Sem confirmação manual; gera só um aviso informativo (`MARCO_AUTOMATICO`) no dashboard.
- A cadeia é recalculada do zero a cada sincronização: correções da ANP criam, movem ou removem marcos automáticos, e
  um marco de mês parcial acompanha as novas pesquisas até o mês fechar. Mudar o limite em Configurações também recalcula.
- Redefinição manual (`MES_DA_SERIE`) funciona como âncora: reinicia a cadeia a partir do mês escolhido.
- `antt_gatilhos` e `antt_reajustes` guardam apenas o histórico da regra anterior (confirmação manual); gatilhos que
  estavam abertos são encerrados com status `MARCO_AUTOMATICO`.
- Marcos inicial e manuais nunca são apagados (só os automáticos, quando uma correção da ANP os elimina). Redefinição manual é excepcional e usa sempre a média calculada de um mês encerrado.
- **Decisão do reajuste (única ação humana):** para cada marco criado por gatilho, a tela principal mostra "reajuste
  aguardando confirmação" até alguém registrar *aplicado* (com data de aplicação e % opcional) ou *não aplicado*
  (`POST /api/antt/reajustes/decisao`, só administradores). Fica em `antt_reajustes` (quem, quando, data de aplicação) e o
  marco decidido passa a ser fixo: correções posteriores da ANP não o recalculam nem o removem.
- A regra oficial/regulatória da ANTT (tabelas de coeficientes, marcos regulatórios com documento) é separada e não é
  alterada pelo indicador gerencial.

## Notificações por e-mail (novos gatilhos ±5%)
- **Onde:** Configurações › Notificações por e-mail (só administradores). Endereços ficam em `antt_configuracoes`
  (`notif_email_teste`, `notif_email_oficial`, `notif_modo`, `notif_ativo`, `notif_inicio`), nunca no código.
- **Detecção** (`src/antt/notificacoes.js`): após cada sincronização/importação da ANP, para BA, NE, NO e NE/NO — 1º mês que
  atinge ≥ +5% ou ≤ −5% (inclusivo, comparação exata) contra a referência de marco do próprio indicador. Chave única
  `indicador:AAAA-MM do marco de referência:direção` em `antt_eventos_gatilho` → nunca registra nem avisa duas vezes.
- **Envio:** eventos novos da mesma sincronização viram UM e-mail consolidado (`antt_notificacoes`, gravado como PENDENTE
  antes do envio). Resend com chave de idempotência; falha temporária (rede/429/5xx) → novas tentativas em 15 min, 1 h,
  3 h e 6 h (máx. 5); erro de validação não repete. Envio interrompido por queda do servidor vira FALHA para conferência
  (não reenvia sozinho, para não duplicar).
- **Modo Teste:** o destinatário é decidido na hora do envio e só pode ser o e-mail de teste. Produção exige confirmação
  explícita e e-mail oficial cadastrado. O botão "Enviar e-mail de teste" sempre usa o e-mail de teste, com "[TESTE]" no
  assunto e dados simulados (não cria gatilho nem altera marcos); limite de frequência por usuário.
- **1ª ativação:** grava o início do monitoramento e registra os gatilhos já existentes como histórico, sem e-mail.
- **Servidor (variáveis):** `RESEND_API_KEY`, `MAIL_FROM_EMAIL` (domínio verificado no Resend), `ANTT_APP_URL` (link do
  botão; padrão `https://www.jtdtransportes.com.br/#/antt`; localhost/HTTP são recusados) e, para confirmar ENTREGA,
  `RESEND_WEBHOOK_SECRET` + webhook no Resend apontando para `POST /api/antt/webhooks/resend` (eventos email.delivered,
  email.bounced, email.failed, email.complained, email.delivery_delayed). Sem o segredo o histórico mostra só "Enviado"
  (aceito pelo Resend). O disparo depende da sincronização automática (agendador interno + workflow do GitHub no Render free).

## Comunicar reajuste (e-mail MANUAL a clientes) — `/#/antt/comunicados`
- **Independente dos gatilhos:** nada é disparado pela sincronização da ANP; todo envio é pedido por um funcionário e o envio
  real exige confirmação explícita (`confirmar: true` + `chave_envio` única + destinatário revisado igual ao do cadastro).
- **Quem usa:** administradores e os setores marcados em Configurações › Geral › "Comunicar reajuste" (o setor também precisa
  ter acesso ao módulo). Chave `setores_comunicados`; o acesso devolve `pode_comunicar`.
- **Clientes:** reaproveita `antt_clientes` (mesmo cadastro dos retroativos); contatos em `antt_clientes_comunicacao`
  (e-mail principal, contato, até 10 cópias, observações, situação). Cadastrar um nome já existente no módulo (ou excluído)
  reaproveita o registro. Excluir = exclusão lógica (`excluido_em`); o histórico nunca é apagado.
- **Modelo:** assunto padrão editável; texto padrão gerado no navegador a partir do cliente e dos dados (reajuste, vigência,
  contrato) — sem dado, a frase se adapta. O texto COMUNICA o reajuste (não usa "propomos").
- **Reajuste pré-preenchido:** `GET /comunicados/contexto` devolve `acumulado` = variação acumulada do mês mais recente da
  média NE/NO (mesma série dos gatilhos; `acumuladoDoMes()`). Se o próprio mês virou marco zero, compara com o marco anterior
  (como nos alertas). O campo vem com esse valor e pode ser editado; "Usar acumulado" restaura.
- **Remetente:** nome "Evandro Meato JTD Transportes" (`ANTT_COMUNICADOS_FROM_NAME`) com o endereço verificado de
  `ANTT_COMUNICADOS_FROM`/`MAIL_FROM_EMAIL` (o nome "Site JTD Transportes" do site não é usado). Assinatura: "Evandro Meato"
  (`ANTT_COMUNICADOS_ASSINATURA`). Quem enviou de fato fica no histórico.
- **HTML:** `src/antt/emailComunicado.js` (mesma identidade dos alertas, tabelas + estilos inline, Outlook/Gmail/celular).
  A pré-visualização (`POST /comunicados/visualizar`) usa a mesma função do envio. O conteúdo editado passa por
  `src/antt/htmlSeguro.js` (lista branca p/br/strong/em/ul/ol/li, sem atributos).
- **Anexos:** PDF, XLSX, PNG e JPG, até 10 arquivos, 10 MB cada e 25 MB no total (o Resend aceita 40 MB por e-mail após
  base64). Extensão E assinatura do arquivo são conferidas; `.xlsx` com macro é recusado. No banco ficam só os metadados
  (nome, tipo, tamanho, SHA-256), não os arquivos.
- **Teste:** `POST /comunicados/teste` envia SÓ para o e-mail do usuário logado (lido do banco), sem cópias, com "[TESTE]"
  no assunto, mesmo corpo/anexos; registrado com modo TESTE. Limite: 10 testes a cada 10 min.
- **Histórico:** `antt_comunicados` guarda a "foto" do envio (cliente, endereços, assunto, conteúdo, HTML completo, anexos,
  percentual, responsável, id do Resend, status). Não há rota para alterar ou apagar. Status: Enviando → Enviado (aceito pelo
  Resend) → Entregue/Falha (webhook já existente `POST /api/antt/webhooks/resend`).
- **Duplicidade:** botão travado durante o envio, `chave_envio` UNIQUE, chave de idempotência no Resend e bloqueio de
  comunicado idêntico ao mesmo destino nos últimos 2 min.
- **Variáveis do servidor:** `RESEND_API_KEY`; `MAIL_FROM_EMAIL` (domínio verificado) ou `ANTT_COMUNICADOS_FROM`
  (só o endereço); `ANTT_COMUNICADOS_FROM_NAME` / `ANTT_COMUNICADOS_ASSINATURA` (opcionais, padrão Evandro Meato);
  `ANTT_COMUNICADOS_REPLY_TO` (Reply-To corporativo; sem ele, as respostas vão para o remetente — a tela avisa).

## Testes
`npm test` (node:test) — decimais/gatilho inclusivo, regra de corte, médias e média NE/NO, tabela da planilha, marcos e
reinício do acumulado, fluxo completo com repositório em memória (marco automático, alerta único, confirmação, tratamento,
correção de semana), descoberta de arquivos da ANP, parsers, calculadora, retroativos e acesso.
