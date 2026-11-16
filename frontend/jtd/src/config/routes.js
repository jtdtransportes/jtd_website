import { Navigate, Route, Routes } from "react-router-dom";
import Home from "../screens/Home/Home";
import AntiCorruption from "../screens/Policy/AntiCorruption";
import Environmental from "../screens/Policy/Environmental";
import CodeOfEthics from "../screens/Policy/CodeOfEthics";
import ETIBaseCodes from "../screens/Policy/ETIBaseCodes";
import Login from "../screens/Login/Login"
import Profile from "../screens/Profile/Profile"
import Register from "../screens/Register/Register";
import AnttLayout from "../screens/Antt/AnttLayout";
import AnttGatilhos from "../screens/Antt/AnttGatilhos";
import AnttCalculadora from "../screens/Antt/AnttCalculadora";
import AnttRetroativos from "../screens/Antt/AnttRetroativos";
import AnttConfiguracoes from "../screens/Antt/AnttConfiguracoes";
import AnttComunicados from "../screens/Antt/AnttComunicados";

const AppRoutes = () => {
  // const basename = process.env.NODE_ENV === "production" ? "/jtd_website" : "/";
  return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="anticorruption" element={<AntiCorruption />} />
        <Route path="environmental" element={<Environmental />} />
        <Route path="codeofethics" element={<CodeOfEthics />} />
        <Route path="etibasecodes" element={<ETIBaseCodes />} />
        <Route path="login" element={<Login />} />
        <Route path="profile" element={<Profile />} />
        <Route path="register" element={<Register />} />
        {/* Módulo ANTT (HashRouter): /#/antt = Gatilhos e marcos (tela principal, com preços e gráficos) */}
        <Route path="antt" element={<AnttLayout />}>
          <Route index element={<AnttGatilhos />} />
          {/* rotas antigas continuam funcionando */}
          <Route path="reajustes" element={<Navigate to="/antt" replace />} />
          <Route path="historico" element={<Navigate to="/antt" replace />} />
          <Route path="precos" element={<Navigate to="/antt" replace />} />
          <Route path="dashboard" element={<Navigate to="/antt" replace />} />
          <Route path="comunicados" element={<AnttComunicados />} />
          <Route path="calculadora" element={<AnttCalculadora />} />
          <Route path="retroativos" element={<AnttRetroativos />} />
          <Route path="configuracoes" element={<AnttConfiguracoes />} />
        </Route>
      </Routes>
  );
};

export default AppRoutes;
