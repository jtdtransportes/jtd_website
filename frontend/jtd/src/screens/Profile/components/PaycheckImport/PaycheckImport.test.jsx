import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaycheckImport from "./PaycheckImport";
import { previewContrachequeImport, importContrachequeFile } from "../../../../services/authService";

jest.mock("../../../../services/authService", () => ({
  previewContrachequeImport: jest.fn(), importContrachequeFile: jest.fn(),
}));

function selectFiles(count = 1) {
  fireEvent.change(screen.getByLabelText("Mês de competência"), { target: { value: "9" } });
  fireEvent.change(screen.getByLabelText("Ano de competência"), { target: { value: "2026" } });
  const files = Array.from({ length: count }, (_, i) => new File(["%PDF-test"], `${String(i).padStart(11, "0")} - TESTE 09-2026.pdf`, { type: "application/pdf" }));
  fireEvent.change(screen.getByLabelText("Selecionar PDFs"), { target: { files } });
  return files;
}

beforeEach(() => {
  jest.clearAllMocks();
  previewContrachequeImport.mockImplementation(async (_, data) => ({ ok: true, rows: data.files.map((f, i) => ({
    index: i, file_name: f.name, cpf: String(i).padStart(11, "0"),
    user: { id: i + 1, nome: `Usuario ${i + 1}` }, status: "ready", message: "Pronto", ticket: `ticket-${i}`,
  })) }));
  importContrachequeFile.mockResolvedValue({ ok: true, status: "imported", message: "Importado com sucesso" });
});

test("exige competencia e confere antes de enviar qualquer PDF", async () => {
  render(<PaycheckImport />);
  expect(screen.getByLabelText("Selecionar PDFs")).toBeDisabled();
  selectFiles(2);
  await screen.findByText("Usuario 1");
  expect(importContrachequeFile).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Importar todos" })).toBeEnabled();
});

test("processa 200 PDFs com no maximo 3 envios simultaneos", async () => {
  let active = 0; let maximum = 0;
  importContrachequeFile.mockImplementation(async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 0));
    active--;
    return { ok: true, status: "imported", message: "Importado" };
  });
  render(<PaycheckImport />);
  selectFiles(200);
  await screen.findByText("Usuario 200");
  fireEvent.click(screen.getByRole("button", { name: "Importar todos" }));
  expect(screen.getByLabelText("Mês de competência")).toBeDisabled();
  await waitFor(() => expect(importContrachequeFile).toHaveBeenCalledTimes(200), { timeout: 15000 });
  await screen.findByText(/Processamento concluído: 200 de 200/);
  expect(maximum).toBe(3);
  expect(screen.getByRole("button", { name: "Importar todos" })).toBeDisabled();
}, 20000);

test("repete somente falhas e preserva arquivos concluidos", async () => {
  importContrachequeFile.mockResolvedValueOnce({ ok: false, message: "Falha de rede" });
  render(<PaycheckImport />);
  selectFiles(2);
  await screen.findByText("Usuario 2");
  fireEvent.click(screen.getByRole("button", { name: "Importar todos" }));
  await screen.findByText(/Processamento concluído: 2 de 2/);
  expect(screen.getByText("Falha de rede")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Importar todos" }));
  await screen.findByText(/Processamento concluído: 1 de 1/);
  expect(importContrachequeFile).toHaveBeenCalledTimes(3);
  expect(importContrachequeFile.mock.calls[2][2]).toBe("ticket-0");
});

test("nao envia arquivos sem correspondencia ou ja existentes", async () => {
  previewContrachequeImport.mockResolvedValue({ ok: true, rows: [
    { index: 0, file_name: "sem-usuario.pdf", status: "unmatched", message: "Nenhum usuário" },
    { index: 1, file_name: "existente.pdf", status: "existing", message: "Já existe" },
  ] });
  render(<PaycheckImport />);
  selectFiles(2);
  await screen.findByText("Nenhum usuário");
  expect(screen.getByRole("button", { name: "Importar todos" })).toBeDisabled();
  expect(importContrachequeFile).not.toHaveBeenCalled();
});

test("trocar competencia invalida a conferencia anterior", async () => {
  render(<PaycheckImport />);
  selectFiles();
  await screen.findByText("Usuario 1");
  fireEvent.change(screen.getByLabelText("Mês de competência"), { target: { value: "8" } });
  expect(screen.getByRole("button", { name: "Importar todos" })).toBeDisabled();
  await waitFor(() => expect(previewContrachequeImport).toHaveBeenLastCalledWith(null, expect.objectContaining({ mes: 8 })));
});

test("mostra no resumo quando outro lote concluiu o arquivo apos a conferencia", async () => {
  importContrachequeFile.mockResolvedValue({ ok: true, status: "existing", message: "Já importado por outro lote" });
  render(<PaycheckImport />);
  selectFiles();
  await screen.findByText("Usuario 1");
  fireEvent.click(screen.getByRole("button", { name: "Importar todos" }));
  await screen.findByText(/Processamento concluído: 1 de 1/);
  expect(screen.getByText(/sem importação \(veja os motivos\)/)).toHaveTextContent("1 sem importação");
  expect(screen.getByRole("button", { name: "Importar todos" })).toBeDisabled();
});

test("resposta antiga nao substitui uma selecao mais recente", async () => {
  let finish;
  previewContrachequeImport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<PaycheckImport />);
  selectFiles();
  await waitFor(() => expect(previewContrachequeImport).toHaveBeenCalledTimes(1));
  selectFiles(2);
  await screen.findByText("Usuario 2");
  await act(async () => finish({ ok: true, rows: [] }));
  expect(screen.getByText("Usuario 2")).toBeInTheDocument();
});
