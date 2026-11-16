import React from "react";

export function Kpi({ rotulo, valor, detalhe, tom = "neutro", destaque = false, ajuda }) {
  return (
    <div className={`antt-kpi antt-kpi--${tom} ${destaque ? "antt-kpi--destaque" : ""}`} title={ajuda}>
      <span className="antt-kpi__label">{rotulo}</span>
      <strong className="antt-kpi__value">{valor}</strong>
      {detalhe && <span className="antt-kpi__detail">{detalhe}</span>}
    </div>
  );
}

export function Badge({ tom = "neutro", children }) {
  return <span className={`antt-badge antt-badge--${tom}`}>{children}</span>;
}

export function Notice({ tipo = "info", titulo, children, onClose }) {
  return (
    <div className={`antt-notice antt-notice--${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      <div>
        {titulo && <strong>{titulo}</strong>}
        <div>{children}</div>
      </div>
      {onClose && <button type="button" onClick={onClose} aria-label="Fechar">×</button>}
    </div>
  );
}

export function Card({ titulo, subtitulo, acoes, children, className = "" }) {
  return (
    <section className={`antt-card ${className}`}>
      {(titulo || acoes) && (
        <header className="antt-card__head">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {acoes && <div className="antt-card__actions">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHead({ titulo, descricao, children }) {
  return (
    <div className="antt-pagehead">
      <div>
        <h1>{titulo}</h1>
        {descricao && <p>{descricao}</p>}
      </div>
      {children && <div className="antt-pagehead__actions">{children}</div>}
    </div>
  );
}

export const Loading = ({ texto = "Carregando…" }) => <div className="antt-loading" role="status">{texto}</div>;

export function Field({ rotulo, ajuda, children, className = "" }) {
  return (
    <label className={`antt-field ${className}`}>
      <span>{rotulo}</span>
      {children}
      {ajuda && <small>{ajuda}</small>}
    </label>
  );
}

export function Tabs({ abas, ativa, onChange }) {
  return (
    <div className="antt-tabs" role="tablist">
      {abas.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={ativa === a.id} className={ativa === a.id ? "is-active" : ""} onClick={() => onChange(a.id)}>
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Seleção única em formato de botões agrupados (ex.: NE/NO · BA · NE · NO). */
export function Segmented({ opcoes, valor, onChange, rotulo }) {
  return (
    <div className="antt-seg" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} title={o.titulo}
          className={valor === o.valor ? "is-on" : ""} onClick={() => onChange(o.valor)}>{o.rotulo}</button>
      ))}
    </div>
  );
}

/** Seleção múltipla em chips (mantém ao menos um selecionado). */
export function Chips({ opcoes, valores, onChange, rotulo }) {
  const alternar = (v) => {
    if (valores.includes(v)) { if (valores.length > 1) onChange(valores.filter((x) => x !== v)); }
    else onChange([...valores, v]);
  };
  return (
    <div className="antt-chips" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={valores.includes(o.valor)} title={o.titulo}
          className={valores.includes(o.valor) ? "is-on" : ""} onClick={() => alternar(o.valor)}>
          <i style={{ background: o.cor }} aria-hidden="true" />{o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Seção recolhível para detalhes (fechada por padrão). */
export function Expand({ titulo, extra, children, aberto = false }) {
  return (
    <details className="antt-expand" open={aberto || undefined}>
      <summary><span>{titulo}</span>{extra && <small>{extra}</small>}</summary>
      <div className="antt-expand__body">{children}</div>
    </details>
  );
}

/** Ajuda contextual: explicação técnica no tooltip, fora da tela principal. */
export const Help = ({ texto }) => <span className="antt-help" tabIndex={0} role="img" aria-label={texto} title={texto}>?</span>;
