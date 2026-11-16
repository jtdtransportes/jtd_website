// Gráficos em SVG puro (sem dependências novas), responsivos via viewBox, com tooltip por mês.
import React, { useEffect, useRef, useState } from "react";

const DEFAULT_W = 760;
const PAD = { top: 18, right: 24, bottom: 34, left: 62 };

function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const rawStep = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function dominio(values, extra = [], { incluirZero = false, folga = 0.08 } = {}) {
  const all = [...values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v)), ...extra];
  if (!all.length) return [0, 1, [0, 1]];
  let min = Math.min(...all), max = Math.max(...all);
  if (incluirZero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  const p = (max - min || 1) * folga;
  const ticks = niceTicks(incluirZero && min === 0 ? 0 : min - p, incluirZero && max === 0 ? 0 : max + p);
  return [ticks[0], ticks[ticks.length - 1], ticks];
}

function Legenda({ itens }) {
  return (
    <div className="antt-chart__legend">
      {itens.map((s) => (
        <span key={s.name}><i className={s.tipo === "linha" ? "is-line" : ""} style={{ background: s.tipo === "linha" ? "transparent" : s.color, borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }} />{s.name}</span>
      ))}
    </div>
  );
}

/** Estrutura comum: eixos, grade, marcadores verticais (novos marcos), faixa de hover e tooltip. */
function Quadro({ W, height, labels, ticks, y, x, format, children, markers = [], tooltip, titulo, slot, pad = PAD }) {
  const [hover, setHover] = useState(null);
  const every = Math.max(1, Math.ceil(labels.length / 12));
  const larguraHover = slot || (labels.length > 1 ? (x(1) - x(0)) : W - pad.left - pad.right);
  return (
    <div className="antt-chart__frame" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={titulo}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="antt-chart__grid" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="antt-chart__tick">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % every === 0 ? <text key={`${l}${i}`} x={x(i)} y={height - 10} textAnchor="middle" className="antt-chart__tick">{l}</text> : null))}
        {markers.map((m) => (
          <g key={`mk${m.index}`}>
            <line x1={x(m.index)} x2={x(m.index)} y1={pad.top} y2={height - pad.bottom} stroke={m.color || "#6b4fbb"} strokeWidth="1.5" strokeDasharray="3 3" />
            <text x={x(m.index) + 4} y={pad.top + 10} className="antt-chart__marker">{m.label}</text>
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={height - pad.bottom} className="antt-chart__guide" />}
        {children}
        {tooltip && labels.map((l, i) => (
          <rect key={`h${i}`} x={x(i) - larguraHover / 2} y={pad.top} width={larguraHover} height={height - pad.top - pad.bottom}
            fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      {tooltip && hover !== null && (
        <div className="antt-chart__tooltip" style={{ left: `${(x(hover) / W) * 100}%`, transform: x(hover) > W * 0.6 ? "translateX(-105%)" : "translateX(5%)" }}>
          {tooltip(hover).map((linha, k) => <div key={k} className={k === 0 ? "is-title" : ""}>{linha}</div>)}
        </div>
      )}
    </div>
  );
}

export function LineChart({ labels, series, format = (v) => v, height = 280, width = DEFAULT_W, refLines = [], band = null, markers = [], tooltip, title }) {
  if (!labels.length) return <p className="antt-empty">Sem dados para o gráfico.</p>;
  const W = width;
  const values = series.flatMap((s) => s.values);
  const extra = [...refLines.map((r) => r.value), ...(band ? [band.from, band.to] : [])];
  const [min, max, ticks] = dominio(values, extra);
  const y = (v) => PAD.top + (1 - (v - min) / (max - min)) * (height - PAD.top - PAD.bottom);
  const x = (i) => PAD.left + (labels.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i / (labels.length - 1)) * (W - PAD.left - PAD.right));
  return (
    <figure className="antt-chart">
      <Quadro {...{ W, height, labels, ticks, y, x, format, markers, tooltip, titulo: title }}>
        {band && <rect x={PAD.left} width={W - PAD.left - PAD.right} y={y(band.to)} height={Math.max(0, y(band.from) - y(band.to))} className="antt-chart__band" />}
        {refLines.map((r) => (
          <g key={r.label}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeDasharray={r.solid ? undefined : "6 4"} strokeWidth={r.solid ? 1.2 : 1.6} />
            {!r.semRotulo && <text x={W - PAD.right} y={y(r.value) - 5} textAnchor="end" className="antt-chart__refLabel" fill={r.color}>{r.label}</text>}
          </g>
        ))}
        {series.map((s) => {
          let d = "", aberto = false;
          s.values.forEach((v, i) => { if (v === null || v === undefined) { aberto = false; return; } d += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; aberto = true; });
          return (
            <g key={s.name} pointerEvents="none">
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width || 2.5} strokeLinejoin="round" strokeDasharray={s.dashed ? "6 4" : undefined} />
              {s.values.map((v, i) => {
                if (v === null || v === undefined) return null;
                const destaque = s.highlight ? s.highlight(v, i) : null;
                return (
                  <g key={i}>
                    {destaque && <circle cx={x(i)} cy={y(v)} r="9" fill={destaque} opacity="0.22" />}
                    <circle cx={x(i)} cy={y(v)} r={destaque ? 5.5 : 3.5} fill={destaque || s.color} stroke="#fff" strokeWidth="1.5" />
                  </g>
                );
              })}
            </g>
          );
        })}
      </Quadro>
      <Legenda itens={[...series.map((s) => ({ ...s, tipo: "linha" })), ...refLines.filter((r) => !r.semLegenda).map((r) => ({ name: r.label, color: r.color, dashed: !r.solid, tipo: "linha" }))]} />
    </figure>
  );
}

export function BarChart({ labels, series, format = (v) => v, height = 280, width = DEFAULT_W, signColors = null, tooltip, markers = [], title }) {
  if (!labels.length) return <p className="antt-empty">Sem dados para o gráfico.</p>;
  const W = width;
  const values = series.flatMap((s) => s.values);
  const [min, max, ticks] = dominio(values, [], { incluirZero: true, folga: 0.1 });
  const y = (v) => PAD.top + (1 - (v - min) / (max - min)) * (height - PAD.top - PAD.bottom);
  const inner = W - PAD.left - PAD.right;
  const slot = inner / labels.length;
  const x = (i) => PAD.left + slot * i + slot / 2;
  const barW = Math.min(30, (slot * 0.78) / series.length);
  return (
    <figure className="antt-chart">
      <Quadro {...{ W, height, labels, ticks, y, x, format, markers, tooltip, titulo: title, slot }}>
        {series.map((s, si) => s.values.map((v, i) => {
          if (v === null || v === undefined) return null;
          const bx = x(i) - (barW * series.length) / 2 + si * barW;
          const top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0));
          const fill = signColors && series.length === 1 ? (v > 0 ? signColors.pos : v < 0 ? signColors.neg : "#9aa7b0") : s.color;
          return <rect key={`${si}-${i}`} x={bx + 1} y={top} width={Math.max(barW - 2, 2)} height={Math.max(h, 1)} rx="2" fill={fill} pointerEvents="none" />;
        }))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="antt-chart__zero" />
      </Quadro>
      {signColors && series.length === 1
        ? <div className="antt-chart__legend"><span><i style={{ background: signColors.pos }} />Aumento</span><span><i style={{ background: signColors.neg }} />Redução</span><span><i className="is-line" style={{ borderColor: "#51626e" }} />Linha de zero</span></div>
        : <Legenda itens={[...series, { name: "Linha de zero", color: "#51626e", tipo: "linha" }]} />}
    </figure>
  );
}

