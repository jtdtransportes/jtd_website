import { useEffect, useRef, useState } from "react";
import { previewContrachequeImport, importContrachequeFile } from "../../../../services/authService";
import "./PaycheckImport.css";

const STATUS = {
  ready: "Pronto", invalid: "Inválido", duplicate: "CPF repetido", unmatched: "Sem usuário",
  ambiguous: "Cadastro duplicado", existing: "Já existente", uploading: "Enviando",
  imported: "Importado", error: "Falha no envio",
};

function formatCpf(cpf) {
  return cpf ? cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : "—";
}

export default function PaycheckImport() {
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [files, setFiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [refresh, setRefresh] = useState(0);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const validPeriod = Number.isInteger(Number(mes)) && Number(mes) >= 1 && Number(mes) <= 12 &&
    Number.isInteger(Number(ano)) && Number(ano) >= 2000 && Number(ano) <= 2100;

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setRows([]);
    setProgress({ done: 0, total: 0 });
    if (!files.length || !validPeriod) { setChecking(false); return; }
    setChecking(true);
    setError("");
    const timer = setTimeout(async () => {
      const result = await previewContrachequeImport(localStorage.getItem("token"), {
        mes: Number(mes), ano: Number(ano),
        files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
      });
      if (!current) return;
      setChecking(false);
      if (result.ok) setRows(result.rows);
      else setError(result.message || "Não foi possível conferir os arquivos.");
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [mes, ano, files, validPeriod, refresh]);

  useEffect(() => {
    if (!running) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    setRows([]);
    setProgress({ done: 0, total: 0 });
    if (selected.length > 300) {
      setFiles([]);
      setError("Selecione no máximo 300 PDFs por lote.");
      event.target.value = "";
      return;
    }
    setError("");
    setFiles(selected);
  }

  const pending = rows.filter(row => row.ticket && (row.status === "ready" || row.status === "error"));
  const imported = rows.filter(row => row.status === "imported").length;
  const blocked = rows.filter(row => !["ready", "error", "uploading", "imported"].includes(row.status)).length;

  async function importAll() {
    if (busyRef.current || checking || !pending.length) return;
    busyRef.current = true;
    setRunning(true);
    setError("");
    setProgress({ done: 0, total: pending.length });
    const queue = [...pending];
    const patchRow = (index, patch) => {
      if (aliveRef.current) setRows(current => current.map(row => row.index === index ? { ...row, ...patch } : row));
    };
    async function worker() {
      while (queue.length && aliveRef.current) {
        const row = queue.shift();
        patchRow(row.index, { status: "uploading", message: "Enviando PDF e vinculando ao usuário…" });
        try {
          const result = await importContrachequeFile(localStorage.getItem("token"), files[row.index], row.ticket);
          patchRow(row.index, {
            status: result.ok ? result.status : "error",
            message: result.message || "Não foi possível importar este PDF.",
          });
        } catch {
          patchRow(row.index, { status: "error", message: "Falha no envio. Tente novamente." });
        } finally {
          if (aliveRef.current) setProgress(current => ({ ...current, done: current.done + 1 }));
        }
      }
    }
    try { await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker())); }
    finally {
      busyRef.current = false;
      if (aliveRef.current) setRunning(false);
    }
  }

  return (
    <div className="paycheck-import">
      <h3>Importar Contracheques</h3>
      <p>Escolha a competência e selecione os PDFs. Confira os usuários identificados pelo CPF antes de importar.</p>
      <div className="paycheck-import-fields">
        <label htmlFor="import-month">Mês de competência
          <select id="import-month" value={mes} onChange={e => setMes(e.target.value)} disabled={running}>
            <option value="">Selecione o mês</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, "0")}</option>)}
          </select>
        </label>
        <label htmlFor="import-year">Ano de competência
          <input id="import-year" type="number" min="2000" max="2100" value={ano} onChange={e => setAno(e.target.value)} disabled={running} />
        </label>
      </div>
      <label className="paycheck-import-picker" htmlFor="import-pdfs">Selecionar PDFs
        <input id="import-pdfs" type="file" accept=".pdf,application/pdf" multiple disabled={running || !validPeriod} onChange={selectFiles} aria-describedby="import-file-help" />
      </label>
      <p id="import-file-help" className="paycheck-import-help">Até 300 PDFs por lote, com até 5 MB cada. Padrão: CPF - NOME MM-AAAA.pdf.</p>
      {error && <p className="paycheck-import-error" role="alert">{error}</p>}
      {checking && <p role="status">Conferindo {files.length} arquivos e identificando os usuários…</p>}
      {!!rows.length && <>
        <div className="paycheck-import-summary" aria-live="polite">
          <span><strong>{rows.length}</strong> arquivos selecionados</span>
          <span><strong>{pending.length}</strong> prontos para enviar</span>
          <span><strong>{imported}</strong> importados</span>
          <span><strong>{blocked}</strong> sem importação (veja os motivos)</span>
        </div>
        <p className="paycheck-import-help">O vínculo é feito pelo CPF. Registros ativos da mesma competência são mantidos; registros inativos são reativados com o PDF selecionado.</p>
        <div className="paycheck-import-table" tabIndex={0} role="region" aria-label="Conferência dos contracheques">
          <table>
            <thead><tr><th>PDF</th><th>CPF identificado</th><th>Usuário no sistema</th><th>Situação</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.index}>
              <td>{row.file_name}</td>
              <td>{formatCpf(row.cpf)}</td>
              <td>{row.user?.nome || "—"}</td>
              <td><span className={`paycheck-import-status status-${row.status}`}>{STATUS[row.status] || row.status}</span><small>{row.message}</small></td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      {!!progress.total && <div className="paycheck-import-progress" role="status" aria-live="polite">
        <progress value={progress.done} max={progress.total} aria-label="Progresso da importação" />
        <span>{running ? "Importando" : "Processamento concluído"}: {progress.done} de {progress.total} arquivos processados.</span>
        {!running && rows.some(row => row.status === "error") && <span>Houve falhas. Clique em “Importar todos” para tentar novamente apenas os pendentes.</span>}
      </div>}
      <div className="paycheck-import-actions">
        <button type="button" onClick={importAll} disabled={running || checking || !pending.length}>
          {running ? "Importando…" : "Importar todos"}
        </button>
        {!!files.length && <button type="button" className="paycheck-import-recheck" onClick={() => setRefresh(n => n + 1)} disabled={running || checking || !validPeriod}>Conferir novamente</button>}
      </div>
      {running && <p className="paycheck-import-help">Mantenha esta página aberta até o fim do envio.</p>}
    </div>
  );
}
