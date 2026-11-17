// Tela "Comunicar reajuste" com a API simulada (nenhuma chamada de rede, nenhum e-mail real).
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AnttComunicados from "./AnttComunicados";
import { AnttContext } from "./AnttContext";
import { comunicadosApi } from "../../services/anttService";

jest.mock("../../services/anttService", () => ({
  comunicadosApi: {
    contexto: jest.fn(), clientes: jest.fn(), criarCliente: jest.fn(), atualizarCliente: jest.fn(), excluirCliente: jest.fn(),
    visualizar: jest.fn(), enviarTeste: jest.fn(), enviar: jest.fn(), historico: jest.fn(), comunicado: jest.fn(),
  },
}));

const CLIENTES = [
  { id: 1, nome: "Alfa Ltda", email_principal: "compras@alfa.com.br", contato_nome: "Carlos", emails_cc: ["financeiro@alfa.com.br"], ativo: true },
  { id: 2, nome: "Beta Transportes", email_principal: "contato@beta.com", contato_nome: null, emails_cc: [], ativo: true },
];
const CTX = {
  ok: true, assunto_padrao: "JTD Transportes | Solicitação de reajuste contratual", remetente: "JTD Transportes <nao-responda@jtd.com.br>",
  reply_to: "comercial@jtd.com.br", email_teste: "eu@jtd.com.br", resend_configurado: true,
  limites: { max_arquivos: 10, max_bytes_arquivo: 10485760, max_bytes_total: 26214400, extensoes: [".pdf", ".xlsx", ".png", ".jpg", ".jpeg"] },
};
const previa = (para = "compras@alfa.com.br") => ({ ok: true, email: { de: CTX.remetente, para, cc: ["financeiro@alfa.com.br"], reply_to: CTX.reply_to, assunto: CTX.assunto_padrao, html: "<p>email</p>", texto: "email" }, cliente: { id: 1, nome: "Alfa Ltda" }, anexos: [] });

function renderizar(podeComunicar = true) {
  return render(<AnttContext.Provider value={{ podeComunicar }}><AnttComunicados /></AnttContext.Provider>);
}
async function selecionarAlfa() {
  const combo = await screen.findByRole("combobox", { name: "Cliente" });
  fireEvent.focus(combo);
  fireEvent.change(combo, { target: { value: "alf" } });
  fireEvent.mouseDown(await screen.findByRole("option", { name: /Alfa Ltda/ }));
}

beforeEach(() => {
  jest.clearAllMocks();
  comunicadosApi.contexto.mockResolvedValue(CTX);
  comunicadosApi.clientes.mockResolvedValue({ ok: true, clientes: CLIENTES });
  comunicadosApi.historico.mockResolvedValue({ ok: true, comunicados: [], clientes: [] });
});

test("sem permissão: não carrega dados nem permite envio", () => {
  renderizar(false);
  expect(screen.getByText(/não tem permissão/)).toBeInTheDocument();
  expect(comunicadosApi.contexto).not.toHaveBeenCalled();
});

test("reajuste já vem preenchido com o acumulado do mês, editável e restaurável", async () => {
  comunicadosApi.contexto.mockResolvedValue({ ...CTX, acumulado: { pct: "5.29", indicador: "NENO", ano: 2026, mes: 11, mes_parcial: false, semanas: 4, preco_mes: "6.422690", marco: { ano: 2026, mes: 1, preco: "6.100000" } } });
  renderizar();
  const campo = await screen.findByPlaceholderText("ex.: 5,29");
  await waitFor(() => expect(campo).toHaveValue("5,29"));
  expect(screen.getByText(/Variação acumulada da média NE\/NO do Diesel S10 em novembro\/2026 em relação ao marco de janeiro\/2026/)).toBeInTheDocument();
  expect(screen.getByText("Conta: (6,4227 ÷ 6,1000 − 1) × 100 = +5,29%")).toBeInTheDocument();
  const editor = screen.getByRole("textbox", { name: "Mensagem" });
  await waitFor(() => expect(editor.innerHTML).toContain("o reajuste acumulado do óleo diesel S10 atingiu <strong>5,29%</strong> em novembro de 2026."));
  expect(editor.innerHTML).not.toMatch(/propomos/i);
  fireEvent.change(campo, { target: { value: "5,1" } });
  await waitFor(() => expect(editor.innerHTML).toContain("<strong>5,1%</strong>"));
  fireEvent.click(screen.getByRole("button", { name: "Usar acumulado (5,29%)" }));
  expect(campo).toHaveValue("5,29");
});

test("selecionar o cliente preenche e-mail principal, cópias e o modelo com os dados opcionais", async () => {
  renderizar();
  await selecionarAlfa();
  expect(screen.getByText("compras@alfa.com.br")).toBeInTheDocument();
  expect(screen.getByText("financeiro@alfa.com.br")).toBeInTheDocument();
  const editor = screen.getByRole("textbox", { name: "Mensagem" });
  expect(editor.innerHTML).toContain("<strong>Alfa Ltda</strong>");
  expect(editor.innerHTML).toContain("Prezado(a) Carlos,");
  fireEvent.change(screen.getByPlaceholderText("ex.: 5,29"), { target: { value: "8,5" } });
  fireEvent.change(screen.getByLabelText("Vigência proposta"), { target: { value: "2026-12-01" } });
  await waitFor(() => expect(editor.innerHTML).toContain("<strong>8,5%</strong>"));
  expect(editor.innerHTML).toContain("<strong>01/12/2026</strong>");
  expect(screen.getByDisplayValue(CTX.assunto_padrao)).toBeInTheDocument();       // assunto padrão editável
});

