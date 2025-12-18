import "./MeetUs.css";
import Caminhao3D from "../../assets/caminhao-3d.png";
import Divider from "../Divider/Divider";

const MeetUs = () => {
  return (
    <>
      <Divider />
      <div className="meetus-container">
        <div className="meetus-image">
          <img
            src={Caminhao3D}
            alt="Caminhão baú branco dentro de uma bola azul como logo 'JTD Transportes'"
          />
        </div>
        <div className="meetus-info-text">
          <h6>
            Conheça nossa <b>história</b>
          </h6>
          <p className="meetus-description">
            De origem familiar, a JTD Transportes foi fundada em 2013 por
            Jonathas Carneiro, com uma estrutura modesta e muita determinação. A
            empresa iniciou sua trajetória prestando serviços para a
            multinacional MK Eletrodomésticos. <br /> <br />
          </p>
          <h6>
            Quem <b>somos</b>
          </h6>
          <p className="meetus-description">
             A qualidade do serviço sempre foi o principal
            diferencial competitivo da JTD. Mesmo com poucos veículos e recursos
            no início, ao longo de sua trajetória a empresa enfrentou diversos
            desafios e conquistou importantes resultados. A persistência em
            alcançar seus objetivos foi fundamental para que chegássemos ao
            patamar em que estamos hoje.
            <br /> <br />
            Temos orgulho das parcerias construídas com empresas como Nestlé,
            Mondial, Ypê e Altenburg Nordeste, entre outras. Essas parcerias
            foram, e continuam sendo, essenciais para a evolução e o
            amadurecimento da JTD Transportes.
          </p>
        </div>
      </div>
    </>
  );
};

export default MeetUs;
