// Cliente da API do módulo ANTT. Usa a mesma base de API e o mesmo token JWT do restante do sistema.
// Para apontar só o módulo ANTT para outro backend, defina REACT_APP_ANTT_API_BASE_URL.
import { API_BASE_URL } from "./authService";

const BASE = `${process.env.REACT_APP_ANTT_API_BASE_URL || API_BASE_URL}/api/antt`;

const qs = (params = {}) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") s.append(k, v);
  });
  const out = s.toString();
  return out ? `?${out}` : "";
};

async function request(path, { method = "GET", body, form, raw = false } = {}) {
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  try {
    const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
    if (raw) {
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { ok: false, status: response.status, message: err.message || "Falha ao baixar o arquivo." };
      }
      return { ok: true, blob: await response.blob(), response };
    }
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) {
      return { ok: false, status: response.status, message: "Resposta inválida do servidor (verifique se o backend com o módulo ANTT está no ar)." };
    }
    const data = await response.json();
    return { status: response.status, ...data };
  } catch {
    return { ok: false, message: "Não foi possível conectar ao backend." };
  }
}

export const anttApi = {
  acesso: () => request("/acesso"),
  opcoes: () => request("/opcoes"),
  config: () => request("/config"),
  salvarConfig: (body) => request("/config", { method: "PUT", body }),
  dashboard: (p) => request(`/dashboard${qs(p)}`),
  historicoSemanal: (p) => request(`/historico/semanal${qs(p)}`),
  historicoMensal: (p) => request(`/historico/mensal${qs(p)}`),
  statusSync: () => request("/sync/status"),
  versao: () => request("/sync/versao"),
  notificacoes: () => request("/notificacoes"),
  salvarNotificacoes: (body) => request("/notificacoes/config", { method: "PUT", body }),
  testarEmail: () => request("/notificacoes/teste", { method: "POST" }),
  sincronizar: (completo = false) => request(`/sync${completo ? "?completo=1" : ""}`, { method: "POST" }),
  gatilhos: (p) => request(`/gatilhos${qs(p)}`),
  importarAnp: (file) => {
    const form = new FormData();
    form.append("arquivo", file);
    return request("/importar/anp", { method: "POST", form });
  },
  marcos: (p) => request(`/marcos${qs(p)}`),
  criarMarco: (body) => request("/marcos", { method: "POST", body }),
  reajustes: () => request("/reajustes"),
  decidirReajuste: (body) => request("/reajustes/decisao", { method: "POST", body }),
  alertas: (p) => request(`/alertas${qs(p)}`),
  resolverAlerta: (id) => request(`/alertas/${id}/resolver`, { method: "PATCH" }),
  tabelasFrete: () => request("/tabelas-frete"),
  criarTabelaFrete: (body) => request("/tabelas-frete", { method: "POST", body }),
  calcularFrete: (body) => request("/calculadora", { method: "POST", body }),
  clientes: () => request("/clientes"),
  criarCliente: (body) => request("/clientes", { method: "POST", body }),
  contratos: (p) => request(`/contratos${qs(p)}`),
  criarContrato: (body) => request("/contratos", { method: "POST", body }),
  atualizarContrato: (id, body) => request(`/contratos/${id}`, { method: "PUT", body }),
  fretes: (p) => request(`/fretes${qs(p)}`),
  criarFrete: (body) => request("/fretes", { method: "POST", body }),
  importarFretes: (file, clienteId, contratoId) => {
    const form = new FormData();
    form.append("arquivo", file);
    form.append("cliente_id", clienteId);
    if (contratoId) form.append("contrato_id", contratoId);
    return request("/fretes/importar", { method: "POST", form });
  },
  calcularRetroativos: (body) => request("/retroativos/calcular", { method: "POST", body }),
  retroativos: () => request("/retroativos"),
  retroativo: (id) => request(`/retroativos/${id}`),
  exportarRetroativo: (id) => request(`/retroativos/${id}/exportar`, { raw: true }),
  auditoria: () => request("/auditoria"),
};

/** Multipart do envio: campos em "dados" (JSON) + arquivos em "anexos". */
function formComunicado(dados, arquivos = []) {
  const form = new FormData();
  form.append("dados", JSON.stringify(dados));
  arquivos.forEach((f) => form.append("anexos", f, f.name));
  return form;
}

/** "Comunicar reajuste": envio MANUAL de e-mails de reajuste a clientes (independente dos gatilhos automáticos). */
export const comunicadosApi = {
  contexto: () => request("/comunicados/contexto"),
  clientes: (p) => request(`/comunicados/clientes${qs(p)}`),
  criarCliente: (body) => request("/comunicados/clientes", { method: "POST", body }),
  atualizarCliente: (id, body) => request(`/comunicados/clientes/${id}`, { method: "PUT", body }),
  excluirCliente: (id) => request(`/comunicados/clientes/${id}`, { method: "DELETE" }),
  visualizar: (body) => request("/comunicados/visualizar", { method: "POST", body }),
  enviarTeste: (dados, arquivos) => request("/comunicados/teste", { method: "POST", form: formComunicado(dados, arquivos) }),
  enviar: (dados, arquivos) => request("/comunicados/enviar", { method: "POST", form: formComunicado(dados, arquivos) }),
  historico: (p) => request(`/comunicados/historico${qs(p)}`),
  comunicado: (id) => request(`/comunicados/historico/${id}`),
};

/** Lista de setores do sistema (endpoint já existente), usada para autorizar setores no módulo. */
export async function listarSetores() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sectors`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    const data = await response.json();
    return Array.isArray(data.sectors) ? data.sectors.map((s) => ({ id: s.id, nome: s.name || s.descricao || `Setor ${s.id}` })) : [];
  } catch {
    return [];
  }
}

/** Baixa um Blob como arquivo (relatórios). */
export function salvarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
