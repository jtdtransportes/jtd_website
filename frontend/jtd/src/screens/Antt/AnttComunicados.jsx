// Comunicar reajuste — envio MANUAL de e-mails de reajuste contratual a clientes cadastrados.
// Fluxo: cliente → (dados opcionais) → revisar assunto/mensagem → anexos → Visualizar / Enviar teste / Enviar e-mail
// → confirmação explícita → envio pelo servidor (Resend) → histórico. Nada é enviado automaticamente nem pelos gatilhos.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { comunicadosApi } from "../../services/anttService";
import { useAntt } from "./AnttContext";
import { Badge, Field, Loading, Notice, PageHead, Tabs } from "./components/Ui";
import { ClienteSelect, EditorSimples, Envelope, Modal, PreviaEmail } from "./comunicados/Componentes";
import ClientesPanel from "./comunicados/ClientesPanel";
import Historico from "./comunicados/Historico";
import { ASSUNTO_PADRAO, fmtBytes, fmtPercentual, mesPorExtenso, montarModelo, normalizarPercentual, novaChave, textoDe } from "./comunicados/modelo";
import "./comunicados/Comunicados.css";

const LIMITES_PADRAO = { max_arquivos: 10, max_bytes_arquivo: 10 * 1048576, max_bytes_total: 25 * 1048576, extensoes: [".pdf", ".xlsx", ".png", ".jpg", ".jpeg"] };
const extDe = (nome) => { const i = String(nome).lastIndexOf("."); return i >= 0 ? nome.slice(i).toLowerCase() : ""; };
/** Acumulado do Diesel S10 no mês (vindo do servidor) como valor do campo: "5.29" → "5,29". Só sugere quando > 0. */
const pctAcumulado = (a) => (a && Number(a.pct) > 0 ? String(Number(a.pct)).replace(".", ",") : "");

