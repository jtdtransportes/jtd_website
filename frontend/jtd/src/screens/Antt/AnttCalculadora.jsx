import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { anttApi } from "../../services/anttService";
import { useAntt } from "./AnttContext";
import { Badge, Card, Field, Loading, Notice, PageHead } from "./components/Ui";
import { fmtBRL, fmtDate, fmtNumber, fmtPct } from "./format";

const hojeIso = () => new Date().toISOString().slice(0, 10);
const TABELAS = {
  A: "Tabela A — contratação da composição veicular completa ou caminhão simples",
  B: "Tabela B — contratação apenas da unidade de tração (cavalo mecânico)",
};
const rotuloCarga = (c) => c.replaceAll("_", " ").toLowerCase().replace(/^./, (x) => x.toUpperCase());

export default function AnttCalculadora() {
  const { config } = useAntt();
  const [tabelas, setTabelas] = useState(null);
  const [diesel, setDiesel] = useState(null);
  const [f, setF] = useState({ tabela: "A", tipo_carga: "CARGA_GERAL", eixos: 5, distancia_km: "", data_referencia: hojeIso(), valor_diesel: "", valor_praticado: "", manual: false, ccd: "", cc: "", simular: false, modo: "SOMAR_AO_CC", ajuste_valor: config?.ajuste_cc_valor || "0.085" });
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    anttApi.tabelasFrete().then((r) => setTabelas(r.ok ? r.tabelas : []));
    anttApi.historicoMensal().then((r) => {
      const ultima = r.ok ? r.series.NENO.at(-1) : null;
      if (ultima) {
        setDiesel(ultima);
        setF((x) => (x.valor_diesel ? x : { ...x, valor_diesel: String(ultima.preco_medio).replace(/0+$/, "").replace(/\.$/, "") }));
      }
    });
  }, []);

  const tiposCarga = useMemo(() => [...new Set(["CARGA_GERAL", ...(tabelas || []).map((t) => t.tipo_carga)])], [tabelas]);

  // Tabela vigente na data de referência (somente leitura; o servidor refaz a busca no cálculo)
  const vigente = useMemo(() => {
    if (!tabelas) return null;
    return tabelas.filter((t) => t.tabela === f.tabela && t.tipo_carga === f.tipo_carga && t.vigencia_inicio <= f.data_referencia)
      .sort((a, b) => b.vigencia_inicio.localeCompare(a.vigencia_inicio))[0] || null;
  }, [tabelas, f.tabela, f.tipo_carga, f.data_referencia]);
  const item = vigente?.itens.find((i) => i.eixos === Number(f.eixos)) || null;

  async function calcular(e) {
    e.preventDefault();
    setCalculando(true); setErro(null); setResultado(null);
    const r = await anttApi.calcularFrete({
      tabela: f.tabela, tipo_carga: f.tipo_carga, eixos: Number(f.eixos), distancia_km: f.distancia_km, data_referencia: f.data_referencia,
      ccd: f.manual ? f.ccd : undefined, cc: f.manual ? f.cc : undefined,
      valor_diesel: f.valor_diesel || undefined, valor_praticado: f.valor_praticado || undefined,
      simular_ajuste: f.simular ? { valor: f.ajuste_valor, modo: f.modo } : undefined,
    });
    setCalculando(false);
    if (r.ok) setResultado(r.resultado); else setErro(r.message);
  }

  const aj = resultado?.ajuste;
  const cfgModo = config?.ajuste_cc_modo ? config.modos_ajuste?.[config.ajuste_cc_modo] : null;

  return (
    <>
      <PageHead titulo="Calculadora de piso mínimo de frete (ANTT)" descricao="Piso mínimo = (distância × CCD) + CC, usando os coeficientes oficiais cadastrados e suas vigências. Os coeficientes nunca são estimados." />
      {!tabelas ? <Loading /> : (
        <div className="antt-grid antt-grid--2" style={{ alignItems: "start" }}>
          <Card titulo="Dados do frete">
            <form onSubmit={calcular} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field rotulo="Tipo de tabela ANTT"><select value={f.tabela} onChange={(e) => set({ tabela: e.target.value })}>{Object.entries(TABELAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <div className="antt-grid antt-grid--form">
                <Field rotulo="Tipo de carga"><select value={f.tipo_carga} onChange={(e) => set({ tipo_carga: e.target.value })}>{tiposCarga.map((c) => <option key={c} value={c}>{rotuloCarga(c)}</option>)}</select></Field>
                <Field rotulo="Número de eixos"><select value={f.eixos} onChange={(e) => set({ eixos: e.target.value })}>{[2, 3, 4, 5, 6, 7, 9].map((n) => <option key={n} value={n}>{n} eixos</option>)}</select></Field>
                <Field rotulo="Distância (km)"><input type="text" inputMode="decimal" value={f.distancia_km} onChange={(e) => set({ distancia_km: e.target.value })} placeholder="ex.: 850" required /></Field>
                <Field rotulo="Data de referência da tabela"><input type="date" value={f.data_referencia} onChange={(e) => set({ data_referencia: e.target.value })} required /></Field>
              </div>

              <div className="antt-notice antt-notice--info" style={{ display: "block" }}>
                {vigente ? (
                  <>
                    <strong>Tabela {vigente.tabela} vigente em {fmtDate(f.data_referencia)}</strong>: {vigente.norma} · vigência desde {fmtDate(vigente.vigencia_inicio)}.{" "}
                    {item ? <>Coeficientes para {f.eixos} eixos — CCD <strong>{fmtNumber(item.ccd, 4)}</strong> R$/km · CC <strong>{fmtNumber(item.cc, 2)}</strong> R$.</> : <span>Esta tabela não tem coeficientes para {f.eixos} eixos.</span>}
                  </>
                ) : <>Nenhuma tabela {f.tabela} ({rotuloCarga(f.tipo_carga)}) cadastrada com vigência até {fmtDate(f.data_referencia)}. Cadastre os coeficientes oficiais em <Link to="/antt/configuracoes">Configurações</Link> ou use coeficientes manuais (resultado não oficial).</>}
              </div>

              <label className="antt-check"><input type="checkbox" checked={f.manual} onChange={(e) => set({ manual: e.target.checked })} /><span>Informar coeficientes manualmente (resultado marcado como NÃO oficial)</span></label>
              <div className="antt-grid antt-grid--form">
                <Field rotulo="Coeficiente de deslocamento — CCD (R$/km)"><input type="text" inputMode="decimal" disabled={!f.manual} value={f.manual ? f.ccd : item ? item.ccd : ""} onChange={(e) => set({ ccd: e.target.value })} required={f.manual} /></Field>
                <Field rotulo="Coeficiente de carga e descarga — CC (R$)"><input type="text" inputMode="decimal" disabled={!f.manual} value={f.manual ? f.cc : item ? item.cc : ""} onChange={(e) => set({ cc: e.target.value })} required={f.manual} /></Field>
                <Field rotulo="Valor atual do diesel (R$/l)" ajuda={diesel ? `Média NE/NO de ${String(diesel.mes).padStart(2, "0")}/${diesel.ano}${diesel.mes_completo ? "" : " (parcial)"} — ANP, Diesel S10. Informativo.` : "Informativo"}><input type="text" inputMode="decimal" value={f.valor_diesel} onChange={(e) => set({ valor_diesel: e.target.value })} /></Field>
                <Field rotulo="Valor anteriormente praticado (R$)" ajuda="Para comparação"><input type="text" inputMode="decimal" value={f.valor_praticado} onChange={(e) => set({ valor_praticado: e.target.value })} /></Field>
              </div>

              <Card titulo="Ajuste adicional no coeficiente de carga" subtitulo="Valor configurável; unidade e forma de aplicação precisam ser confirmadas antes de entrar no cálculo oficial.">
                <p className="antt-muted">
                  Configuração atual: valor <strong>{config?.ajuste_cc_valor}</strong> · forma: <strong>{cfgModo || "não definida"}</strong> · {config?.ajuste_cc_confirmado ? <Badge tom="ok">confirmado — participa do cálculo</Badge> : <Badge tom="aviso">não confirmado — não participa do valor oficial</Badge>}
                </p>
                <label className="antt-check"><input type="checkbox" checked={f.simular} onChange={(e) => set({ simular: e.target.checked })} /><span>Simular o ajuste (apenas visualização, nunca oficial)</span></label>
                {f.simular && (
                  <div className="antt-grid antt-grid--form">
                    <Field rotulo="Valor do ajuste"><input type="text" inputMode="decimal" value={f.ajuste_valor} onChange={(e) => set({ ajuste_valor: e.target.value })} /></Field>
                    <Field rotulo="Forma de aplicação (hipótese)"><select value={f.modo} onChange={(e) => set({ modo: e.target.value })}>{Object.entries(config?.modos_ajuste || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                  </div>
                )}
              </Card>

              <div className="antt-row"><button className="antt-btn" disabled={calculando}>{calculando ? "Calculando…" : "Calcular piso mínimo"}</button></div>
            </form>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {erro && <Notice tipo="erro" titulo="Não foi possível calcular">{erro}</Notice>}
            {!resultado && !erro && <p className="antt-empty">O resultado aparecerá aqui.</p>}
            {resultado && (
              <div className={`antt-resultado ${resultado.oficial ? "" : "antt-resultado--estimado"}`}>
                <div className="antt-row" style={{ justifyContent: "space-between" }}>
                  <span className="antt-muted">Valor mínimo calculado</span>
                  {resultado.oficial ? <Badge tom="ok">Coeficientes oficiais</Badge> : <Badge tom="aviso">{resultado.origem_coeficientes === "MANUAL_NAO_OFICIAL" ? "Coeficientes manuais — não oficial" : "Contém simulação não confirmada"}</Badge>}
                </div>
                <div className="antt-resultado__valor">{fmtBRL(resultado.valor_oficial_calculado)}</div>
                <p className="antt-muted">{resultado.formula} = ({fmtNumber(resultado.distancia_km, 2)} km × {fmtNumber(resultado.ccd_utilizado, 4)}) + {fmtNumber(resultado.cc_utilizado, 2)} = {fmtBRL(resultado.valor_minimo)}</p>
                <dl className="antt-dl">
                  <div><dt>Coeficiente de deslocamento (CCD)</dt><dd>{fmtNumber(resultado.ccd_utilizado, 4)} R$/km</dd></div>
                  <div><dt>Coeficiente de carga e descarga (CC)</dt><dd>{fmtNumber(resultado.cc_utilizado, 2)} R$</dd></div>
                  <div><dt>Parcela de deslocamento</dt><dd>{fmtBRL(resultado.parcela_deslocamento)}</dd></div>
                  <div><dt>Eixos</dt><dd>{resultado.eixos}</dd></div>
                  <div><dt>Data de referência</dt><dd>{fmtDate(resultado.data_referencia)}</dd></div>
                  <div><dt>Vigência da tabela</dt><dd>{resultado.tabela ? `desde ${fmtDate(resultado.tabela.vigencia_inicio)}` : "—"}</dd></div>
                  <div><dt>Norma</dt><dd>{resultado.tabela?.norma || "—"}</dd></div>
                  <div><dt>Fonte oficial</dt><dd>{resultado.tabela?.fonte_url ? <a href={resultado.tabela.fonte_url} target="_blank" rel="noreferrer">gov.br/antt</a> : "—"}</dd></div>
                  {resultado.diesel && <div><dt>Diesel informado</dt><dd>{fmtBRL(resultado.diesel.valor_informado, 3)}/l</dd></div>}
                </dl>
                {resultado.diesel && <p className="antt-muted">{resultado.diesel.nota}</p>}
                {resultado.comparacao && (
                  <Notice tipo={Number(resultado.comparacao.diferenca) > 0 ? "alerta-alta" : "ok"} titulo="Comparação com o valor anteriormente praticado">
                    Praticado {fmtBRL(resultado.comparacao.valor_praticado)} → piso {fmtBRL(resultado.valor_oficial_calculado)}: diferença <strong>{fmtBRL(resultado.comparacao.diferenca)}</strong> ({resultado.comparacao.diferenca_pct === null ? "—" : fmtPct(resultado.comparacao.diferenca_pct)}).
                  </Notice>
                )}
                {aj && (
                  <Notice tipo={aj.situacao === "APLICADO_CONFIRMADO" ? "ok" : "aviso"} titulo={`Ajuste adicional ${aj.valor}`}>
                    {aj.situacao === "NAO_APLICADO_FORMA_INDEFINIDA" && aj.aviso}
                    {aj.situacao === "SIMULACAO_NAO_CONFIRMADA" && <>{aj.aviso} Com o ajuste: {fmtBRL(aj.valor_com_ajuste)} (diferença {fmtBRL(aj.diferenca)}; CCD {fmtNumber(aj.ccd_ajustado, 4)}, CC {fmtNumber(aj.cc_ajustado, 4)}).</>}
                    {aj.situacao === "APLICADO_CONFIRMADO" && <>Aplicado conforme configuração confirmada. Sem ajuste: {fmtBRL(resultado.valor_minimo)}; com ajuste: {fmtBRL(aj.valor_com_ajuste)}.</>}
                  </Notice>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
