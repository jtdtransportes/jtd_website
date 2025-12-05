import React from 'react'
import "./Banner.css"
import BannerImage from "../../assets/banner.png"

const Banner = () => {
  return (
    <div className='banner-container'>
      <img className='banner-img' src={BannerImage} alt='Imagem de um caminhão azul escrito jtd transportes ao pôr do sol' />
      <div className='banner-text-container'>
        <h1>A carga é sua. <br /> A responsabilidade é nossa.</h1>
        <p>Desde <b>2013</b> fornecendo serviços de transporte de carga, com <b>qualidade</b> e <b>pontualidade</b> para o mercado.</p>
        <button>Contato</button>
      </div>
    </div>
  )
}

export default Banner
