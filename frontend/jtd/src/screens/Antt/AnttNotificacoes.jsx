// Configurações › Notificações por e-mail (somente administradores).
// Modo Teste: todo e-mail vai SÓ para o e-mail de teste. Produção exige confirmação explícita.
import React, { useCallback, useEffect, useState } from "react";
import { anttApi } from "../../services/anttService";
import { Badge, Card, Field, Loading, Notice } from "./components/Ui";
import { fmtDateTime, fmtPct, rotuloMes } from "./format";

const ROTULO = { BA: "Bahia", NE: "Nordeste", N: "Norte", NENO: "Média NE/NO", SIMULADO: "Simulado (teste)" };
const STATUS = {
  PENDENTE: ["Pendente", "neutro"], ENVIANDO: ["Pendente", "neutro"], ENVIADO: ["Enviado (aceito pelo Resend)", "ok"],
  ENTREGUE: ["Entregue", "ok"], FALHA: ["Falha", "erro"],
};
const TIPO = { ALTA: "Aumento", BAIXA: "Redução", MULTIPLOS: "Múltiplos gatilhos" };
const indicadores = (s) => (s || "").split(",").filter(Boolean).map((k) => ROTULO[k] || k).join(", ");

export default function AnttNotificacoes() {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmaProducao, setConfirmaProducao] = useState(false);

  const carregar = useCallback(async () => {
    const r = await anttApi.notificacoes();
    if (!r.ok) { setMsg({ tipo: "erro", texto: r.message }); return; }
    setD(r);
    setF({ email_teste: r.config.email_teste, email_oficial: r.config.email_oficial });
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(body, ok) {
    setOcupado(true); setMsg(null);
    const r = await anttApi.salvarNotificacoes(body);
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.message });
    setMsg({ tipo: "ok", texto: ok });
    setConfirmaProducao(false);
    carregar();
  }
  async function testar() {
    setOcupado(true); setMsg(null);
    const r = await anttApi.testarEmail();
    setOcupado(false);
    setMsg(r.ok
      ? { tipo: "ok", texto: `O Resend aceitou o e-mail de teste para ${r.destinatario} (id ${r.provedor_id}). Confira a caixa de entrada e o spam.` }
      : { tipo: "erro", texto: r.message });
    carregar();
  }

  if (!d || !f) return msg ? <Notice tipo={msg.tipo}>{msg.texto}</Notice> : <Loading />;
  const c = d.config;
  const s = d.servidor;
  const producao = c.modo === "PRODUCAO";
  const ultimo = d.ultimo_envio;
  const alterado = f.email_teste !== c.email_teste || f.email_oficial !== c.email_oficial;

  return (
    <>
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      {!s.resend_configurado && <Notice tipo="erro">RESEND_API_KEY não está configurada no servidor: nenhum e-mail pode ser enviado.</Notice>}

      <Card titulo="Notificações por e-mail" subtitulo="Aviso automático de novos gatilhos de ±5% (Bahia, Nordeste, Norte e Média NE/NO), enviado pelo servidor após cada atualização da ANP.">
        <div className="antt-notif-status">
          <span>Situação <strong>{c.ativo ? <Badge tom="ok">Ativadas</Badge> : <Badge>Desativadas</Badge>}</strong></span>
          <span>Modo <strong>{producao ? <Badge tom="aviso">Produção</Badge> : <Badge tom="neutro">Teste</Badge>}</strong></span>
          <span>Último envio <strong>{ultimo ? <>{fmtDateTime(ultimo.enviado_em || ultimo.atualizado_em)} · <Badge tom={STATUS[ultimo.status][1]}>{STATUS[ultimo.status][0]}</Badge></> : "—"}</strong></span>
          <span>Monitoramento desde <strong>{c.inicio_monitoramento ? fmtDateTime(c.inicio_monitoramento.slice(0, 19)) : "—"}</strong></span>
        </div>

        <div className="antt-grid antt-grid--form">
          <Field rotulo="E-mail de teste" ajuda="Recebe todos os e-mails enquanto o modo Teste estiver ativo.">
            <input type="email" value={f.email_teste} onChange={(e) => setF({ ...f, email_teste: e.target.value })} placeholder="seu.email@exemplo.com" />
          </Field>
          <Field rotulo="E-mail oficial do responsável" ajuda="Usado somente no modo Produção.">
            <input type="email" value={f.email_oficial} onChange={(e) => setF({ ...f, email_oficial: e.target.value })} placeholder="responsavel@jtdlog.com.br" />
          </Field>
        </div>
        <div className="antt-row">
          <button type="button" className="antt-btn antt-btn--sm" disabled={ocupado || !alterado} onClick={() => salvar({ email_teste: f.email_teste, email_oficial: f.email_oficial }, "E-mails salvos.")}>Salvar e-mails</button>
          <button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" disabled={ocupado || !c.email_teste || alterado} onClick={testar}
            title={alterado ? "Salve os e-mails antes de testar" : !c.email_teste ? "Cadastre o e-mail de teste" : "Envia um e-mail demonstrativo (dados simulados) ao e-mail de teste"}>
            {ocupado ? "Enviando…" : "Enviar e-mail de teste"}
          </button>
        </div>

        <div className="antt-notif-acoes">
          <div>
            <strong>Notificações automáticas</strong>
            <p className="antt-muted">{c.ativo ? "O servidor envia um e-mail a cada novo gatilho." : "Ao ativar pela primeira vez, os gatilhos já existentes ficam só no histórico (sem e-mail)."}</p>
          </div>
          <button type="button" className={`antt-btn antt-btn--sm${c.ativo ? " antt-btn--ghost" : ""}`} disabled={ocupado}
            onClick={() => salvar({ ativo: !c.ativo }, c.ativo ? "Notificações automáticas desativadas." : "Notificações automáticas ativadas.")}>
            {c.ativo ? "Desativar" : "Ativar notificações"}
          </button>
        </div>

        <div className="antt-notif-acoes">
          <div>
            <strong>Modo de envio</strong>
            <p className="antt-muted">{producao ? `Produção: os avisos vão para ${c.email_oficial}.` : `Teste: os avisos vão somente para ${c.email_teste || "o e-mail de teste"}; o e-mail oficial nunca recebe.`}</p>
          </div>
          {producao ? (
            <button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" disabled={ocupado} onClick={() => salvar({ modo: "TESTE" }, "Modo Teste ativado.")}>Voltar para Teste</button>
          ) : (
            <div className="antt-notif-prod">
              <label className="antt-check"><input type="checkbox" checked={confirmaProducao} onChange={(e) => setConfirmaProducao(e.target.checked)} disabled={!c.email_oficial} />
                <span>Validei o envio de teste e autorizo enviar ao e-mail oficial</span></label>
              <button type="button" className="antt-btn antt-btn--sm" disabled={ocupado || !confirmaProducao || !c.email_oficial} onClick={() => salvar({ modo: "PRODUCAO", confirmar_producao: true }, "Modo Produção ativado.")}>
                Mudar para Produção
              </button>
            </div>
          )}
        </div>

        <p className="antt-muted antt-notif-servidor">
          Remetente: {s.remetente} · Link do e-mail: {s.url_modulo || "sem botão (endereço público não configurado)"} · Confirmação de entrega: {s.webhook_configurado ? "ativa (webhook do Resend)" : "não configurada — o histórico mostra apenas a aceitação pelo Resend"}
        </p>
      </Card>

      <Card titulo="Histórico de envios" subtitulo="Enviado = aceito pelo Resend. Entregue = confirmado pela caixa postal do destinatário (webhook).">
        {!d.historico.length ? <p className="antt-empty">Nenhum envio ainda.</p> : (
          <div className="antt-tablewrap">
            <table className="antt-table antt-table--list">
              <thead><tr><th>Data</th><th className="is-left">Destinatário</th><th className="is-left">Tipo</th><th className="is-left">Indicador</th><th className="is-left">Status</th><th className="is-left">Modo</th></tr></thead>
              <tbody>
                {d.historico.map((n) => (
                  <tr key={n.id}>
                    <td>{fmtDateTime(n.enviado_em || n.criado_em)}</td>
                    <td className="is-left">{n.destinatario || "—"}</td>
                    <td className="is-left">{n.tipo === "TESTE" ? "Teste (simulado)" : TIPO[n.tipo_alerta] || n.tipo_alerta || "—"}</td>
                    <td className="is-left">{indicadores(n.indicadores)}</td>
                    <td className="is-left" title={n.erro || (n.provedor_id ? `id Resend: ${n.provedor_id}` : undefined)}>
                      <Badge tom={(STATUS[n.status] || ["", "neutro"])[1]}>{(STATUS[n.status] || [n.status])[0]}</Badge>
                      {n.erro && <div className="antt-notif-erro">{n.erro}{n.proxima_tentativa_em ? ` · nova tentativa ${fmtDateTime(n.proxima_tentativa_em)}` : ""}</div>}
                    </td>
                    <td className="is-left">{n.modo === "PRODUCAO" ? "Produção" : "Teste"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card titulo="Gatilhos detectados" subtitulo="Uso interno: indicador, referência e se gerou e-mail. Os anteriores ao início do monitoramento não geram e-mail.">
        {!d.eventos.length ? <p className="antt-empty">Nenhum gatilho registrado ainda (o registro começa na próxima atualização da ANP ou ao ativar as notificações).</p> : (
          <div className="antt-tablewrap" style={{ maxHeight: 320, overflowY: "auto" }}>
            <table className="antt-table antt-table--list">
              <thead><tr><th>Mês</th><th className="is-left">Indicador</th><th className="is-left">Tipo</th><th>Variação</th><th>Referência</th><th className="is-left">E-mail</th></tr></thead>
              <tbody>
                {d.eventos.map((e) => (
                  <tr key={e.id}>
                    <td>{rotuloMes(e.ref_ano, e.ref_mes)}{e.mes_parcial ? "*" : ""}</td>
                    <td className="is-left">{ROTULO[e.indicador] || e.indicador}</td>
                    <td className="is-left">{e.direcao === "ALTA" ? "Aumento" : "Redução"}</td>
                    <td className={e.direcao === "ALTA" ? "is-alta" : "is-baixa"}>{fmtPct(e.variacao_pct)}</td>
                    <td>marco {rotuloMes(e.marco_ref_ano, e.marco_ref_mes)}</td>
                    <td className="is-left">{e.historico ? "Anterior ao monitoramento" : e.notificacao_id ? `Notificação #${e.notificacao_id}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
