// Gerenciar clientes (dentro da própria página "Comunicar reajuste"): cadastrar, editar, ativar/desativar,
// excluir (exclusão lógica — o histórico de envios é preservado) e pesquisar.
import React, { useCallback, useEffect, useState } from "react";
import { comunicadosApi } from "../../../services/anttService";
import { Badge, Field, Notice } from "../components/Ui";
import { Modal } from "./Componentes";

const VAZIO = { nome: "", email_principal: "", contato_nome: "", emails_cc: "", observacoes: "", ativo: true };
const EMAIL = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]{2,}$/;
const separar = (s) => String(s || "").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

function validarLocal(f) {
  if (f.nome.trim().length < 2) return "Informe o nome do cliente.";
  if (!EMAIL.test(f.email_principal.trim())) return "Informe um e-mail principal válido.";
  const invalido = separar(f.emails_cc).find((e) => !EMAIL.test(e));
  if (invalido) return `E-mail em cópia inválido: ${invalido}`;
  if (separar(f.emails_cc).length > 10) return "No máximo 10 e-mails em cópia.";
  return null;
}

export default function ClientesPanel({ onClose, onAlterado }) {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);            // null = lista · { ...dados, id? } = formulário
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async (q = "") => {
    const r = await comunicadosApi.clientes({ busca: q });
    if (r.ok) setLista(r.clientes); else { setLista([]); setMsg({ tipo: "erro", texto: r.message }); }
  }, []);
  useEffect(() => { const t = setTimeout(() => carregar(busca.trim()), 250); return () => clearTimeout(t); }, [busca, carregar]);

  const editar = (c) => { setMsg(null); setForm({ id: c.id, nome: c.nome, email_principal: c.email_principal || "", contato_nome: c.contato_nome || "", emails_cc: (c.emails_cc || []).join(", "), observacoes: c.observacoes || "", ativo: c.ativo }); };

  async function salvar(e) {
    e.preventDefault();
    const erro = validarLocal(form);
    if (erro) return setMsg({ tipo: "erro", texto: erro });
    setOcupado(true); setMsg(null);
    const body = { nome: form.nome.trim(), email_principal: form.email_principal.trim(), contato_nome: form.contato_nome.trim(), emails_cc: separar(form.emails_cc), observacoes: form.observacoes.trim(), ativo: form.ativo };
    const r = form.id ? await comunicadosApi.atualizarCliente(form.id, body) : await comunicadosApi.criarCliente(body);
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.message });
    setMsg({ tipo: "ok", texto: form.id ? "Cliente atualizado." : r.reaproveitado ? "Cliente cadastrado (aproveitado o cadastro já existente no módulo)." : "Cliente cadastrado." });
    setForm(null);
    carregar(busca.trim());
    onAlterado?.();
  }

  async function alternarSituacao(c) {
    setOcupado(true);
    const r = await comunicadosApi.atualizarCliente(c.id, { nome: c.nome, email_principal: c.email_principal, contato_nome: c.contato_nome || "", emails_cc: c.emails_cc || [], observacoes: c.observacoes || "", ativo: !c.ativo });
    setOcupado(false);
    setMsg(r.ok ? { tipo: "ok", texto: `${c.nome}: ${c.ativo ? "desativado" : "reativado"}.` } : { tipo: "erro", texto: r.message });
    carregar(busca.trim()); onAlterado?.();
  }

  async function excluir(c) {
    if (!window.confirm(`Excluir o cliente "${c.nome}"?\n\nEle deixa de aparecer na lista. Os comunicados já enviados continuam no histórico.`)) return;
    setOcupado(true);
    const r = await comunicadosApi.excluirCliente(c.id);
    setOcupado(false);
    setMsg(r.ok ? { tipo: "ok", texto: `${c.nome} excluído. O histórico de envios foi preservado.` } : { tipo: "erro", texto: r.message });
    carregar(busca.trim()); onAlterado?.();
  }

  const set = (p) => setForm((f) => ({ ...f, ...p }));

  return (
    <Modal titulo={form ? (form.id ? "Editar cliente" : "Novo cliente") : "Gerenciar clientes"} onClose={onClose} largo bloqueado={ocupado}>
      {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}
      {form ? (
        <form className="antt-com-form" onSubmit={salvar} noValidate>
          <div className="antt-com-form__grid">
            <Field rotulo="Nome do cliente *"><input type="text" value={form.nome} maxLength={160} onChange={(e) => set({ nome: e.target.value })} autoFocus /></Field>
            <Field rotulo="E-mail principal *"><input type="email" value={form.email_principal} maxLength={254} onChange={(e) => set({ email_principal: e.target.value })} placeholder="compras@cliente.com.br" /></Field>
            <Field rotulo="Nome do contato"><input type="text" value={form.contato_nome} maxLength={160} onChange={(e) => set({ contato_nome: e.target.value })} placeholder="Opcional" /></Field>
            <Field rotulo="Situação">
              <select value={form.ativo ? "1" : "0"} onChange={(e) => set({ ativo: e.target.value === "1" })}><option value="1">Ativo</option><option value="0">Inativo</option></select>
            </Field>
          </div>
          <Field rotulo="E-mails em cópia" ajuda="Opcional. Separe por vírgula, ponto e vírgula ou linha (até 10).">
            <textarea rows={2} value={form.emails_cc} onChange={(e) => set({ emails_cc: e.target.value })} placeholder="financeiro@cliente.com.br, gerente@cliente.com.br" />
          </Field>
          <Field rotulo="Observações"><textarea rows={2} maxLength={1000} value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Opcional (uso interno, não vai no e-mail)" /></Field>
          <div className="antt-row antt-com-form__acoes">
            <button type="button" className="antt-btn antt-btn--ghost" onClick={() => { setForm(null); setMsg(null); }} disabled={ocupado}>Cancelar</button>
            <button className="antt-btn" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar cliente"}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="antt-com-toolbar">
            <input type="search" aria-label="Pesquisar clientes" placeholder="Pesquisar por nome, e-mail ou contato…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button type="button" className="antt-btn" onClick={() => { setMsg(null); setForm({ ...VAZIO }); }}>+ Cadastrar cliente</button>
          </div>
          {lista === null ? <p className="antt-muted">Carregando…</p> : !lista.length ? (
            <p className="antt-empty">{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda. Clique em “Cadastrar cliente”."}</p>
          ) : (
            <ul className="antt-com-clientes">
              {lista.map((c) => (
                <li key={c.id} className={c.ativo ? "" : "is-inativo"}>
                  <div className="antt-com-clientes__info">
                    <strong>{c.nome}</strong>
                    <span>{c.email_principal || <em>sem e-mail cadastrado</em>}{c.contato_nome ? ` · ${c.contato_nome}` : ""}</span>
                    {c.emails_cc?.length > 0 && <small>Cc: {c.emails_cc.join(", ")}</small>}
                    {c.observacoes && <small className="antt-com-obs">{c.observacoes}</small>}
                  </div>
                  <div className="antt-com-clientes__acoes">
                    {!c.email_principal ? <Badge tom="aviso">Completar cadastro</Badge> : c.ativo ? <Badge tom="ok">Ativo</Badge> : <Badge>Inativo</Badge>}
                    <button type="button" className="antt-linkbtn" onClick={() => editar(c)} disabled={ocupado}>Editar</button>
                    {c.email_principal && <button type="button" className="antt-linkbtn" onClick={() => alternarSituacao(c)} disabled={ocupado}>{c.ativo ? "Desativar" : "Reativar"}</button>}
                    <button type="button" className="antt-linkbtn antt-com-perigo" onClick={() => excluir(c)} disabled={ocupado}>Excluir</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
