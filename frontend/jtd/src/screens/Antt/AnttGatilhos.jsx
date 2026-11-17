// Tela principal do módulo ANTT. Ordem: filtros → resumo compacto → TABELA MENSAL (sempre visível) →
// gráfico de acompanhamento → mais gráficos e detalhes só sob demanda.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { anttApi } from "../../services/anttService";
import { useAntt } from "./AnttContext";
import { Badge, Chips, Help, Loading, Notice, Segmented } from "./components/Ui";
import { ComboChart, LineChart, TriggerGauge } from "./components/Charts";
import { SemanalAnp } from "./AnttHistorico";
import {
  COR_INDICADOR, LOCALIDADES, MESES, ROTULO_INDICADOR, SIGLA_INDICADOR, completo, contaVariacao, descreverVariacao, fmtBRL, fmtDate, fmtDateTime, fmtNumber, fmtPct, fmtRsL,
  mesBarraAno, num, rotuloMes, rotuloMesLongo,
} from "./format";

const COR = { alta: "#b42318", baixa: "#0f7a4a" };
const ORDEM = ["NENO", "BA", "NE", "N"];                       // NE/NO primeiro: é a referência do gatilho
const tomNum = (v) => (num(v) > 0 ? "is-alta" : num(v) < 0 ? "is-baixa" : "");
const idx = (ano, mes) => ano * 12 + mes;
const opcoesLocal = ORDEM.map((k) => ({ valor: k, rotulo: ROTULO_INDICADOR[k] }));

/** Marcos gerenciais (NE/NO) em ordem, com a variação que levou a cada um e a decisão registrada. */
function linhaDoTempo(marcos, reajustes) {
  const ordenados = [...marcos].sort((a, b) => idx(a.ref_ano, a.ref_mes) - idx(b.ref_ano, b.ref_mes) || a.id - b.id);
  return ordenados.map((m, i) => {
    const ant = ordenados[i - 1] || null;
    const variacao = ant ? (num(m.preco_referencia) / num(ant.preco_referencia) - 1) * 100 : null;
    const tipo = m.origem === "INICIAL_AUTOMATICO" ? "INICIAL" : m.origem === "GATILHO_AUTOMATICO" ? (variacao >= 0 ? "ALTA" : "BAIXA") : "REDEFINIDO";
    const decisao = reajustes.find((r) => r.id === m.reajuste_id || r.novo_marco_id === m.id) || null;
    const pendente = m.origem === "GATILHO_AUTOMATICO" && !m.reajuste_id && !decisao;
    return { ...m, anterior: ant, variacao, tipo, decisao, pendente };
  });
}
const EVENTO = { INICIAL: "Marco inicial", ALTA: "Gatilho de aumento", BAIXA: "Gatilho de redução", REDEFINIDO: "Redefinido manualmente" };

/**
 * Tabela mensal no modelo da planilha da empresa: 4 preços médios + variação mensal do NE/NO, JAN..DEZ + ACUM.
 * Valores e ACUM vêm prontos do backend (precisão completa); aqui só a exibição com 2 casas.
 * ACUM: preços = média dos meses do ano; variação = acumulado do ano (metodologia gerencial já implementada).
 */
// [nome completo, nome curto (celular)]
const LINHAS_PLANILHA = [["preco_ba", "Preço Médio BA", "BA"], ["preco_ne", "Preço Médio NE", "NE"], ["preco_no", "Preço Médio NO", "NO"], ["preco_neno", "Preço Médio NE/NO", "NE/NO"]];

/** Rótulo da linha: completo no computador; curto no celular (o completo continua para leitores de tela). */
const NomeLinha = ({ longo, curto }) => (
  <><span className="antt-xls__longo">{longo}</span><span className="antt-xls__curto" aria-hidden="true">{curto}</span></>
);

/**
 * Mês que virou marco zero: variação que ele atingiu contra o marco ANTERIOR (o motivo de virar marco).
 * null = não é mês de marco · { inicial: true } = marco inicial (jan/2026).
 */
function infoMarco(serie, ano, mes) {
  const i = serie.findIndex((m) => m.ano === ano && m.mes === mes);
  const r = serie[i];
  if (!r?.marco_inicia_aqui) return null;
  const anterior = serie[i - 1]?.marco_ref;
  if (!anterior?.preco) return { inicial: true };
  return { pct: (Number(r.preco_medio) / Number(anterior.preco) - 1) * 100, preco: r.preco_medio, de: anterior };
}

/** Preço na célula: "R$" some no celular (o título da tabela já diz R$/litro) para o número caber inteiro. */
const Preco = ({ v }) => <><span className="antt-xls__rs">R$ </span>{fmtNumber(v, 2)}</>;

