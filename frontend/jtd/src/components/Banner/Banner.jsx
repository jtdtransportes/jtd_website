import React, { useEffect, useState } from "react";
import "./Banner.css";

import BannerImage from "../../assets/banner.png";
import BannerImageMobile from "../../assets/banner_mobile.png";

import BannerImage1 from "../../assets/banner1.png";
import BannerImageMobile1 from "../../assets/banner_mobile1.jpg";

import BannerImage2 from "../../assets/banner2.png";
import BannerImageMobile2 from "../../assets/banner_mobile2.png";

const banners = [
  {
    desktop: BannerImage,
    mobile: BannerImageMobile,
    showText: true,
    button: {
      text: "Contato",
      link: "#contato",
      desktopClass: "btn-banner-1",
      mobileClass: "btn-banner-1-mobile",
    },
  },
  {
    desktop: BannerImage1,
    mobile: BannerImageMobile1,
    showText: false,
    button: {
      text: "Saiba mais",
      link: "#servicos",
      desktopClass: "btn-banner-2",
      mobileClass: "btn-banner-2-mobile",
    },
  },
  {
    desktop: BannerImage2,
    mobile: BannerImageMobile2,
    showText: false,
  },
];

const Banner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentIndex]);

  return (
    <div className="banner-container">
      <div
        className="banner-slider"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {banners.map((banner, index) => (
          <div className="banner-slide" key={index}>
            <img
              className="banner-img"
              src={isMobile ? banner.mobile : banner.desktop}
              alt="Banner"
            />

            <div
              className={`banner-content ${
                banner.showText ? "with-text" : "only-button"
              }`}
            >
              {banner.showText && (
                <>
                  <h1>
                    A carga é sua. <br /> A responsabilidade é nossa.
                  </h1>
                  <p>
                    Desde <b>2013</b> fornecendo serviços de transporte de
                    carga, com <b>qualidade</b> e <b>pontualidade</b> para o
                    mercado.
                  </p>
                </>
              )}

              {banner.button && (
                <a href={banner.button.link}>
                  <button
                    className={
                      isMobile
                        ? banner.button.mobileClass
                        : banner.button.desktopClass
                    }
                  >
                    {banner.button.text}
                  </button>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="banner-dots">
        {banners.map((_, index) => (
          <button
            key={index}
            className={`banner-dot ${currentIndex === index ? "active" : ""}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Ir para o banner ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default Banner;
