import React, { useState } from "react";
import "./Header.css";
import JTDLogo from "../../assets/icons/jtd_logo_azul.png";
import { IoChevronDown, IoMenu, IoClose } from "react-icons/io5";
import { Link } from "react-router-dom";
import BaseModal from "../ModalContact/BaseModal";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openFeedback, setOpenFeedback] = useState(false);
  const [openContact, setOpenContact] = useState(false);
  const API_URL = "https://jtd-website.onrender.com";

  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [sendingContact, setSendingContact] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState({ type: "", text: "" });
  const [contactStatus, setContactStatus] = useState({ type: "", text: "" });

  const EM_MANUTENCAO = true;

  const toggleDropdown = (menu) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  const StatusBox = ({ type, text, onClose }) => {
    if (!text) return null;

    return (
      <div className={`status-box status-box--${type}`}>
        <span>{text}</span>
        <button type="button" className="status-box__close" onClick={onClose}>
          ✕
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="header-container">
        {EM_MANUTENCAO && (
          <div className="maintenance-tag">Site em manutenção</div>
        )}
        <div className="jtd_logo_container">
          <Link to="/">
            <img
              src={JTDLogo}
              alt="Logo da JTD na cor azul, escrito jtd transportes."
            />
          </Link>
        </div>

        <ul className="header-list">
          <li className="header-list-item">
            <Link to="/">Home</Link>
          </li>
          <li className="header-list-item">
            <Link to="/">Quem somos</Link>
          </li>
          <li className="header-list-item">
            <Link to="/">Serviços</Link>
          </li>
          <li className="header-list-item">
            <Link to="/">Clientes</Link>
          </li>
          <li className="header-list-item">
            <Link to="/">Localização</Link>
          </li>

          <li className="header-list-item dropdown">
            <button className="dropbtn">
              Contato <IoChevronDown className="arrow-icon" />
            </button>
            <div className="dropdown-content">
              <button
                className="button-dropdown-sugest"
                onClick={() => setOpenFeedback(true)}
              >
                Sugestões e Reclamações
              </button>
              <button
                className="button-dropdown-contact"
                onClick={() => setOpenContact(true)}
              >
                Fale Conosco
              </button>
            </div>
          </li>

          <li className="header-list-item dropdown">
            <button className="dropbtn">
              Políticas <IoChevronDown className="arrow-icon" />
            </button>
            <div className="dropdown-content">
              <Link to="/anticorruption">Política de Anticorrupção</Link>
              <Link to="/environmental">Política Ambiental</Link>
              <Link to="/codeofethics">Código de Ética</Link>
              <Link to="/etibasecodes">Código Base ETI</Link>
            </div>
          </li>

          <li>
            <button className="header-button-location">
              <a href="/blog">Blog</a>
            </button>
          </li>
        </ul>

        <button className="hamburger-button" onClick={() => setMenuOpen(true)}>
          <IoMenu size={28} />
        </button>
      </div>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        <button className="close-menu" onClick={() => setMenuOpen(false)}>
          <IoClose size={32} />
        </button>

        <ul className="mobile-list">
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/">Quem somos</a>
          </li>
          <li>
            <a href="/">Serviços</a>
          </li>
          <li>
            <a href="/">Clientes</a>
          </li>
          <li>
            <a href="/">Localização</a>
          </li>

          <li
            className={`mobile-dropdown ${
              openDropdown === "contato" ? "open" : ""
            }`}
            onClick={() => toggleDropdown("contato")}
          >
            <div className="mobile-dropdown-title">
              Contato
              <IoChevronDown
                className={`arrow ${
                  openDropdown === "contato" ? "rotate" : ""
                }`}
              />
            </div>
          </li>
          {openDropdown === "contato" && (
            <div className="mobile-submenu">
              <button
                className="mobile-submenu-btn"
                onClick={() => {
                  setOpenContact(true);
                  setMenuOpen(false);
                }}
              >
                Fale Conosco
              </button>

              <button
                className="mobile-submenu-btn"
                onClick={() => {
                  setOpenFeedback(true);
                  setMenuOpen(false);
                }}
              >
                Sugestões e Reclamações
              </button>
            </div>
          )}

          <li
            className={`mobile-dropdown ${
              openDropdown === "politicas" ? "open" : ""
            }`}
            onClick={() => toggleDropdown("politicas")}
          >
            <div className="mobile-dropdown-title">
              Políticas
              <IoChevronDown
                className={`arrow ${
                  openDropdown === "politicas" ? "rotate" : ""
                }`}
              />
            </div>
          </li>
          {openDropdown === "politicas" && (
            <div className="mobile-submenu">
              <Link to="/anticorruption">Política de Anticorrupção</Link>
              <Link to="/environmental">Política Ambiental</Link>
              <Link to="/codeofethics">Código de Ética</Link>
              <Link to="/etibasecodes">Código Base ETI</Link>
            </div>
          )}

          <li>
            <a className="mobile-blog-btn" href="/blog">
              Blog
            </a>
          </li>
        </ul>
      </div>

      {menuOpen && (
        <div className="backdrop" onClick={() => setMenuOpen(false)} />
      )}

      <BaseModal
        isOpen={openFeedback}
        onClose={() => setOpenFeedback(false)}
        classPrefix="contact-modal"
      >
        <h2 className="contact-modal__title">
          Envie suas sugestões e reclamações
        </h2>

        <p className="contact-modal__text">
          A JTD valoriza a opinião de todos e oferece este canal para que você
          possa enviar sua sugestão ou reclamação de forma totalmente anônima.
          Sua mensagem será recebida e analisada com respeito e seriedade,
          garantindo o sigilo absoluto sobre sua identidade.
        </p>

        <StatusBox
          type={feedbackStatus.type}
          text={feedbackStatus.text}
          onClose={() => setFeedbackStatus({ type: "", text: "" })}
        />

        <form
          className="contact-modal__form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (sendingFeedback) return;

            setSendingFeedback(true);

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);

            try {
              const form = e.currentTarget;
              const fd = new FormData(form);

              const payload = {
                name: String(fd.get("name") || ""),
                email: String(fd.get("email") || ""),
                message: String(fd.get("message") || ""),
              };

              const res = await fetch(`${API_URL}/api/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });

              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setFeedbackStatus({
                  type: "error",
                  text:
                    data?.message ||
                    "Não foi possível enviar o e-mail, tente novamente.",
                });
                return;
              }

              setFeedbackStatus({
                type: "success",
                text: "Enviado com sucesso.",
              });
              form.reset();
            } catch (err) {
              if (err.name === "AbortError") {
                setFeedbackStatus({
                  type: "error",
                  text: "Tempo esgotado. Tente novamente.",
                });
              } else {
                setFeedbackStatus({
                  type: "error",
                  text: "Erro de conexão com o servidor.",
                });
              }
            } finally {
              clearTimeout(timer);
              setSendingFeedback(false);
            }
          }}
        >
          <div className="contact-modal__form-row">
            <input name="name" type="text" placeholder="Nome (opcional)" />
            <input name="email" type="email" placeholder="E-mail (opcional)" />
          </div>

          <textarea name="message" placeholder="Mensagem" rows="6" required />

          <button
            type="submit"
            className="contact-modal__submit"
            disabled={sendingFeedback}
          >
            {sendingFeedback ? "Enviando..." : "Enviar e-mail"}
          </button>
        </form>
      </BaseModal>

      <BaseModal
        isOpen={openContact}
        onClose={() => setOpenContact(false)}
        classPrefix="contactModal"
      >
        <h2 className="contactModal__title">
          Entre em contato com a nossa equipe
        </h2>

        <p className="contactModal__text">
          Utilize o formulário abaixo para falar diretamente com a JTD
          Transportes. Retornaremos o mais breve possível.
        </p>

        <StatusBox
          type={contactStatus.type}
          text={contactStatus.text}
          onClose={() => setContactStatus({ type: "", text: "" })}
        />

        <form
          className="contactModal__form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (sendingContact) return;

            setSendingContact(true);
            try {
              const form = e.currentTarget;
              const fd = new FormData(form);

              const payload = {
                name: String(fd.get("name") || ""),
                email: String(fd.get("email") || ""),
                company: String(fd.get("company") || ""),
                role: String(fd.get("role") || ""),
                phone: String(fd.get("phone") || ""),
                message: String(fd.get("message") || ""),
              };

              const res = await fetch(`${API_URL}/api/contact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setContactStatus({
                  type: "error",
                  text:
                    data?.message ||
                    "Não foi possível enviar o e-mail, tente novamente.",
                });
                return;
              }

              setContactStatus({
                type: "success",
                text: "Enviado com sucesso.",
              });
              form.reset();
            } catch (err) {
              console.error(err);
              setContactStatus({
                type: "error",
                text: "Erro de conexão com o servidor. Tente novamente.",
              });
            } finally {
              setSendingContact(false);
            }
          }}
        >
          <div className="contactModal__form_row">
            <input name="name" type="text" placeholder="Nome" required />
            <input name="email" type="email" placeholder="E-mail" required />
            <input name="company" type="text" placeholder="Empresa" />
            <input name="role" type="text" placeholder="Cargo" />
            <input name="phone" type="text" placeholder="Telefone" />
          </div>

          <textarea name="message" placeholder="Mensagem" rows="6" required />

          <button
            type="submit"
            className="contactModal__submit"
            disabled={sendingContact}
          >
            {sendingContact ? "Enviando..." : "Enviar mensagem"}
          </button>
        </form>
      </BaseModal>
    </>
  );
};

export default Header;
