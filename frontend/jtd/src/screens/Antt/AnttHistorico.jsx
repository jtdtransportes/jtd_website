// Blocos do antigo "Histórico do diesel", usados em Preços e evolução (seções recolhíveis).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { anttApi } from "../../services/anttService";
import { useAntt } from "./AnttContext";
import { Badge, Loading, Notice } from "./components/Ui";
import { fmtBRL, fmtDate, fmtDateTime, rotuloMes } from "./format";

const COLUNAS = [["BA", "Bahia"], ["NE", "Nordeste"], ["N", "Norte"]];

/** Pesquisas semanais oficiais da ANP (preço médio de BA, NE e NO), da mais recente para a mais antiga. */
export function SemanalAnp() {
  const [semanas, setSemanas] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    anttApi.historicoSemanal({}).then((r) => (r.ok ? setSemanas(r.semanas) : setErro(r.message)));
  }, []);
  const linhas = useMemo(() => {
    if (!semanas) return [];
    const map = new Map();
    for (const s of semanas) {
      if (!map.has(s.semana_inicio)) map.set(s.semana_inicio, { inicio: s.semana_inicio, fim: s.semana_fim });
      map.get(s.semana_inicio)[s.chave] = s;
    }
    return [...map.values()].sort((a, b) => b.inicio.localeCompare(a.inicio));
  }, [semanas]);

  if (erro) return <Notice tipo="erro">{erro}</Notice>;
  if (!semanas) return <Loading />;
  if (!linhas.length) return <p className="antt-empty">Nenhuma semana importada ainda.</p>;
  return (
    <>
      <div className="antt-tablewrap" style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className="antt-table antt-table--list">
          <thead><tr><th>Pesquisa</th><th>Mês</th>{COLUNAS.map(([k, nome]) => <th key={k}>{nome}</th>)}<th>Atualizado em</th></tr></thead>
          <tbody>
            {linhas.map((l) => {
              const [a, m] = l.inicio.split("-").map(Number);
              return (
                <tr key={l.inicio}>
                  <td>{fmtDate(l.inicio).slice(0, 5)} → {fmtDate(l.fim)}</td>
                  <td>{rotuloMes(a, m)}</td>
                  {COLUNAS.map(([k]) => (
                    <td key={k} title={l[k] ? `${l[k].n_postos} postos pesquisados` : "Sem dado oficial nesta semana"}>{l[k] ? fmtBRL(l[k].preco_medio) : "—"}</td>
                  ))}
                  <td>{fmtDateTime((l.NE || l.N || l.BA)?.atualizado_em)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="antt-muted">Cada pesquisa conta no mês da sua data inicial · {linhas.length} semanas desde 01/01/2026.</p>
    </>
  );
}

/** Sincronização automática, reverificação, importação manual de planilha oficial e histórico (auditoria). */
export function SincronizacaoAnp() {
  const { podeEditar, recarregarOpcoes } = useAntt();
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const inputRef = useRef(null);
  const carregar = useCallback(async () => { const r = await anttApi.statusSync(); if (r.ok) setStatus(r); }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function sincronizar(completo) {
    setOcupado(true); setMsg(null);
    const r = await anttApi.sincronizar(completo);
    setOcupado(false);
    setMsg(r.ok
      ? { tipo: r.status === "SUCESSO" ? "ok" : "aviso", texto: `Sincronização ${r.status}: ${r.arquivos} arquivo(s) processados, ${r.ignorados} sem alteração; ${r.semanas_2026} registros semana/localidade em 2026; ${r.novas} novos; ${r.correcoes.length} correções${r.divergencias.length ? `; ${r.divergencias.length} divergências na série histórica (mantida a fonte principal)` : ""}.${r.erros?.length ? ` Pendências: ${r.erros.slice(0, 3).join(" | ")}` : ""}` }
      : { tipo: "erro", texto: r.message });
    carregar(); recarregarOpcoes();
  }
  async function enviar(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setOcupado(true); setMsg(null);
    const r = await anttApi.importarAnp(arquivo);
    setOcupado(false);
    if (inputRef.current) inputRef.current.value = "";
    setMsg(r.ok ? { tipo: "ok", texto: `Planilha importada: ${r.registros} registros BA/NE/NO (2026+), ${r.novas} novos, ${r.correcoes.length} correções. Meses e marcos recalculados.` } : { tipo: "erro", texto: r.message });
    carregar(); recarregarOpcoes();
  }

  return (
    <div className="antt-stack">
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      <p className="antt-muted">
        Fontes oficiais da ANP: <a href="https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas" target="_blank" rel="noreferrer">levantamento semanal</a> (principal; republicações corrigem semanas) e <a href="https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos" target="_blank" rel="noreferrer">série histórica por região e estado</a> (só semanas ausentes). Atualização automática no servidor.
      </p>
      {podeEditar && (
        <div className="antt-row">
          <button type="button" className="antt-btn antt-btn--sm" onClick={() => sincronizar(false)} disabled={ocupado}>{ocupado ? "Processando…" : "Sincronizar agora"}</button>
          <button type="button" className="antt-btn antt-btn--sm antt-btn--ghost" onClick={() => sincronizar(true)} disabled={ocupado}>Reverificar todas as semanas de 2026</button>
          <label className="antt-btn antt-btn--sm antt-btn--ghost" style={{ cursor: ocupado ? "not-allowed" : "pointer" }}>
            Importar planilha oficial (XLSX)
            <input ref={inputRef} type="file" accept=".xlsx" onChange={enviar} disabled={ocupado} hidden />
          </label>
        </div>
      )}
      {!status ? <Loading /> : !status.historico.length ? <p className="antt-empty">Nenhuma sincronização registrada.</p> : (
        <div className="antt-tablewrap">
          <table className="antt-table antt-table--list">
            <thead><tr><th>Início</th><th className="is-left">Origem</th><th className="is-left">Status</th><th>Arquivos</th><th>Sem alteração</th><th>Registros</th><th className="is-left">Resultado</th></tr></thead>
            <tbody>
              {status.historico.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDateTime(l.iniciado_em)}</td><td className="is-left">{l.origem}</td>
                  <td className="is-left"><Badge tom={l.status === "SUCESSO" ? "ok" : l.status === "PARCIAL" || l.status === "EM_ANDAMENTO" ? "aviso" : "erro"}>{l.status}</Badge></td>
                  <td>{l.arquivos_processados}</td><td>{l.arquivos_ignorados}</td><td>{l.registros_gravados}</td>
                  <td className="is-wrap">{l.mensagem || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
