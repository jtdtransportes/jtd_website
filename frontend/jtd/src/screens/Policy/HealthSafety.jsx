import React from "react";
import "./Policy.css";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";

const Lista = ({ itens }) => (
  <ul className="policy-list">
    {itens.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const HealthSafety = () => {
  return (
    <>
      <Header />
      <div className="policy-container">
        <div className="policy-content">
          <h2>Política de Saúde e Segurança do Trabalho</h2>
          <p className="paragrafo">
            <b>JTD TRANSPORTES LTDA</b>
          </p>

          <h4 className="subtitulo">1. OBJETIVO</h4>
          <p className="paragrafo">
            A <b>JTD TRANSPORTES LTDA</b> estabelece esta Política de Saúde e
            Segurança do Trabalho (SST) com o compromisso de proporcionar um
            ambiente de trabalho seguro, saudável e adequado às atividades
            desenvolvidas, priorizando a preservação da vida, a integridade
            física e mental, a prevenção de acidentes e doenças ocupacionais e o
            bem-estar de seus colaboradores.
          </p>
          <p className="paragrafo">
            Esta política integra os princípios de gestão da empresa e orienta
            suas decisões administrativas, operacionais e estratégicas,
            promovendo uma cultura organizacional baseada na prevenção,
            responsabilidade, conscientização e melhoria contínua.
          </p>

          <h4 className="subtitulo">2. ABRANGÊNCIA</h4>
          <p className="paragrafo">
            Esta política aplica-se a todos os colaboradores, gestores,
            motoristas, profissionais administrativos e operacionais, bem como a
            terceiros, prestadores de serviços e parceiros que desenvolvam
            atividades sob responsabilidade ou controle da JTD TRANSPORTES LTDA.
          </p>
          <p className="paragrafo">
            Abrange as atividades realizadas nas unidades administrativas,
            instalações operacionais, pátios, áreas de carregamento e
            descarregamento, instalações de clientes e operações de transporte
            rodoviário de cargas.
          </p>

          <h4 className="subtitulo">3. COMPROMISSOS DA EMPRESA</h4>
          <p className="paragrafo">
            A JTD TRANSPORTES LTDA assume os seguintes compromissos:
          </p>

          <h4 className="subtitulo">3.1. Preservação da vida e da saúde</h4>
          <p className="paragrafo">
            Promover condições de trabalho que preservem a vida, a saúde física
            e mental e a integridade dos trabalhadores, adotando medidas
            preventivas para eliminar perigos e reduzir riscos ocupacionais.
          </p>

          <h4 className="subtitulo">3.2. Cumprimento da legislação</h4>
          <p className="paragrafo">
            Cumprir a legislação trabalhista e previdenciária aplicável, as
            Normas Regulamentadoras (NRs) do Ministério do Trabalho e Emprego e
            demais requisitos legais relacionados à segurança e saúde
            ocupacional, incluindo as disposições específicas para o transporte
            rodoviário de cargas.
          </p>

          <h4 className="subtitulo">
            3.3. Prevenção de acidentes e doenças ocupacionais
          </h4>
          <p className="paragrafo">
            Identificar, avaliar e controlar os riscos presentes nas atividades
            administrativas e operacionais, mediante implementação e
            acompanhamento do Programa de Gerenciamento de Riscos (PGR), do
            Programa de Controle Médico de Saúde Ocupacional (PCMSO) e de outros
            programas legalmente exigidos.
          </p>

          <h4 className="subtitulo">3.4. Segurança nas operações de transporte</h4>
          <p className="paragrafo">
            Adotar procedimentos que promovam a segurança dos motoristas e
            demais profissionais envolvidos nas operações, incluindo:
          </p>
          <Lista
            itens={[
              "Cumprimento das normas de trânsito e direção defensiva.",
              "Controle da jornada de trabalho e dos períodos de descanso, conforme legislação vigente.",
              "Prevenção da fadiga e de acidentes relacionados ao excesso de jornada.",
              "Inspeção dos veículos antes do início das viagens.",
              "Manutenção preventiva e corretiva da frota.",
              "Cumprimento das regras de segurança nos carregamentos e descarregamentos.",
              "Utilização adequada dos equipamentos de proteção individual e coletiva.",
              "Proibição de condução de veículos sob efeito de álcool, drogas ilícitas ou substâncias que comprometam a capacidade de dirigir.",
              "Respeito aos limites de velocidade, capacidade de carga e demais exigências legais.",
            ]}
          />

          <h4 className="subtitulo">3.5. Treinamento e conscientização</h4>
          <p className="paragrafo">
            Promover treinamentos, orientações e ações educativas para
            desenvolver a percepção de riscos, a adoção de comportamentos
            seguros e o cumprimento dos procedimentos internos.
          </p>

          <h4 className="subtitulo">3.6. Participação dos colaboradores</h4>
          <p className="paragrafo">
            Estimular a participação dos trabalhadores na identificação de
            perigos, comunicação de condições inseguras e proposição de
            melhorias, garantindo que os relatos sejam tratados com
            responsabilidade e sem retaliações quando realizados de boa-fé.
          </p>

          <h4 className="subtitulo">3.7. Gestão de incidentes e acidentes</h4>
          <p className="paragrafo">
            Estabelecer procedimentos para comunicação, registro, investigação e
            análise de acidentes, incidentes e situações de risco, com definição
            de medidas corretivas e preventivas destinadas a evitar
            recorrências.
          </p>

          <h4 className="subtitulo">3.8. Melhoria contínua</h4>
          <p className="paragrafo">
            Monitorar periodicamente o desempenho em saúde e segurança do
            trabalho, avaliando indicadores, resultados de inspeções,
            ocorrências e oportunidades de melhoria.
          </p>

          <h4 className="subtitulo">4. RESPONSABILIDADES</h4>

          <h4 className="subtitulo">4.1. Direção da empresa</h4>
          <p className="paragrafo">Compete à Direção:</p>
          <Lista
            itens={[
              "Assegurar recursos adequados à implementação desta política.",
              "Promover o cumprimento dos requisitos legais.",
              "Estabelecer responsabilidades e acompanhar os resultados.",
              "Incentivar uma cultura de prevenção e segurança.",
            ]}
          />

          <h4 className="subtitulo">4.2. Gestores e lideranças</h4>
          <p className="paragrafo">Compete aos gestores:</p>
          <Lista
            itens={[
              "Orientar e supervisionar as equipes.",
              "Assegurar o cumprimento dos procedimentos de segurança.",
              "Identificar e comunicar situações de risco.",
              "Implementar ações corretivas e preventivas.",
              "Garantir que os colaboradores recebam orientações e treinamentos pertinentes às atividades.",
            ]}
          />

          <h4 className="subtitulo">4.3. Colaboradores e motoristas</h4>
          <p className="paragrafo">Compete aos colaboradores:</p>
          <Lista
            itens={[
              "Cumprir as normas e procedimentos de segurança.",
              "Utilizar corretamente os equipamentos de proteção fornecidos.",
              "Participar dos treinamentos obrigatórios.",
              "Comunicar imediatamente acidentes, incidentes e condições inseguras.",
              "Zelar pela própria segurança e pela segurança de terceiros.",
              "Não executar atividades para as quais não estejam devidamente habilitados, capacitados ou autorizados.",
              "Interromper e comunicar atividades diante de situações que, por motivos razoáveis, representem risco grave e iminente à vida ou à saúde, conforme os procedimentos e a legislação aplicáveis.",
            ]}
          />

          <h4 className="subtitulo">5. DIRETRIZES ESPECÍFICAS PARA MOTORISTAS</h4>
          <p className="paragrafo">
            Considerando a natureza das operações da JTD TRANSPORTES LTDA, a
            empresa estabelece como prioridades:
          </p>
          <Lista
            itens={[
              "Gestão e acompanhamento da jornada de trabalho dos motoristas.",
              "Respeito aos períodos legais de descanso e recuperação física.",
              "Monitoramento das condições de segurança dos veículos.",
              "Prevenção de acidentes nas rodovias, pátios e instalações de clientes.",
              "Orientação sobre condução segura e prevenção de fadiga.",
              "Comunicação imediata de acidentes, avarias e condições inseguras.",
              "Proibição do uso indevido de telefone celular durante a condução.",
              "Cumprimento das exigências de exames médicos ocupacionais e demais avaliações legalmente aplicáveis.",
            ]}
          />

          <h4 className="subtitulo">6. SAÚDE OCUPACIONAL E BEM-ESTAR</h4>
          <p className="paragrafo">
            A JTD TRANSPORTES LTDA compromete-se a promover ações de saúde
            ocupacional, observando os riscos identificados e as exigências
            legais, incluindo:
          </p>
          <Lista
            itens={[
              "Realização de exames médicos ocupacionais previstos no PCMSO.",
              "Acompanhamento das condições de saúde relacionadas ao trabalho.",
              "Ações de prevenção de doenças ocupacionais.",
              "Orientações sobre ergonomia e posturas adequadas.",
              "Medidas de prevenção de riscos psicossociais relacionados ao trabalho, conforme exigências legais aplicáveis.",
              "Incentivo a hábitos saudáveis e à qualidade de vida.",
            ]}
          />
          <p className="paragrafo">
            As informações médicas individuais serão tratadas com
            confidencialidade, observando-se o sigilo profissional e a
            legislação de proteção de dados pessoais.
          </p>

          <h4 className="subtitulo">7. COMUNICAÇÃO E TRATAMENTO DE OCORRÊNCIAS</h4>
          <p className="paragrafo">
            Todos os acidentes, incidentes, quase acidentes e condições
            inseguras deverão ser comunicados imediatamente à liderança
            responsável, para avaliação e adoção das providências necessárias.
          </p>
          <p className="paragrafo">
            A empresa deverá assegurar os encaminhamentos de emergência,
            registros, investigações e comunicações legais cabíveis, inclusive a
            Comunicação de Acidente de Trabalho (CAT), quando aplicável.
          </p>

          <h4 className="subtitulo">8. MONITORAMENTO E INDICADORES</h4>
          <p className="paragrafo">
            A empresa acompanhará, conforme a natureza e os riscos de suas
            operações, indicadores como:
          </p>
          <Lista
            itens={[
              "Quantidade e gravidade dos acidentes de trabalho.",
              "Ocorrências e quase acidentes.",
              "Cumprimento dos treinamentos obrigatórios.",
              "Regularidade dos exames ocupacionais.",
              "Conformidade dos controles de jornada e descanso.",
              "Cumprimento das inspeções e manutenções da frota.",
              "Execução das ações preventivas e corretivas.",
            ]}
          />
          <p className="paragrafo">
            Os resultados serão utilizados para orientar decisões gerenciais e
            aprimorar continuamente as condições de trabalho.
          </p>

          <h4 className="subtitulo">9. DIVULGAÇÃO E COMPROMETIMENTO</h4>
          <p className="paragrafo">
            Esta política deverá ser divulgada a todos os colaboradores,
            disponibilizada para consulta e apresentada durante a integração de
            novos profissionais.
          </p>
          <p className="paragrafo">
            A JTD TRANSPORTES LTDA entende que a segurança é uma
            responsabilidade compartilhada e que nenhuma meta operacional ou
            financeira justifica a exposição indevida de pessoas a riscos.
          </p>

          <h4 className="subtitulo">10. DISPOSIÇÕES FINAIS</h4>
          <p className="paragrafo">
            Esta política entra em vigor após sua aprovação pela Direção da JTD
            TRANSPORTES LTDA e deverá ser revisada periodicamente ou sempre que
            ocorrerem mudanças relevantes nas atividades, nos riscos
            ocupacionais ou na legislação aplicável.
          </p>
          <p className="paragrafo">
            O cumprimento desta política é parte integrante das
            responsabilidades profissionais e dos princípios de gestão da
            empresa.
          </p>

          <h4 className="subtitulo">NOSSO COMPROMISSO:</h4>
          <p className="paragrafo policy-quote">
            <b>
              "Nenhuma entrega é mais importante do que a vida. Segurança é
              responsabilidade de todos."
            </b>
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default HealthSafety;
