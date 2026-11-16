import React, { useEffect, useId, useMemo, useRef, useState } from "react";

/** Diálogo modal simples (Esc fecha, foco no diálogo, rolagem própria). */
export function Modal({ titulo, onClose, children, rodape, largo = false, bloqueado = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const tecla = (e) => { if (e.key === "Escape" && !bloqueado) onClose(); };
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = overflow; };
  }, [onClose, bloqueado]);
  return (
    <div className="antt-com-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !bloqueado) onClose(); }}>
      <div className={`antt-com-modal${largo ? " antt-com-modal--largo" : ""}`} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref}>
        <header className="antt-com-modal__head">
          <h2>{titulo}</h2>
          <button type="button" className="antt-com-x" onClick={onClose} disabled={bloqueado} aria-label="Fechar">×</button>
        </header>
        <div className="antt-com-modal__body">{children}</div>
        {rodape && <footer className="antt-com-modal__foot">{rodape}</footer>}
      </div>
    </div>
  );
}

const exec = (cmd, valor = null) => {
  try { if (typeof document.execCommand === "function") document.execCommand(cmd, false, valor); } catch { /* navegador sem suporte */ }
};

/**
 * Editor simples: parágrafos, negrito, listas e quebras de linha. Colar/arrastar insere só texto (sem estilos do
 * Word/Outlook). O HTML é sanitizado de novo no servidor antes de virar e-mail.
 */
export function EditorSimples({ value, onChange, rotulo = "Mensagem" }) {
  const ref = useRef(null);
  const [ativo, setAtivo] = useState({});
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value; }, [value]);

  const emitir = () => onChange(ref.current?.innerHTML || "");
  const estado = () => {
    try { setAtivo({ bold: document.queryCommandState?.("bold"), ul: document.queryCommandState?.("insertUnorderedList"), ol: document.queryCommandState?.("insertOrderedList") }); } catch { /* sem suporte */ }
  };
  const comando = (cmd) => (e) => { e.preventDefault(); ref.current?.focus(); exec(cmd); emitir(); estado(); };
  const textoPuro = (texto) => {
    const linhas = String(texto || "").replace(/\r\n?/g, "\n");
    exec("insertText", linhas);
    emitir();
  };

  return (
    <div className="antt-com-editor">
      <div className="antt-com-editor__bar" role="toolbar" aria-label="Formatação">
        <button type="button" onMouseDown={comando("bold")} aria-pressed={Boolean(ativo.bold)} title="Negrito (Ctrl+B)"><strong>B</strong></button>
        <button type="button" onMouseDown={comando("insertUnorderedList")} aria-pressed={Boolean(ativo.ul)} title="Lista com marcadores">• Lista</button>
        <button type="button" onMouseDown={comando("insertOrderedList")} aria-pressed={Boolean(ativo.ol)} title="Lista numerada">1. Lista</button>
        <span className="antt-com-editor__dica">Enter = novo parágrafo · Shift+Enter = quebra de linha</span>
      </div>
      <div
        ref={ref}
        className="antt-com-editor__area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={rotulo}
        spellCheck
        onFocus={() => exec("defaultParagraphSeparator", "p")}
        onInput={emitir}
        onKeyUp={estado}
        onMouseUp={estado}
        onPaste={(e) => { e.preventDefault(); textoPuro(e.clipboardData?.getData("text/plain")); }}
        onDrop={(e) => { e.preventDefault(); textoPuro(e.dataTransfer?.getData("text/plain")); }}
      />
    </div>
  );
}

const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Campo de seleção pesquisável (combobox) com navegação por teclado. */
export function ClienteSelect({ clientes, valor, onChange, desabilitado = false }) {
  const id = useId();
  const selecionado = clientes.find((c) => c.id === valor) || null;
  const [texto, setTexto] = useState(selecionado?.nome || "");
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  const caixa = useRef(null);
  useEffect(() => { setTexto(selecionado?.nome || ""); }, [selecionado?.id, selecionado?.nome]);

  const filtrados = useMemo(() => {
    const q = normalizar(texto === selecionado?.nome ? "" : texto);
    return clientes.filter((c) => !q || normalizar(`${c.nome} ${c.email_principal} ${c.contato_nome || ""}`).includes(q)).slice(0, 60);
  }, [clientes, texto, selecionado?.nome]);

  const escolher = (c) => { onChange(c); setTexto(c?.nome || ""); setAberto(false); };
  const tecla = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setFoco((f) => Math.min(f + 1, filtrados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFoco((f) => Math.max(f - 1, 0)); }
    else if (e.key === "Enter" && aberto && filtrados[foco]) { e.preventDefault(); escolher(filtrados[foco]); }
    else if (e.key === "Escape") { setAberto(false); setTexto(selecionado?.nome || ""); }
  };

  return (
    <div className="antt-com-combo" ref={caixa} onBlur={(e) => { if (!caixa.current?.contains(e.relatedTarget)) { setAberto(false); setTexto(selecionado?.nome || ""); } }}>
      <input
        type="text" role="combobox" aria-expanded={aberto} aria-controls={`${id}-lista`} aria-autocomplete="list" aria-label="Cliente"
        placeholder={clientes.length ? "Pesquise pelo nome, e-mail ou contato…" : "Nenhum cliente ativo cadastrado"}
        value={texto} disabled={desabilitado}
        onChange={(e) => { setTexto(e.target.value); setAberto(true); setFoco(0); }}
        onFocus={(e) => { setAberto(true); e.target.select(); }}
        onKeyDown={tecla}
      />
      {selecionado && !desabilitado && <button type="button" className="antt-com-combo__limpar" aria-label="Limpar cliente" onClick={() => escolher(null)}>×</button>}
      {aberto && (
        <ul className="antt-com-combo__lista" id={`${id}-lista`} role="listbox">
          {!filtrados.length && <li className="antt-com-combo__vazio">Nenhum cliente encontrado.</li>}
          {filtrados.map((c, i) => (
            <li key={c.id} role="option" aria-selected={c.id === valor} tabIndex={-1}
              className={`${i === foco ? "is-foco" : ""} ${c.id === valor ? "is-sel" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); escolher(c); }} onMouseEnter={() => setFoco(i)}>
              <strong>{c.nome}</strong><small>{c.email_principal}{c.contato_nome ? ` · ${c.contato_nome}` : ""}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pré-visualização do HTML do e-mail em iframe isolado (sem scripts, sem acesso à página). */
export function PreviaEmail({ html, altura = 560 }) {
  return <iframe className="antt-com-iframe" title="Pré-visualização do e-mail" sandbox="" srcDoc={html} style={{ height: altura }} />;
}

/** Cabeçalho do e-mail (remetente, destinatários, assunto, anexos). */
export function Envelope({ de, para, cc = [], replyTo, assunto, anexos = [], fmtBytes }) {
  return (
    <dl className="antt-com-envelope">
      <div><dt>De</dt><dd>{de}</dd></div>
      <div><dt>Para</dt><dd>{para || <em>selecione um cliente</em>}</dd></div>
      {cc.length > 0 && <div><dt>Cc</dt><dd>{cc.join(", ")}</dd></div>}
      <div><dt>Responder para</dt><dd>{replyTo || <em>o próprio remetente</em>}</dd></div>
      <div><dt>Assunto</dt><dd><strong>{assunto}</strong></dd></div>
      <div><dt>Anexos</dt><dd>{anexos.length ? anexos.map((a) => `${a.nome}${a.tamanho != null && fmtBytes ? ` (${fmtBytes(a.tamanho)})` : ""}`).join(" · ") : "nenhum"}</dd></div>
    </dl>
  );
}
