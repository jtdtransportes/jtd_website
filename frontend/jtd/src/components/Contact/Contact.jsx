import "./Contact.css";
import { useState } from "react";
import BaseModal from "../ModalContact/BaseModal";

const Contact = () => {
  const [openFeedback, setOpenFeedback] = useState(false);
  const [openContact, setOpenContact] = useState(false);

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

        <form className="contact-modal__form">
          <div className="contact-modal__form-row">
            <input type="text" placeholder="Nome (opcional)" />
            <input type="email" placeholder="E-mail (opcional)" />
          </div>

          <textarea placeholder="Mensagem" rows="6" />

          <button type="submit" className="contact-modal__submit">
            Enviar e-mail
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

        <form className="contactModal__form">
          <div className="contactModal__form_row">
            <input type="text" placeholder="Nome" />
            <input type="email" placeholder="E-mail" />
            <input type="text" placeholder="Empresa" />
            <input type="text" placeholder="Cargo" />
            <input type="text" placeholder="Telefone" />
          </div>

          <textarea placeholder="Mensagem" rows="6" />

          <button type="submit" className="contactModal__submit">
            Enviar mensagem
          </button>
        </form>
      </BaseModal>
    </>
  );
};

export default Contact;
