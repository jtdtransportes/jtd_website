import JTDLogo from "../../assets/logo_branca.png";
import "./BaseModal.css";


const BaseModal = ({ isOpen, onClose, classPrefix, children }) => {
  if (!isOpen) return null;

  return (
    <div className={`${classPrefix}__overlay`}>
      <div className={`${classPrefix}__modal`}>
        <div className={`${classPrefix}__header`}>
          <div className={`${classPrefix}__logo`}>
            <img src={JTDLogo} alt="JTD Transportes" />
          </div>

          <div className={`${classPrefix}__actions`}>
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
              className={`${classPrefix}__close`}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className={`${classPrefix}__content`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default BaseModal;
