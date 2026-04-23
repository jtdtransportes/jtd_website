import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import {
  getProfile,
  updateProfile,
  changePassword,
  getUsers,
  uploadContracheque,
  getMyContracheques,
  getAllUsers,
  deactivateUserByAdmin,
  activateUserByAdmin,
  getAllContrachequesForAdmin,
  removeContrachequeByAdmin,
} from "../../services/authService";
import "./Profile.css";

const API_URL = "https://jtd-website.onrender.com/api/contracheques";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("perfil");
  const [searchColaborador, setSearchColaborador] = useState("");
  const [searchUsuario, setSearchUsuario] = useState("");
  const [users, setUsers] = useState([]);
  const [uploadData, setUploadData] = useState({
    user_id: "",
    ano: "",
    mes: "",
    contracheque: null,
  });
  const [contracheques, setContracheques] = useState([]);
  const [allContracheques, setAllContracheques] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: "",
    telefone: "",
    sexo: "",
    data_nascimento: "",
  });

  const meses = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => String(anoAtual - 2 + i));

  const mesesNomes = {
    1: "Janeiro",
    2: "Fevereiro",
    3: "Março",
    4: "Abril",
    5: "Maio",
    6: "Junho",
    7: "Julho",
    8: "Agosto",
    9: "Setembro",
    10: "Outubro",
    11: "Novembro",
    12: "Dezembro",
  };

  async function reloadUsersData(token) {
    const usersResult = await getUsers(token);
    if (usersResult.ok) {
      setUsers(usersResult.users || []);
    }
  }

  async function reloadMyContrachequesData(token) {
    const contrachequesResult = await getMyContracheques(token);
    if (contrachequesResult.ok) {
      setContracheques(contrachequesResult.contracheques || []);
    }
  }

  async function reloadAdminUsersData(token) {
    const allUsersResult = await getAllUsers(token);
    if (allUsersResult.ok) {
      setAllUsers(allUsersResult.users || []);
    }
  }

  async function reloadAdminContrachequesData(token) {
    const allContrachequesResult = await getAllContrachequesForAdmin(token);
    if (allContrachequesResult.ok) {
      setAllContracheques(allContrachequesResult.contracheques || []);
    }
  }

  async function refreshTabData(tab = activeTab) {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (tab === "contracheque") {
      await reloadMyContrachequesData(token);
      return;
    }

    if (tab === "enviar-contracheque") {
      await reloadUsersData(token);
      await reloadMyContrachequesData(token);

      if (user?.role === "admin") {
        await reloadAdminContrachequesData(token);
      }
      return;
    }

    if (tab === "remover-contracheque" && user?.role === "admin") {
      await reloadAdminContrachequesData(token);
      return;
    }

    if (tab === "editar-usuarios" && user?.role === "admin") {
      await reloadAdminUsersData(token);
      return;
    }
  }

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      const result = await getProfile(token);

      if (!result.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      setUser(result.user);
      setFormData({
        nome: result.user.nome || "",
        email: result.user.email || "",
        cpf: result.user.cpf || "",
        telefone: result.user.telefone || "",
        sexo: result.user.sexo || "",
        data_nascimento: result.user.data_nascimento
          ? String(result.user.data_nascimento).slice(0, 10)
          : "",
      });

      await reloadUsersData(token);
      await reloadMyContrachequesData(token);

      if (result.user.role === "admin") {
        await reloadAdminUsersData(token);
        await reloadAdminContrachequesData(token);
      }
    }

    loadProfile();
  }, [navigate]);



  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  async function changeTab(tab) {
    setMessage("");
    setActiveTab(tab);

    const token = localStorage.getItem("token");
    if (!token) return;

    if (tab === "contracheque") {
      await reloadMyContrachequesData(token);
    }

    if (tab === "enviar-contracheque") {
      await reloadUsersData(token);
    }

    if (tab === "remover-contracheque" && user?.role === "admin") {
      await reloadAdminContrachequesData(token);
    }

    if (tab === "editar-usuarios" && user?.role === "admin") {
      await reloadAdminUsersData(token);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "cpf") return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSave() {
    const token = localStorage.getItem("token");

    const result = await updateProfile(token, {
      nome: formData.nome,
      email: formData.email,
      telefone: formData.telefone,
      sexo: formData.sexo,
      data_nascimento: formData.data_nascimento,
    });

    if (!result.ok) {
      setMessage(result.message || "Erro ao atualizar perfil.");
      return;
    }

    setUser(result.user);
    localStorage.setItem("user", JSON.stringify(result.user));
    setMessage("Perfil atualizado com sucesso.");
    setEditing(false);
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target;

    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleChangePassword() {
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmNewPassword
    ) {
      setMessage("Preencha todos os campos da senha.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setMessage("A confirmação da nova senha não confere.");
      return;
    }

    const token = localStorage.getItem("token");

    const result = await changePassword(token, {
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
      confirmNewPassword: passwordData.confirmNewPassword,
    });

    if (!result.ok) {
      setMessage(result.message || "Erro ao atualizar a senha.");
      return;
    }

    setMessage("Senha atualizada com sucesso.");
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
  }

  function handleUploadChange(e) {
    const { name, value, files } = e.target;

    if (name === "contracheque") {
      setUploadData((prev) => ({
        ...prev,
        contracheque: files[0] || null,
      }));
      return;
    }

    setUploadData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleUploadContracheque() {
    const token = localStorage.getItem("token");

    if (
      !uploadData.user_id ||
      !uploadData.ano ||
      !uploadData.mes ||
      !uploadData.contracheque
    ) {
      setMessage("Selecione o usuário, o ano, o mês e o arquivo PDF.");
      return;
    }

    const userIdSelecionado = Number(uploadData.user_id);

    const form = new FormData();
    form.append("user_id", uploadData.user_id);
    form.append("ano", uploadData.ano);
    form.append("mes", uploadData.mes);
    form.append("contracheque", uploadData.contracheque);

    const result = await uploadContracheque(token, form);

    if (!result.ok) {
      setMessage(result.message || "Erro ao enviar contracheque.");
      return;
    }

    const novoContracheque = result.contracheque;

    setMessage("Contracheque enviado com sucesso.");
    setUploadData({
      user_id: "",
      ano: "",
      mes: "",
      contracheque: null,
    });

    if (novoContracheque) {
      if (Number(user?.id) === userIdSelecionado) {
        setContracheques((prev) => [novoContracheque, ...prev]);
      }

      if (user?.role === "admin") {
        const itemAdmin = {
          ...novoContracheque,
          user_nome:
            users.find((u) => Number(u.id) === userIdSelecionado)?.nome || "",
          user_email:
            users.find((u) => Number(u.id) === userIdSelecionado)?.email || "",
          user_cpf:
            users.find((u) => Number(u.id) === userIdSelecionado)?.cpf || "",
        };

        setAllContracheques((prev) => [itemAdmin, ...prev]);
      }
    } else {
      await reloadMyContrachequesData(token);

      if (user?.role === "admin") {
        await reloadAdminContrachequesData(token);
      }
    }
  }

  const contrachequesSeguros = Array.isArray(contracheques)
    ? contracheques.filter(
      (item) =>
        item &&
        item.id != null &&
        item.ano != null &&
        item.mes != null
    )
    : [];

  const contrachequesAgrupados = contrachequesSeguros.reduce((acc, item) => {
    const ano = String(item.ano);
    const mes = String(item.mes);

    if (!acc[ano]) acc[ano] = {};
    if (!acc[ano][mes]) acc[ano][mes] = [];

    acc[ano][mes].push(item);
    return acc;
  }, {});

  async function handleAdminDeactivateUser(userId) {
    const confirmAction = window.confirm(
      "Tem certeza que deseja desativar este usuário?"
    );

    if (!confirmAction) return;

    const token = localStorage.getItem("token");
    const result = await deactivateUserByAdmin(token, userId);

    if (!result.ok) {
      setMessage(result.message || "Erro ao desativar usuário.");
      return;
    }

    setMessage("Usuário desativado com sucesso.");
    await reloadAdminUsersData(token);
  }

  async function handleRemoveContracheque(contrachequeId) {
    const confirmAction = window.confirm(
      "Tem certeza que deseja remover este contracheque?"
    );

    if (!confirmAction) return;

    const token = localStorage.getItem("token");
    const result = await removeContrachequeByAdmin(token, contrachequeId);

    if (!result.ok) {
      setMessage(result.message || "Erro ao remover contracheque.");
      return;
    }

    setMessage("Contracheque removido com sucesso.");

    setAllContracheques((prev) =>
      prev.filter((item) => Number(item.id) !== Number(contrachequeId))
    );

    setContracheques((prev) =>
      prev.filter((item) => Number(item.id) !== Number(contrachequeId))
    );
  }

  async function handleAdminActivateUser(userId) {
    const confirmAction = window.confirm("Deseja reativar este usuário?");

    if (!confirmAction) return;

    const token = localStorage.getItem("token");
    const result = await activateUserByAdmin(token, userId);

    if (!result.ok) {
      setMessage(result.message || "Erro ao ativar usuário.");
      return;
    }

    setMessage("Usuário ativado com sucesso.");
    await reloadAdminUsersData(token);
  }

  const contrachequesAdminAgrupados = allContracheques.reduce((acc, item) => {
    const userKey = `${item.user_id}`;
    const userNome = item.user_nome || "Usuário";
    const ano = String(item.ano);
    const mes = String(item.mes);

    if (!acc[userKey]) {
      acc[userKey] = {
        user_id: item.user_id,
        user_nome: userNome,
        user_email: item.user_email,
        user_cpf: item.user_cpf,
        anos: {},
      };
    }

    if (!acc[userKey].anos[ano]) {
      acc[userKey].anos[ano] = {};
    }

    if (!acc[userKey].anos[ano][mes]) {
      acc[userKey].anos[ano][mes] = [];
    }

    acc[userKey].anos[ano][mes].push(item);

    return acc;
  }, {});

  const contrachequesAdminFiltrados = Object.values(
    contrachequesAdminAgrupados
  ).filter((usuario) =>
    usuario.user_nome
      ?.toLowerCase()
      .includes(searchColaborador.toLowerCase().trim())
  );

  const allUsersFiltrados = allUsers.filter((item) =>
    item.nome?.toLowerCase().includes(searchUsuario.toLowerCase().trim())
  );

  async function handleDownloadContracheque(id) {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Usuário não autenticado.");
        return;
      }

      const response = await fetch(`${API_URL}/${id}/download`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorMessage = "Erro ao baixar contracheque.";

        try {
          const errorData = await response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch { }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const fileURL = window.URL.createObjectURL(blob);

      let fileName = "contracheque.pdf";
      const disposition = response.headers.get("content-disposition");

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const link = document.createElement("a");
      link.href = fileURL;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(fileURL);
    } catch (error) {
      console.error("Erro ao baixar contracheque:", error);
      alert(error.message || "Erro ao baixar contracheque.");
    }
  }

  return (
    <>
      <Header />

      <main className="profile-page">
        <aside className="profile-sidebar">
          <button className="sidebar-title" onClick={() => changeTab("perfil")}>
            Perfil
          </button>

          <br />

          <button
            className="sidebar-title"
            onClick={() => changeTab("contracheque")}
          >
            Baixar Contracheque
          </button>
          <br />

          <button className="sidebar-title" onClick={() => changeTab("senha")}>
            Alterar Senha
          </button>

          <br />

          {user?.role === "admin" && (
            <>
              <button
                className="sidebar-title"
                onClick={() => changeTab("enviar-contracheque")}
              >
                Adicionar Contracheque
              </button>

              <button
                className="sidebar-title"
                onClick={() => changeTab("remover-contracheque")}
              >
                Remover Contracheque
              </button>
              <br />

              <button
                className="sidebar-title"
                onClick={() => changeTab("editar-usuarios")}
              >
                Desativar/Ativar Usuários
              </button>
              <br />
            </>
          )}
        </aside>

        <section className="profile-content">
          <div className="profile-header">
            <h2>Olá {user?.nome || "Usuário"}</h2>
          </div>

          <div className="profile-box">
            {activeTab === "enviar-contracheque" && user?.role === "admin" && (
              <div className="upload-section">
                <h3>Adicionar Contracheque</h3>

                <div className="profile-form">
                  <label>
                    Usuário
                    <select
                      name="user_id"
                      value={uploadData.user_id}
                      onChange={handleUploadChange}
                    >
                      <option value="">Selecione um usuário</option>
                      {users.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Ano de competência
                    <select
                      name="ano"
                      value={uploadData.ano}
                      onChange={handleUploadChange}
                    >
                      <option value="">Selecione o ano</option>
                      {anos.map((ano) => (
                        <option key={ano} value={ano}>
                          {ano}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Mês de referência
                    <select
                      name="mes"
                      value={uploadData.mes}
                      onChange={handleUploadChange}
                    >
                      <option value="">Selecione o mês</option>
                      {meses.map((mes) => (
                        <option key={mes.value} value={mes.value}>
                          {mes.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Arquivo PDF
                    <input
                      type="file"
                      name="contracheque"
                      accept="application/pdf"
                      onChange={handleUploadChange}
                    />
                  </label>
                </div>

                <button
                  className="action-button password-save-button"
                  onClick={handleUploadContracheque}
                >
                  Adicionar Contracheque
                </button>
              </div>
            )}

            {activeTab === "editar-usuarios" && user?.role === "admin" && (
              <div className="admin-users-section">
                <h3>Desativar/Ativar Usuários</h3>

                <input
                  type="text"
                  placeholder="Pesquisar usuário"
                  className="search-colaborador-input"
                  value={searchUsuario}
                  onChange={(e) => setSearchUsuario(e.target.value)}
                />

                {allUsers.length === 0 ? (
                  <p>Nenhum usuário encontrado.</p>
                ) : allUsersFiltrados.length === 0 ? (
                  <p>Nenhum usuário encontrado com esse nome.</p>
                ) : (
                  <div className="admin-users-list">
                    {allUsersFiltrados.map((item) => (
                      <div key={item.id} className="admin-user-card">
                        <div className="admin-user-info">
                          <p><strong>Nome:</strong> {item.nome}</p>
                          <p><strong>Email:</strong> {item.email}</p>
                          <p><strong>CPF:</strong> {item.cpf}</p>
                          <p>
                            <strong>Status:</strong>{" "}
                            {Number(item.is_active) === 1 ? "Ativo" : "Inativo"}
                          </p>
                        </div>

                        {Number(item.is_active) === 1 ? (
                          <button
                            className="danger-button"
                            onClick={() => handleAdminDeactivateUser(item.id)}
                          >
                            Desativar usuário
                          </button>
                        ) : (
                          <button
                            className="success-button"
                            onClick={() => handleAdminActivateUser(item.id)}
                          >
                            Ativar usuário
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "remover-contracheque" && user?.role === "admin" && (
              <div className="admin-contracheque-section">
                <h3>Remover Contracheque</h3>

                <input
                  type="text"
                  placeholder="Pesquisar colaborador"
                  className="search-colaborador-input"
                  value={searchColaborador}
                  onChange={(e) => setSearchColaborador(e.target.value)}
                />

                {allContracheques.length === 0 ? (
                  <p>Nenhum contracheque encontrado.</p>
                ) : contrachequesAdminFiltrados.length === 0 ? (
                  <p>Nenhum colaborador encontrado.</p>
                ) : (
                  contrachequesAdminFiltrados.map((usuario) => (
                    <div
                      key={usuario.user_id}
                      className="admin-contracheque-user-block"
                    >
                      <h4>{usuario.user_nome}</h4>
                      <p><strong>Email:</strong> {usuario.user_email}</p>
                      <p><strong>CPF:</strong> {usuario.user_cpf}</p>

                      {Object.keys(usuario.anos)
                        .sort((a, b) => Number(b) - Number(a))
                        .map((ano) => (
                          <div
                            key={`${usuario.user_id}-${ano}`}
                            className="admin-contracheque-year-block"
                          >
                            <h5>{ano}</h5>

                            {Object.keys(usuario.anos[ano])
                              .sort((a, b) => Number(b) - Number(a))
                              .map((mes) => (
                                <div
                                  key={`${usuario.user_id}-${ano}-${mes}`}
                                  className="admin-contracheque-month-block"
                                >
                                  <h6>{mesesNomes[Number(mes)]}</h6>

                                  <div className="admin-contracheque-list">
                                    {usuario.anos[ano][mes].map((item) => (
                                      <div
                                        key={item.id}
                                        className="admin-contracheque-card"
                                      >
                                        <span>{item.file_name}</span>

                                        <div className="admin-contracheque-actions">
                                          <button
                                            className="download-button"
                                            onClick={() =>
                                              handleDownloadContracheque(item.id)
                                            }
                                          >
                                            Baixar
                                          </button>

                                          <button
                                            className="danger-button"
                                            onClick={() =>
                                              handleRemoveContracheque(item.id)
                                            }
                                          >
                                            Remover
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "senha" && (
              <div className="password-section">
                <h3>Alterar Senha</h3>

                <div className="profile-form">
                  <label>
                    Senha atual
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Digite sua senha atual"
                    />
                  </label>

                  <label>
                    Nova senha
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Digite a nova senha"
                    />
                  </label>

                  <label>
                    Confirmar nova senha
                    <input
                      type="password"
                      name="confirmNewPassword"
                      value={passwordData.confirmNewPassword}
                      onChange={handlePasswordChange}
                      placeholder="Confirme a nova senha"
                    />
                  </label>
                </div>

                <button
                  className="action-button password-save-button"
                  onClick={handleChangePassword}
                >
                  Atualizar senha
                </button>
              </div>
            )}

            {activeTab === "perfil" && (
              <>
                <div className="profile-actions">
                  {!editing ? (
                    <button
                      className="action-button"
                      onClick={() => {
                        setEditing(true);
                        setMessage("");
                      }}
                    >
                      Editar dados
                    </button>
                  ) : (
                    <button className="action-button" onClick={handleSave}>
                      Salvar alterações
                    </button>
                  )}
                </div>

                <div className="profile-form">
                  <label>
                    Nome
                    <input
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleChange}
                      disabled={!editing}
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!editing}
                    />
                  </label>

                  <label>
                    CPF
                    <input
                      type="text"
                      name="cpf"
                      value={formData.cpf}
                      disabled
                    />
                  </label>

                  <label>
                    Telefone
                    <input
                      type="text"
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleChange}
                      disabled={!editing}
                    />
                  </label>

                  <label>
                    Sexo
                    <select
                      name="sexo"
                      value={formData.sexo}
                      onChange={handleChange}
                      disabled={!editing}
                    >
                      <option value="">Selecione</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="outro">Outro</option>
                      <option value="prefiro_nao_informar">
                        Prefiro não informar
                      </option>
                    </select>
                  </label>

                  <label>
                    Data de nascimento
                    <input
                      type="date"
                      name="data_nascimento"
                      value={formData.data_nascimento}
                      onChange={handleChange}
                      disabled={!editing}
                    />
                  </label>
                </div>
              </>
            )}

            {activeTab === "contracheque" && (
              <div className="contracheque-section">
                <h3>Baixar Contracheque</h3>

                {contrachequesSeguros.length === 0 ? (
                  <p>Nenhum contracheque disponível.</p>
                ) : (
                  Object.keys(contrachequesAgrupados)
                    .sort((a, b) => Number(b) - Number(a))
                    .map((ano) => (
                      <div key={ano} className="contracheque-year-block">
                        <h4>{ano}</h4>

                        {Object.keys(contrachequesAgrupados[ano])
                          .sort((a, b) => Number(b) - Number(a))
                          .map((mes) => (
                            <div
                              key={`${ano}-${mes}`}
                              className="contracheque-month-block"
                            >
                              <h5>{mesesNomes[Number(mes)] || `Mês ${mes}`}</h5>

                              <div className="contracheque-list">
                                {contrachequesAgrupados[ano][mes].map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className="contracheque-link"
                                    onClick={() =>
                                      handleDownloadContracheque(item.id)
                                    }
                                  >
                                    Baixar{" "}
                                    {mesesNomes[Number(item.mes)] || item.mes}/
                                    {item.ano}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    ))
                )}
              </div>
            )}

            {message && <p className="profile-message">{message}</p>}

            <button className="logout-button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}