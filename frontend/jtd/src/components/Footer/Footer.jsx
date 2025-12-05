import React from 'react'
import './Footer.css'
import JTDLogoBranca from "../../assets/icons/logo_jtd_branco.png"

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">

        <div className="footer-column">
          <h3>Institucional</h3>
          <a href="/">Unidades</a>
          <a href="/">Sobre nós</a>
          <a href="/">Perfil de carga</a>
          <a href="/">Nossa estrutura</a>
          <a href="/">Seja JTD</a>
        </div>

        <div className="footer-column">
          <h3>Serviços</h3>
          <a href="/">Agendar coleta</a>
          <a href="/">Fazer cotação</a>
          <a href="/">Rastreamento de carga</a>
          <a href="/">Calcular previsão de entrega</a>
          <a href="/">Gerar 2ª Via de Faturas/Boletos</a>
          <a href="/">Login</a>
        </div>

        <div className="footer-column">
          <h3>Contatos</h3>
          <a href="/">Whatsapp</a>
          <a href="/">Instagram</a>
          <a href="/">Facebook</a>
        </div>

        <div className="footer-logo">
          <img src={JTDLogoBranca} alt="Logo JTD" />
        </div>

      </div>

      <div className="footer-bottom">
        <p>© 2025 JTD Transportes. Todos os direitos reservados.</p>
        <p>Matriz: BR-324, 5039 - Humildes, Feira de Santana - BA, 44097-012</p>
      </div>
    </footer>
  )
}

export default Footer