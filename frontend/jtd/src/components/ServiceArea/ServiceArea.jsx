import "./ServiceArea.css"

const ServiceArea = () => {

    return (
        <div className='service-container'>
            <div className='service-info-text'>
                <p className='service__title'><b>Onde</b> atuamos?</p>
                <p className='service-description'>
                    Nossa base está localizada em Feira de Santana - BA, um ponto estratégico no Nordeste, que nos permite oferecer maior agilidade e ampla cobertura logística para diversas regiões do Brasil.
                </p>
                <p className='service-description'>
                    BR-324, 5039 - Humildes, Feira de Santana - BA, 44097-012
                </p>
            </div>

            <div className='service-map'>
                <iframe
                    src="https://www.google.com/maps?q=-12.315149448877332,-38.87943696132987&hl=pt-BR&z=15&output=embed"
                    width="100%"
                    height="400"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                ></iframe>
            </div>
        </div>
    )
}

export default ServiceArea