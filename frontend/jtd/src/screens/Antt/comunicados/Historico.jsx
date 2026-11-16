// Histórico de comunicados (somente leitura): filtros por cliente, período e tipo; abre o e-mail exatamente como foi enviado.
import React, { useCallback, useEffect, useState } from "react";
import { comunicadosApi } from "../../../services/anttService";
import { Badge, Field, Notice } from "../components/Ui";
import { fmtDateTime } from "../format";
import { Envelope, Modal, PreviaEmail } from "./Componentes";
import { fmtBytes, fmtDataBr, fmtPercentual } from "./modelo";

export const STATUS = {
  ENVIANDO: ["Enviando", "neutro", "Gravado antes do envio; sem confirmação do Resend."],
  ENVIADO: ["Enviado", "ok", "Aceito pelo Resend para envio."],
  ENTREGUE: ["Entregue", "ok", "Entrega confirmada pelo servidor do destinatário (webhook)."],
  FALHA: ["Falha", "erro", "Não enviado ou devolvido."],
};
const StatusBadge = ({ s }) => { const [r, tom, t] = STATUS[s] || [s, "neutro", ""]; return <span title={t}><Badge tom={tom}>{r}</Badge></span>; };

function Detalhe({ id, onClose }) {
  const [c, setC] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => { comunicadosApi.comunicado(id).then((r) => (r.ok ? setC(r.comunicado) : setErro(r.message))); }, [id]);
  return (
    <Modal titulo={`Comunicado #${id}`} onClose={onClose} largo>
      {erro && <Notice tipo="erro">{erro}</Notice>}
      {!c && !erro && <p className="antt-muted">Carregando…</p>}
      {c && (
        <>
          <div className="antt-com-detalhe__meta">
            {c.modo === "TESTE" ? <Badge tom="aviso">Teste — não enviado ao cliente</Badge> : <Badge tom="neutro">Envio real</Badge>}
            <StatusBadge s={c.status} />
            <span>Cliente: <strong>{c.cliente_nome}</strong></span>
            <span>Enviado por: <strong>{c.enviado_por_nome || `#${c.enviado_por}`}</strong></span>
            <span>Data: <strong>{fmtDateTime(c.enviado_em || c.criado_em)}</strong></span>
            {c.entregue_em && <span>Entregue: <strong>{fmtDateTime(c.entregue_em)}</strong></span>}
            {c.percentual && <span>Percentual: <strong>{fmtPercentual(c.percentual)}</strong></span>}
            {c.data_vigencia && <span>Vigência: <strong>{fmtDataBr(c.data_vigencia)}</strong></span>}
            {c.contrato_ref && <span>Contrato: <strong>{c.contrato_ref}</strong></span>}
            {c.provedor_id && <span>ID Resend: <code>{c.provedor_id}</code></span>}
          </div>
          {c.erro && <Notice tipo="erro">{c.erro}</Notice>}
          <Envelope de={c.remetente} para={c.destinatario} cc={c.cc} replyTo={c.reply_to} assunto={c.assunto} anexos={c.anexos} fmtBytes={fmtBytes} />
          {c.anexos?.length > 0 && (
            <details className="antt-com-hash"><summary>Detalhes dos anexos</summary>
              <ul>{c.anexos.map((a) => <li key={a.sha256 || a.nome}>{a.nome} · {a.tipo} · {fmtBytes(a.tamanho)} · SHA-256 <code>{String(a.sha256 || "").slice(0, 16)}…</code></li>)}</ul>
              <p className="antt-muted">Os arquivos não ficam guardados no sistema; o registro mantém nome, tipo, tamanho e a impressão digital (SHA-256) de cada anexo.</p>
            </details>
          )}
          <PreviaEmail html={c.email_html} />
          <p className="antt-muted">Registro somente leitura: esta é a mensagem exatamente como foi enviada.</p>
        </>
      )}
    </Modal>
  );
}

export default function Historico({ versao }) {
  const [f, setF] = useState({ cliente_id: "", de: "", ate: "", modo: "" });
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async (filtros) => {
    setErro(null);
    const r = await comunicadosApi.historico(filtros);
    if (r.ok) setD(r); else { setErro(r.message); setD((x) => x || { comunicados: [], clientes: [] }); }
  }, []);
  useEffect(() => { carregar(f); }, [carregar, f, versao]);
  const set = (p) => setF((x) => ({ ...x, ...p }));

  return (
    <section className="antt-card">
      <div className="antt-com-filtros">
        <Field rotulo="Cliente">
          <select value={f.cliente_id} onChange={(e) => set({ cliente_id: e.target.value })}>
            <option value="">Todos</option>
            {(d?.clientes || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <Field rotulo="De"><input type="date" value={f.de} onChange={(e) => set({ de: e.target.value })} /></Field>
        <Field rotulo="Até"><input type="date" value={f.ate} onChange={(e) => set({ ate: e.target.value })} /></Field>
        <Field rotulo="Tipo">
          <select value={f.modo} onChange={(e) => set({ modo: e.target.value })}><option value="">Todos</option><option value="REAL">Envios reais</option><option value="TESTE">Testes</option></select>
        </Field>
        {(f.cliente_id || f.de || f.ate || f.modo) && <button type="button" className="antt-linkbtn" onClick={() => setF({ cliente_id: "", de: "", ate: "", modo: "" })}>Limpar filtros</button>}
      </div>
      {erro && <Notice tipo="erro">{erro}</Notice>}
      {!d ? <p className="antt-muted">Carregando…</p> : !d.comunicados.length ? <p className="antt-empty">Nenhum comunicado encontrado.</p> : (
        <div className="antt-tablewrap">
          <table className="antt-table antt-table--list antt-com-tabela">
            <thead><tr><th>Data</th><th className="is-left">Cliente</th><th className="is-left">Enviado para</th><th className="is-left">Assunto</th><th className="is-left">Status</th><th className="is-left">Responsável</th><th /></tr></thead>
            <tbody>
              {d.comunicados.map((c) => (
                <tr key={c.id}>
                  <td>{fmtDateTime(c.enviado_em || c.criado_em)}</td>
                  <td className="is-left">{c.cliente_nome}{c.modo === "TESTE" && <> <Badge tom="aviso">Teste</Badge></>}</td>
                  <td className="is-left">{c.destinatario}{c.cc?.length ? <small className="antt-com-cc"> +{c.cc.length} cópia(s)</small> : null}</td>
                  <td className="is-left antt-com-assunto" title={c.assunto}>{c.assunto}{c.anexos?.length ? <small className="antt-com-cc"> · {c.anexos.length} anexo(s)</small> : null}</td>
                  <td className="is-left"><StatusBadge s={c.status} /></td>
                  <td className="is-left">{c.enviado_por_nome || "—"}</td>
                  <td><button type="button" className="antt-linkbtn" onClick={() => setAberto(c.id)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aberto && <Detalhe id={aberto} onClose={() => setAberto(null)} />}
    </section>
  );
}
