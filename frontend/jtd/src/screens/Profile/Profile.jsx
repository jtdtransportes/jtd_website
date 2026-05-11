import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { fixMojibake, normalizePopText } from "../../utils/textEncoding";
import {
  getProfile,
  updateProfile,
  changePassword,
  getUsers,
  uploadContracheque,
  getMyContracheques,
  deactivateUserByAdmin,
  activateUserByAdmin,
  getAllContrachequesForAdmin,
  removeContrachequeByAdmin,
  getMyPops,
  uploadPop,
  getAllPopsForAdmin,
  removePopByAdmin,
} from "../../services/authService";
import "./Profile.css";

// aqui estava o código como era antes:
const API_BASE_URL = "https://jtd-website.onrender.com";
// const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000";
const API_URL = `${API_BASE_URL}/api/contracheques`;
const POPS_API_URL = `${API_BASE_URL}/api/pops`;
const SECTORS_API_URL = `${API_BASE_URL}/api/sectors`;

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("perfil");
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingContracheque, setUploadingContracheque] = useState(false);
  const [uploadingPop, setUploadingPop] = useState(false);
  const [updatingPopSector, setUpdatingPopSector] = useState(false);

  const [searchColaborador, setSearchColaborador] = useState("");
  const [searchUsuario, setSearchUsuario] = useState("");
  const [searchSector, setSearchSector] = useState("");
  const [searchPop, setSearchPop] = useState("");

  const [selectedUserSectorFilter, setSelectedUserSectorFilter] =
    useState("todos");
  const [selectedUploadSectorFilter, setSelectedUploadSectorFilter] =
    useState("todos");
  const [selectedRemoveSectorFilter, setSelectedRemoveSectorFilter] =
    useState("todos");
  const [selectedRemovePopSectorFilter, setSelectedRemovePopSectorFilter] =
    useState("todos");

  const [users, setUsers] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [sectors, setSectors] = useState([]);
  const [sectorDescricao, setSectorDescricao] = useState("");
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [editingSectorDescricao, setEditingSectorDescricao] = useState("");

  const [editingUserSectorId, setEditingUserSectorId] = useState(null);
  const [selectedUserSectorId, setSelectedUserSectorId] = useState("");

  const [uploadData, setUploadData] = useState({
    user_id: "",
    ano: "",
    mes: "",
    contracheque: null,
  });

  const [popUploadData, setPopUploadData] = useState({
    sector_id: "",
    pop: null,
  });

  const [contracheques, setContracheques] = useState([]);
  const [allContracheques, setAllContracheques] = useState([]);
  const [pops, setPops] = useState([]);
  const [allPops, setAllPops] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const downloadingContrachequeIdsRef = useRef(new Set());
  const [downloadingContrachequeIds, setDownloadingContrachequeIds] = useState([]);
  const downloadingPopIdsRef = useRef(new Set());
  const [downloadingPopIds, setDownloadingPopIds] = useState([]);
  const [selectedPopSectorId, setSelectedPopSectorId] = useState("");

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
    sector_id: "",
    setor: "",
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

  const showError = useCallback((text) => {
    setMessageType("error");
    setMessage(text);
  }, []);

  const showSuccess = useCallback((text) => {
    setMessageType("success");
    setMessage(text);
  }, []);

  const clearMessage = useCallback(() => {
    setMessage("");
    setMessageType("");
  }, []);

  const getSectorDisplayName = useCallback((sector) => {
    if (!sector) return "Sem setor";
    return fixMojibake(
      sector.name || sector.descricao || sector.sector_name || "Sem setor"
    );
  }, []);

  const getSectorNameFromUser = useCallback(
    (userData, sectorsList = []) => {
      if (!userData) return "Sem setor";

      if (userData.sector_name) return fixMojibake(userData.sector_name);
      if (userData.setor) return fixMojibake(userData.setor);

      if (userData.sector?.name) return fixMojibake(userData.sector.name);
      if (userData.sector?.descricao) return fixMojibake(userData.sector.descricao);

      if (userData.sector_id) {
        const foundSector = sectorsList.find(
          (sector) => Number(sector.id) === Number(userData.sector_id)
        );

        if (foundSector) return getSectorDisplayName(foundSector);
      }

      return "Sem setor";
    },
    [getSectorDisplayName]
  );

  const getSectorIdFromUser = useCallback(
    (userData, sectorsList = []) => {
      if (!userData) return "";

      if (
        userData.sector_id !== null &&
        userData.sector_id !== undefined &&
        userData.sector_id !== ""
      ) {
        return String(userData.sector_id);
      }

      const sectorName =
        userData.sector_name ||
        userData.setor ||
        userData.sector?.name ||
        userData.sector?.descricao ||
        "";

      if (!sectorName) return "";

      const foundSector = sectorsList.find(
        (sector) =>
          getSectorDisplayName(sector).toLowerCase() ===
          String(sectorName).toLowerCase()
      );

      return foundSector ? String(foundSector.id) : "";
    },
    [getSectorDisplayName]
  );

  const reloadUsersData = useCallback(async (token) => {
    const usersResult = await getUsers(token);
    if (usersResult.ok) setUsers(usersResult.users || []);
  }, []);

  const reloadMyContrachequesData = useCallback(async (token) => {
    const result = await getMyContracheques(token);
    if (result.ok) setContracheques(result.contracheques || []);
  }, []);

  const reloadMyPopsData = useCallback(async (token) => {
    const result = await getMyPops(token);
    if (result.ok) setPops((result.pops || []).map(normalizePopText));
  }, []);

  const reloadAdminUsersData = useCallback(
    async (token) => {
      try {
        const response = await fetch(`${SECTORS_API_URL}/users`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (result.ok) {
          setAllUsers(result.users || []);
        } else {
          showError(result.message || "Erro ao carregar usuários.");
        }
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        showError("Erro ao carregar usuários.");
      }
    },
    [showError]
  );

  const reloadAdminContrachequesData = useCallback(async (token) => {
    const result = await getAllContrachequesForAdmin(token);
    if (result.ok) setAllContracheques(result.contracheques || []);
  }, []);

  const reloadAdminPopsData = useCallback(async (token) => {
    const result = await getAllPopsForAdmin(token);
    if (result.ok) setAllPops((result.pops || []).map(normalizePopText));
  }, []);

  const reloadSectorsData = useCallback(
    async (token) => {
      try {
        const response = await fetch(SECTORS_API_URL, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (result.ok) {
          setSectors(result.sectors || []);
          return result.sectors || [];
        }

        showError(result.message || "Erro ao carregar setores.");
        return [];
      } catch (error) {
        console.error("Erro ao carregar setores:", error);
        showError("Erro ao carregar setores.");
        return [];
      }
    },
    [showError]
  );

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

      const loadedSectors = await reloadSectorsData(token);
      const setorNome = getSectorNameFromUser(result.user, loadedSectors);
      const setorId = getSectorIdFromUser(result.user, loadedSectors);

      setUser(result.user);
      setSelectedPopSectorId(setorId);

      setFormData({
        nome: result.user.nome || "",
        email: result.user.email || "",
        cpf: result.user.cpf || "",
        telefone: result.user.telefone || "",
        sexo: result.user.sexo || "",
        data_nascimento: result.user.data_nascimento
          ? String(result.user.data_nascimento).slice(0, 10)
          : "",
        sector_id: setorId,
        setor: setorNome,
      });

      await reloadUsersData(token);
      await reloadMyContrachequesData(token);
      await reloadMyPopsData(token);

      if (result.user.role === "admin") {
        await reloadAdminUsersData(token);
        await reloadAdminContrachequesData(token);
        await reloadAdminPopsData(token);
      }
    }

    loadProfile();
  }, [
    navigate,
    getSectorIdFromUser,
    getSectorNameFromUser,
    reloadUsersData,
    reloadMyContrachequesData,
    reloadMyPopsData,
    reloadAdminUsersData,
    reloadAdminContrachequesData,
    reloadAdminPopsData,
    reloadSectorsData,
  ]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) setMobileMenuOpen(false);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  function handleOpenTicket() {
    setMobileMenuOpen(false);
    window.location.assign("https://deskio.site");
  }

  async function changeTab(tab) {
    clearMessage();
    setActiveTab(tab);
    setMobileMenuOpen(false);

    const token = localStorage.getItem("token");
    if (!token) return;

    if (tab === "contracheque") await reloadMyContrachequesData(token);

    if (tab === "pop") {
      await reloadSectorsData(token);
      await reloadMyPopsData(token);
    }

    if (tab === "enviar-contracheque" && user?.role === "admin") {
      await reloadSectorsData(token);
      await reloadAdminUsersData(token);
      await reloadUsersData(token);
    }

    if (tab === "remover-contracheque" && user?.role === "admin") {
      await reloadSectorsData(token);
      await reloadAdminUsersData(token);
      await reloadAdminContrachequesData(token);
    }

    if (tab === "editar-usuarios" && user?.role === "admin") {
      await reloadSectorsData(token);
      await reloadAdminUsersData(token);
    }

    if (tab === "gerenciar-setores" && user?.role === "admin") {
      await reloadSectorsData(token);
    }

    if (tab === "adicionar-pop" && user?.role === "admin") {
      await reloadSectorsData(token);
    }

    if (tab === "remover-pop" && user?.role === "admin") {
      await reloadSectorsData(token);
      await reloadAdminPopsData(token);
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
    if (savingProfile) {
      return;
    }

    const token = localStorage.getItem("token");

    setSavingProfile(true);

    try {
      const result = await updateProfile(token, {
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        sexo: formData.sexo,
        data_nascimento: formData.data_nascimento,
        sector_id: formData.sector_id ? Number(formData.sector_id) : null,
      });

      if (!result.ok) {
        showError(result.message || "Erro ao atualizar perfil.");
        return;
      }

      let loadedSectors = sectors;

      if (!loadedSectors.length) {
        loadedSectors = await reloadSectorsData(token);
      }

      const setorNome = getSectorNameFromUser(result.user, loadedSectors);
      const setorId = getSectorIdFromUser(result.user, loadedSectors);

      setUser(result.user);
      setSelectedPopSectorId(setorId);
      localStorage.setItem("user", JSON.stringify(result.user));

      setFormData({
        nome: result.user.nome || "",
        email: result.user.email || "",
        cpf: result.user.cpf || "",
        telefone: result.user.telefone || "",
        sexo: result.user.sexo || "",
        data_nascimento: result.user.data_nascimento
          ? String(result.user.data_nascimento).slice(0, 10)
          : "",
        sector_id: setorId,
        setor: setorNome,
      });

      showSuccess("Perfil atualizado com sucesso.");
      setEditing(false);

      if (activeTab === "pop") {
        await reloadMyPopsData(token);
      }
    } finally {
      setSavingProfile(false);
    }
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target;

    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleChangePassword() {
    if (changingPassword) {
      return;
    }

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmNewPassword
    ) {
      showError("Preencha todos os campos da senha.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      showError("A confirmação da nova senha não confere.");
      return;
    }

    const token = localStorage.getItem("token");

    setChangingPassword(true);

    try {
      const result = await changePassword(token, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmNewPassword: passwordData.confirmNewPassword,
      });

      if (!result.ok) {
        showError(result.message || "Erro ao atualizar a senha.");
        return;
      }

      showSuccess("Senha atualizada com sucesso.");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    } finally {
      setChangingPassword(false);
    }
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
    if (uploadingContracheque) {
      return;
    }

    const token = localStorage.getItem("token");

    if (
      !uploadData.user_id ||
      !uploadData.ano ||
      !uploadData.mes ||
      !uploadData.contracheque
    ) {
      showError("Selecione o usuário, o ano, o mês e o arquivo PDF.");
      return;
    }

    const userIdSelecionado = Number(uploadData.user_id);

    const form = new FormData();
    form.append("user_id", uploadData.user_id);
    form.append("ano", uploadData.ano);
    form.append("mes", uploadData.mes);
    form.append("contracheque", uploadData.contracheque);

    setUploadingContracheque(true);

    try {
      const result = await uploadContracheque(token, form);

      if (!result.ok) {
        showError(result.message || "Erro ao enviar contracheque.");
        return;
      }

      const novoContracheque = result.contracheque;

      showSuccess("Contracheque enviado com sucesso.");
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
          const usuarioSelecionado =
            allUsers.find((u) => Number(u.id) === userIdSelecionado) ||
            users.find((u) => Number(u.id) === userIdSelecionado);

          const itemAdmin = {
            ...novoContracheque,
            user_nome: usuarioSelecionado?.nome || "",
            user_email: usuarioSelecionado?.email || "",
            user_cpf: usuarioSelecionado?.cpf || "",
            sector_id: usuarioSelecionado?.sector_id || null,
            sector_name: getSectorNameFromUser(usuarioSelecionado, sectors),
          };

          setAllContracheques((prev) => [itemAdmin, ...prev]);
        }
      } else {
        await reloadMyContrachequesData(token);

        if (user?.role === "admin") {
          await reloadAdminContrachequesData(token);
        }
      }
    } finally {
      setUploadingContracheque(false);
    }
  }

  function handlePopUploadChange(e) {
    const { name, value, files } = e.target;

    if (name === "pop") {
      setPopUploadData((prev) => ({
        ...prev,
        pop: files[0] || null,
      }));
      return;
    }

    setPopUploadData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleUploadPop() {
    if (uploadingPop) {
      return;
    }

    if (!popUploadData.sector_id || !popUploadData.pop) {
      showError("Selecione o setor e escolha o PDF do POP.");
      return;
    }

    const token = localStorage.getItem("token");
    const form = new FormData();
    form.append("sector_id", popUploadData.sector_id);
    form.append("pop", popUploadData.pop);

    setUploadingPop(true);

    try {
      const result = await uploadPop(token, form);

      if (!result.ok) {
        showError(result.message || "Erro ao enviar POP.");
        return;
      }

      showSuccess("POP enviado com sucesso.");
      setPopUploadData({
        sector_id: "",
        pop: null,
      });

      if (result.pop) {
        const normalizedPop = normalizePopText(result.pop);

        setAllPops((prev) => [normalizedPop, ...prev]);

        if (Number(normalizedPop.sector_id) === Number(user?.sector_id)) {
          setPops((prev) => [normalizedPop, ...prev]);
        }
      } else {
        await reloadAdminPopsData(token);
        await reloadMyPopsData(token);
      }
    } finally {
      setUploadingPop(false);
    }
  }

  async function handleSavePopSector() {
    if (updatingPopSector) {
      return;
    }

    if (!selectedPopSectorId) {
      showError("Selecione seu setor para consultar os POPs disponiveis.");
      return;
    }

    const token = localStorage.getItem("token");
    setUpdatingPopSector(true);

    try {
      const result = await updateProfile(token, {
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        sexo: formData.sexo,
        data_nascimento: formData.data_nascimento,
        sector_id: Number(selectedPopSectorId),
      });

      if (!result.ok) {
        showError(result.message || "Erro ao atualizar setor.");
        return;
      }

      const setorNome = getSectorNameFromUser(result.user, sectors);
      const setorId = getSectorIdFromUser(result.user, sectors);

      setUser(result.user);
      setSelectedPopSectorId(setorId);
      setFormData((prev) => ({
        ...prev,
        sector_id: setorId,
        setor: setorNome,
      }));
      localStorage.setItem("user", JSON.stringify(result.user));

      showSuccess("Setor atualizado com sucesso.");
      await reloadMyPopsData(token);
    } finally {
      setUpdatingPopSector(false);
    }
  }

  const contrachequesSeguros = Array.isArray(contracheques)
    ? contracheques.filter(
        (item) => item && item.id != null && item.ano != null && item.mes != null
      )
    : [];

  const popsSeguros = Array.isArray(pops)
    ? pops.filter((item) => item && item.id != null)
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
      showError(result.message || "Erro ao desativar usuário.");
      return;
    }

    showSuccess("Usuário desativado com sucesso.");
    await reloadAdminUsersData(token);
  }

  async function handleAdminActivateUser(userId) {
    const confirmAction = window.confirm("Deseja reativar este usuário?");

    if (!confirmAction) return;

    const token = localStorage.getItem("token");
    const result = await activateUserByAdmin(token, userId);

    if (!result.ok) {
      showError(result.message || "Erro ao ativar usuário.");
      return;
    }

    showSuccess("Usuário ativado com sucesso.");
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
      showError(result.message || "Erro ao remover contracheque.");
      return;
    }

    showSuccess("Contracheque removido com sucesso.");

    setAllContracheques((prev) =>
      prev.filter((item) => Number(item.id) !== Number(contrachequeId))
    );

    setContracheques((prev) =>
      prev.filter((item) => Number(item.id) !== Number(contrachequeId))
    );
  }

  async function handleRemovePop(popId) {
    const confirmAction = window.confirm("Tem certeza que deseja remover este POP?");

    if (!confirmAction) return;

    const token = localStorage.getItem("token");
    const result = await removePopByAdmin(token, popId);

    if (!result.ok) {
      showError(result.message || "Erro ao remover POP.");
      return;
    }

    showSuccess("POP removido com sucesso.");

    setAllPops((prev) => prev.filter((item) => Number(item.id) !== Number(popId)));
    setPops((prev) => prev.filter((item) => Number(item.id) !== Number(popId)));
  }

  async function handleCreateSector() {
    const token = localStorage.getItem("token");

    if (!sectorDescricao.trim()) {
      showError("Informe o nome do setor.");
      return;
    }

    try {
      const response = await fetch(SECTORS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: sectorDescricao.trim(),
          descricao: sectorDescricao.trim(),
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        showError(result.message || "Erro ao criar setor.");
        return;
      }

      showSuccess("Setor criado com sucesso.");
      setSectorDescricao("");
      await reloadSectorsData(token);
    } catch (error) {
      console.error("Erro ao criar setor:", error);
      showError("Erro ao criar setor.");
    }
  }

  function handleStartEditSector(sector) {
    setEditingSectorId(sector.id);
    setEditingSectorDescricao(getSectorDisplayName(sector));
    clearMessage();
  }

  function handleCancelEditSector() {
    setEditingSectorId(null);
    setEditingSectorDescricao("");
    clearMessage();
  }

  async function handleUpdateSector(sectorId) {
    const token = localStorage.getItem("token");

    if (!editingSectorDescricao.trim()) {
      showError("Informe o nome do setor.");
      return;
    }

    try {
      const response = await fetch(`${SECTORS_API_URL}/${sectorId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editingSectorDescricao.trim(),
          descricao: editingSectorDescricao.trim(),
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        showError(result.message || "Erro ao atualizar setor.");
        return;
      }

      showSuccess("Setor atualizado com sucesso.");
      setEditingSectorId(null);
      setEditingSectorDescricao("");
      await reloadSectorsData(token);
      await reloadAdminUsersData(token);
    } catch (error) {
      console.error("Erro ao atualizar setor:", error);
      showError("Erro ao atualizar setor.");
    }
  }

  async function handleDeleteSector(sectorId) {
    const confirmAction = window.confirm(
      "Tem certeza que deseja excluir este setor?"
    );

    if (!confirmAction) return;

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${SECTORS_API_URL}/${sectorId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!result.ok) {
        showError(result.message || "Erro ao excluir setor.");
        return;
      }

      showSuccess("Setor excluído com sucesso.");
      await reloadSectorsData(token);
      await reloadAdminUsersData(token);
    } catch (error) {
      console.error("Erro ao excluir setor:", error);
      showError("Erro ao excluir setor.");
    }
  }

  function handleStartEditUserSector(item) {
    setEditingUserSectorId(item.id);
    setSelectedUserSectorId(item.sector_id ? String(item.sector_id) : "");
    clearMessage();
  }

  function handleCancelEditUserSector() {
    setEditingUserSectorId(null);
    setSelectedUserSectorId("");
    clearMessage();
  }

  async function handleUpdateUserSector(userId) {
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${SECTORS_API_URL}/users/${userId}/sector`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sector_id: selectedUserSectorId ? Number(selectedUserSectorId) : null,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        showError(result.message || "Erro ao alterar setor do usuário.");
        return;
      }

      showSuccess("Setor do usuário atualizado com sucesso.");
      setEditingUserSectorId(null);
      setSelectedUserSectorId("");

      await reloadAdminUsersData(token);

      if (Number(user?.id) === Number(userId)) {
        const updatedProfile = await getProfile(token);

        if (updatedProfile.ok) {
          const sectorName = getSectorNameFromUser(updatedProfile.user, sectors);
          const sectorId = getSectorIdFromUser(updatedProfile.user, sectors);

          setUser(updatedProfile.user);
          setSelectedPopSectorId(sectorId);
          setFormData((prev) => ({
            ...prev,
            setor: sectorName,
            sector_id: sectorId,
          }));
          localStorage.setItem("user", JSON.stringify(updatedProfile.user));
          await reloadMyPopsData(token);
        }
      }
    } catch (error) {
      console.error("Erro ao alterar setor do usuário:", error);
      showError("Erro ao alterar setor do usuário.");
    }
  }

  function getUserSectorId(userId) {
    const foundUser = allUsers.find((item) => Number(item.id) === Number(userId));
    return foundUser?.sector_id || null;
  }

  function getUserSectorName(userId) {
    const foundUser = allUsers.find((item) => Number(item.id) === Number(userId));
    return getSectorNameFromUser(foundUser, sectors);
  }

  function userMatchesSectorFilter(item, selectedSector) {
    if (selectedSector === "todos") return true;
    if (selectedSector === "sem-setor") return !item.sector_id;
    return Number(item.sector_id) === Number(selectedSector);
  }

  function contrachequeMatchesSectorFilter(item, selectedSector) {
    const sectorId = item.sector_id || getUserSectorId(item.user_id);

    if (selectedSector === "todos") return true;
    if (selectedSector === "sem-setor") return !sectorId;
    return Number(sectorId) === Number(selectedSector);
  }

  function popMatchesSectorFilter(item, selectedSector) {
    if (selectedSector === "todos") return true;
    if (selectedSector === "sem-setor") return !item.sector_id;
    return Number(item.sector_id) === Number(selectedSector);
  }

  function groupUsersBySector(usersList) {
    const groups = {};

    usersList.forEach((item) => {
      const key = item.sector_id ? String(item.sector_id) : "sem-setor";
      const name = getSectorNameFromUser(item, sectors);

      if (!groups[key]) {
        groups[key] = {
          sector_id: key,
          sector_name: name,
          users: [],
        };
      }

      groups[key].users.push(item);
    });

    return Object.values(groups).sort((a, b) => {
      if (a.sector_id === "sem-setor") return 1;
      if (b.sector_id === "sem-setor") return -1;
      return a.sector_name.localeCompare(b.sector_name);
    });
  }

  function groupContrachequesBySector(contrachequesList) {
    const groups = {};

    contrachequesList.forEach((item) => {
      const sectorId = item.sector_id || getUserSectorId(item.user_id);
      const key = sectorId ? String(sectorId) : "sem-setor";
      const name = item.sector_name || getUserSectorName(item.user_id);

      if (!groups[key]) {
        groups[key] = {
          sector_id: key,
          sector_name: name || "Sem setor",
          colaboradores: {},
        };
      }

      const userKey = `${item.user_id}`;
      const userNome = item.user_nome || "Usuário";
      const ano = String(item.ano);
      const mes = String(item.mes);

      if (!groups[key].colaboradores[userKey]) {
        groups[key].colaboradores[userKey] = {
          user_id: item.user_id,
          user_nome: userNome,
          user_email: item.user_email,
          user_cpf: item.user_cpf,
          sector_id: sectorId,
          sector_name: name || "Sem setor",
          anos: {},
        };
      }

      if (!groups[key].colaboradores[userKey].anos[ano]) {
        groups[key].colaboradores[userKey].anos[ano] = {};
      }

      if (!groups[key].colaboradores[userKey].anos[ano][mes]) {
        groups[key].colaboradores[userKey].anos[ano][mes] = [];
      }

      groups[key].colaboradores[userKey].anos[ano][mes].push(item);
    });

    return Object.values(groups)
      .map((group) => ({
        ...group,
        colaboradores: Object.values(group.colaboradores).sort((a, b) =>
          a.user_nome.localeCompare(b.user_nome)
        ),
      }))
      .sort((a, b) => {
        if (a.sector_id === "sem-setor") return 1;
        if (b.sector_id === "sem-setor") return -1;
        return a.sector_name.localeCompare(b.sector_name);
      });
  }

  function groupPopsBySector(popsList) {
    const groups = {};

    popsList.forEach((item) => {
      const key = item.sector_id ? String(item.sector_id) : "sem-setor";
      const name = fixMojibake(item.sector_name || "Sem setor");

      if (!groups[key]) {
        groups[key] = {
          sector_id: key,
          sector_name: name,
          pops: [],
        };
      }

      groups[key].pops.push(item);
    });

    return Object.values(groups)
      .map((group) => ({
        ...group,
        pops: group.pops.sort((a, b) =>
          String(fixMojibake(a.title) || "").localeCompare(
            String(fixMojibake(b.title) || "")
          )
        ),
      }))
      .sort((a, b) => {
        if (a.sector_id === "sem-setor") return 1;
        if (b.sector_id === "sem-setor") return -1;
        return a.sector_name.localeCompare(b.sector_name);
      });
  }

  const allUsersFiltrados = allUsers
    .filter((item) =>
      item.nome?.toLowerCase().includes(searchUsuario.toLowerCase().trim())
    )
    .filter((item) => userMatchesSectorFilter(item, selectedUserSectorFilter));

  const usuariosAgrupadosPorSetor = groupUsersBySector(allUsersFiltrados);

  const usersParaUpload = allUsers
    .filter((item) => Number(item.is_active) === 1)
    .filter((item) => userMatchesSectorFilter(item, selectedUploadSectorFilter));

  const usersParaUploadAgrupadosPorSetor = groupUsersBySector(usersParaUpload);

  const allContrachequesComSetor = allContracheques.map((item) => {
    const foundUser = allUsers.find((u) => Number(u.id) === Number(item.user_id));

    return {
      ...item,
      sector_id: item.sector_id || foundUser?.sector_id || null,
      sector_name:
        item.sector_name || getSectorNameFromUser(foundUser, sectors) || "Sem setor",
      user_nome: item.user_nome || foundUser?.nome || "Usuário",
      user_email: item.user_email || foundUser?.email || "",
      user_cpf: item.user_cpf || foundUser?.cpf || "",
    };
  });

  const contrachequesAdminFiltrados = allContrachequesComSetor
    .filter((item) =>
      item.user_nome
        ?.toLowerCase()
        .includes(searchColaborador.toLowerCase().trim())
    )
    .filter((item) =>
      contrachequeMatchesSectorFilter(item, selectedRemoveSectorFilter)
    );

  const contrachequesAgrupadosPorSetor =
    groupContrachequesBySector(contrachequesAdminFiltrados);

  const allPopsFiltrados = allPops
    .filter((item) =>
      fixMojibake(item.title)
        ?.toLowerCase()
        .includes(searchPop.toLowerCase().trim())
    )
    .filter((item) => popMatchesSectorFilter(item, selectedRemovePopSectorFilter));

  const popsAgrupadosPorSetor = groupPopsBySector(allPopsFiltrados);

  const sectorsFiltrados = sectors.filter((item) =>
    getSectorDisplayName(item)
      .toLowerCase()
      .includes(searchSector.toLowerCase().trim())
  );

  function isContrachequeDownloading(id) {
    return downloadingContrachequeIds.includes(String(id));
  }

  function isPopDownloading(id) {
    return downloadingPopIds.includes(String(id));
  }

  async function handleDownloadContracheque(id) {
    const downloadId = String(id);

    if (downloadingContrachequeIdsRef.current.has(downloadId)) {
      return;
    }

    downloadingContrachequeIdsRef.current.add(downloadId);
    setDownloadingContrachequeIds([...downloadingContrachequeIdsRef.current]);

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
          if (errorData?.message) errorMessage = errorData.message;
        } catch {}

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const fileURL = window.URL.createObjectURL(blob);

      let fileName = "contracheque.pdf";
      const disposition = response.headers.get("content-disposition");

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) fileName = match[1];
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
    } finally {
      downloadingContrachequeIdsRef.current.delete(downloadId);
      setDownloadingContrachequeIds([...downloadingContrachequeIdsRef.current]);
    }
  }

  async function handleDownloadPop(id) {
    const downloadId = String(id);

    if (downloadingPopIdsRef.current.has(downloadId)) {
      return;
    }

    downloadingPopIdsRef.current.add(downloadId);
    setDownloadingPopIds([...downloadingPopIdsRef.current]);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Usuario nao autenticado.");
        return;
      }

      const response = await fetch(`${POPS_API_URL}/${id}/download`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorMessage = "Erro ao baixar POP.";

        try {
          const errorData = await response.json();
          if (errorData?.message) errorMessage = errorData.message;
        } catch {}

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const fileURL = window.URL.createObjectURL(blob);

      let fileName = "pop.pdf";
      const disposition = response.headers.get("content-disposition");

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) fileName = fixMojibake(match[1]);
      }

      const link = document.createElement("a");
      link.href = fileURL;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(fileURL);
    } catch (error) {
      console.error("Erro ao baixar POP:", error);
      alert(error.message || "Erro ao baixar POP.");
    } finally {
      downloadingPopIdsRef.current.delete(downloadId);
      setDownloadingPopIds([...downloadingPopIdsRef.current]);
    }
  }

  return (
    <>
      <Header />

      {mobileMenuOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <main className="profile-page">
        <aside className={`profile-sidebar ${mobileMenuOpen ? "open" : ""}`}>
          <div className="sidebar-mobile-header">
            <span>Menu</span>
            <button
              className="sidebar-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
              type="button"
            >
              ×
            </button>
          </div>

          <button
            className="sidebar-ticket-button"
            onClick={handleOpenTicket}
            type="button"
          >
            Abrir chamado
          </button>

          <button className="sidebar-title" onClick={() => changeTab("perfil")}>
            Meu perfil
          </button>

          <button
            className="sidebar-title"
            onClick={() => changeTab("contracheque")}
          >
            Baixar Contracheque
          </button>

          <button className="sidebar-title" onClick={() => changeTab("senha")}>
            Alterar Senha
          </button>

          <button className="sidebar-title" onClick={() => changeTab("pop")}>
            POP
          </button>

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

              <button
                className="sidebar-title"
                onClick={() => changeTab("adicionar-pop")}
              >
                Adicionar POP
              </button>

              <button
                className="sidebar-title"
                onClick={() => changeTab("remover-pop")}
              >
                Remover POP
              </button>

              <button
                className="sidebar-title"
                onClick={() => changeTab("editar-usuarios")}
              >
                Gerenciar Usuarios
              </button>

              <button
                className="sidebar-title"
                onClick={() => changeTab("gerenciar-setores")}
              >
                Gerenciar Setores
              </button>
            </>
          )}
        </aside>

        <section className="profile-content">
          {!mobileMenuOpen && (
            <div className="mobile-menu-anchor">
              <button
                className="mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
                type="button"
              >
                ☰
              </button>
            </div>
          )}

          <div className="profile-header">
            <h2>Olá {user?.nome || "Usuário"}</h2>
          </div>

          <div className="profile-box">
            {activeTab === "perfil" && (
              <>
                <div className="profile-actions">
                  {!editing ? (
                    <button
                      className="action-button"
                      onClick={() => {
                        setEditing(true);
                        clearMessage();
                      }}
                    >
                      Editar dados
                    </button>
                  ) : (
                    <button
                      className="action-button"
                      onClick={handleSave}
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Salvando" : "Salvar alterações"}
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
                    <input type="text" name="cpf" value={formData.cpf} disabled />
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

                  <label>
                    Setor
                    <select
                      name="sector_id"
                      value={formData.sector_id}
                      onChange={handleChange}
                      disabled={!editing}
                    >
                      <option value="">Selecione o setor</option>
                      {formData.sector_id &&
                        !sectors.some(
                          (sector) =>
                            String(sector.id) === String(formData.sector_id)
                        ) && (
                          <option value={formData.sector_id}>
                            {formData.setor || "Setor atual"}
                          </option>
                        )}
                      {sectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {getSectorDisplayName(sector)}
                        </option>
                      ))}
                    </select>
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
                                    className="action-button password-save-button contracheque-download-button"
                                    disabled={isContrachequeDownloading(item.id)}
                                    onClick={() =>
                                      handleDownloadContracheque(item.id)
                                    }
                                  >
                                    {isContrachequeDownloading(item.id)
                                      ? "Baixando..."
                                      : `Baixar ${
                                          mesesNomes[Number(item.mes)] ||
                                          item.mes
                                        }/${item.ano}`}
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
                  disabled={changingPassword}
                >
                  {changingPassword ? "Atualizando..." : "Atualizar senha"}
                </button>
              </div>
            )}

            {activeTab === "pop" && (
              <div className="pop-section">
                <h3>Procedimento Operacional Padrão</h3>

                {formData.sector_id ? (
                  <p className="pop-sector-label">
                    <strong>Setor:</strong>{" "}
                    {formData.setor || getSectorNameFromUser(user, sectors)}
                  </p>
                ) : (
                  <div className="pop-sector-select">
                    <p>Selecione seu setor para visualizar os POPs disponíveis.</p>

                    <div className="profile-form">
                      <label>
                        Selecione seu setor
                        <select
                          value={selectedPopSectorId}
                          onChange={(e) => setSelectedPopSectorId(e.target.value)}
                        >
                          <option value="">Selecione seu setor</option>
                          {sectors.map((sector) => (
                            <option key={sector.id} value={sector.id}>
                              {getSectorDisplayName(sector)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      className="action-button password-save-button"
                      onClick={handleSavePopSector}
                      disabled={updatingPopSector}
                    >
                      {updatingPopSector ? "Salvando..." : "Salvar setor"}
                    </button>
                  </div>
                )}

                {formData.sector_id &&
                  (popsSeguros.length === 0 ? (
                    <p>
                      Nenhum POP foi disponibilizado para este setor ainda. Assim
                      que houver um documento publicado, ele aparecerá aqui.
                    </p>
                  ) : (
                    <div className="contracheque-list">
                      {popsSeguros.map((item) => (
                        <div key={item.id} className="contracheque-item">
                          <span>
                            <strong>{fixMojibake(item.title)}</strong>
                          </span>

                          <button
                            type="button"
                            className="action-button password-save-button contracheque-download-button"
                            disabled={isPopDownloading(item.id)}
                            onClick={() => handleDownloadPop(item.id)}
                          >
                            {isPopDownloading(item.id) ? "Baixando..." : "Baixar POP"}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}

            {activeTab === "enviar-contracheque" && user?.role === "admin" && (
              <div className="upload-section">
                <h3>Adicionar Contracheque</h3>

                <div className="sector-filter-box">
                  <label>
                    Filtrar usuários por setor
                    <select
                      value={selectedUploadSectorFilter}
                      onChange={(e) => {
                        setSelectedUploadSectorFilter(e.target.value);
                        setUploadData((prev) => ({
                          ...prev,
                          user_id: "",
                        }));
                      }}
                    >
                      <option value="todos">Todos os setores</option>
                      <option value="sem-setor">Sem setor</option>
                      {sectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {getSectorDisplayName(sector)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="profile-form">
                  <label>
                    Usuário
                    <select
                      name="user_id"
                      value={uploadData.user_id}
                      onChange={handleUploadChange}
                    >
                      <option value="">Selecione um usuário</option>

                      {usersParaUploadAgrupadosPorSetor.map((group) => (
                        <optgroup
                          key={group.sector_id}
                          label={group.sector_name || "Sem setor"}
                        >
                          {group.users.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nome}
                            </option>
                          ))}
                        </optgroup>
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
                  disabled={uploadingContracheque}
                >
                  {uploadingContracheque
                    ? "Salvando"
                    : "Adicionar Contracheque"}
                </button>
              </div>
            )}

            {activeTab === "remover-contracheque" && user?.role === "admin" && (
              <div className="admin-contracheque-section">
                <h3>Remover Contracheque</h3>

                <div className="filter-row">
                  <input
                    type="text"
                    placeholder="Pesquisar colaborador"
                    className="search-colaborador-input"
                    value={searchColaborador}
                    onChange={(e) => setSearchColaborador(e.target.value)}
                  />

                  <div className="sector-filter-box inline-filter">
                    <label>
                      <select
                        value={selectedRemoveSectorFilter}
                        onChange={(e) =>
                          setSelectedRemoveSectorFilter(e.target.value)
                        }
                      >
                        <option value="todos">Todos os setores</option>
                        <option value="sem-setor">Sem setor</option>
                        {sectors.map((sector) => (
                          <option key={sector.id} value={sector.id}>
                            {getSectorDisplayName(sector)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {allContracheques.length === 0 ? (
                  <p>Nenhum contracheque encontrado.</p>
                ) : contrachequesAgrupadosPorSetor.length === 0 ? (
                  <p>Nenhum colaborador encontrado.</p>
                ) : (
                  <div className="sector-group-list">
                    {contrachequesAgrupadosPorSetor.map((sectorGroup) => (
                      <div
                        key={sectorGroup.sector_id}
                        className="sector-group-block"
                      >
                        <h4>{sectorGroup.sector_name || "Sem setor"}</h4>

                        {sectorGroup.colaboradores.map((usuario) => (
                          <div
                            key={usuario.user_id}
                            className="admin-contracheque-user-block"
                          >
                            <h5>{usuario.user_nome}</h5>
                            <p>
                              <strong>Email:</strong> {usuario.user_email}
                            </p>
                            <p>
                              <strong>CPF:</strong> {usuario.user_cpf}
                            </p>

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
                                                  disabled={isContrachequeDownloading(
                                                    item.id
                                                  )}
                                                  onClick={() =>
                                                    handleDownloadContracheque(
                                                      item.id
                                                    )
                                                  }
                                                >
                                                  {isContrachequeDownloading(
                                                    item.id
                                                  )
                                                    ? "Baixando..."
                                                    : "Baixar"}
                                                </button>

                                                <button
                                                  className="danger-button"
                                                  onClick={() =>
                                                    handleRemoveContracheque(
                                                      item.id
                                                    )
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
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "adicionar-pop" && user?.role === "admin" && (
              <div className="upload-section">
                <h3>Adicionar POP</h3>

                <div className="profile-form">
                  <label>
                    Setor
                    <select
                      name="sector_id"
                      value={popUploadData.sector_id}
                      onChange={handlePopUploadChange}
                    >
                      <option value="">Selecione o setor</option>
                      {sectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {getSectorDisplayName(sector)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Arquivo PDF
                    <input
                      type="file"
                      name="pop"
                      accept="application/pdf"
                      onChange={handlePopUploadChange}
                    />
                  </label>
                </div>

                <button
                  className="action-button password-save-button"
                  onClick={handleUploadPop}
                  disabled={uploadingPop}
                >
                  {uploadingPop ? "Salvando..." : "Adicionar POP"}
                </button>
              </div>
            )}

            {activeTab === "remover-pop" && user?.role === "admin" && (
              <div className="admin-contracheque-section">
                <h3>Remover POP</h3>

                <div className="filter-row">
                  <input
                    type="text"
                    placeholder="Pesquisar POP"
                    className="search-colaborador-input"
                    value={searchPop}
                    onChange={(e) => setSearchPop(e.target.value)}
                  />

                  <div className="sector-filter-box inline-filter">
                    <label>
                      <select
                        value={selectedRemovePopSectorFilter}
                        onChange={(e) =>
                          setSelectedRemovePopSectorFilter(e.target.value)
                        }
                      >
                        <option value="todos">Todos os setores</option>
                        <option value="sem-setor">Sem setor</option>
                        {sectors.map((sector) => (
                          <option key={sector.id} value={sector.id}>
                            {getSectorDisplayName(sector)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {allPops.length === 0 ? (
                  <p>Nenhum POP cadastrado.</p>
                ) : popsAgrupadosPorSetor.length === 0 ? (
                  <p>Nenhum POP encontrado com esse filtro.</p>
                ) : (
                  <div className="sector-group-list">
                    {popsAgrupadosPorSetor.map((sectorGroup) => (
                      <div
                        key={sectorGroup.sector_id}
                        className="sector-group-block"
                      >
                        <h4>{sectorGroup.sector_name || "Sem setor"}</h4>

                        <div className="admin-contracheque-list">
                          {sectorGroup.pops.map((item) => (
                            <div key={item.id} className="admin-contracheque-card">
                              <span>
                                <strong>{fixMojibake(item.title)}</strong>
                                {item.file_name
                                  ? ` - ${fixMojibake(item.file_name)}`
                                  : ""}
                              </span>

                              <div className="admin-contracheque-actions">
                                <button
                                  className="download-button"
                                  disabled={isPopDownloading(item.id)}
                                  onClick={() => handleDownloadPop(item.id)}
                                >
                                  {isPopDownloading(item.id)
                                    ? "Baixando..."
                                    : "Baixar"}
                                </button>

                                <button
                                  className="danger-button"
                                  onClick={() => handleRemovePop(item.id)}
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
                )}
              </div>
            )}

            {activeTab === "editar-usuarios" && user?.role === "admin" && (
              <div className="admin-users-section">
                <h3>Gerenciar Usuarios</h3>

                <div className="filter-row">
                  <input
                    type="text"
                    placeholder="Pesquisar usuário"
                    className="search-colaborador-input"
                    value={searchUsuario}
                    onChange={(e) => setSearchUsuario(e.target.value)}
                  />

                  <div className="sector-filter-box inline-filter">
                    <label>
                      <select
                        value={selectedUserSectorFilter}
                        onChange={(e) =>
                          setSelectedUserSectorFilter(e.target.value)
                        }
                      >
                        <option value="todos">Todos os setores</option>
                        <option value="sem-setor">Sem setor</option>
                        {sectors.map((sector) => (
                          <option key={sector.id} value={sector.id}>
                            {getSectorDisplayName(sector)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {allUsers.length === 0 ? (
                  <p>Nenhum usuário encontrado.</p>
                ) : allUsersFiltrados.length === 0 ? (
                  <p>Nenhum usuário encontrado com esse filtro.</p>
                ) : (
                  <div className="sector-group-list">
                    {usuariosAgrupadosPorSetor.map((sectorGroup) => (
                      <div
                        key={sectorGroup.sector_id}
                        className="sector-group-block"
                      >
                        <h4>{sectorGroup.sector_name || "Sem setor"}</h4>

                        <div className="admin-users-list">
                          {sectorGroup.users.map((item) => (
                            <div key={item.id} className="admin-user-card">
                              <div className="admin-user-info">
                                <p>
                                  <strong>Nome:</strong> {item.nome}
                                </p>
                                <p>
                                  <strong>Email:</strong> {item.email}
                                </p>
                                <p>
                                  <strong>CPF:</strong> {item.cpf}
                                </p>
                                <p>
                                  <strong>Status:</strong>{" "}
                                  {Number(item.is_active) === 1
                                    ? "Ativo"
                                    : "Inativo"}
                                </p>
                                <p>
                                  <strong>Setor:</strong>{" "}
                                  {getSectorNameFromUser(item, sectors)}
                                </p>

                                {editingUserSectorId === item.id && (
                                  <div className="user-sector-edit-box">
                                    <label>
                                      Alterar setor
                                      <select
                                        value={selectedUserSectorId}
                                        onChange={(e) =>
                                          setSelectedUserSectorId(e.target.value)
                                        }
                                      >
                                        <option value="">Sem setor</option>
                                        {sectors.map((sector) => (
                                          <option
                                            key={sector.id}
                                            value={sector.id}
                                          >
                                            {getSectorDisplayName(sector)}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                )}
                              </div>

                              <div className="admin-user-actions">
                                {editingUserSectorId === item.id ? (
                                  <>
                                    <button
                                      className="success-button"
                                      onClick={() =>
                                        handleUpdateUserSector(item.id)
                                      }
                                    >
                                      Salvar setor
                                    </button>

                                    <button
                                      className="danger-button"
                                      onClick={handleCancelEditUserSector}
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="download-button"
                                    onClick={() =>
                                      handleStartEditUserSector(item)
                                    }
                                  >
                                    Alterar setor
                                  </button>
                                )}

                                {Number(item.is_active) === 1 ? (
                                  <button
                                    className="danger-button"
                                    onClick={() =>
                                      handleAdminDeactivateUser(item.id)
                                    }
                                  >
                                    Desativar usuário
                                  </button>
                                ) : (
                                  <button
                                    className="success-button"
                                    onClick={() =>
                                      handleAdminActivateUser(item.id)
                                    }
                                  >
                                    Ativar usuário
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "gerenciar-setores" && user?.role === "admin" && (
              <div className="sectors-section">
                <h3>Gerenciar Setores</h3>

                <div className="sector-create-box">
                  <label>
                    Novo setor
                    <input
                      type="text"
                      placeholder="Digite o nome do setor"
                      value={sectorDescricao}
                      onChange={(e) => setSectorDescricao(e.target.value)}
                    />
                  </label>

                  <button className="action-button" onClick={handleCreateSector}>
                    Criar setor
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Pesquisar setor"
                  className="search-colaborador-input"
                  value={searchSector}
                  onChange={(e) => setSearchSector(e.target.value)}
                />

                {sectors.length === 0 ? (
                  <p>Nenhum setor cadastrado.</p>
                ) : sectorsFiltrados.length === 0 ? (
                  <p>Nenhum setor encontrado com esse nome.</p>
                ) : (
                  <div className="sectors-list">
                    {sectorsFiltrados.map((sector) => (
                      <div key={sector.id} className="sector-card">
                        {editingSectorId === sector.id ? (
                          <>
                            <div className="sector-edit-box">
                              <label>
                                Nome do setor
                                <input
                                  type="text"
                                  value={editingSectorDescricao}
                                  onChange={(e) =>
                                    setEditingSectorDescricao(e.target.value)
                                  }
                                />
                              </label>
                            </div>

                            <div className="sector-actions">
                              <button
                                className="success-button"
                                onClick={() => handleUpdateSector(sector.id)}
                              >
                                Salvar
                              </button>

                              <button
                                className="danger-button"
                                onClick={handleCancelEditSector}
                              >
                                Cancelar
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="sector-info">
                              <p>
                                <strong>ID:</strong> {sector.id}
                              </p>
                              <p>
                                <strong>Setor:</strong>{" "}
                                {getSectorDisplayName(sector)}
                              </p>
                            </div>

                            <div className="sector-actions">
                              <button
                                className="download-button"
                                onClick={() => handleStartEditSector(sector)}
                              >
                                Editar
                              </button>

                              <button
                                className="danger-button"
                                onClick={() => handleDeleteSector(sector.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {message && (
              <p
                className={`profile-message ${
                  messageType === "error"
                    ? "profile-message-error"
                    : "profile-message-success"
                }`}
              >
                {message}
              </p>
            )}

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
