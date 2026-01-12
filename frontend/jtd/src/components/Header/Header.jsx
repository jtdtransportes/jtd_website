import React, { useState } from "react";
import "./Header.css";
import JTDLogo from "../../assets/icons/jtd_logo_azul.png";
import { IoChevronDown, IoMenu, IoClose } from "react-icons/io5";
import { Link } from "react-router-dom";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const toggleDropdown = (menu) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  return (
    <>
      <div className="header-container">
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
              <Link to="/">Sugestões e Reclamações</Link>
              <Link to="/">Fale Conosco</Link>
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
              <a href="/">Fale Conosco</a>
              <a href="/">Sugestões e Reclamações</a>
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
    </>
  );
};

export default Header;
