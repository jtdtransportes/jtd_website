import React, { useCallback, useEffect, useState } from "react";
import { anttApi, listarSetores } from "../../services/anttService";
import { useAntt } from "./AnttContext";
import { Badge, Card, Field, Loading, Notice, PageHead, Tabs } from "./components/Ui";
import { SincronizacaoAnp } from "./AnttHistorico";
import AdminMarcos from "./AnttAdminMarcos";
import AnttNotificacoes from "./AnttNotificacoes";
import { fmtDate, fmtDateTime, fmtNumber } from "./format";

const FONTE_ANTT = "https://www.gov.br/antt/pt-br/assuntos/cargas/politica-nacional-de-pisos-minimos-de-frete";
const rotuloCarga = (c) => c.replaceAll("_", " ").toLowerCase().replace(/^./, (x) => x.toUpperCase());

function Geral() {
  const { config, podeEditar, recarregarConfig } = useAntt();
  const [f, setF] = useState(() => ({ ...config }));
  const [setores, setSetores] = useState([]);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  useEffect(() => { listarSetores().then(setSetores); }, []);

  async function salvar(e) {
    e.preventDefault();
    setOcupado(true); setMsg(null);
    const r = await anttApi.salvarConfig({
      limite_gatilho_pct: Number(String(f.limite_gatilho_pct).replace(",", ".")), sync_ativo: f.sync_ativo, sync_intervalo_horas: Number(f.sync_intervalo_horas),
      setores_autorizados: f.setores_autorizados.map(Number),
      setores_comunicados: (f.setores_comunicados || []).map(Number).filter((id) => f.setores_autorizados.map(Number).includes(id)),
      ajuste_cc_valor: String(f.ajuste_cc_valor).replace(",", "."),
      ajuste_cc_modo: f.ajuste_cc_modo, ajuste_cc_confirmado: f.ajuste_cc_confirmado,
    });
    setOcupado(false);
    if (r.ok) { setMsg({ tipo: "ok", texto: "Configurações salvas." }); recarregarConfig(); } else setMsg({ tipo: "erro", texto: r.message });
  }

  const alternarSetor = (id) => set({ setores_autorizados: f.setores_autorizados.includes(id) ? f.setores_autorizados.filter((s) => s !== id) : [...f.setores_autorizados, id] });
  const comunicados = f.setores_comunicados || [];
  const alternarComunicado = (id) => set({ setores_comunicados: comunicados.includes(id) ? comunicados.filter((s) => s !== id) : [...comunicados, id] });
  const ro = !podeEditar;

  return (
    <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {ro && <Notice tipo="info">Somente administradores podem alterar as configurações.</Notice>}
      <Card titulo="Regra gerencial (planilha NE/NO)" subtitulo="Regras fixas do indicador. O gatilho gerencial não altera a regra oficial/regulatória da ANTT.">
        <ul className="antt-muted" style={{ margin: 0, paddingLeft: 18 }}>{(config.regras || []).map((r) => <li key={r}>{r}</li>)}</ul>
        <div className="antt-grid antt-grid--form">
          <Field rotulo="Limite do gatilho gerencial (±%, inclusive)" ajuda="Padrão: 5"><input type="text" inputMode="decimal" disabled={ro} value={f.limite_gatilho_pct} onChange={(e) => set({ limite_gatilho_pct: e.target.value })} /></Field>
        </div>
      </Card>

      <Card titulo="Atualização automática (ANP)" subtitulo={`O servidor verifica a página de últimas semanas da ANP no intervalo definido, importa só arquivos novos ou alterados (Diesel S10, Norte e Nordeste, desde ${fmtDate(config.inicio_serie)}) e recalcula meses e gatilhos.`}>
        <div className="antt-grid antt-grid--form">
          <label className="antt-check"><input type="checkbox" disabled={ro} checked={f.sync_ativo} onChange={(e) => set({ sync_ativo: e.target.checked })} /><span>Sincronização automática ativa</span></label>
          <Field rotulo="Intervalo (horas)"><input type="number" min="1" max="168" disabled={ro} value={f.sync_intervalo_horas} onChange={(e) => set({ sync_intervalo_horas: e.target.value })} /></Field>
        </div>
      </Card>

      <Card titulo="Acesso ao módulo" subtitulo="Administradores sempre têm acesso total. Marque os setores que poderão apenas consultar o módulo (padrão: nenhum).">
        {setores.length ? (
          <div className="antt-grid antt-grid--form">
            {setores.map((s) => <label key={s.id} className="antt-check"><input type="checkbox" disabled={ro} checked={f.setores_autorizados.includes(Number(s.id))} onChange={() => alternarSetor(Number(s.id))} /><span>{s.nome}</span></label>)}
          </div>
        ) : <p className="antt-muted">Nenhum setor carregado. Setores autorizados atualmente: {f.setores_autorizados.length ? f.setores_autorizados.join(", ") : "nenhum"}.</p>}
      </Card>

      <Card titulo="Comunicar reajuste" subtitulo="Quem pode cadastrar clientes e enviar e-mails de reajuste a eles. Administradores sempre podem; entre os setores com acesso ao módulo, marque os autorizados (padrão: nenhum).">
        {setores.filter((s) => f.setores_autorizados.includes(Number(s.id))).length ? (
          <div className="antt-grid antt-grid--form">
            {setores.filter((s) => f.setores_autorizados.includes(Number(s.id))).map((s) => (
              <label key={s.id} className="antt-check"><input type="checkbox" disabled={ro} checked={comunicados.includes(Number(s.id))} onChange={() => alternarComunicado(Number(s.id))} /><span>{s.nome}</span></label>
            ))}
          </div>
        ) : <p className="antt-muted">Marque primeiro os setores com acesso ao módulo (acima). Sem setores marcados, somente administradores comunicam reajustes.</p>}
      </Card>

      <Card titulo="Ajuste adicional no coeficiente de carga" subtitulo="Valor solicitado: 0,085. Unidade e forma de aplicação ainda precisam ser confirmadas; enquanto não confirmado, o ajuste não altera nenhum valor oficial.">
        <div className="antt-grid antt-grid--form">
          <Field rotulo="Valor do ajuste"><input type="text" inputMode="decimal" disabled={ro} value={f.ajuste_cc_valor} onChange={(e) => set({ ajuste_cc_valor: e.target.value })} /></Field>
          <Field rotulo="Forma de aplicação">
            <select disabled={ro} value={f.ajuste_cc_modo} onChange={(e) => set({ ajuste_cc_modo: e.target.value, ajuste_cc_confirmado: e.target.value ? f.ajuste_cc_confirmado : false })}>
              <option value="">Não definida</option>
              {Object.entries(config.modos_ajuste).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <label className="antt-check"><input type="checkbox" disabled={ro || !f.ajuste_cc_modo} checked={f.ajuste_cc_confirmado} onChange={(e) => set({ ajuste_cc_confirmado: e.target.checked })} />
          <span>Confirmo a unidade e a forma de aplicação: o ajuste passa a compor os cálculos oficiais da calculadora.</span></label>
        {f.ajuste_cc_confirmado ? <Badge tom="ok">Confirmado — participa do cálculo</Badge> : <Badge tom="aviso">Não confirmado — apenas simulação</Badge>}
      </Card>

      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      {podeEditar && <div className="antt-row"><button className="antt-btn" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar configurações"}</button></div>}
    </form>
  );
}

function Coeficientes() {
  const { podeEditar } = useAntt();
  const [tabelas, setTabelas] = useState(null);
  const [msg, setMsg] = useState(null);
  const vazio = { tabela: "A", tipo_carga: "CARGA_GERAL", vigencia_inicio: "", norma: "", fonte_url: FONTE_ANTT, observacao: "", itens: [{ eixos: 2, ccd: "", cc: "" }] };
  const [f, setF] = useState(vazio);
  const carregar = useCallback(async () => { const r = await anttApi.tabelasFrete(); setTabelas(r.ok ? r.tabelas : []); }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const setItem = (i, p) => setF((x) => ({ ...x, itens: x.itens.map((it, j) => (j === i ? { ...it, ...p } : it)) }));
  async function salvar(e) {
    e.preventDefault();
    const r = await anttApi.criarTabelaFrete({ ...f, observacao: f.observacao || undefined, itens: f.itens.map((i) => ({ eixos: Number(i.eixos), ccd: i.ccd, cc: i.cc })) });
    if (r.ok) { setMsg({ tipo: "ok", texto: "Nova vigência cadastrada. As versões anteriores foram preservadas." }); setF(vazio); carregar(); } else setMsg({ tipo: "erro", texto: r.message });
  }

  return (
    <>
      <Notice tipo="info" titulo="Somente valores oficiais">
        Cadastre apenas os coeficientes publicados pela ANTT (Tabelas A e B, carga geral) conforme a norma vigente: <a href={FONTE_ANTT} target="_blank" rel="noreferrer">Política Nacional de Pisos Mínimos de Frete</a>.
        O sistema não estima nem substitui coeficientes automaticamente. Uma atualização é uma <strong>nova vigência</strong>; versões anteriores ficam preservadas (usadas nos retroativos).
      </Notice>
      {podeEditar && (
        <Card titulo="Cadastrar nova vigência de coeficientes">
          <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="antt-grid antt-grid--form">
              <Field rotulo="Tabela"><select value={f.tabela} onChange={(e) => setF({ ...f, tabela: e.target.value })}><option value="A">A — composição completa / caminhão simples</option><option value="B">B — unidade de tração (cavalo mecânico)</option></select></Field>
              <Field rotulo="Tipo de carga" ajuda="Inicialmente: carga geral"><input type="text" value={f.tipo_carga} onChange={(e) => setF({ ...f, tipo_carga: e.target.value.toUpperCase().replace(/\s+/g, "_") })} /></Field>
              <Field rotulo="Início da vigência"><input type="date" value={f.vigencia_inicio} onChange={(e) => setF({ ...f, vigencia_inicio: e.target.value })} required /></Field>
              <Field rotulo="Norma de origem (resolução/portaria)"><input type="text" value={f.norma} onChange={(e) => setF({ ...f, norma: e.target.value })} required /></Field>
            </div>
            <Field rotulo="Fonte oficial (URL gov.br)"><input type="url" value={f.fonte_url} onChange={(e) => setF({ ...f, fonte_url: e.target.value })} required /></Field>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontSize: ".85rem" }}>Coeficientes por quantidade de eixos</strong>
              {f.itens.map((it, i) => (
                <div key={i} className="antt-grid antt-grid--form">
                  <Field rotulo="Eixos"><select value={it.eixos} onChange={(e) => setItem(i, { eixos: e.target.value })}>{[2, 3, 4, 5, 6, 7, 9].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
                  <Field rotulo="CCD — deslocamento (R$/km)"><input type="text" inputMode="decimal" value={it.ccd} onChange={(e) => setItem(i, { ccd: e.target.value })} required /></Field>
                  <Field rotulo="CC — carga e descarga (R$)"><input type="text" inputMode="decimal" value={it.cc} onChange={(e) => setItem(i, { cc: e.target.value })} required /></Field>
                  <button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" disabled={f.itens.length === 1} onClick={() => setF({ ...f, itens: f.itens.filter((_, j) => j !== i) })}>Remover linha</button>
                </div>
              ))}
              <div className="antt-row"><button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" onClick={() => setF({ ...f, itens: [...f.itens, { eixos: Math.min(9, Number(f.itens.at(-1)?.eixos || 2) + 1), ccd: "", cc: "" }] })}>+ Adicionar eixos</button></div>
            </div>
            <Field rotulo="Observação (opcional)"><input type="text" value={f.observacao} maxLength={500} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></Field>
            {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
            <div className="antt-row"><button className="antt-btn">Cadastrar vigência</button></div>
          </form>
        </Card>
      )}
      <Card titulo="Tabelas cadastradas" subtitulo="Versões por vigência (a mais recente com início ≤ data de referência é a utilizada).">
        {tabelas === null ? <Loading /> : !tabelas.length ? <p className="antt-empty">Nenhuma tabela cadastrada ainda. Nenhum coeficiente é fornecido por padrão.</p> : tabelas.map((t) => (
          <details key={t.id} open={!t.vigencia_fim}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              Tabela {t.tabela} · {rotuloCarga(t.tipo_carga)} · {fmtDate(t.vigencia_inicio)} → {t.vigencia_fim ? fmtDate(t.vigencia_fim) : "vigente"} {!t.vigencia_fim && <Badge tom="ok">vigente</Badge>}
            </summary>
            <p className="antt-muted">{t.norma} · <a href={t.fonte_url} target="_blank" rel="noreferrer">fonte oficial</a> · cadastrada por {t.criado_por_nome || "—"} em {fmtDateTime(t.criado_em)}{t.observacao ? ` · ${t.observacao}` : ""}</p>
            <div className="antt-tablewrap"><table className="antt-table"><thead><tr><th>Eixos</th><th>CCD (R$/km)</th><th>CC (R$)</th></tr></thead>
              <tbody>{t.itens.map((i) => <tr key={i.eixos}><td>{i.eixos}</td><td>{fmtNumber(i.ccd, 4)}</td><td>{fmtNumber(i.cc, 2)}</td></tr>)}</tbody></table></div>
          </details>
        ))}
      </Card>
    </>
  );
}

function Auditoria() {
  const [dados, setDados] = useState(null);
  useEffect(() => { anttApi.auditoria().then((r) => setDados(r.ok ? r.auditoria : [])); }, []);
  if (!dados) return <Loading />;
  return (
    <Card titulo="Registro de alterações e auditoria" subtitulo="Últimas 200 ações do módulo (quem, quando e o quê).">
      {!dados.length ? <p className="antt-empty">Sem registros.</p> : (
        <div className="antt-tablewrap" style={{ maxHeight: 520, overflowY: "auto" }}>
          <table className="antt-table">
            <thead><tr><th>Data</th><th className="is-left">Usuário</th><th className="is-left">Ação</th><th className="is-left">Entidade</th><th className="is-left">Detalhe</th></tr></thead>
            <tbody>{dados.map((a) => <tr key={a.id}><td>{fmtDateTime(a.criado_em)}</td><td className="is-left">{a.usuario_nome || `#${a.usuario_id ?? "sistema"}`}</td><td className="is-left">{a.acao}</td><td className="is-left">{a.entidade}{a.entidade_id ? ` #${a.entidade_id}` : ""}</td><td className="is-wrap" style={{ fontSize: ".75rem" }}>{a.depois ? JSON.stringify(typeof a.depois === "string" ? JSON.parse(a.depois) : a.depois).slice(0, 160) : "—"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AnttConfiguracoes() {
  const { podeEditar } = useAntt();
  const [aba, setAba] = useState("geral");
  const abas = [{ id: "geral", rotulo: "Geral" }, { id: "sync", rotulo: "Dados da ANP" }, { id: "marcos", rotulo: "Marcos e regulatório" }, { id: "coeficientes", rotulo: "Coeficientes ANTT" }, ...(podeEditar ? [{ id: "notificacoes", rotulo: "Notificações por e-mail" }, { id: "auditoria", rotulo: "Auditoria" }] : [])];
  return (
    <>
      <PageHead titulo="Configurações" descricao="Área administrativa: gatilho, acesso, dados da ANP, marcos, coeficientes e auditoria." />
      <Tabs abas={abas} ativa={aba} onChange={setAba} />
      {aba === "geral" && <Geral />}
      {aba === "sync" && <Card titulo="Dados da ANP" subtitulo="Atualização automática no servidor. Os botões abaixo são opcionais."><SincronizacaoAnp /></Card>}
      {aba === "marcos" && <AdminMarcos />}
      {aba === "coeficientes" && <Coeficientes />}
      {aba === "notificacoes" && podeEditar && <AnttNotificacoes />}
      {aba === "auditoria" && <Auditoria />}
    </>
  );
}