/** Indicador visual do gatilho: faixa −L … +L com a posição atual da variação acumulada (limites inclusivos). */
export function TriggerGauge({ value, limit = 5 }) {
  const v = Number(value);
  const span = Math.max(limit * 2, Math.ceil(Math.abs(v) / limit) * limit * 1.2);
  const pos = (n) => Math.min(100, Math.max(0, ((n + span) / (span * 2)) * 100));
  const estado = v >= limit ? "alta" : v <= -limit ? "baixa" : "neutro";
  return (
    <div className={`antt-gauge antt-gauge--${estado}`} role="img" aria-label={`Variação acumulada ${v.toFixed(2)}% (gatilhos em ±${limit}%, inclusive)`}>
      <div className="antt-gauge__track">
        <div className="antt-gauge__zone antt-gauge__zone--baixa" style={{ left: 0, width: `${pos(-limit)}%` }} />
        <div className="antt-gauge__zone antt-gauge__zone--neutro" style={{ left: `${pos(-limit)}%`, width: `${pos(limit) - pos(-limit)}%` }} />
        <div className="antt-gauge__zone antt-gauge__zone--alta" style={{ left: `${pos(limit)}%`, right: 0 }} />
        <div className="antt-gauge__marker" style={{ left: `${pos(v)}%` }}><span>{`${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}%`}</span></div>
      </div>
      <div className="antt-gauge__scale" style={{ position: "relative", height: 16 }}>
        <span style={{ position: "absolute", left: `${pos(-limit)}%`, transform: "translateX(-50%)" }}>-{limit}%</span>
        <span style={{ position: "absolute", left: `${pos(0)}%`, transform: "translateX(-50%)" }}>0%</span>
        <span style={{ position: "absolute", left: `${pos(limit)}%`, transform: "translateX(-50%)" }}>+{limit}%</span>
      </div>
    </div>
  );
}

