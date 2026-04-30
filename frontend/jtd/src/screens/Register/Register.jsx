import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { registerUser } from "../../services/authService";
import "./Register.css";

const SECTORS_API_URL = "https://jtd-website.onrender.com/api/sectors";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    password: "",
    cpf: "",
    data_nascimento: "",
    sexo: "",
    telefone: "",
    sector_id: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    cpf: "",
    telefone: "",
  });

  const [sectors, setSectors] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [dateInputType, setDateInputType] = useState("text");

  useEffect(() => {
    async function loadSectors() {
      try {
        const response = await fetch(SECTORS_API_URL);
        const result = await response.json();

        if (result.ok) {
          setSectors(result.sectors || []);
        }
      } catch (error) {
        console.error("Erro ao carregar setores:", error);
      }
    }

    loadSectors();
  }, []);

  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleEmailChange(e) {
    const value = e.target.value;

    setFormData((prev) => ({
      ...prev,
      email: value,
    }));

    setErrors((prev) => ({
      ...prev,
      email: "",
    }));
  }

  function handleEmailBlur() {
    const email = formData.email.trim();

    if (email.length === 0) return;

    if (!validarEmail(email)) {
      setErrors((prev) => ({
        ...prev,
        email: "Digite um e-mail válido.",
      }));
    }
  }

  function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");

    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;

    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf.charAt(i)) * (10 - i);
    }

    let resto = (soma * 10) % 11;

    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;

    soma = 0;

    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf.charAt(i)) * (11 - i);
    }

    resto = (soma * 10) % 11;

    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  function formatarCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  function handleCpfChange(e) {
    let value = e.target.value.replace(/\D/g, "");
    value = value.slice(0, 11);

    setFormData((prev) => ({
      ...prev,
      cpf: value,
    }));

    setErrors((prev) => ({
      ...prev,
      cpf: "",
    }));
  }

  function handleCpfBlur() {
    const cpfLimpo = formData.cpf.replace(/\D/g, "");

    if (cpfLimpo.length === 0) return;

    if (!validarCPF(cpfLimpo)) {
      setErrors((prev) => ({
        ...prev,
        cpf: "CPF inválido.",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      cpf: formatarCPF(cpfLimpo),
    }));
  }

  function handleCpfFocus() {
    const cpfLimpo = formData.cpf.replace(/\D/g, "");

    setFormData((prev) => ({
      ...prev,
      cpf: cpfLimpo,
    }));
  }

  function handleTelefoneChange(e) {
    let value = e.target.value.replace(/\D/g, "");
    value = value.slice(0, 11);

    setFormData((prev) => ({
      ...prev,
      telefone: value,
    }));

    if (value.length > 0 && value.length < 11) {
      setErrors((prev) => ({
        ...prev,
        telefone: "O telefone deve ter 11 dígitos.",
      }));
    } else {
      setErrors((prev) => ({
        ...prev,
        telefone: "",
      }));
    }
  }

  function formatTelefoneOnBlur() {
    const numbers = formData.telefone.replace(/\D/g, "");

    if (numbers.length === 11) {
      const formatado = numbers.replace(
        /^(\d{2})(\d{1})(\d{4})(\d{4})$/,
        "$1 $2 $3-$4"
      );

      setFormData((prev) => ({
        ...prev,
        telefone: formatado,
      }));
    } else if (numbers.length > 0) {
      setErrors((prev) => ({
        ...prev,
        telefone: "Telefone inválido. Use 11 números, exemplo: 71996815406",
      }));
    }
  }

  function handleTelefoneFocus() {
    const somenteNumeros = formData.telefone.replace(/\D/g, "");

    setFormData((prev) => ({
      ...prev,
      telefone: somenteNumeros,
    }));
  }

  function handleDateFocus() {
    setDateInputType("date");
  }

  function handleDateBlur() {
    if (!formData.data_nascimento) {
      setDateInputType("text");
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    if (
      !formData.nome ||
      !formData.email ||
      !formData.password ||
      !formData.cpf ||
      !formData.data_nascimento ||
      !formData.sexo ||
      !formData.telefone ||
      !formData.sector_id
    ) {
      setMessage("Preencha todos os campos.");
      setLoading(false);
      return;
    }

    if (errors.email || errors.cpf || errors.telefone) {
      setMessage("Corrija os campos inválidos.");
      setLoading(false);
      return;
    }

    const payload = {
      ...formData,
      sector_id: Number(formData.sector_id),
    };

    const result = await registerUser(payload);

    if (!result.ok) {
      setMessage(result.message || "Erro ao realizar cadastro.");
      setLoading(false);
      return;
    }

    setMessage("Cadastro realizado com sucesso.");
    navigate("/login");
    setLoading(false);
  }

  return (
    <>
      <Header />

      <main className="register-page">
        <section className="register-container">
          <h1 className="register-title">Cadastro</h1>

          <form className="register-form" onSubmit={handleSubmit}>
            <input
              type="text"
              name="nome"
              placeholder="Nome"
              className="register-input"
              value={formData.nome}
              onChange={handleChange}
            />

            <input
              type="email"
              name="email"
              placeholder="E-mail"
              className="register-input"
              value={formData.email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
            />

            {errors.email && <span className="cpf-error">{errors.email}</span>}

            <input
              type="password"
              name="password"
              placeholder="Senha"
              className="register-input"
              value={formData.password}
              onChange={handleChange}
            />

            <input
              type="text"
              name="cpf"
              placeholder="CPF"
              className="register-input"
              value={formData.cpf}
              onChange={handleCpfChange}
              onBlur={handleCpfBlur}
              onFocus={handleCpfFocus}
            />

            {errors.cpf && <span className="cpf-error">{errors.cpf}</span>}

            <input
              type="text"
              name="telefone"
              placeholder="Telefone"
              className="register-input"
              value={formData.telefone}
              onChange={handleTelefoneChange}
              onBlur={formatTelefoneOnBlur}
              onFocus={handleTelefoneFocus}
            />

            {errors.telefone && (
              <span className="cpf-error">{errors.telefone}</span>
            )}

            <input
              type={dateInputType}
              name="data_nascimento"
              placeholder="Data de nascimento"
              className="register-input"
              value={formData.data_nascimento}
              onChange={handleChange}
              onFocus={handleDateFocus}
              onBlur={handleDateBlur}
            />

            <select
              name="sexo"
              className="register-input"
              value={formData.sexo}
              onChange={handleChange}
            >
              <option value="">Selecione o sexo</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
              <option value="prefiro_nao_informar">Prefiro não informar</option>
            </select>

            <select
              name="sector_id"
              className="register-input"
              value={formData.sector_id}
              onChange={handleChange}
            >
              <option value="">Selecione o setor</option>

              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name || sector.nome || sector.descricao}
                </option>
              ))}
            </select>

            <p className="register-login-text">
              Já tem conta? <Link to="/login"><b>Faça login aqui</b></Link>
            </p>

            {message && <p className="register-message">{message}</p>}

            <button type="submit" className="register-button" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </form>
        </section>
      </main>

      <Footer />
    </>
  );
}