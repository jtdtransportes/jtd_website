import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { anttApi, salvarBlob } from "../../services/anttService";
import { useAntt } from "./AnttContext";
import { Badge, Card, Field, Kpi, Loading, Notice, PageHead } from "./components/Ui";
import { fmtBRL, fmtDate, fmtDateTime, fmtNumber, num } from "./format";

const ELEG = { PENDENTE_CONFIRMACAO: "Pendente de confirmação", CONFIRMADA: "Confirmada", NAO_ELEGIVEL: "Não elegível" };

function Cadastro({ clienteId, setClienteId, contratoId, setContratoId, clientes, contratos, podeEditar, onChange }) {
  const [novoCliente, setNovoCliente] = useState("");
  const [novoContrato, setNovoContrato] = useState({ descricao: "", elegibilidade: "PENDENTE_CONFIRMACAO", data_aplicacao_reajuste: "", aplicacao_confirmada: false });
  const [msg, setMsg] = useState(null);
  const contrato = contratos.find((c) => String(c.id) === String(contratoId));

  async function criarCliente(e) {
    e.preventDefault();
    const r = await anttApi.criarCliente({ nome: novoCliente });
    if (r.ok) { setNovoCliente(""); setClienteId(String(r.id)); onChange(); setMsg({ tipo: "ok", texto: "Cliente cadastrado." }); } else setMsg({ tipo: "erro", texto: r.message });
  }
  async function criarContrato(e) {
    e.preventDefault();
    const r = await anttApi.criarContrato({ cliente_id: Number(clienteId), ...novoContrato, data_aplicacao_reajuste: novoContrato.data_aplicacao_reajuste || null });
    if (r.ok) { setNovoContrato({ descricao: "", elegibilidade: "PENDENTE_CONFIRMACAO", data_aplicacao_reajuste: "", aplicacao_confirmada: false }); setContratoId(String(r.id)); onChange(); setMsg({ tipo: "ok", texto: "Contrato cadastrado." }); } else setMsg({ tipo: "erro", texto: r.message });
  }
  async function atualizarElegibilidade(patch) {
    const r = await anttApi.atualizarContrato(contrato.id, { descricao: contrato.descricao, elegibilidade: contrato.elegibilidade, data_aplicacao_reajuste: contrato.data_aplicacao_reajuste, aplicacao_confirmada: contrato.aplicacao_confirmada, ...patch });
    if (r.ok) onChange(); else setMsg({ tipo: "erro", texto: r.message });
  }

  return (
    <Card titulo="1. Cliente e contrato" subtitulo="A elegibilidade contratual e a data de aplicação definem se o cálculo é estimado ou confirmado.">
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      <div className="antt-grid antt-grid--form">
        <Field rotulo="Cliente"><select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setContratoId(""); }}><option value="">Selecione…</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.qtd_fretes} fretes)</option>)}</select></Field>
        <Field rotulo="Contrato (opcional)"><select value={contratoId} onChange={(e) => setContratoId(e.target.value)} disabled={!clienteId}><option value="">Todos os fretes do cliente</option>{contratos.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}</select></Field>
      </div>
      {contrato && (
        <div className="antt-row">
          <Badge tom={contrato.elegibilidade === "CONFIRMADA" ? "ok" : contrato.elegibilidade === "NAO_ELEGIVEL" ? "erro" : "aviso"}>Elegibilidade: {ELEG[contrato.elegibilidade]}</Badge>
          <Badge tom={contrato.aplicacao_confirmada ? "ok" : "aviso"}>Data de aplicação: {contrato.data_aplicacao_reajuste ? fmtDate(contrato.data_aplicacao_reajuste) : "não definida"}{contrato.aplicacao_confirmada ? " (confirmada)" : " (não confirmada)"}</Badge>
          {podeEditar && <>
            <select style={{ width: "auto" }} value={contrato.elegibilidade} onChange={(e) => atualizarElegibilidade({ elegibilidade: e.target.value })}>{Object.entries(ELEG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input type="date" style={{ width: "auto" }} value={contrato.data_aplicacao_reajuste || ""} onChange={(e) => atualizarElegibilidade({ data_aplicacao_reajuste: e.target.value || null, aplicacao_confirmada: false })} />
            <button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" disabled={!contrato.data_aplicacao_reajuste} onClick={() => atualizarElegibilidade({ aplicacao_confirmada: !contrato.aplicacao_confirmada })}>{contrato.aplicacao_confirmada ? "Desconfirmar data" : "Confirmar data de aplicação"}</button>
          </>}
        </div>
      )}
      {podeEditar && (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Cadastrar cliente / contrato</summary>
          <div className="antt-split" style={{ marginTop: 12 }}>
            <form onSubmit={criarCliente} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field rotulo="Novo cliente"><input type="text" value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)} minLength={2} required /></Field>
              <div className="antt-row"><button className="antt-btn antt-btn--sm">Cadastrar cliente</button></div>
            </form>
            <form onSubmit={criarContrato} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field rotulo={`Novo contrato${clienteId ? "" : " (selecione o cliente)"}`}><input type="text" value={novoContrato.descricao} onChange={(e) => setNovoContrato({ ...novoContrato, descricao: e.target.value })} disabled={!clienteId} required /></Field>
              <Field rotulo="Elegibilidade ao reajuste"><select value={novoContrato.elegibilidade} onChange={(e) => setNovoContrato({ ...novoContrato, elegibilidade: e.target.value })}>{Object.entries(ELEG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field rotulo="Data de aplicação do reajuste"><input type="date" value={novoContrato.data_aplicacao_reajuste} onChange={(e) => setNovoContrato({ ...novoContrato, data_aplicacao_reajuste: e.target.value })} /></Field>
              <label className="antt-check"><input type="checkbox" checked={novoContrato.aplicacao_confirmada} onChange={(e) => setNovoContrato({ ...novoContrato, aplicacao_confirmada: e.target.checked })} /><span>Data de aplicação confirmada</span></label>
              <div className="antt-row"><button className="antt-btn antt-btn--sm" disabled={!clienteId}>Cadastrar contrato</button></div>
            </form>
          </div>
        </details>
      )}
    </Card>
  );
}

