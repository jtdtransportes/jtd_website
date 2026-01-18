import React from "react";
import "./Home.css";
import Header from "../../components/Header/Header";
import Banner from "../../components/Banner/Banner";
import StatCard from "../../components/StatCard/StatCard";
import ServiceArea from "../../components/ServiceArea/ServiceArea";
import MeetUs from "../../components/MeetUs/MeetUs";
import QuickActions from "../../components/QuickActions/QuickActions";
import BusinessPartner from "../../components/BusinessPartner/BusinessPartner";
import Contact from "../../components/Contact/Contact";
import Footer from "../../components/Footer/Footer";

const Home = () => {
  return (
    <div>
      <Header />
      <Banner />
      <StatCard />
      <section id="sobre-nos">
        <MeetUs />
      </section>
      <QuickActions />
       <section id="clientes">
        <BusinessPartner />
      </section>
      <Contact />
       <section id="localizacao">
        <ServiceArea />
      </section>
      <Footer />
    </div>
  );
};

export default Home;