export default function AnttComunicados() {
  const { podeComunicar } = useAntt();
  const [aba, setAba] = useState("novo");
  const [ctx, setCtx] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [gerenciar, setGerenciar] = useState(false);
  const [versaoHist, setVersaoHist] = useState(0);

  const [clienteId, setClienteId] = useState(null);
  const [opc, setOpc] = useState({ percentual: "", vigencia: "", contrato: "" });
  const [assunto, setAssunto] = useState(ASSUNTO_PADRAO);
  const [corpo, setCorpo] = useState(() => montarModelo());
  const [editado, setEditado] = useState(false);
  const modeloNaEdicao = useRef(null);
  const [arquivos, setArquivos] = useState([]);
  const inputArquivos = useRef(null);

  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(null);           // "previa" | "teste" | "confirmar" | "envio"
  const [previa, setPrevia] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const travaEnvio = useRef(false);

  const cliente = clientes.find((c) => c.id === clienteId) || null;
  const limites = ctx?.limites || LIMITES_PADRAO;
  const pct = normalizarPercentual(opc.percentual);
  const acumulado = ctx?.acumulado || null;
  const referencia = mesPorExtenso(acumulado);
  const modelo = useMemo(
    () => montarModelo({ cliente: cliente?.nome, contato: cliente?.contato_nome, percentual: pct || "", vigencia: opc.vigencia, contrato: opc.contrato, referencia }),
    [cliente?.nome, cliente?.contato_nome, pct, opc.vigencia, opc.contrato, referencia]
  );
  // Enquanto o funcionário não editar, a mensagem acompanha o modelo (cliente e dados opcionais).
  useEffect(() => { if (!editado) setCorpo(modelo); }, [modelo, editado]);

  const carregarClientes = useCallback(async () => {
    const r = await comunicadosApi.clientes({ ativos: "1" });
    if (r.ok) setClientes(r.clientes);
  }, []);
  useEffect(() => {
    if (!podeComunicar) return;
    comunicadosApi.contexto().then((r) => {
      if (!r.ok) return setMsg({ tipo: "erro", texto: r.message });
      setCtx(r);
      setOpc((o) => ({ ...o, percentual: o.percentual || pctAcumulado(r.acumulado) }));   // reajuste já preenchido
    });
    carregarClientes();
  }, [podeComunicar, carregarClientes]);
  // cliente desativado/excluído no "Gerenciar clientes" sai da seleção
  useEffect(() => { if (clienteId && !clientes.some((c) => c.id === clienteId)) setClienteId(null); }, [clientes, clienteId]);

  if (!podeComunicar) {
    return <Notice tipo="erro" titulo="Acesso restrito">Seu perfil não tem permissão para comunicar reajustes a clientes. Solicite a liberação ao administrador.</Notice>;
  }
  if (!ctx) return msg ? <Notice tipo={msg.tipo}>{msg.texto}</Notice> : <Loading />;

  const alterarCorpo = (html) => {
    if (!editado) modeloNaEdicao.current = modelo;
    setEditado(true);
    setCorpo(html);
  };
  const restaurarModelo = () => {
    if (editado && !window.confirm("Substituir a mensagem pelo modelo padrão? As alterações feitas no texto serão perdidas.")) return;
    setEditado(false);
    setCorpo(modelo);
  };
  const dadosMudaram = editado && modeloNaEdicao.current !== null && modeloNaEdicao.current !== modelo;

  function adicionarArquivos(lista) {
    const novos = [...arquivos];
    const erros = [];
    for (const f of Array.from(lista || [])) {
      if (!limites.extensoes.includes(extDe(f.name))) erros.push(`${f.name}: formato não permitido`);
      else if (f.size > limites.max_bytes_arquivo) erros.push(`${f.name}: acima de ${fmtBytes(limites.max_bytes_arquivo)}`);
      else if (!f.size) erros.push(`${f.name}: arquivo vazio`);
      else if (novos.some((x) => x.name.toLowerCase() === f.name.toLowerCase())) erros.push(`${f.name}: já anexado`);
      else if (novos.length >= limites.max_arquivos) erros.push(`${f.name}: máximo de ${limites.max_arquivos} anexos`);
      else if (novos.reduce((s, x) => s + x.size, 0) + f.size > limites.max_bytes_total) erros.push(`${f.name}: os anexos passariam de ${fmtBytes(limites.max_bytes_total)}`);
      else novos.push(f);
    }
    setArquivos(novos);
    setMsg(erros.length ? { tipo: "erro", texto: `Não anexado — ${erros.join("; ")}.` } : null);
    if (inputArquivos.current) inputArquivos.current.value = "";
  }

  function validar({ real }) {
    if (real && !cliente) return "Selecione o cliente destinatário.";
    if (assunto.trim().length < 3) return "Informe o assunto do e-mail.";
    if (textoDe(corpo).length < 10) return "A mensagem está vazia ou muito curta.";
    if (pct === undefined) return "Percentual de reajuste inválido (use, por exemplo, 8,5).";
    return null;
  }
  const dados = () => ({
    cliente_id: cliente?.id, assunto: assunto.trim(), corpo_html: corpo, percentual: pct || undefined,
    data_vigencia: opc.vigencia || undefined, contrato_ref: opc.contrato.trim() || undefined,
  });
  const metaAnexos = () => arquivos.map((f) => ({ nome: f.name, tamanho: f.size }));

  async function visualizar() {
    const erro = validar({ real: false });
    if (erro) return setMsg({ tipo: "erro", texto: erro });
    setOcupado("previa"); setMsg(null);
    const r = await comunicadosApi.visualizar({ ...dados(), anexos: metaAnexos() });
    setOcupado(null);
    if (r.ok) setPrevia(r); else setMsg({ tipo: "erro", texto: r.message });
  }

  async function enviarTeste() {
    const erro = validar({ real: false });
    if (erro) return setMsg({ tipo: "erro", texto: erro });
    if (travaEnvio.current) return;
    travaEnvio.current = true; setOcupado("teste"); setMsg(null);
    const r = await comunicadosApi.enviarTeste(dados(), arquivos);
    travaEnvio.current = false; setOcupado(null);
    setVersaoHist((v) => v + 1);
    setMsg(r.ok
      ? { tipo: "ok", texto: `E-mail de TESTE enviado somente para ${r.envio.destinatario} (aceito pelo Resend). O cliente não recebeu nada. Confira a caixa de entrada e o spam.` }
      : { tipo: "erro", texto: r.message });
  }

  // 1º passo do envio real: o servidor monta o e-mail e devolve destinatários/assunto para a confirmação explícita.
  async function pedirConfirmacao() {
    const erro = validar({ real: true });
    if (erro) return setMsg({ tipo: "erro", texto: erro });
    setOcupado("confirmar"); setMsg(null);
    const r = await comunicadosApi.visualizar({ ...dados(), anexos: metaAnexos() });
    setOcupado(null);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.message });
    setConfirmacao({ ...r, chave: novaChave() });
  }

  async function confirmarEnvio() {
    if (travaEnvio.current || !confirmacao) return;      // cliques repetidos
    travaEnvio.current = true; setOcupado("envio");
    const r = await comunicadosApi.enviar({ ...dados(), chave_envio: confirmacao.chave, destinatario_esperado: confirmacao.email.para, confirmar: true }, arquivos);
    travaEnvio.current = false; setOcupado(null);
    setVersaoHist((v) => v + 1);
    if (!r.ok) { setConfirmacao(null); return setMsg({ tipo: "erro", texto: r.message }); }
    setConfirmacao(null);
    setMsg({ tipo: "ok", texto: `Comunicado enviado para ${r.envio.destinatario}${r.envio.cc?.length ? ` (cópia: ${r.envio.cc.join(", ")})` : ""}. Registrado no histórico.` });
    // formulário limpo: evita reenvio acidental do mesmo comunicado
    setClienteId(null); setOpc({ percentual: pctAcumulado(acumulado), vigencia: "", contrato: "" }); setAssunto(ASSUNTO_PADRAO); setArquivos([]); setEditado(false);
  }

  const totalAnexos = arquivos.reduce((s, f) => s + f.size, 0);
  const bloqueado = Boolean(ocupado);

  return (
    <div className="antt-com">
      <PageHead titulo="Comunicar reajuste" descricao="Envio manual de comunicados de reajuste contratual aos clientes. Nada é enviado sem a sua confirmação.">
        <button type="button" className="antt-btn antt-btn--ghost" onClick={() => setGerenciar(true)}>Gerenciar clientes</button>
      </PageHead>
      <Tabs abas={[{ id: "novo", rotulo: "Novo comunicado" }, { id: "historico", rotulo: "Histórico de comunicados" }]} ativa={aba} onChange={setAba} />

      {aba === "historico" ? <Historico versao={versaoHist} /> : (
        <>
          {!ctx.resend_configurado && <Notice tipo="erro">O envio de e-mails não está configurado no servidor (RESEND_API_KEY). A pré-visualização funciona, mas nenhum e-mail pode ser enviado.</Notice>}
          {msg && <Notice tipo={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Notice>}

          <section className="antt-card antt-com-passo">
            <header className="antt-com-passo__head"><span>1</span><h2>Cliente</h2></header>
            <ClienteSelect clientes={clientes} valor={clienteId} onChange={(c) => setClienteId(c?.id ?? null)} desabilitado={bloqueado} />
            {!clientes.length && <p className="antt-muted">Nenhum cliente ativo com e-mail. Use <button type="button" className="antt-linkbtn" onClick={() => setGerenciar(true)}>Gerenciar clientes</button> para cadastrar.</p>}
            {cliente && (
              <div className="antt-com-dest" aria-live="polite">
                <div><span>Para</span><strong>{cliente.email_principal}</strong>{cliente.contato_nome && <small>{cliente.contato_nome}</small>}</div>
                <div><span>Cópia</span>{cliente.emails_cc?.length ? <strong>{cliente.emails_cc.join(", ")}</strong> : <em>nenhuma</em>}</div>
              </div>
            )}
          </section>

          <section className="antt-card antt-com-passo">
            <header className="antt-com-passo__head"><span>2</span><h2>Dados do reajuste</h2></header>
            <div className="antt-com-opc">
              <Field rotulo="Reajuste (%)">
                <input type="text" inputMode="decimal" placeholder="ex.: 5,29" value={opc.percentual} disabled={bloqueado}
                  aria-invalid={pct === undefined} onChange={(e) => setOpc({ ...opc, percentual: e.target.value })} />
                {pct === undefined && <small className="antt-erro">Use um número entre 0,01 e 100.</small>}
                {acumulado && pctAcumulado(acumulado) && normalizarPercentual(opc.percentual) !== normalizarPercentual(pctAcumulado(acumulado)) && (
                  <button type="button" className="antt-linkbtn antt-com-usar" disabled={bloqueado} onClick={() => setOpc({ ...opc, percentual: pctAcumulado(acumulado) })}>
                    Usar acumulado ({fmtPercentual(acumulado.pct)})
                  </button>
                )}
              </Field>
              <Field rotulo="Vigência proposta"><input type="date" value={opc.vigencia} disabled={bloqueado} onChange={(e) => setOpc({ ...opc, vigencia: e.target.value })} /></Field>
              <Field rotulo="Referência do contrato"><input type="text" maxLength={120} placeholder="ex.: CT-2025/014" value={opc.contrato} disabled={bloqueado} onChange={(e) => setOpc({ ...opc, contrato: e.target.value })} /></Field>
            </div>
            <p className="antt-muted antt-com-nota">
              {acumulado
                ? <>Reajuste preenchido com o acumulado do Diesel S10 de {referencia}{acumulado.mes_parcial ? " (mês em andamento)" : ""}: <strong>{fmtPercentual(acumulado.pct)}</strong> (média NE/NO · ANP, sobre o marco de {mesPorExtenso(acumulado.marco)}). Pode ser editado antes do envio.</>
                : "Acumulado do Diesel S10 indisponível no momento: informe o percentual manualmente."}
              {" "}Vigência e contrato são opcionais; em branco, o texto se adapta.
            </p>
          </section>

          <section className="antt-card antt-com-passo">
            <header className="antt-com-passo__head"><span>3</span><h2>Mensagem</h2>
              {editado && <button type="button" className="antt-linkbtn" onClick={restaurarModelo} disabled={bloqueado}>Restaurar modelo</button>}
            </header>
            <Field rotulo="Assunto"><input type="text" maxLength={200} value={assunto} disabled={bloqueado} onChange={(e) => setAssunto(e.target.value)} /></Field>
            {dadosMudaram && (
              <Notice tipo="aviso">O cliente ou os dados do reajuste mudaram depois que você editou a mensagem. <button type="button" className="antt-linkbtn" onClick={restaurarModelo}>Atualizar a mensagem com o modelo</button></Notice>
            )}
            <EditorSimples value={corpo} onChange={alterarCorpo} />
          </section>

          <section className="antt-card antt-com-passo">
            <header className="antt-com-passo__head"><span>4</span><h2>Anexos <small>opcionais</small></h2></header>
            <div
              className="antt-com-drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (!bloqueado) adicionarArquivos(e.dataTransfer.files); }}
            >
              <button type="button" className="antt-btn antt-btn--ghost antt-btn--sm" onClick={() => inputArquivos.current?.click()} disabled={bloqueado}>Adicionar arquivos</button>
              <span>ou arraste aqui · PDF, Excel (.xlsx), PNG ou JPG · até {fmtBytes(limites.max_bytes_arquivo)} cada, {fmtBytes(limites.max_bytes_total)} no total</span>
              <input ref={inputArquivos} type="file" multiple hidden accept={limites.extensoes.join(",")} aria-label="Selecionar anexos" onChange={(e) => adicionarArquivos(e.target.files)} />
            </div>
            {arquivos.length > 0 && (
              <ul className="antt-com-anexos">
                {arquivos.map((f) => (
                  <li key={f.name}>
                    <span className="antt-com-anexos__ext">{extDe(f.name).slice(1).toUpperCase()}</span>
                    <span className="antt-com-anexos__nome">{f.name}</span>
                    <small>{fmtBytes(f.size)}</small>
                    <button type="button" className="antt-com-x" aria-label={`Remover ${f.name}`} disabled={bloqueado} onClick={() => setArquivos(arquivos.filter((x) => x !== f))}>×</button>
                  </li>
                ))}
                <li className="antt-com-anexos__total">{arquivos.length} arquivo(s) · {fmtBytes(totalAnexos)}</li>
              </ul>
            )}
          </section>

          <div className="antt-com-acoes">
            <p className="antt-muted">
              Teste vai somente para <strong>{ctx.email_teste || "— (seu usuário não tem e-mail)"}</strong>.
              {" "}Remetente: {ctx.remetente}{ctx.reply_to ? ` · respostas para ${ctx.reply_to}` : ""}.
            </p>
            <div className="antt-row">
              <button type="button" className="antt-btn antt-btn--ghost" onClick={visualizar} disabled={bloqueado}>{ocupado === "previa" ? "Gerando…" : "Visualizar e-mail"}</button>
              <button type="button" className="antt-btn antt-btn--ghost" onClick={enviarTeste} disabled={bloqueado || !ctx.email_teste || !ctx.resend_configurado}>{ocupado === "teste" ? "Enviando teste…" : "Enviar teste"}</button>
              <button type="button" className="antt-btn" onClick={pedirConfirmacao} disabled={bloqueado || !cliente || !ctx.resend_configurado}
                title={!cliente ? "Selecione o cliente" : undefined}>{ocupado === "confirmar" ? "Preparando…" : "Enviar e-mail"}</button>
            </div>
          </div>
        </>
      )}

      {previa && (
        <Modal titulo="Pré-visualização do e-mail" onClose={() => setPrevia(null)} largo
          rodape={<button type="button" className="antt-btn antt-btn--ghost" onClick={() => setPrevia(null)}>Fechar</button>}>
          <Envelope de={previa.email.de} para={previa.email.para} cc={previa.email.cc} replyTo={previa.email.reply_to} assunto={previa.email.assunto} anexos={previa.anexos} fmtBytes={fmtBytes} />
          <PreviaEmail html={previa.email.html} />
        </Modal>
      )}

      {confirmacao && (
        <Modal titulo="Confirmar envio ao cliente" onClose={() => setConfirmacao(null)} bloqueado={ocupado === "envio"} largo
          rodape={(
            <>
              <button type="button" className="antt-btn antt-btn--ghost" onClick={() => setConfirmacao(null)} disabled={ocupado === "envio"}>Cancelar</button>
              <button type="button" className="antt-btn" onClick={confirmarEnvio} disabled={ocupado === "envio"}>{ocupado === "envio" ? "Enviando…" : "Confirmar e enviar"}</button>
            </>
          )}>
          <Notice tipo="aviso">Este e-mail será enviado ao <strong>cliente</strong>{confirmacao.cliente ? <> <strong>{confirmacao.cliente.nome}</strong></> : null}. Confira os dados abaixo.</Notice>
          <Envelope de={confirmacao.email.de} para={confirmacao.email.para} cc={confirmacao.email.cc} replyTo={confirmacao.email.reply_to} assunto={confirmacao.email.assunto} anexos={confirmacao.anexos} fmtBytes={fmtBytes} />
          <details className="antt-com-ver"><summary>Ver o e-mail</summary><PreviaEmail html={confirmacao.email.html} altura={420} /></details>
          {!confirmacao.email.reply_to && <p className="antt-muted"><Badge tom="aviso">Atenção</Badge> Reply-To corporativo não configurado: respostas irão para o remetente.</p>}
        </Modal>
      )}

      {gerenciar && <ClientesPanel onClose={() => setGerenciar(false)} onAlterado={carregarClientes} />}
    </div>
  );
}