function Fretes({ clienteId, contratoId, podeEditar }) {
  const [fretes, setFretes] = useState(null);
  const [msg, setMsg] = useState(null);
  const [novo, setNovo] = useState({ identificacao: "", data_frete: "", km: "", valor_cobrado: "", eixos: "" });
  const inputRef = useRef(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return setFretes(null);
    const r = await anttApi.fretes({ cliente_id: clienteId });
    setFretes(r.ok ? r.fretes : []);
  }, [clienteId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function importar(e) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    const r = await anttApi.importarFretes(arq, clienteId, contratoId);
    if (inputRef.current) inputRef.current.value = "";
    if (r.ok) setMsg({ tipo: r.total_rejeitados ? "aviso" : "ok", texto: `${r.inseridos} frete(s) importado(s), ${r.duplicados} já existentes (ignorados), ${r.total_rejeitados} rejeitado(s).${r.rejeitados?.length ? " " + r.rejeitados.slice(0, 5).map((x) => `${x.linha ? `linha ${x.linha}` : "arquivo"}: ${x.motivo}`).join(" | ") : ""}` });
    else setMsg({ tipo: "erro", texto: r.message });
    carregar();
  }
  async function adicionar(e) {
    e.preventDefault();
    const r = await anttApi.criarFrete({ cliente_id: Number(clienteId), contrato_id: contratoId ? Number(contratoId) : null, ...novo, eixos: novo.eixos || null });
    if (r.ok) { setNovo({ identificacao: "", data_frete: "", km: "", valor_cobrado: "", eixos: "" }); setMsg({ tipo: "ok", texto: "Frete cadastrado." }); carregar(); } else setMsg({ tipo: "erro", texto: r.message });
  }

  if (!clienteId) return <Card titulo="2. Fretes realizados"><p className="antt-empty">Selecione um cliente.</p></Card>;
  return (
    <Card titulo="2. Fretes realizados" subtitulo="Importe uma planilha (CSV ou XLSX) com colunas: conhecimento/identificação, data, km e valor. Opcionais: eixos, tabela, ccd, cc. Duplicados (mesma identificação) são ignorados.">
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      {podeEditar && (
        <>
          <div className="antt-row">
            <label className="antt-btn antt-btn--ghost" style={{ cursor: "pointer" }}>Importar planilha de fretes<input ref={inputRef} type="file" accept=".csv,.xlsx" onChange={importar} hidden /></label>
          </div>
          <form onSubmit={adicionar} className="antt-grid antt-grid--form">
            <Field rotulo="CT-e / viagem"><input type="text" value={novo.identificacao} onChange={(e) => setNovo({ ...novo, identificacao: e.target.value })} required /></Field>
            <Field rotulo="Data do frete"><input type="date" value={novo.data_frete} onChange={(e) => setNovo({ ...novo, data_frete: e.target.value })} required /></Field>
            <Field rotulo="Km percorridos"><input type="text" inputMode="decimal" value={novo.km} onChange={(e) => setNovo({ ...novo, km: e.target.value })} required /></Field>
            <Field rotulo="Valor cobrado (R$)"><input type="text" inputMode="decimal" value={novo.valor_cobrado} onChange={(e) => setNovo({ ...novo, valor_cobrado: e.target.value })} required /></Field>
            <Field rotulo="Eixos (opcional)"><select value={novo.eixos} onChange={(e) => setNovo({ ...novo, eixos: e.target.value })}><option value="">—</option>{[2, 3, 4, 5, 6, 7, 9].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
            <button className="antt-btn antt-btn--sm">Adicionar frete</button>
          </form>
        </>
      )}
      {fretes === null ? <Loading /> : !fretes.length ? <p className="antt-empty">Nenhum frete cadastrado para este cliente.</p> : (
        <div className="antt-tablewrap" style={{ maxHeight: 280, overflowY: "auto" }}>
          <table className="antt-table">
            <thead><tr><th>Identificação</th><th>Data</th><th>Km</th><th>Valor cobrado</th><th>Eixos</th><th>CCD/CC aplicados</th></tr></thead>
            <tbody>{fretes.slice(0, 200).map((f) => <tr key={f.id}><td>{f.identificacao}</td><td>{fmtDate(f.data_frete)}</td><td>{fmtNumber(f.km, 2)}</td><td>{fmtBRL(f.valor_cobrado)}</td><td>{f.eixos || "—"}</td><td>{f.ccd_aplicado ? `${fmtNumber(f.ccd_aplicado, 4)} / ${fmtNumber(f.cc_aplicado, 2)}` : "—"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AnttRetroativos() {
  const { podeEditar } = useAntt();
  const [clientes, setClientes] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [tabelas, setTabelas] = useState([]);
  const [salvos, setSalvos] = useState(null);
  const [clienteId, setClienteId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [p, setP] = useState({ periodo_inicio: "", periodo_fim: new Date().toISOString().slice(0, 10), data_vigencia_reajuste: "", tabela_nova_id: "", eixos_padrao: "", apenas_positivas: false, observacao: "" });
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregarBase = useCallback(async () => {
    const [c, t, s] = await Promise.all([anttApi.clientes(), anttApi.tabelasFrete(), anttApi.retroativos()]);
    if (c.ok) setClientes(c.clientes);
    if (t.ok) setTabelas(t.tabelas);
    setSalvos(s.ok ? s.retroativos : []);
  }, []);
  const carregarContratos = useCallback(async () => {
    if (!clienteId) return setContratos([]);
    const r = await anttApi.contratos({ cliente_id: clienteId });
    setContratos(r.ok ? r.contratos : []);
  }, [clienteId]);
  useEffect(() => { carregarBase(); }, [carregarBase]);
  useEffect(() => { carregarContratos(); setRes(null); }, [carregarContratos]);

  const contrato = contratos.find((c) => String(c.id) === String(contratoId));
  const tabela = tabelas.find((t) => String(t.id) === String(p.tabela_nova_id));

  // data de vigência padrão: a do contrato; senão o início da tabela escolhida
  useEffect(() => {
    if (!p.data_vigencia_reajuste) {
      const d = contrato?.data_aplicacao_reajuste || tabela?.vigencia_inicio;
      if (d) setP((x) => ({ ...x, data_vigencia_reajuste: d, periodo_inicio: x.periodo_inicio || d }));
    }
  }, [contrato, tabela]); // eslint-disable-line react-hooks/exhaustive-deps

  async function calcular(salvar) {
    setOcupado(true); setErro(null);
    const r = await anttApi.calcularRetroativos({ cliente_id: Number(clienteId), contrato_id: contratoId ? Number(contratoId) : null, periodo_inicio: p.periodo_inicio, periodo_fim: p.periodo_fim, data_vigencia_reajuste: p.data_vigencia_reajuste || null, tabela_nova_id: Number(p.tabela_nova_id), eixos_padrao: p.eixos_padrao ? Number(p.eixos_padrao) : null, apenas_positivas: p.apenas_positivas, observacao: p.observacao || undefined, salvar });
    setOcupado(false);
    if (r.ok) { setRes(r.resultado); if (salvar) carregarBase(); } else { setErro(r.message); setRes(null); }
  }

  async function exportar(id) {
    const r = await anttApi.exportarRetroativo(id);
    if (!r.ok) return setErro(r.message);
    const cd = r.response.headers.get("content-disposition") || "";
    salvarBlob(r.blob, /filename="([^"]+)"/.exec(cd)?.[1] || `retroativos-${id}.xlsx`);
  }

  const r = res?.resumo;
  const pronto = clienteId && p.periodo_inicio && p.periodo_fim && p.tabela_nova_id;

  return (
    <>
      <PageHead titulo="Cobranças retroativas" descricao="Recalcula fretes de períodos anteriores com os novos coeficientes ANTT e apura a diferença por viagem e no total. Valores são estimados até a confirmação contratual." />
      <Cadastro {...{ clienteId, setClienteId, contratoId, setContratoId, clientes, contratos, podeEditar }} onChange={() => { carregarBase(); carregarContratos(); }} />
      <Fretes clienteId={clienteId} contratoId={contratoId} podeEditar={podeEditar} />

      {podeEditar && (
        <Card titulo="3. Cálculo do retroativo" subtitulo="Coeficientes novos vêm da tabela ANTT selecionada; os originais, do próprio frete ou da versão imediatamente anterior da mesma tabela.">
          {!tabelas.length && <Notice tipo="aviso">Nenhuma tabela ANTT cadastrada. Cadastre as vigências em <Link to="/antt/configuracoes">Configurações → Coeficientes ANTT</Link>.</Notice>}
          <div className="antt-grid antt-grid--form">
            <Field rotulo="Tabela ANTT (nova vigência)"><select value={p.tabela_nova_id} onChange={(e) => setP({ ...p, tabela_nova_id: e.target.value, data_vigencia_reajuste: "" })}><option value="">Selecione…</option>{tabelas.map((t) => <option key={t.id} value={t.id}>Tabela {t.tabela} · {t.tipo_carga.replaceAll("_", " ")} · desde {fmtDate(t.vigencia_inicio)}</option>)}</select></Field>
            <Field rotulo="Data de vigência do reajuste"><input type="date" value={p.data_vigencia_reajuste} onChange={(e) => setP({ ...p, data_vigencia_reajuste: e.target.value })} /></Field>
            <Field rotulo="Período dos fretes — início"><input type="date" value={p.periodo_inicio} onChange={(e) => setP({ ...p, periodo_inicio: e.target.value })} /></Field>
            <Field rotulo="Período dos fretes — fim"><input type="date" value={p.periodo_fim} onChange={(e) => setP({ ...p, periodo_fim: e.target.value })} /></Field>
            <Field rotulo="Eixos padrão" ajuda="Usado nos fretes sem eixos informados"><select value={p.eixos_padrao} onChange={(e) => setP({ ...p, eixos_padrao: e.target.value })}><option value="">Nenhum</option>{[2, 3, 4, 5, 6, 7, 9].map((n) => <option key={n} value={n}>{n} eixos</option>)}</select></Field>
          </div>
          <label className="antt-check"><input type="checkbox" checked={p.apenas_positivas} onChange={(e) => setP({ ...p, apenas_positivas: e.target.checked })} /><span>Considerar somente diferenças positivas (cobrar apenas o que ficou abaixo do novo piso)</span></label>
          <Field rotulo="Observação (opcional)"><input type="text" value={p.observacao} maxLength={500} onChange={(e) => setP({ ...p, observacao: e.target.value })} /></Field>
          <div className="antt-row">
            <button className="antt-btn" disabled={!pronto || ocupado} onClick={() => calcular(false)}>{ocupado ? "Calculando…" : "Calcular (prévia)"}</button>
            <button className="antt-btn antt-btn--ghost" disabled={!pronto || ocupado} onClick={() => calcular(true)}>Calcular e salvar</button>
          </div>
          {erro && <Notice tipo="erro" onClose={() => setErro(null)}>{erro}</Notice>}
        </Card>
      )}

      {res && (
        <Card titulo={res.id ? `Resultado — cálculo #${res.id} salvo` : "Resultado (prévia, não salva)"} acoes={res.id ? <button type="button" className="antt-btn antt-btn--sm" onClick={() => exportar(res.id)}>Exportar Excel</button> : null}>
          {res.aviso ? <Notice tipo="aviso" titulo="Retroativos estimados">{res.aviso}</Notice> : <Notice tipo="ok">Elegibilidade e data de aplicação confirmadas no contrato.</Notice>}
          <p className="antt-muted">Cliente <strong>{res.cliente.nome}</strong> · vigência do reajuste {fmtDate(res.data_vigencia_reajuste)} · tabela {res.tabela_nova.tabela} ({res.tabela_nova.norma}) · fretes de {fmtDate(res.periodo.inicio)} a {fmtDate(res.periodo.fim)}.</p>
          <div className="antt-grid antt-grid--kpi">
            <Kpi rotulo="Quantidade de fretes" valor={r.qtd_fretes} />
            <Kpi rotulo="Quilometragem total" valor={`${fmtNumber(r.km_total, 2)} km`} />
            <Kpi rotulo="Média de km por viagem" valor={`${fmtNumber(r.km_medio, 2)} km`} />
            <Kpi rotulo="Valor total cobrado" valor={fmtBRL(r.total_cobrado)} />
            <Kpi rotulo="Valor recalculado" valor={fmtBRL(r.total_recalculado)} />
            <Kpi destaque rotulo={res.status === "ESTIMADO" ? "Retroativo estimado" : "Valor retroativo"} valor={fmtBRL(r.total_retroativo)} detalhe={res.apenas_positivas ? "somente diferenças positivas" : "soma das diferenças"} />
          </div>
          {res.ignorados.length > 0 && <Notice tipo="info" titulo={`${res.ignorados.length} frete(s) fora do cálculo`}>{res.ignorados.slice(0, 5).map((i) => `${i.identificacao}: ${i.motivo}`).join(" | ")}{res.ignorados.length > 5 ? " …" : ""}</Notice>}
          {res.itens.length > 0 && (
            <div className="antt-tablewrap" style={{ maxHeight: 420, overflowY: "auto" }}>
              <table className="antt-table">
                <thead><tr><th>Identificação</th><th>Data</th><th>Km</th><th>Cobrado</th><th>CCD orig.</th><th>CC orig.</th><th>CCD novo</th><th>CC novo</th><th>Recalculado</th><th>Efeito CCD</th><th>Efeito CC</th><th>Diferença</th></tr></thead>
                <tbody>
                  {res.itens.map((i) => (
                    <tr key={i.identificacao}>
                      <td>{i.identificacao}</td><td>{fmtDate(i.data_frete)}</td><td>{fmtNumber(i.km, 2)}</td><td>{fmtNumber(i.valor_cobrado, 2)}</td>
                      <td>{i.ccd_original ? fmtNumber(i.ccd_original, 4) : "—"}</td><td>{i.cc_original ? fmtNumber(i.cc_original, 2) : "—"}</td>
                      <td>{fmtNumber(i.ccd_novo, 4)}</td><td>{fmtNumber(i.cc_novo, 2)}</td><td>{fmtNumber(i.valor_recalculado, 2)}</td>
                      <td>{i.efeito_ccd === null ? "—" : fmtNumber(i.efeito_ccd, 2)}</td><td>{i.efeito_cc === null ? "—" : fmtNumber(i.efeito_cc, 2)}</td>
                      <td className={num(i.diferenca) > 0 ? "is-alta" : num(i.diferenca) < 0 ? "is-baixa" : ""}>{fmtNumber(i.diferenca, 2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td>Total</td><td /><td>{fmtNumber(r.km_total, 2)}</td><td>{fmtNumber(r.total_cobrado, 2)}</td><td colSpan={5} /><td>{fmtNumber(r.total_recalculado, 2)}</td><td colSpan={2} /><td>{fmtNumber(r.total_retroativo, 2)}</td></tr></tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card titulo="Cálculos salvos" subtitulo="Relatórios exportáveis em Excel para conferência e cobrança.">
        {salvos === null ? <Loading /> : !salvos.length ? <p className="antt-empty">Nenhum cálculo salvo.</p> : (
          <div className="antt-tablewrap">
            <table className="antt-table">
              <thead><tr><th>#</th><th className="is-left">Cliente</th><th>Período</th><th>Vigência</th><th>Fretes</th><th>Cobrado</th><th>Recalculado</th><th>Retroativo</th><th>Status</th><th>Criado em</th><th /></tr></thead>
              <tbody>
                {salvos.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td><td className="is-left">{s.cliente_nome}</td><td>{fmtDate(s.periodo_inicio)} → {fmtDate(s.periodo_fim)}</td><td>{fmtDate(s.data_vigencia_reajuste)}</td>
                    <td>{s.qtd_fretes}</td><td>{fmtNumber(s.total_cobrado, 2)}</td><td>{fmtNumber(s.total_recalculado, 2)}</td><td><strong>{fmtNumber(s.total_retroativo, 2)}</strong></td>
                    <td><Badge tom={s.status === "CONFIRMADO" ? "ok" : "aviso"}>{s.status === "CONFIRMADO" ? "Confirmado" : "Estimado"}</Badge></td><td>{fmtDateTime(s.criado_em)}</td>
                    <td><button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" onClick={() => exportar(s.id)}>Excel</button></td>
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