/**
 * Gráfico de acompanhamento (modelo da planilha): colunas = preço médio (eixo esquerdo, R$/L) e
 * linha = variação mensal (eixo direito, %). Meses fixos JAN..DEZ; meses sem dado ficam vazios.
 */
export function ComboChart({ labels, barras, linha, height = 320, alturaCelular = 280, formatBarra = (v) => v, formatLinha = (v) => v, tooltip, title, parciais = [] }) {
  // Usa a largura real do espaço disponível: a altura fica fixa (ex.: 320 px) e o texto em tamanho real.
  const ref = useRef(null);
  const [largura, setLargura] = useState(1000);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setLargura(w); };
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener("resize", medir);
    return () => { ro?.disconnect(); window.removeEventListener("resize", medir); };
  }, []);
  const W = largura;
  const H = W < 600 ? alturaCelular : height;
  const pad = { top: 30, right: 58, bottom: 34, left: 62 };
  const temBarra = barras.values.some((v) => v !== null && v !== undefined);
  if (!temBarra) return <div ref={ref}><p className="antt-empty">Sem dados para o gráfico.</p></div>;
  height = H;
  const [bMin, bMax, bTicks] = dominio(barras.values, [], { folga: 0.25 });
  const [lMin, lMax, lTicks] = dominio(linha.values, [], { incluirZero: true, folga: 0.15 });
  const altura = height - pad.top - pad.bottom;
  const yB = (v) => pad.top + (1 - (v - bMin) / (bMax - bMin)) * altura;
  const yL = (v) => pad.top + (1 - (v - lMin) / (lMax - lMin)) * altura;
  const slot = (W - pad.left - pad.right) / labels.length;
  const x = (i) => pad.left + slot * i + slot / 2;
  const barW = Math.max(6, Math.min(34, slot * 0.56));
  let d = "", aberto = false;
  linha.values.forEach((v, i) => { if (v === null || v === undefined) { aberto = false; return; } d += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${yL(v).toFixed(1)} `; aberto = true; });
  return (
    <figure className="antt-chart antt-chart--combo" ref={ref}>
      <Quadro {...{ W, height, labels: W < 600 ? labels.map((l) => l.slice(0, 1)) : labels, ticks: bTicks, y: yB, x, format: formatBarra, tooltip, titulo: title, slot, pad }}>
        <text x={pad.left - 8} y={14} textAnchor="end" className="antt-chart__axis">R$/L</text>
        <text x={W - pad.right + 8} y={14} className="antt-chart__axis">%</text>
        {lTicks.map((t) => <text key={`r${t}`} x={W - pad.right + 8} y={yL(t) + 4} className="antt-chart__tick">{formatLinha(t)}</text>)}
        {barras.values.map((v, i) => (v === null || v === undefined ? null : (
          <rect key={`b${i}`} x={x(i) - barW / 2} y={yB(v)} width={barW} height={Math.max(1, pad.top + altura - yB(v))} rx="3"
            fill={barras.color} opacity={parciais[i] ? 0.45 : 0.9} pointerEvents="none" />
        )))}
        {lMin < 0 && lMax > 0 && <line x1={pad.left} x2={W - pad.right} y1={yL(0)} y2={yL(0)} stroke={linha.color} strokeOpacity=".35" strokeDasharray="4 4" />}
        <path d={d} fill="none" stroke={linha.color} strokeWidth="2.2" strokeLinejoin="round" pointerEvents="none" />
        {linha.values.map((v, i) => (v === null || v === undefined ? null : (
          <circle key={`p${i}`} cx={x(i)} cy={yL(v)} r="3.6" fill={v > 0 ? "#b42318" : v < 0 ? "#0f7a4a" : linha.color} stroke="#fff" strokeWidth="1.5" pointerEvents="none" />
        )))}
      </Quadro>
      <div className="antt-chart__legend">
        <span><i style={{ background: barras.color }} />{barras.name} (R$/L)</span>
        <span><i className="is-line" style={{ borderColor: linha.color }} />{linha.name} (%)</span>
      </div>
    </figure>
  );
}
