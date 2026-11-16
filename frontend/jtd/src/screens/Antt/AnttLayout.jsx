import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { anttApi } from "../../services/anttService";
import { AnttContext } from "./AnttContext";
import { Loading, Notice } from "./components/Ui";
import "./Antt.css";

// Retroativos fica fora do menu temporariamente (rota, tela e dados preservados em /antt/retroativos).
// "Comunicar reajuste" só aparece para quem pode enviar (administradores e setores autorizados para comunicados).
const MENU = [
  { to: "/antt", rotulo: "Gatilhos e marcos", fim: true },
  { to: "/antt/comunicados", rotulo: "Comunicar reajuste", comunicar: true },
  { to: "/antt/calculadora", rotulo: "Calculadora ANTT", secundario: true },
  { to: "/antt/configuracoes", rotulo: "Configurações", secundario: true },
];

export default function AnttLayout() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState({ carregando: true, acesso: null, erro: null });
  const [opcoes, setOpcoes] = useState(null);
  const [config, setConfig] = useState(null);

  const recarregarOpcoes = useCallback(async () => {
    const r = await anttApi.opcoes();
    if (r.ok) setOpcoes(r);
  }, []);
  const recarregarConfig = useCallback(async () => {
    const r = await anttApi.config();
    if (r.ok) setConfig(r.config);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login", { replace: true });
      return;
    }
    let vivo = true;
    (async () => {
      const r = await anttApi.acesso();
      if (!vivo) return;
      if (r.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }
      if (!r.ok) return setEstado({ carregando: false, acesso: null, erro: r.message });
      setEstado({ carregando: false, acesso: r, erro: null });
      if (r.acesso) { recarregarOpcoes(); recarregarConfig(); }
    })();
    return () => { vivo = false; };
  }, [navigate, recarregarOpcoes, recarregarConfig]);

  const ctx = useMemo(
    () => ({ podeEditar: Boolean(estado.acesso?.pode_editar), podeComunicar: Boolean(estado.acesso?.pode_comunicar), opcoes, config, recarregarConfig, recarregarOpcoes }),
    [estado.acesso, opcoes, config, recarregarConfig, recarregarOpcoes]
  );

  let conteudo;
  if (estado.carregando) conteudo = <Loading texto="Verificando acesso…" />;
  else if (estado.erro) conteudo = <Notice tipo="erro" titulo="Não foi possível abrir o módulo ANTT">{estado.erro}</Notice>;
  else if (!estado.acesso?.acesso) {
    conteudo = (
      <Notice tipo="erro" titulo="Acesso restrito">
        {estado.acesso?.motivo || "Você não tem permissão para acessar o módulo ANTT."} Solicite a liberação ao administrador do sistema.
      </Notice>
    );
  } else if (!config || !opcoes) conteudo = <Loading />;
  else conteudo = <Outlet />;

  return (
    <div className="antt-shell">
      <Header />
      <main className="antt-page">
        <aside className="antt-sidebar" aria-label="Navegação do módulo ANTT">
          <div className="antt-sidebar__brand">
            <span>Módulo</span>
            <strong>ANTT</strong>
            <small>Monitoramento e reajuste de fretes</small>
          </div>
          <nav>
            {MENU.filter((m) => !m.comunicar || estado.acesso?.pode_comunicar).map((m) => (
              <NavLink key={m.to} to={m.to} end={m.fim} className={({ isActive }) => `antt-nav ${m.secundario ? "antt-nav--sec" : ""} ${isActive ? "is-active" : ""}`}>
                {m.rotulo}
              </NavLink>
            ))}
          </nav>
          {estado.acesso?.acesso && (
            <p className="antt-sidebar__role">{estado.acesso.pode_editar ? "Perfil: administrador (leitura e edição)" : "Perfil: consulta (somente leitura)"}</p>
          )}
        </aside>
        <section className="antt-content">
          <AnttContext.Provider value={ctx}>{conteudo}</AnttContext.Provider>
        </section>
      </main>
      <Footer />
    </div>
  );
}
