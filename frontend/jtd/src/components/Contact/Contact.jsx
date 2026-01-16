import "./Contact.css";
import { useState } from "react";
import BaseModal from "../ModalContact/BaseModal";

const Contact = () => {
  const [openFeedback, setOpenFeedback] = useState(false);
  const [openContact, setOpenContact] = useState(false);
  const API_URL = "https://jtd-website.onrender.com";

  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [sendingContact, setSendingContact] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState({ type: "", text: "" });
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
      <div className="contact__container">
        <div className="contact__content">
          <div className="contact__header">
            <p className="contact__title">Fale conosco!</p>
            <p className="contact__subtitle_handle">
              Escolha uma das opções abaixo para falar com a nossa equipe.
            </p>
            <div className="contact_buttons_section">
              <div className="contact__button_open">
                <button onClick={() => setOpenContact(true)}>Contato</button>
              </div>
              <div className="contact__button_open">
                <button onClick={() => setOpenFeedback(true)}>
                  Sugestões e reclamações
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BaseModal
        isOpen={openFeedback}
        onClose={() => setOpenFeedback(false)}
        classPrefix="contact-modal"
      >
        <h2 className="contact-modal__title">
          Envie suas sugestões e reclamações
        </h2>

        <p className="contact-modal__text">
          A JTD Transportes acredita que ouvir os clientes...
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
              console.error(err);
              setFeedbackStatus({
                type: "error",
                text: "Erro de conexão com o servidor. Tente novamente.",
              });
            } finally {
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

export default Contact;
