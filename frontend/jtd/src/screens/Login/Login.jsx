import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { loginUser } from "../../services/authService";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    login: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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

      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));

      setMessage("Login realizado com sucesso.");
      navigate("/profile");
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
          <h1 className="login-title">Login</h1>

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="text"
              name="login"
              placeholder="E-mail ou CPF"
              className="login-input"
              value={formData.login}
              onChange={handleChange}
            />

            <input
              type="password"
              name="password"
              placeholder="Senha"
              className="login-input"
              value={formData.password}
              onChange={handleChange}
            />

            <p className="login-register-text">
              Não tem conta? <Link to="/register">Realize o cadastro aqui</Link>
            </p>

            {message && <p className="login-message">{message}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Entrando..." : "Login"}
            </button>
          </form>
        </section>
      </main>

      <Footer />
    </>
  );
}