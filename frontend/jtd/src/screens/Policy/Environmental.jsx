import React from "react";
import "./Policy.css";
import Header from "../../components/Header/Header";

const Environmental = () => {
  return (
    <>
      <Header />
      <div className="policy-container">
        <div className="policy-content">
          <h2>Política Ambiental</h2>
          <p className="paragrafo">
            <b>Objetivo:</b> Expor os interesses e responsabilidades ambientais
            da empresa. <br />
            <br /> A <b>JTD TRANSPORTES LTDA</b>, na busca da melhoria contínua
            das ações voltadas para o meio ambiente, assegura que está
            comprometida em. <br />
            <br />
            <ul>
              <li>
                Promover o desenvolvimento sustentável, protegendo o meio
                ambiente através da prevenção da poluição, administrando os
                impactos ambientais de forma a torná-los compatíveis com a
                preservação das condições necessárias à vida;{" "}
              </li>
              <li>
                Atender à legislação ambiental vigente aplicável e demais
                requisitos subscritos pela organização; Promover a melhoria
                contínua em meio ambiente através de sistema de gestão
                estruturado que controla e avalia as atividades, produtos e
                serviços, bem como estabelece e revisa seus objetivos e metas
                ambientais;
              </li>
              <li>
                Garantir transparência nas atividades e ações da empresa,
                disponibilizando às partes interessadas informações sobre seu
                desempenho em meio ambiente;
              </li>
              <li>
                Praticar a reciclagem e o reuso das águas do processo produtivo,
                contribuindo com a redução dos impactos ambientais através do
                uso racional dos recursos naturais;
              </li>
              <li>
                Promover a conscientização e o envolvimento de seus
                colaboradores, para que atuem de forma responsável e
                ambientalmente correta;
              </li>
            </ul>
            <br /><br />
            <b>A DIREÇÃO</b>
          </p>
        </div>
      </div>
    </>
  );
};

export default Environmental;
