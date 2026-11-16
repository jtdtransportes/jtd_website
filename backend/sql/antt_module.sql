-- ============================================================================
-- Módulo ANTT — Monitoramento e Reajuste de Fretes
-- Todas as tabelas novas usam o prefixo antt_. Nenhuma tabela existente é alterada,
-- exceto a referência (FK opcional) a users(id) para registrar autoria.
-- Idempotente: pode ser executado várias vezes (CREATE TABLE IF NOT EXISTS).
-- Aplicar com:  npm run migrate:antt   (ou importando este arquivo no MySQL)
-- Valores financeiros e coeficientes usam DECIMAL (nunca FLOAT/DOUBLE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ANP: arquivos processados (controle de "somente o que mudou")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_anp_arquivos (
  id INT NOT NULL AUTO_INCREMENT,
  url VARCHAR(500) NOT NULL,
  fonte VARCHAR(30) NOT NULL,
  hash_sha256 CHAR(64) NOT NULL,
  tamanho_bytes BIGINT NOT NULL DEFAULT 0,
  linhas_lidas INT NOT NULL DEFAULT 0,
  registros_gravados INT NOT NULL DEFAULT 0,
  processado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_anp_arquivos_url (url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- ANP: agregados DIÁRIOS derivados dos microdados por posto (fonte ANP_MICRODADOS).
-- Guardar soma + quantidade permite recompor semanas que cruzam dois arquivos
-- mensais sem duplicar nem sobrescrever dados parciais.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_anp_precos_diarios (
  id BIGINT NOT NULL AUTO_INCREMENT,
  data_coleta DATE NOT NULL,
  escopo ENUM('BRASIL','REGIAO','ESTADO') NOT NULL,
  chave VARCHAR(4) NOT NULL,
  produto VARCHAR(30) NOT NULL DEFAULT 'DIESEL S10',
  n_observacoes INT NOT NULL,
  soma_precos DECIMAL(16,4) NOT NULL,
  preco_minimo DECIMAL(10,4) NOT NULL,
  preco_maximo DECIMAL(10,4) NOT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_diario (data_coleta, escopo, chave, produto),
  KEY idx_antt_diario_busca (escopo, chave, produto, data_coleta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- ANP: histórico SEMANAL (semana domingo→sábado).
-- fonte = ANP_RESUMO_SEMANAL  → planilha oficial "resumo semanal" (preço com 2 casas)
-- fonte = ANP_MICRODADOS      → média simples derivada dos microdados por posto
-- As duas metodologias NÃO se misturam: a chave única inclui a fonte.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_anp_precos_semanais (
  id BIGINT NOT NULL AUTO_INCREMENT,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  escopo ENUM('BRASIL','REGIAO','ESTADO') NOT NULL,
  chave VARCHAR(4) NOT NULL,
  produto VARCHAR(30) NOT NULL DEFAULT 'DIESEL S10',
  fonte ENUM('ANP_RESUMO_SEMANAL','ANP_MICRODADOS') NOT NULL,
  preco_medio DECIMAL(10,4) NOT NULL,
  preco_minimo DECIMAL(10,4) NULL,
  preco_maximo DECIMAL(10,4) NULL,
  n_postos INT NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_semanal (semana_inicio, escopo, chave, produto, fonte),
  KEY idx_antt_semanal_busca (escopo, chave, produto, fonte, semana_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- ANP: médias MENSAIS calculadas (cada metodologia em linha própria).
-- MEDIA_SIMPLES_SEMANAS  = média aritmética das médias semanais
-- MEDIA_PONDERADA_POSTOS = média das semanas ponderada pelo nº de postos
-- Semana pertence ao mês da sua quarta-feira (maioria dos dias).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_anp_medias_mensais (
  id BIGINT NOT NULL AUTO_INCREMENT,
  ano SMALLINT NOT NULL,
  mes TINYINT NOT NULL,
  escopo ENUM('BRASIL','REGIAO','ESTADO') NOT NULL,
  chave VARCHAR(4) NOT NULL,
  produto VARCHAR(30) NOT NULL DEFAULT 'DIESEL S10',
  fonte ENUM('ANP_RESUMO_SEMANAL','ANP_MICRODADOS') NOT NULL,
  metodologia ENUM('MEDIA_SIMPLES_SEMANAS','MEDIA_PONDERADA_POSTOS') NOT NULL,
  preco_medio DECIMAL(10,4) NOT NULL,
  n_semanas TINYINT NOT NULL,
  n_postos_total INT NOT NULL DEFAULT 0,
  mes_completo TINYINT(1) NOT NULL DEFAULT 0,
  ultima_semana_fim DATE NOT NULL,
  calculado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_mensal (ano, mes, escopo, chave, produto, fonte, metodologia),
  KEY idx_antt_mensal_busca (escopo, chave, produto, fonte, metodologia, ano, mes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Marcos de referência (nunca apagados; só o indicador "vigente" muda)
-- tipo GERENCIAL  = marco definido pela empresa (base do gatilho de 5%)
-- tipo REGULATORIO = referência informada manualmente a partir de publicação ANTT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_marcos (
  id INT NOT NULL AUTO_INCREMENT,
  tipo ENUM('GERENCIAL','REGULATORIO') NOT NULL DEFAULT 'GERENCIAL',
  escopo ENUM('BRASIL','REGIAO','ESTADO') NOT NULL DEFAULT 'BRASIL',
  chave VARCHAR(4) NOT NULL DEFAULT 'BR',
  produto VARCHAR(30) NOT NULL DEFAULT 'DIESEL S10',
  fonte ENUM('ANP_RESUMO_SEMANAL','ANP_MICRODADOS') NOT NULL,
  metodologia ENUM('MEDIA_SIMPLES_SEMANAS','MEDIA_PONDERADA_POSTOS') NOT NULL,
  ref_ano SMALLINT NOT NULL,
  ref_mes TINYINT NOT NULL,
  preco_referencia DECIMAL(10,4) NOT NULL,
  origem ENUM('MES_DA_SERIE','PRECO_MANUAL','APOS_REAJUSTE') NOT NULL,
  reajuste_id INT NULL,
  fonte_documento VARCHAR(500) NULL,
  observacao VARCHAR(500) NULL,
  vigente TINYINT(1) NOT NULL DEFAULT 1,
  encerrado_em TIMESTAMP NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_antt_marcos_vigente (tipo, escopo, chave, vigente),
  CONSTRAINT fk_antt_marcos_user FOREIGN KEY (criado_por) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Eventos de reajuste (gerenciais) — só existem com confirmação humana
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_reajustes (
  id INT NOT NULL AUTO_INCREMENT,
  marco_id INT NOT NULL,
  direcao ENUM('ALTA','BAIXA') NOT NULL,
  ref_ano SMALLINT NOT NULL,
  ref_mes TINYINT NOT NULL,
  preco_apurado DECIMAL(10,4) NOT NULL,
  preco_referencia DECIMAL(10,4) NOT NULL,
  variacao_pct DECIMAL(10,4) NOT NULL,
  percentual_aplicado DECIMAL(10,4) NULL,
  data_vigencia DATE NOT NULL,
  status ENUM('APROVADO','REJEITADO') NOT NULL,
  justificativa VARCHAR(500) NOT NULL,
  aprovado_por INT NOT NULL,
  aprovado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  novo_marco_id INT NULL,
  PRIMARY KEY (id),
  KEY idx_antt_reajustes_marco (marco_id),
  CONSTRAINT fk_antt_reajustes_marco FOREIGN KEY (marco_id) REFERENCES antt_marcos (id),
  CONSTRAINT fk_antt_reajustes_user FOREIGN KEY (aprovado_por) REFERENCES users (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Alertas do dashboard (alert_key UNIQUE evita duplicidade)
-- email_enviado_em reservado para notificações por e-mail futuras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_alertas (
  id INT NOT NULL AUTO_INCREMENT,
  alert_key VARCHAR(120) NOT NULL,
  tipo ENUM('GATILHO_ALTA','GATILHO_BAIXA','SYNC_ERRO','DADOS_NOVOS') NOT NULL,
  severidade ENUM('INFO','ATENCAO','CRITICO') NOT NULL DEFAULT 'INFO',
  titulo VARCHAR(160) NOT NULL,
  mensagem VARCHAR(600) NOT NULL,
  marco_id INT NULL,
  ref_ano SMALLINT NULL,
  ref_mes TINYINT NULL,
  variacao_pct DECIMAL(10,4) NULL,
  resolvido TINYINT(1) NOT NULL DEFAULT 0,
  resolvido_por INT NULL,
  resolvido_em TIMESTAMP NULL,
  email_enviado_em TIMESTAMP NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_alertas_key (alert_key),
  KEY idx_antt_alertas_abertos (resolvido, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Log de sincronizações com a ANP
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_sync_logs (
  id INT NOT NULL AUTO_INCREMENT,
  origem ENUM('AUTOMATICA','MANUAL','UPLOAD') NOT NULL,
  status ENUM('EM_ANDAMENTO','SUCESSO','PARCIAL','ERRO') NOT NULL DEFAULT 'EM_ANDAMENTO',
  arquivos_processados INT NOT NULL DEFAULT 0,
  arquivos_ignorados INT NOT NULL DEFAULT 0,
  registros_gravados INT NOT NULL DEFAULT 0,
  mensagem VARCHAR(1000) NULL,
  detalhes JSON NULL,
  iniciado_por INT NULL,
  iniciado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalizado_em TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_antt_sync_logs_data (iniciado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Configurações do módulo (chave/valor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_configuracoes (
  chave VARCHAR(60) NOT NULL,
  valor TEXT NOT NULL,
  atualizado_por INT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Coeficientes oficiais ANTT (versionados por vigência; nunca sobrescritos)
-- Fórmula do piso mínimo:  distância(km) × CCD + CC
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_tabelas_frete (
  id INT NOT NULL AUTO_INCREMENT,
  tabela ENUM('A','B') NOT NULL,
  tipo_carga VARCHAR(40) NOT NULL DEFAULT 'CARGA_GERAL',
  vigencia_inicio DATE NOT NULL,
  norma VARCHAR(200) NOT NULL,
  fonte_url VARCHAR(500) NOT NULL,
  observacao VARCHAR(500) NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_tabela_vigencia (tabela, tipo_carga, vigencia_inicio),
  CONSTRAINT fk_antt_tabelas_user FOREIGN KEY (criado_por) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antt_tabelas_frete_itens (
  id INT NOT NULL AUTO_INCREMENT,
  tabela_id INT NOT NULL,
  eixos TINYINT NOT NULL,
  ccd DECIMAL(14,6) NOT NULL,
  cc DECIMAL(14,6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_tabela_item (tabela_id, eixos),
  CONSTRAINT fk_antt_itens_tabela FOREIGN KEY (tabela_id) REFERENCES antt_tabelas_frete (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Clientes, contratos e fretes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_clientes (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(160) NOT NULL,
  documento VARCHAR(20) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_clientes_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antt_contratos (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  descricao VARCHAR(200) NOT NULL,
  elegibilidade ENUM('PENDENTE_CONFIRMACAO','CONFIRMADA','NAO_ELEGIVEL') NOT NULL DEFAULT 'PENDENTE_CONFIRMACAO',
  data_aplicacao_reajuste DATE NULL,
  aplicacao_confirmada TINYINT(1) NOT NULL DEFAULT 0,
  observacao VARCHAR(500) NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_antt_contratos_cliente (cliente_id),
  CONSTRAINT fk_antt_contratos_cliente FOREIGN KEY (cliente_id) REFERENCES antt_clientes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antt_fretes (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  contrato_id INT NULL,
  identificacao VARCHAR(60) NOT NULL,
  data_frete DATE NOT NULL,
  km DECIMAL(12,2) NOT NULL,
  valor_cobrado DECIMAL(14,2) NOT NULL,
  tabela ENUM('A','B') NULL,
  tipo_carga VARCHAR(40) NOT NULL DEFAULT 'CARGA_GERAL',
  eixos TINYINT NULL,
  ccd_aplicado DECIMAL(14,6) NULL,
  cc_aplicado DECIMAL(14,6) NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_fretes_ident (cliente_id, identificacao),
  KEY idx_antt_fretes_data (cliente_id, data_frete),
  CONSTRAINT fk_antt_fretes_cliente FOREIGN KEY (cliente_id) REFERENCES antt_clientes (id),
  CONSTRAINT fk_antt_fretes_contrato FOREIGN KEY (contrato_id) REFERENCES antt_contratos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Cálculos retroativos (cabeçalho + itens com "foto" dos coeficientes usados)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_retroativos (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  contrato_id INT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  data_vigencia_reajuste DATE NOT NULL,
  tabela_nova_id INT NOT NULL,
  apenas_positivas TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('ESTIMADO','CONFIRMADO') NOT NULL DEFAULT 'ESTIMADO',
  qtd_fretes INT NOT NULL,
  km_total DECIMAL(14,2) NOT NULL,
  km_medio DECIMAL(14,2) NOT NULL,
  total_cobrado DECIMAL(16,2) NOT NULL,
  total_recalculado DECIMAL(16,2) NOT NULL,
  total_retroativo DECIMAL(16,2) NOT NULL,
  observacao VARCHAR(500) NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_antt_retro_cliente (cliente_id, criado_em),
  CONSTRAINT fk_antt_retro_cliente FOREIGN KEY (cliente_id) REFERENCES antt_clientes (id),
  CONSTRAINT fk_antt_retro_tabela FOREIGN KEY (tabela_nova_id) REFERENCES antt_tabelas_frete (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antt_retroativo_itens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  retroativo_id INT NOT NULL,
  frete_id INT NULL,
  identificacao VARCHAR(60) NOT NULL,
  data_frete DATE NOT NULL,
  km DECIMAL(12,2) NOT NULL,
  valor_cobrado DECIMAL(14,2) NOT NULL,
  ccd_original DECIMAL(14,6) NULL,
  cc_original DECIMAL(14,6) NULL,
  ccd_novo DECIMAL(14,6) NOT NULL,
  cc_novo DECIMAL(14,6) NOT NULL,
  valor_recalculado DECIMAL(14,2) NOT NULL,
  diferenca DECIMAL(14,2) NOT NULL,
  efeito_ccd DECIMAL(14,2) NULL,
  efeito_cc DECIMAL(14,2) NULL,
  PRIMARY KEY (id),
  KEY idx_antt_retro_itens (retroativo_id),
  CONSTRAINT fk_antt_retro_itens FOREIGN KEY (retroativo_id) REFERENCES antt_retroativos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antt_auditoria (
  id BIGINT NOT NULL AUTO_INCREMENT,
  usuario_id INT NULL,
  acao VARCHAR(60) NOT NULL,
  entidade VARCHAR(60) NOT NULL,
  entidade_id VARCHAR(40) NULL,
  antes JSON NULL,
  depois JSON NULL,
  ip VARCHAR(64) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_antt_auditoria_data (criado_em),
  KEY idx_antt_auditoria_entidade (entidade, entidade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- v2 — Regra da planilha NE/NO (Diesel S10, Norte e Nordeste, a partir de 2026)
-- Alterações idempotentes apenas em tabelas do próprio módulo (antt_*).
-- ============================================================================
ALTER TABLE antt_anp_medias_mensais
  MODIFY escopo ENUM('BRASIL','REGIAO','ESTADO','COMBINADO') NOT NULL,
  MODIFY preco_medio DECIMAL(14,6) NOT NULL;

ALTER TABLE antt_marcos
  MODIFY escopo ENUM('BRASIL','REGIAO','ESTADO','COMBINADO') NOT NULL DEFAULT 'COMBINADO',
  MODIFY chave VARCHAR(4) NOT NULL DEFAULT 'NENO',
  MODIFY origem ENUM('MES_DA_SERIE','PRECO_MANUAL','APOS_REAJUSTE','INICIAL_AUTOMATICO','GATILHO_AUTOMATICO') NOT NULL,
  MODIFY preco_referencia DECIMAL(14,6) NOT NULL;

ALTER TABLE antt_reajustes
  MODIFY preco_apurado DECIMAL(14,6) NOT NULL,
  MODIFY preco_referencia DECIMAL(14,6) NOT NULL;

-- Gatilho detectado automaticamente (um por marco e direção). Fica ABERTO até ser
-- confirmado (reajuste aplicado → novo marco) ou tratado (decisão de não aplicar).
CREATE TABLE IF NOT EXISTS antt_gatilhos (
  id INT NOT NULL AUTO_INCREMENT,
  marco_id INT NOT NULL,
  direcao ENUM('ALTA','BAIXA') NOT NULL,
  ref_ano SMALLINT NOT NULL,
  ref_mes TINYINT NOT NULL,
  mes_parcial TINYINT(1) NOT NULL DEFAULT 0,
  marco_ref_ano SMALLINT NOT NULL,
  marco_ref_mes TINYINT NOT NULL,
  preco_referencia DECIMAL(14,6) NOT NULL,
  preco_atual DECIMAL(14,6) NOT NULL,
  variacao_pct DECIMAL(10,4) NOT NULL,
  diferenca_rs DECIMAL(14,6) NOT NULL,
  status ENUM('ABERTO','CONFIRMADO','TRATADO','CANCELADO_CORRECAO') NOT NULL DEFAULT 'ABERTO',
  detectado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  tratado_por INT NULL,
  tratado_em TIMESTAMP NULL,
  reajuste_id INT NULL,
  observacao VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_gatilho_marco_dir (marco_id, direcao),
  KEY idx_antt_gatilhos_status (status),
  CONSTRAINT fk_antt_gatilhos_marco FOREIGN KEY (marco_id) REFERENCES antt_marcos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- v3 — Marco zero automático: o mês que atinge o gatilho (±limite) vira o novo marco
-- (origem GATILHO_AUTOMATICO, recalculado a cada atualização). Sem confirmação manual.
-- ============================================================================
ALTER TABLE antt_alertas
  MODIFY tipo ENUM('GATILHO_ALTA','GATILHO_BAIXA','SYNC_ERRO','DADOS_NOVOS','MARCO_AUTOMATICO') NOT NULL;

ALTER TABLE antt_gatilhos
  MODIFY status ENUM('ABERTO','CONFIRMADO','TRATADO','CANCELADO_CORRECAO','MARCO_AUTOMATICO') NOT NULL DEFAULT 'ABERTO';

-- ============================================================================
-- v4 — Notificações por e-mail de gatilhos (BA, NE, NO e NE/NO). Só tabelas novas.
-- ============================================================================
-- Evento de gatilho detectado (chave única = indicador:marco de referência:direção → nunca duplica)
CREATE TABLE IF NOT EXISTS antt_eventos_gatilho (
  id INT NOT NULL AUTO_INCREMENT,
  chave_evento VARCHAR(80) NOT NULL,
  indicador VARCHAR(5) NOT NULL,
  direcao ENUM('ALTA','BAIXA') NOT NULL,
  ref_ano SMALLINT NOT NULL,
  ref_mes TINYINT NOT NULL,
  marco_ref_ano SMALLINT NOT NULL,
  marco_ref_mes TINYINT NOT NULL,
  preco_referencia DECIMAL(14,6) NOT NULL,
  preco_apurado DECIMAL(14,6) NOT NULL,
  variacao_pct DECIMAL(10,4) NOT NULL,
  mes_parcial TINYINT(1) NOT NULL DEFAULT 0,
  historico TINYINT(1) NOT NULL DEFAULT 0,
  notificacao_id INT NULL,
  detectado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_evento_chave (chave_evento),
  KEY idx_antt_evento_notif (notificacao_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tentativa de notificação (estado persistido: reiniciar o servidor não reenvia)
CREATE TABLE IF NOT EXISTS antt_notificacoes (
  id INT NOT NULL AUTO_INCREMENT,
  tipo ENUM('GATILHO','TESTE') NOT NULL,
  modo ENUM('TESTE','PRODUCAO') NOT NULL,
  destinatario VARCHAR(254) NOT NULL DEFAULT '',
  assunto VARCHAR(200) NULL,
  tipo_alerta VARCHAR(20) NULL,
  indicadores VARCHAR(60) NULL,
  status ENUM('PENDENTE','ENVIANDO','ENVIADO','ENTREGUE','FALHA') NOT NULL DEFAULT 'PENDENTE',
  tentativas TINYINT NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMP NULL,
  provedor_id VARCHAR(100) NULL,
  evento_provedor VARCHAR(40) NULL,
  erro VARCHAR(500) NULL,
  criado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  enviado_em TIMESTAMP NULL,
  entregue_em TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_antt_notif_status (status, proxima_tentativa_em),
  KEY idx_antt_notif_provedor (provedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- v5 — Comunicar reajuste (envio MANUAL de e-mails a clientes). Só tabelas novas.
-- Reaproveita antt_clientes (nome/situação); os dados de contato ficam na extensão 1:1.
-- Exclusão é lógica (excluido_em): o histórico de comunicados nunca é apagado.
-- ============================================================================
CREATE TABLE IF NOT EXISTS antt_clientes_comunicacao (
  cliente_id INT NOT NULL,
  email_principal VARCHAR(254) NULL,
  contato_nome VARCHAR(160) NULL,
  emails_cc JSON NULL,
  observacoes VARCHAR(1000) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  excluido_em TIMESTAMP NULL,
  excluido_por INT NULL,
  atualizado_por INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cliente_id),
  KEY idx_antt_cli_com_ativo (excluido_em, ativo),
  CONSTRAINT fk_antt_cli_com_cliente FOREIGN KEY (cliente_id) REFERENCES antt_clientes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comunicado enviado (registro imutável: só os campos de status do provedor mudam depois).
-- Guarda a "foto" do envio: cliente, endereços, assunto, conteúdo editado e o HTML completo enviado.
-- chave_envio UNIQUE impede gravar/enviar duas vezes o mesmo clique.
CREATE TABLE IF NOT EXISTS antt_comunicados (
  id INT NOT NULL AUTO_INCREMENT,
  chave_envio VARCHAR(64) NOT NULL,
  modo ENUM('TESTE','REAL') NOT NULL,
  cliente_id INT NULL,
  cliente_nome VARCHAR(160) NOT NULL,
  destinatario VARCHAR(254) NOT NULL,
  cc JSON NULL,
  remetente VARCHAR(320) NOT NULL,
  reply_to VARCHAR(254) NULL,
  assunto VARCHAR(220) NOT NULL,
  corpo_html MEDIUMTEXT NOT NULL,
  email_html MEDIUMTEXT NOT NULL,
  email_texto MEDIUMTEXT NOT NULL,
  conteudo_sha256 CHAR(64) NOT NULL,
  percentual DECIMAL(9,4) NULL,
  data_vigencia DATE NULL,
  contrato_ref VARCHAR(120) NULL,
  anexos JSON NULL,
  status ENUM('ENVIANDO','ENVIADO','ENTREGUE','FALHA') NOT NULL DEFAULT 'ENVIANDO',
  provedor_id VARCHAR(100) NULL,
  evento_provedor VARCHAR(40) NULL,
  erro VARCHAR(500) NULL,
  enviado_por INT NULL,
  enviado_por_nome VARCHAR(160) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_em TIMESTAMP NULL,
  entregue_em TIMESTAMP NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antt_comunicado_chave (chave_envio),
  KEY idx_antt_comunicado_cliente (cliente_id, criado_em),
  KEY idx_antt_comunicado_data (criado_em),
  KEY idx_antt_comunicado_hash (conteudo_sha256, criado_em),
  KEY idx_antt_comunicado_provedor (provedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