test("edição manual da mensagem é preservada e enviada; assunto editado também", async () => {
  comunicadosApi.visualizar.mockResolvedValue(previa());
  renderizar();
  await selecionarAlfa();
  const editor = screen.getByRole("textbox", { name: "Mensagem" });
  editor.innerHTML = "<p>Texto <b>revisado</b> pelo comercial.</p>";
  fireEvent.input(editor);
  fireEvent.change(screen.getByPlaceholderText("ex.: 5,29"), { target: { value: "6" } });   // não sobrescreve a edição
  expect(editor.innerHTML).toContain("revisado");
  expect(screen.getByText(/mudaram depois que você editou/)).toBeInTheDocument();
  fireEvent.change(screen.getByDisplayValue(CTX.assunto_padrao), { target: { value: "Reajuste 2027" } });
  fireEvent.click(screen.getByRole("button", { name: "Visualizar e-mail" }));
  await waitFor(() => expect(comunicadosApi.visualizar).toHaveBeenCalled());
  const body = comunicadosApi.visualizar.mock.calls[0][0];
  expect(body).toMatchObject({ cliente_id: 1, assunto: "Reajuste 2027", percentual: "6" });
  expect(body.corpo_html).toContain("revisado");
  expect(await screen.findByTitle("Pré-visualização do e-mail")).toBeInTheDocument();
  expect(comunicadosApi.enviar).not.toHaveBeenCalled();                                // prévia não envia
});

test("anexos: adiciona, recusa formato perigoso e remove antes de enviar", async () => {
  renderizar();
  const input = await screen.findByLabelText("Selecionar anexos");
  const pdf = new File(["%PDF-1.4"], "proposta.pdf", { type: "application/pdf" });
  const exe = new File(["MZ"], "programa.exe", { type: "application/octet-stream" });
  fireEvent.change(input, { target: { files: [pdf, exe] } });
  expect(screen.getByText("proposta.pdf")).toBeInTheDocument();
  expect(screen.queryByText("programa.exe")).not.toBeInTheDocument();
  expect(screen.getByText(/programa\.exe: formato não permitido/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remover proposta.pdf" }));
  expect(screen.queryByText("proposta.pdf")).not.toBeInTheDocument();
});

test("enviar teste usa só o endpoint de teste (nunca o envio real)", async () => {
  comunicadosApi.enviarTeste.mockResolvedValue({ ok: true, envio: { destinatario: "eu@jtd.com.br", cc: [] } });
  renderizar();
  await selecionarAlfa();
  fireEvent.click(screen.getByRole("button", { name: "Enviar teste" }));
  expect(await screen.findByText(/TESTE enviado somente para eu@jtd.com.br/)).toBeInTheDocument();
  expect(comunicadosApi.enviarTeste).toHaveBeenCalledTimes(1);
  expect(comunicadosApi.enviar).not.toHaveBeenCalled();
});

test("envio real exige confirmação explícita e cliques repetidos enviam uma única vez", async () => {
  comunicadosApi.visualizar.mockResolvedValue(previa());
  let liberar;
  comunicadosApi.enviar.mockImplementation(() => new Promise((r) => { liberar = () => r({ ok: true, envio: { destinatario: "compras@alfa.com.br", cc: ["financeiro@alfa.com.br"] } }); }));
  renderizar();
  await selecionarAlfa();
  fireEvent.click(screen.getByRole("button", { name: "Enviar e-mail" }));
  const dialogo = await screen.findByRole("dialog", { name: "Confirmar envio ao cliente" });
  expect(within(dialogo).getByText("compras@alfa.com.br")).toBeInTheDocument();
  expect(within(dialogo).getByText(CTX.assunto_padrao)).toBeInTheDocument();
  expect(comunicadosApi.enviar).not.toHaveBeenCalled();                                // nada sai sem confirmar
  const confirmar = within(dialogo).getByRole("button", { name: "Confirmar e enviar" });
  fireEvent.click(confirmar); fireEvent.click(confirmar); fireEvent.click(confirmar);
  expect(comunicadosApi.enviar).toHaveBeenCalledTimes(1);
  const [dados] = comunicadosApi.enviar.mock.calls[0];
  expect(dados).toMatchObject({ cliente_id: 1, confirmar: true, destinatario_esperado: "compras@alfa.com.br" });
  expect(dados.chave_envio.length).toBeGreaterThanOrEqual(16);
  await act(async () => liberar());
  expect(await screen.findByText(/Comunicado enviado para compras@alfa.com.br/)).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Cliente" })).toHaveValue("");           // formulário limpo após o envio
});

test("histórico em aba própria com filtros", async () => {
  comunicadosApi.historico.mockResolvedValue({
    ok: true, clientes: [{ id: 1, nome: "Alfa Ltda" }],
    comunicados: [{ id: 9, modo: "REAL", cliente_nome: "Alfa Ltda", destinatario: "compras@alfa.com.br", cc: [], assunto: "Reajuste", anexos: [], status: "ENTREGUE", enviado_por_nome: "Ana", criado_em: "2026-11-10T10:00:00", enviado_em: "2026-11-10T10:00:01" }],
  });
  renderizar();
  fireEvent.click(await screen.findByRole("tab", { name: "Histórico de comunicados" }));
  expect(await screen.findByText("Entregue")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "1" } });
  await waitFor(() => expect(comunicadosApi.historico).toHaveBeenLastCalledWith(expect.objectContaining({ cliente_id: "1" })));
});