/** Símbolo da média (𝑀𝑎) — encurta "Média NE/NO" nos títulos das linhas. */
export const Ma = () => <span className="antt-ma" title="Média" aria-label="Média">Ma</span>;
/** Nome do indicador nos títulos das linhas: "𝑀𝑎 NE/NO" para a média; "Bahia", "Nordeste", "Norte" para os demais. */
const NomeIndicador = ({ chave }) => (chave === "NENO" ? <><Ma /> NE/NO</> : ROTULO_INDICADOR[chave]);

/** A tabela em si (usada na página e na visualização em tela cheia). */
function TabelaMensal({ tabela, serie }) {
  const L = tabela.linhas;
  const v = L.variacao_mensal_pct;
  const g = L.variacao_acumulada_pct;
  // localidade escolhida no filtro do topo: o backend já calculou a variação/ACUM sobre ela (tabela.base)
  const chaveBase = tabela.base || "NENO";
  const base = SIGLA_INDICADOR[chaveBase] || "NE/NO";
  const nome = <NomeIndicador chave={chaveBase} />;
  const linhaBase = { BA: "preco_ba", NE: "preco_ne", N: "preco_no", NENO: "preco_neno" }[chaveBase];
  return (
    <table className="antt-xls">
      {/* larguras fixas: a tabela não muda de tamanho ao trocar a localidade */}
      <colgroup><col className="antt-xls__col-nome" />{MESES.map((m) => <col key={m} />)}<col className="antt-xls__col-acum" /></colgroup>
      <thead>
        <tr><th className="antt-xls__ano">{tabela.ano}</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th className="antt-xls__acum">ACUM</th></tr>
      </thead>
      <tbody>
        {LINHAS_PLANILHA.map(([k, nome, curto]) => (
          <tr key={k} className={k === linhaBase ? "is-sel" : undefined}>
            <th scope="row"><NomeLinha longo={nome} curto={curto} /></th>
            {L[k].valores.map((x, i) => (
              <td key={i} className={x?.parcial ? "is-parcial" : ""} title={x ? `${completo(x.valor, " R$/L")}${x.parcial ? " · mês parcial" : ""}` : undefined}>
                {x ? <><Preco v={x.valor} />{x.parcial && <sup>*</sup>}</> : ""}
              </td>
            ))}
            <td className="antt-xls__acum" title={L[k].acum ? `Média dos meses do ano: ${completo(L[k].acum, " R$/L")}` : undefined}>{L[k].acum ? <Preco v={L[k].acum} /> : ""}</td>
          </tr>
        ))}
        <tr className="antt-xls__var">
          <th scope="row">
            <span className="antt-xls__vtit"><NomeLinha longo={<>Variação mensal — {nome} (%)</>} curto="Var. mensal %" /></span>
            <small>Calculada sobre o Preço Médio {base}</small>
          </th>
          {v.valores.map((x, i) => <td key={i} className={tomNum(x)} title={x == null ? undefined : `${base}: ${completo(x, "%")}`}>{x == null ? "" : fmtPct(x)}</td>)}
          <td className={`antt-xls__acum ${tomNum(v.acum)}`} title={v.acum == null ? undefined : `Acumulado do ano (${base}): ${completo(v.acum, "%")}`}>{v.acum == null ? "" : fmtPct(v.acum)}</td>
        </tr>
        {g && (
          <tr className="antt-xls__var antt-xls__gat">
            <th scope="row">
              <span className="antt-xls__vtit"><NomeLinha longo={<>Variação desde o marco — {nome} (%)</>} curto="Desde o marco %" /></span>
              <small>Número do gatilho ±5% · ◆ mês que virou marco</small>
            </th>
            {g.valores.map((x, i) => {
              const mk = infoMarco(serie, tabela.ano, i + 1);
              if (mk?.inicial) return <td key={i} className="is-marco" title="Marco inicial: média de janeiro/2026">◆ inicial</td>;
              if (mk) {
                return (
                  <td key={i} className={`is-marco ${tomNum(mk.pct)}`}
                    title={`Atingiu ${fmtPct(mk.pct)} contra o marco de ${rotuloMes(mk.de.ano, mk.de.mes)} (${fmtBRL(mk.de.preco, 4)}) e virou o novo marco zero: (${fmtNumber(mk.preco, 4)} ÷ ${fmtNumber(mk.de.preco, 4)} − 1) × 100. O acumulado recomeça neste mês.`}>
                    {fmtPct(mk.pct)} ◆
                  </td>
                );
              }
              return <td key={i} className={tomNum(x)} title={x == null ? undefined : `${MESES[i]}: preço do mês ÷ preço do marco em vigor − 1 = ${completo(x, "%")}`}>{x == null ? "" : fmtPct(x)}</td>;
            })}
            <td className={`antt-xls__acum ${tomNum(g.acum)}`} title="Valor do último mês (o mesmo do resumo do gatilho)">{g.acum == null ? "" : fmtPct(g.acum)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/**
 * Tabela em tela cheia, deitada (paisagem) no celular: pede tela cheia + giro do aparelho (Android/Chrome) e, se o
 * navegador não deixar (iPhone), gira o conteúdo 90° por CSS. Zoom por botões e pelo gesto de pinça.
 */
function TabelaTelaCheia({ titulo, onClose, children }) {
  const ref = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [girar, setGirar] = useState(true);
  useEffect(() => {
    const el = ref.current;
    let travou = false;
    (async () => {
      try { if (el?.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen({ navigationUI: "hide" }); } catch { /* sem tela cheia */ }
      try { await window.screen?.orientation?.lock?.("landscape"); travou = true; } catch { /* iPhone/desktop: giro por CSS */ }
    })();
    const tecla = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      try { if (travou) window.screen.orientation.unlock(); } catch { /* nada */ }
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [onClose]);
  const mudarZoom = (d) => setZoom((z) => Math.min(2, Math.max(0.6, Math.round((z + d) * 10) / 10)));
  return (
    <div ref={ref} className={`antt-xls-full${girar ? " is-girar" : ""}`} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="antt-xls-full__palco">
        <header className="antt-xls-full__barra">
          <strong>{titulo}</strong>
          <div className="antt-xls-full__botoes">
            <button type="button" onClick={() => mudarZoom(-0.1)} aria-label="Diminuir zoom">−</button>
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => mudarZoom(0.1)} aria-label="Aumentar zoom">+</button>
            <button type="button" className="antt-xls-full__girar" onClick={() => setGirar((x) => !x)} aria-pressed={girar} title="Deitar a tabela na tela">↻ Girar</button>
            <button type="button" onClick={onClose} aria-label="Fechar tabela em tela cheia">✕</button>
          </div>
        </header>
        <div className="antt-xls-full__corpo">
          <div style={{ zoom }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function PlanilhaMensal({ tabela, serie = [] }) {
  const L = tabela.linhas;
  const g = L.variacao_acumulada_pct;
  const temParcial = LINHAS_PLANILHA.some(([k]) => L[k].valores.some((x) => x?.parcial));
  const [cheia, setCheia] = useState(false);
  const fechar = useCallback(() => setCheia(false), []);
  const legenda = (
    <div className="antt-legenda antt-xls__legenda">
      {temParcial && <p>* mês parcial (ainda faltam pesquisas semanais da ANP).</p>}
      <p><Ma /> = média · <strong>Variação mensal</strong> = preço do mês ÷ preço do mês anterior − 1 (ex.: novembro contra outubro).</p>
      {g && <p><strong>Variação desde o marco</strong> = preço do mês ÷ preço do marco em vigor − 1. É este o número comparado com o gatilho de ±5%; ao atingir o limite, o mês vira o novo marco (◆) e a contagem recomeça.</p>}
      <p><strong>ACUM</strong>: nos preços, média dos meses do ano · na variação mensal, último mês ÷ primeiro mês do ano − 1 (acumulado do ano) · na variação desde o marco, o valor do último mês.</p>
    </div>
  );
  return (
    <>
      <div className="antt-xls-ferramentas">
        <span className="antt-xls__dica">Deslize para o lado para ver todos os meses, ou</span>
        <button type="button" className="antt-linkbtn antt-xls__expandir" onClick={() => setCheia(true)}>⤢ Ver tabela inteira</button>
      </div>
      <div className="antt-xls-wrap"><TabelaMensal tabela={tabela} serie={serie} /></div>
      {legenda}
      {cheia && (
        <TabelaTelaCheia titulo={`Tabela mensal ANP · Diesel S10 · R$/litro · ${tabela.ano}`} onClose={fechar}>
          <TabelaMensal tabela={tabela} serie={serie} />
          {legenda}
        </TabelaTelaCheia>
      )}
    </>
  );
}

/** Registro da decisão da empresa sobre um gatilho (única ação humana do fluxo). */
function Decisao({ evento, onFeito }) {
  const [f, setF] = useState({ aplicado: true, data_aplicacao: "", percentual_aplicado: "", observacao: "", confirmar: false });
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const pronto = f.confirmar && (!f.aplicado || f.data_aplicacao);
  async function enviar() {
    setOcupado(true); setMsg(null);
    const r = await anttApi.decidirReajuste({ marco_id: evento.id, aplicado: f.aplicado, data_aplicacao: f.aplicado ? f.data_aplicacao : null, percentual_aplicado: f.aplicado ? f.percentual_aplicado : null, observacao: f.observacao, confirmar: true });
    setOcupado(false);
    if (r.ok) onFeito(f.aplicado ? `Reajuste de ${rotuloMes(evento.ref_ano, evento.ref_mes)} registrado como aplicado em ${fmtDate(f.data_aplicacao)}.` : `Gatilho de ${rotuloMes(evento.ref_ano, evento.ref_mes)} registrado como não aplicado.`);
    else setMsg(r.message);
  }
  return (
    <div className="antt-decisao">
      <div className="antt-decisao__resumo">
        <strong>{EVENTO[evento.tipo]} · {rotuloMes(evento.ref_ano, evento.ref_mes)}</strong>
        <span className={evento.tipo === "ALTA" ? "is-alta" : "is-baixa"}>{fmtPct(evento.variacao)}</span>
        <span className="antt-muted">{fmtBRL(evento.anterior?.preco_referencia)} → {fmtBRL(evento.preco_referencia)} (média NE/NO)</span>
      </div>
      <div className="antt-decisao__form">
        <Segmented rotulo="Decisão" valor={f.aplicado ? "s" : "n"} onChange={(v) => setF({ ...f, aplicado: v === "s" })}
          opcoes={[{ valor: "s", rotulo: "Reajuste aplicado" }, { valor: "n", rotulo: "Não aplicado" }]} />
        {f.aplicado && (
          <>
            <label className="antt-inline"><span>Data de aplicação</span><input type="date" value={f.data_aplicacao} onChange={(e) => setF({ ...f, data_aplicacao: e.target.value })} /></label>
            <label className="antt-inline"><span>% aplicado</span><input type="text" inputMode="decimal" placeholder={fmtNumber(evento.variacao, 2)} value={f.percentual_aplicado} onChange={(e) => setF({ ...f, percentual_aplicado: e.target.value })} style={{ width: 90 }} /></label>
          </>
        )}
        <label className="antt-inline antt-inline--grow"><span>Observação</span><input type="text" maxLength={500} placeholder="opcional" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></label>
      </div>
      <div className="antt-decisao__acoes">
        <label className="antt-check"><input type="checkbox" checked={f.confirmar} onChange={(e) => setF({ ...f, confirmar: e.target.checked })} /><span>Confirmo esta decisão</span></label>
        <button type="button" className="antt-btn antt-btn--sm" disabled={!pronto || ocupado} onClick={enviar}>{ocupado ? "Registrando…" : "Registrar decisão"}</button>
      </div>
      {msg && <p className="antt-erro">{msg}</p>}
    </div>
  );
}

export default function AnttGatilhos() {
  const { podeEditar } = useAntt();
  const [ano, setAno] = useState(undefined);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loc, setLoc] = useState("NENO");
  const [comparar, setComparar] = useState([]);
  const [unidade, setUnidade] = useState("pct");
  const [maisGraficos, setMaisGraficos] = useState(false);
  const [detalhes, setDetalhes] = useState(false);
  const [decidindo, setDecidindo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = useCallback(async (a, b = "NENO") => {
    setErro(null);
    const [dash, rj] = await Promise.all([anttApi.dashboard({ ...(a ? { ano: a } : {}), base: b }), anttApi.reajustes()]);
    if (!dash.ok) { setErro(dash.message); setD(null); return; }
    setD({ dash, reajustes: rj.ok ? rj.reajustes : [] });
  }, []);
  useEffect(() => { carregar(ano, loc); }, [ano, loc, carregar]);

  // Atualização sem recarregar a página: consulta leve da "versão" dos dados (última sincronização ok)
  // a cada 2 min e ao voltar para a aba; se mudou, busca os dados novos.
  const versaoAtual = d?.dash?.atualizacao?.versao ?? null;
  useEffect(() => {
    if (!d) return undefined;
    let vivo = true;
    const verificar = async () => {
      if (document.hidden) return;
      const r = await anttApi.versao();
      if (vivo && r.ok && r.versao && r.versao !== versaoAtual) carregar(ano, loc);
    };
    const timer = setInterval(verificar, 120000);
    document.addEventListener("visibilitychange", verificar);
    return () => { vivo = false; clearInterval(timer); document.removeEventListener("visibilitychange", verificar); };
  }, [d, versaoAtual, ano, loc, carregar]);

  const feito = (texto) => { setMsg({ tipo: "ok", texto }); setDecidindo(false); carregar(ano, loc); };

  async function sincronizar() {
    setSincronizando(true); setMsg(null);
    const r = await anttApi.sincronizar();
    setSincronizando(false);
    if (!r.ok) setMsg({ tipo: "erro", texto: r.message });
    else if (r.status !== "SUCESSO") setMsg({ tipo: "aviso", texto: `Sincronização ${r.status.toLowerCase()}.${r.erros?.length ? ` ${r.erros.slice(0, 2).join(" | ")}` : ""}` });
    carregar(ano, loc);
  }

  const dash = d?.dash;
  const limite = Number(dash?.limite_gatilho_pct || 5);
  const anoAtivo = dash?.ano;
  const anos = dash?.anos_disponiveis || [];
  const anoRecente = anos.length ? Math.max(...anos.map(Number)) : null;
  const sync = dash?.ultima_sincronizacao;
  const atualiz = dash?.atualizacao;
  const syncOk = atualiz?.ultima_sincronizacao_ok;
  const statusSync = atualiz?.desatualizado ? "aviso" : sync && sync.status === "ERRO" ? "erro" : syncOk ? "ok" : "neutro";
  const eventos = useMemo(() => (d ? linhaDoTempo(dash.marcos || [], d.reajustes) : []), [d, dash]);
  const pendentes = eventos.filter((e) => e.pendente).reverse();

  // Resumo da localidade selecionada (valores do backend; só a exibição é arredondada)
  const sit = useMemo(() => {
    if (!dash || dash.sem_dados) return null;
    const atual = (dash.series[loc] || []).at(-1);
    if (!atual?.marco_ref) return { atual: atual || null };
    const ger = loc === "NENO" ? dash.gerencial : null;
    const v = num(atual.variacao_acumulada_pct);
    return {
      atual, ref: atual.marco_ref, variacao: atual.variacao_acumulada_pct, diferenca: atual.diferenca_acumulada,
      faltaAlta: ger ? num(ger.restante_alta_pp) : limite - v, faltaBaixa: ger ? num(ger.restante_baixa_pp) : v + limite,
    };
  }, [dash, loc, limite]);

  // Séries do ano (JAN..DEZ) para o gráfico de acompanhamento e os gráficos extras
  const g = useMemo(() => {
    if (!dash || dash.sem_dados) return null;
    const doAno = (k) => Array.from({ length: 12 }, (_, i) => (dash.series[k] || []).find((m) => m.ano === anoAtivo && m.mes === i + 1) || null);
    const presentes = new Set();
    for (const k of LOCALIDADES) for (const m of dash.series[k] || []) if (m.ano === anoAtivo) presentes.add(m.mes);
    const meses = [...presentes].sort((a, b) => a - b);
    const linha = (k) => meses.map((mes) => (dash.series[k] || []).find((m) => m.ano === anoAtivo && m.mes === mes) || null);
    return { doAno, meses, labels: meses.map((m) => rotuloMes(anoAtivo, m)), linha };
  }, [dash, anoAtivo]);

  const doLoc = g ? g.doAno(loc) : [];
  const visiveis = ORDEM.filter((k) => k === loc || comparar.includes(k));
  const rowsLoc = g ? g.linha(loc) : [];
  const campoAcum = unidade === "pct" ? "variacao_acumulada_pct" : "diferenca_acumulada";
  const fmtAcum = unidade === "pct" ? (x) => fmtPct(x) : (x) => fmtRsL(x);
  const gatilhoNoGrafico = unidade === "pct" && loc === "NENO";

  return (
    <div className="antt-pg">
      {/* 1. Título e filtros */}
      <header className="antt-pg__head">
        <div>
          <h1>Gatilhos e marcos</h1>
          <p className="antt-pg__meta">
            Diesel S10 ·
            <select className="antt-pick" aria-label="Ano" value={ano || ""} onChange={(e) => setAno(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">{anoRecente ?? "Mais recente"}</option>
              {anos.filter((a) => Number(a) !== anoRecente).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className={`antt-dot antt-dot--${statusSync}`} aria-hidden="true" />
            <span title={sync?.status === "ERRO" && sync?.mensagem ? `Última tentativa falhou: ${sync.mensagem}. Os dados exibidos são os últimos válidos.` : "Atualização automática com os dados oficiais da ANP"}>
              {syncOk ? `Atualizado em ${fmtDateTime(syncOk.finalizado_em || syncOk.iniciado_em)}` : "Aguardando a primeira atualização"}
            </span>
            {atualiz?.desatualizado && <span className="antt-stale" title={atualiz.motivo}>dados desatualizados</span>}
            {podeEditar && (
              <button type="button" className={`antt-iconbtn${sincronizando ? " is-busy" : ""}`} onClick={sincronizar} disabled={sincronizando} title="Atualizar agora com a ANP" aria-label="Atualizar agora com a ANP">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
          </p>
        </div>
        <Segmented rotulo="Localidade" valor={loc} onChange={setLoc} opcoes={opcoesLocal} />
      </header>

      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      {erro && <Notice tipo="erro">{erro}</Notice>}
      {!d && !erro && <Loading />}
      {dash?.sem_dados && <Notice tipo="aviso" titulo="Aguardando os dados da ANP">A atualização automática preenche os preços; nada precisa ser digitado.</Notice>}

      {sit?.atual && (
        <>
          {/* 2. Resumo compacto: preço, marco, variação e gatilho */}
          <section className={`antt-resumo${pendentes.length ? " is-pendente" : ""}`} aria-label={`Resumo · ${ROTULO_INDICADOR[loc]}`}>
            <div className="antt-resumo__item">
              <span>Preço médio · {SIGLA_INDICADOR[loc]}</span>
              <strong title={completo(sit.atual.preco_medio, " R$/L")}>{fmtBRL(sit.atual.preco_medio)}</strong>
              <small>{ROTULO_INDICADOR[loc]} em {mesBarraAno(sit.atual.ano, sit.atual.mes)}{sit.atual.mes_completo ? "" : " · mês em andamento"}</small>
            </div>
            <div className="antt-resumo__item">
              <span>Marco atual</span>
              <strong title={sit.ref ? completo(sit.ref.preco, " R$/L") : undefined}>{sit.ref ? fmtBRL(sit.ref.preco) : "—"}</strong>
              <small>{sit.ref ? `${ROTULO_INDICADOR[loc]} em ${mesBarraAno(sit.ref.ano, sit.ref.mes)} · base do acumulado` : "aguardando jan/2026"}</small>
            </div>
            <div className="antt-resumo__item">
              <span>Variação acumulada</span>
              <strong className={tomNum(sit.variacao)} title={sit.ref ? completo(sit.variacao, "%") : undefined}>{sit.ref ? fmtPct(sit.variacao) : "—"}</strong>
              <small>{sit.ref ? `${rotuloMes(sit.atual.ano, sit.atual.mes)} contra o marco de ${rotuloMes(sit.ref.ano, sit.ref.mes)} · ${fmtRsL(sit.diferenca)}` : ""}</small>
            </div>
            <div className="antt-resumo__item antt-resumo__gatilho">
              <span>Gatilho ±{limite}%{loc !== "NENO" && <Help texto={`Comparativo: ${ROTULO_INDICADOR[loc]} contra o seu próprio preço no mês do marco. O gatilho de reajuste e os marcos seguem a média NE/NO.`} />}</span>
              {pendentes.length ? (
                <div className="antt-resumo__pend">
                  <strong>{pendentes.length === 1 ? `${EVENTO[pendentes[0].tipo]} em ${rotuloMes(pendentes[0].ref_ano, pendentes[0].ref_mes)} · aguardando confirmação` : `${pendentes.length} reajustes aguardando confirmação`}</strong>
                  <button type="button" className="antt-btn antt-btn--sm" onClick={() => setDecidindo(!decidindo)} aria-expanded={decidindo}>{decidindo ? "Fechar" : "Ver e confirmar"}</button>
                </div>
              ) : <strong className="antt-resumo__ok">Sem gatilho pendente</strong>}
              {sit.ref && <TriggerGauge value={sit.variacao} limit={limite} />}
              {sit.ref && <small>faltam {fmtNumber(Math.max(0, sit.faltaAlta), 2)} p.p. para +{limite}% · {fmtNumber(Math.max(0, sit.faltaBaixa), 2)} p.p. para -{limite}%</small>}
            </div>
            {sit.ref && (
              <div className="antt-resumo__explica" aria-label="O que significa o número exibido">
                <p>
                  <strong className={tomNum(sit.variacao)}>{fmtPct(sit.variacao)}</strong> = {descreverVariacao({
                    indicador: loc, ano: sit.atual.ano, mes: sit.atual.mes, parcial: !sit.atual.mes_completo, marco: sit.ref,
                  })}.
                  {!sit.atual.mes_completo && sit.atual.n_semanas ? ` Considera ${sit.atual.n_semanas} semana(s) da ANP até agora; o valor muda a cada nova pesquisa.` : ""}
                  {sit.atual.marco_inicia_aqui ? " Este mês virou o novo marco zero: o acumulado recomeça em 0%." : ""}
                </p>
                <p className="antt-resumo__conta">
                  Conta: {contaVariacao(sit.atual.preco_medio, sit.ref.preco, sit.variacao)}
                  <span> — preço {loc === "NENO" ? "médio NE/NO" : `de ${ROTULO_INDICADOR[loc]}`} de {rotuloMes(sit.atual.ano, sit.atual.mes)} ÷ preço do marco de {rotuloMes(sit.ref.ano, sit.ref.mes)}</span>
                </p>
              </div>
            )}
          </section>
          {decidindo && pendentes.length > 0 && (
            <section className="antt-decisoes" aria-label="Confirmação de reajustes">
              {podeEditar
                ? pendentes.map((e) => <Decisao key={e.id} evento={e} onFeito={feito} />)
                : <p className="antt-muted">Somente administradores registram a decisão do reajuste.</p>}
            </section>
          )}

          {/* 3. Tabela mensal ANP — sempre visível */}
          {dash.tabela && (
            <section className="antt-sec" aria-label="Tabela mensal ANP">
              <div className="antt-sec__head"><h2>Tabela mensal ANP <span>Diesel S10 · R$/litro</span></h2></div>
              <PlanilhaMensal tabela={dash.tabela} serie={dash.series[dash.tabela.base || "NENO"] || []} />
            </section>
          )}

          {/* 4. Gráfico de acompanhamento: colunas = preço, linha = variação mensal */}
          {g && (
            <section className="antt-sec" aria-label="Acompanhamento do diesel">
              <div className="antt-sec__head">
                <h2>Acompanhamento do diesel <span>{ROTULO_INDICADOR[loc]}</span></h2>
                <Segmented rotulo="Localidade do gráfico" valor={loc} onChange={setLoc} opcoes={opcoesLocal.map((o) => ({ ...o, rotulo: o.rotulo.replace("Média ", "") }))} />
              </div>
              <ComboChart title={`Preço médio e variação mensal · ${ROTULO_INDICADOR[loc]}`} labels={MESES} height={320}
                barras={{ name: "Preço médio", color: "#2f6fa8", values: doLoc.map((m) => num(m?.preco_medio)) }}
                linha={{ name: "Variação mensal", color: "#01304a", values: doLoc.map((m) => num(m?.variacao_mensal_pct)) }}
                parciais={doLoc.map((m) => Boolean(m && !m.mes_completo))}
                formatBarra={(v) => fmtNumber(v, 2)} formatLinha={(v) => `${fmtNumber(v, 1)}%`}
                tooltip={(i) => { const m = doLoc[i]; return m ? [`${rotuloMesLongo(m.ano, m.mes)}${m.mes_completo ? "" : " (parcial)"}`, `Preço médio: ${fmtBRL(m.preco_medio)}`, `Variação mensal: ${fmtPct(m.variacao_mensal_pct)} (${fmtRsL(m.diferenca_mensal)})`] : [`${MESES[i]} · ainda não disponível`]; }} />
            </section>
          )}

          {/* 5. Sob demanda */}
          <div className="antt-mais">
            <button type="button" className="antt-linkbtn" onClick={() => setMaisGraficos(!maisGraficos)} aria-expanded={maisGraficos}>{maisGraficos ? "Ocultar gráficos" : "Ver mais gráficos"}</button>
            <button type="button" className="antt-linkbtn" onClick={() => setDetalhes(!detalhes)} aria-expanded={detalhes}>{detalhes ? "Ocultar detalhes" : "Ver detalhes"}</button>
          </div>

          {maisGraficos && g && (
            <div className="antt-charts2">
              <section className="antt-sec">
                <div className="antt-sec__head">
                  <h3>Comparar preços <span>R$/litro</span></h3>
                  <Chips rotulo="Comparar localidades" valores={visiveis} onChange={(v) => setComparar(v.filter((k) => k !== loc))}
                    opcoes={ORDEM.map((k) => ({ valor: k, rotulo: ROTULO_INDICADOR[k].replace("Média ", ""), cor: COR_INDICADOR[k] }))} />
                </div>
                <LineChart title="Preço médio mensal" labels={g.labels} format={(v) => fmtNumber(v, 2)} height={260}
                  tooltip={(i) => [rotuloMesLongo(anoAtivo, g.meses[i]), ...visiveis.map((k) => { const m = g.linha(k)[i]; return `${ROTULO_INDICADOR[k]}: ${m ? fmtBRL(m.preco_medio) : "—"}`; })]}
                  series={visiveis.map((k) => ({ name: ROTULO_INDICADOR[k], color: COR_INDICADOR[k], width: k === loc ? 3 : 1.8, values: g.linha(k).map((m) => num(m?.preco_medio)) }))} />
              </section>
              <section className="antt-sec">
                <div className="antt-sec__head">
                  <h3>Variação desde o marco <span>{ROTULO_INDICADOR[loc]}</span></h3>
                  <Segmented rotulo="Unidade" valor={unidade} onChange={setUnidade} opcoes={[{ valor: "pct", rotulo: "%" }, { valor: "rs", rotulo: "R$/L" }]} />
                </div>
                <LineChart title="Variação desde o marco" labels={g.labels} height={260} format={unidade === "pct" ? (v) => `${fmtNumber(v, 1)}%` : (v) => fmtNumber(v, 2)}
                  markers={rowsLoc.map((m, i) => (m?.marco_inicia_aqui && i > 0 ? { index: i, label: "", color: "#d4cdea" } : null)).filter(Boolean)}
                  band={gatilhoNoGrafico ? { from: -limite, to: limite } : null}
                  refLines={gatilhoNoGrafico
                    ? [{ value: limite, label: `+${limite}%`, color: COR.alta }, { value: -limite, label: `-${limite}%`, color: COR.baixa }]
                    : [{ value: 0, label: "0", color: "#9aa8b2", solid: true, semLegenda: true, semRotulo: true }]}
                  tooltip={(i) => { const m = rowsLoc[i]; return m ? [rotuloMesLongo(m.ano, m.mes), `Desde o marco: ${fmtAcum(m[campoAcum])}`, m.marco_ref ? `Marco ${rotuloMes(m.marco_ref.ano, m.marco_ref.mes)}: ${fmtBRL(m.marco_ref.preco)}` : ""].filter(Boolean) : [g.labels[i]]; }}
                  series={[{ name: ROTULO_INDICADOR[loc], color: COR_INDICADOR[loc], width: 2.5, values: rowsLoc.map((m) => num(m?.[campoAcum])) }]} />
              </section>
            </div>
          )}

          {detalhes && g && (
            <div className="antt-detalhes">
              <div className="antt-sec__head"><h3>Cálculos · {ROTULO_INDICADOR[loc]}</h3></div>
              <div className="antt-tablewrap">
                <table className="antt-table antt-table--precos">
                  <thead><tr><th>{anoAtivo}</th>{MESES.map((m) => <th key={m}>{m}</th>)}</tr></thead>
                  <tbody>
                    {[
                      ["Variação mensal", "variacao_mensal_pct", "pct"], ["Diferença mensal", "diferenca_mensal", "rs"],
                      ["Variação desde o marco", "variacao_acumulada_pct", "pct"], ["Diferença desde o marco", "diferenca_acumulada", "rs"],
                    ].map(([nome, campo, tipo]) => (
                      <tr key={campo}>
                        <td>{nome}</td>
                        {doLoc.map((m, i) => {
                          const x = m?.[campo];
                          const marco = (campo === "variacao_acumulada_pct" || campo === "diferenca_acumulada") && m?.marco_inicia_aqui;
                          return (
                            <td key={i} className={`${tomNum(x)}${marco ? " is-marco" : ""}`} title={x == null ? undefined : `${completo(x, tipo === "pct" ? "%" : " R$/L")}${m?.marco_ref ? ` · marco ${rotuloMes(m.marco_ref.ano, m.marco_ref.mes)}` : ""}`}>
                              {x == null ? "" : tipo === "pct" ? fmtPct(x) : fmtRsL(x).replace("/L", "")}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="antt-sec__head"><h3>Marcos e decisões <span>média NE/NO</span></h3></div>
              <div className="antt-tablewrap">
                <table className="antt-table antt-table--list">
                  <thead><tr><th>Marco</th><th className="is-left">Evento</th><th>Variação</th><th>Preço</th><th className="is-left">Decisão</th></tr></thead>
                  <tbody>
                    {[...eventos].reverse().map((e) => (
                      <tr key={e.id} className={e.vigente ? "is-sel" : ""}>
                        <td>{rotuloMes(e.ref_ano, e.ref_mes)}{e.vigente ? " · atual" : ""}</td>
                        <td className="is-left">{EVENTO[e.tipo]}</td>
                        <td className={e.tipo === "ALTA" ? "is-alta" : e.tipo === "BAIXA" ? "is-baixa" : ""}>{e.variacao == null ? "—" : fmtPct(e.variacao)}</td>
                        <td title={completo(e.preco_referencia, " R$/L")}>{fmtBRL(e.preco_referencia)}</td>
                        <td className="is-left">
                          {e.pendente ? <Badge tom="aviso">Aguardando confirmação</Badge>
                            : e.decisao ? (
                              <span title={`${e.decisao.justificativa} · ${e.decisao.aprovado_por_nome || ""} em ${fmtDateTime(e.decisao.aprovado_em)}`}>
                                {e.decisao.status === "APROVADO" ? `Aplicado em ${fmtDate(e.decisao.data_vigencia)}${e.decisao.percentual_aplicado != null ? ` · ${fmtPct(e.decisao.percentual_aplicado)}` : ""}` : "Não aplicado"}
                                <span className="antt-muted"> · {e.decisao.aprovado_por_nome || `#${e.decisao.aprovado_por}`}</span>
                              </span>
                            ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="antt-sec__head"><h3>Pesquisas semanais da ANP</h3></div>
              <SemanalAnp />
            </div>
          )}
        </>
      )}
    </div>
  );
}
