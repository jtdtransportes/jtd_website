import React from 'react'
import "./MeetUs.css"
import Caminhao3D from "../../assets/caminhao-3d.png"

const MeetUs = () => {
    return (
        <div className='meetus-container'>
            <div className='meetus-image'>
                <img src={Caminhao3D} alt="Caminhão baú branco dentro de uma bola azul como logo 'JTD Transportes'" />
            </div>
            <div className='meetus-info-text'>
                <p>Conheça nossa <b>história</b></p>
                <p className='meetus-description'>De origem familiar a JTD TRANSPORTES foi fundada no ano de 2013 por Jonathas Carneiro com estrutura modesta e muita determinação, a empresa iniciou sua trajetória prestando serviço para multinacional MK Eletrodomésticos.

A qualidade do serviço sempre foi o diferencial competitivo da empresa, apesar dos poucos veículos e recursos, ao longo de seu percurso a empresa obteve vários desafios e muitas conquistas, porém a persistência em atingir os objetivos nos impulsionou a chegar no lugar onde estamos hoje. Temos orgulho da parceria com empresas como: Nestlé, Mondial Ype Altemburg Nordeste, entre outras

Essas parcerias foram e são fundamentais para a evolução e amadurecimento da JTD.</p>
            </div>
        </div>
    )
}

export default MeetUs
