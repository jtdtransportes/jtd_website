import React from "react";
import "./BusinessPartner.css";
import Mondial from "../../assets/empresas/mondial.png";
import Nestle from "../../assets/empresas/nestle.png";
import Honda from "../../assets/empresas/honda.png";
import Altenburg from "../../assets/empresas/altenburg.png";

const img = [
  { id: 1, image: Honda, alt: "Logo" },
  { id: 2, image: Nestle, alt: "Logo" },
  { id: 3, image: Mondial, alt: "Logo" },
  { id: 4, image: Altenburg, alt: "Logo" },
];

const BusinessPartner = () => {
  return (
    <div className="business-partner">
      <div className="business-partner__header">
        <p className="business-partner__title">Empresas parceiras</p>
        <p className="business-partner__subtitle">
          Temos orgulho de trabalhar com nossos parceiros para ajudá-los a ir
          além.
        </p>
      </div>
      <div className="business-partner__table-container">
        <table className="business-partner__table">
          <tbody>
            <tr className="business-partner__row">
              {img.map((index) => (
                <td key={index.id} className="business-partner__cell">
                  <img
                    src={index.image}
                    alt={index.alt}
                    className={`business-partner__logo ${
                      index.alt === "Logo" && (index.id === 3 || index.id === 4)
                        ? "business-partner__logo--large"
                        : ""
                    }`}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BusinessPartner;
