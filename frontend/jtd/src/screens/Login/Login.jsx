import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { changePassword, loginUser } from "../../services/authService";
import "./Login.css";

const DEFAULT_PASSWORD = "123456";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    login: "",
    password: "",
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });
  const [pendingLogin, setPendingLogin] = useState(null);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const mustChangePassword = Boolean(pendingLogin);

  function handleChange(e) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  function handlePasswordChange(e) {
    setPasswordData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  function finishLogin(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    navigate("/profile");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!formData.login || !formData.password) {
      setMessage("Informe seu e-mail ou CPF e sua senha.");
      setLoading(false);
      return;
    }

    try {
      const result = await loginUser(formData);

      if (!result.ok) {
        setMessage(result.message || "Erro ao fazer login.");
        setLoading(false);
        return;
      }

      if (formData.password === DEFAULT_PASSWORD) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setPendingLogin({
          token: result.token,
          user: result.user,
        });
        setPasswordData({
          newPassword: "",
          confirmNewPassword: "",
        });
        setMessage("");
        return;
      }

      setMessage("Login realizado com sucesso.");
      finishLogin(result.token, result.user);
    } catch {
      setMessage("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForcedPasswordChange(e) {
    e.preventDefault();
    setMessage("");

    if (!pendingLogin) {
      setMessage("Refaca o login para alterar sua senha.");
      return;
    }

    if (!passwordData.newPassword || !passwordData.confirmNewPassword) {
      setMessage("Preencha a nova senha e a confirmacao.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setMessage("A confirmacao da nova senha nao confere.");
      return;
    }

    if (passwordData.newPassword === DEFAULT_PASSWORD) {
      setMessage("Escolha uma senha diferente da senha padrao.");
      return;
    }

    setLoading(true);

    try {
      const result = await changePassword(pendingLogin.token, {
        currentPassword: DEFAULT_PASSWORD,
        newPassword: passwordData.newPassword,
        confirmNewPassword: passwordData.confirmNewPassword,
      });

      if (!result.ok) {
        setMessage(result.message || "Erro ao atualizar a senha.");
        return;
      }

      setMessage("Senha atualizada com sucesso.");
      finishLogin(pendingLogin.token, pendingLogin.user);
    } catch {
      setMessage("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="login-page">
        <section className="login-container">
          <h1 className="login-title">
            {mustChangePassword ? "Atualizar senha" : "Login"}
          </h1>

          {mustChangePassword ? (
            <form className="login-form" onSubmit={handleForcedPasswordChange}>
              <p className="login-instruction">
                Sua senha temporaria foi validada. Defina uma nova senha para
                acessar o perfil.
              </p>

              <input
                type="password"
                name="newPassword"
                placeholder="Nova senha"
                className="login-input"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                autoComplete="new-password"
              />

              <input
                type="password"
                name="confirmNewPassword"
                placeholder="Confirmar nova senha"
                className="login-input"
                value={passwordData.confirmNewPassword}
                onChange={handlePasswordChange}
                autoComplete="new-password"
              />

              {message && <p className="login-message">{message}</p>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Atualizando..." : "Atualizar senha"}
              </button>
            </form>
          ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="text"
              name="login"
              placeholder="E-mail ou CPF"
              className="login-input"
              value={formData.login}
              onChange={handleChange}
              autoComplete="username"
            />

            <input
              type="password"
              name="password"
              placeholder="Senha"
              className="login-input"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
            />

            <p className="login-register-text">
              Não tem conta? <Link to="/register">Realize o cadastro aqui</Link>
            </p>

            {message && <p className="login-message">{message}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Entrando..." : "Login"}
            </button>
          </form>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}
