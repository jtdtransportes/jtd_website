import "./Contact.css";
import { useState } from "react";
import JTDLogo from "../../assets/logo_branca.png";
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

      {openFeedback && (
        <div className="contact__overlay">
          <div className="contact__modal">
            <div className="contact__modal_header">
              <div className="contact__modal_logo">
                <img src={JTDLogo} alt="JTD Transportes" />
              </div>

              <div className="contact__modal_actions">
                <a href="https://github.com" aria-label="Instagram">
                  <i className="fab fa-instagram"></i>
                </a>
                <a href="https://github.com" aria-label="Facebook">
                  <i className="fab fa-facebook-f"></i>
                </a>
                <a href="https://github.com" aria-label="WhatsApp">
                  <i className="fab fa-whatsapp"></i>
                </a>
                <a href="https://github.com" aria-label="LinkedIn">
                  <i className="fab fa-linkedin-in"></i>
                </a>

                <button
                  className="contact__modal_close"
                  onClick={() => setOpenFeedback(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="contact__modal__content">
              <h2 className="contact__modal_title">
                Envie suas sugestões e reclamações
              </h2>

              <p className="contact__text_modal">
                A JTD Transportes acredita que ouvir os clientes, colaboradores
                e fornecedores é fundamental para garantir a qualidade dos
                serviços prestados. Portanto, é importante sempre estar aberto à
                comunicação com todos e considerar suas opiniões na tomada de
                decisões.
                <br />
                <br />
                Deixe abaixo sua sugestão e/ou reclamação. Ela é anônima.
              </p>

              <form className="contact__form">
                <div className="contact__form_row">
                  <input type="text" placeholder="Nome (opcional)" required />
                  <input
                    type="email"
                    placeholder="E-mail (opcional)"
                    required
                  />
                </div>

                <textarea placeholder="Mensagem" rows="6" required />

                <button type="submit" className="contact__submit">
                  Enviar e-mail
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {openContact && (
        <div className="contactModal__overlay">
          <div className="contactModal__modal">
            <div className="contactModal__header">
              <div className="contactModal__logo">
                <img src={JTDLogo} alt="JTD Transportes" />
              </div>

              <div className="contactModal__actions">
                <a href="https://github.com" aria-label="Instagram">
                  <i className="fab fa-instagram"></i>
                </a>
                <a href="https://github.com" aria-label="Facebook">
                  <i className="fab fa-facebook-f"></i>
                </a>
                <a href="https://github.com" aria-label="WhatsApp">
                  <i className="fab fa-whatsapp"></i>
                </a>
                <a href="https://github.com" aria-label="LinkedIn">
                  <i className="fab fa-linkedin-in"></i>
                </a>

                <button
                  className="contactModal__close"
                  onClick={() => setOpenContact(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="contactModal__content">
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
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Contact;
