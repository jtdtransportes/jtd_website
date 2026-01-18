import "./Footer.css";
import JTDLogoBranca from "../../assets/icons/logo_jtd_branco.png";
import { Link } from "react-router-dom";
import BaseModal from "../ModalContact/BaseModal";
import { useState } from "react";

const Footer = () => {
  const [openContact, setOpenContact] = useState(false);
  const API_URL = "https://jtd-website.onrender.com";

  const [sendingContact, setSendingContact] = useState(false);
  const [contactStatus, setContactStatus] = useState({ type: "", text: "" });

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
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-column">
            <h3>Institucional</h3>
            <Link to="/#sobre-nos">Sobre nós</Link>
            <Link to="/#clientes">Clientes</Link>
            <Link to="/#localizacao">Localização</Link>

            <Link to="/anticorruption">Política de Anticorrupção</Link>
            <Link to="/environmental">Política Ambiental</Link>
            <Link to="/codeofethics">Código de Ética</Link>
            <Link to="/etibasecodes">Código Base ETI</Link>
          </div>

          <div className="footer-column">
            <h3>Serviços</h3>
            <button className="button-agendar-coleta" onClick={() => setOpenContact(true)}>Agendar coleta</button>
            <p>Cargas Lotação</p>
            <p>Distribuição</p>
            <p>Armazenagem</p>
            <p>Cross-docking</p>
            <p>Paletização</p>
            <p>Operador Logístico</p>
          </div>

          <div className="footer-column">
            <h3>Contatos</h3>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://w.app/lzikyq"
            >
              Whatsapp
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.instagram.com/jtdtransportesba/"
            >
              Instagram
            </a>
          </div>

          <div className="footer-logo">
            <img src={JTDLogoBranca} alt="Logo JTD" />
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2025 JTD Transportes. Todos os direitos reservados.</p>
          <p>
            Matriz: BR-324, 5039 - Humildes, Feira de Santana - BA, 44097-012
          </p>
        </div>
      </footer>
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

export default Footer;
