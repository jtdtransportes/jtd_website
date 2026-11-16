// Configurações › Marcos e regulatório: ações excepcionais e referências oficiais, fora da tela principal.
import React, { useCallback, useEffect, useState } from "react";
import { anttApi } from "../../services/anttService";
import { useAntt } from "./AnttContext";
import { Card, Field, Loading, Notice } from "./components/Ui";
import { fmtBRL, fmtDate, fmtDateTime, fmtPct, rotuloMes } from "./format";

const STATUS_GATILHO = { ABERTO: "Aberto", CONFIRMADO: "Reajuste confirmado", TRATADO: "Tratado sem reajuste", CANCELADO_CORRECAO: "Cancelado por correção da ANP", MARCO_AUTOMATICO: "Virou marco zero automático" };

function RedefinirMarco({ meses, onFeito }) {
  const completos = meses.filter((m) => m.mes_completo);
  const [sel, setSel] = useState("");
  const [obs, setObs] = useState("");
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState(null);
  async function salvar() {
    const [ano, mes] = sel.split("-").map(Number);
    const r = await anttApi.criarMarco({ tipo: "GERENCIAL", ref_ano: ano, ref_mes: mes, observacao: obs });
    if (r.ok) onFeito(`Marco redefinido para ${rotuloMes(ano, mes)} (${fmtBRL(r.preco_referencia)}).`); else setMsg({ tipo: "erro", texto: r.message });
  }
  return (
    <div className="antt-stack">
      <div className="antt-grid antt-grid--form">
        <Field rotulo="Mês de referência (encerrado)"><select value={sel} onChange={(e) => setSel(e.target.value)}><option value="">Selecione…</option>{completos.map((m) => <option key={`${m.ano}-${m.mes}`} value={`${m.ano}-${m.mes}`}>{rotuloMes(m.ano, m.mes)} — {fmtBRL(m.preco_medio)}</option>)}</select></Field>
        <Field rotulo="Motivo (obrigatório)"><input type="text" value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} /></Field>
      </div>
      <label className="antt-check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>O novo marco passa a ser o vigente; os anteriores e todo o histórico são preservados.</span></label>
      <div className="antt-row"><button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" disabled={!sel || obs.trim().length < 5 || !ok} onClick={salvar}>Redefinir marco</button></div>
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
    </div>
  );
}

function MarcoRegulatorio({ onFeito }) {
  const [f, setF] = useState({ ref_ano: new Date().getFullYear(), ref_mes: 1, preco_referencia: "", fonte_documento: "", observacao: "" });
  const [msg, setMsg] = useState(null);
  async function salvar(e) {
    e.preventDefault();
    const r = await anttApi.criarMarco({ tipo: "REGULATORIO", ...f, ref_ano: Number(f.ref_ano), ref_mes: Number(f.ref_mes) });
    if (r.ok) onFeito("Referência regulatória registrada."); else setMsg({ tipo: "erro", texto: r.message });
  }
  return (
    <form onSubmit={salvar} className="antt-stack">
      <div className="antt-grid antt-grid--form">
        <Field rotulo="Mês"><input type="number" min="1" max="12" value={f.ref_mes} onChange={(e) => setF({ ...f, ref_mes: e.target.value })} /></Field>
        <Field rotulo="Ano"><input type="number" min="2026" value={f.ref_ano} onChange={(e) => setF({ ...f, ref_ano: e.target.value })} /></Field>
        <Field rotulo="Preço de referência ANTT (R$/L)"><input type="text" inputMode="decimal" value={f.preco_referencia} onChange={(e) => setF({ ...f, preco_referencia: e.target.value })} required /></Field>
        <Field rotulo="Documento oficial ANTT"><input type="text" value={f.fonte_documento} onChange={(e) => setF({ ...f, fonte_documento: e.target.value })} required /></Field>
      </div>
      <div className="antt-row"><button className="antt-btn antt-btn--sm antt-btn--ghost">Registrar referência regulatória</button></div>
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
    </form>
  );
}

export default function AdminMarcos() {
  const { podeEditar } = useAntt();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const carregar = useCallback(async () => {
    const [dash, gat, mc] = await Promise.all([anttApi.dashboard({}), anttApi.gatilhos(), anttApi.marcos({ tipo: "REGULATORIO" })]);
    setD({ dash: dash.ok ? dash : null, gatilhos: gat.ok ? gat.gatilhos : [], regulatorios: mc.ok ? mc.marcos : [] });
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const feito = (texto) => { setMsg({ tipo: "ok", texto }); carregar(); };
  if (!d) return <Loading />;
  const tabelas = d.dash?.regulatorio?.tabelas_vigentes || [];
  return (
    <>
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      {podeEditar && d.dash && !d.dash.sem_dados && (
        <Card titulo="Redefinir marco manualmente" subtitulo="Uso excepcional: o marco muda sozinho quando a média NE/NO atinge o gatilho. O preço vem da média NE/NO do mês escolhido.">
          <RedefinirMarco meses={d.dash.series?.NENO || []} onFeito={feito} />
        </Card>
      )}
      <Card titulo="Indicador regulatório ANTT" subtitulo="Baseado só nas publicações oficiais da ANTT; não é alterado pelo gatilho gerencial.">
        {tabelas.length ? (
          <ul className="antt-muted" style={{ margin: 0, paddingLeft: 18 }}>
            {tabelas.map((t) => <li key={t.id}>Tabela {t.tabela} · {t.tipo_carga.replaceAll("_", " ").toLowerCase()} desde {fmtDate(t.vigencia_inicio)} ({t.norma}) <a href={t.fonte_url} target="_blank" rel="noreferrer">fonte</a></li>)}
          </ul>
        ) : <p className="antt-muted">Nenhuma tabela oficial vigente (aba Coeficientes ANTT).</p>}
        {d.regulatorios.length > 0 && (
          <ul className="antt-muted" style={{ margin: 0, paddingLeft: 18 }}>
            {d.regulatorios.map((m) => <li key={m.id}>Referência {rotuloMes(m.ref_ano, m.ref_mes)}: {fmtBRL(m.preco_referencia)} · {m.fonte_documento}{m.vigente ? " (vigente)" : ""}</li>)}
          </ul>
        )}
        {podeEditar && <MarcoRegulatorio onFeito={feito} />}
      </Card>
      {d.gatilhos.length > 0 && (
        <Card titulo="Gatilhos da regra anterior" subtitulo="Registrados quando o marco dependia de confirmação manual (histórico).">
          <div className="antt-tablewrap">
            <table className="antt-table">
              <thead><tr><th>Mês</th><th className="is-left">Tipo</th><th>Marco</th><th>Variação</th><th className="is-left">Situação</th><th className="is-left">Tratado em</th></tr></thead>
              <tbody>
                {d.gatilhos.map((g) => (
                  <tr key={g.id}>
                    <td>{rotuloMes(g.ref_ano, g.ref_mes)}</td><td className="is-left">{g.direcao === "ALTA" ? "Aumento" : "Redução"}</td>
                    <td>{rotuloMes(g.marco_ref_ano, g.marco_ref_mes)} · {fmtBRL(g.preco_referencia)}</td><td>{fmtPct(g.variacao_pct)}</td>
                    <td className="is-left">{STATUS_GATILHO[g.status] || g.status}</td>
                    <td className="is-left">{g.tratado_por_nome ? `${g.tratado_por_nome} · ${fmtDateTime(g.tratado_em)}` : g.tratado_em ? fmtDateTime(g.tratado_em) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
