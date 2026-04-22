import { Route, Routes } from "react-router-dom";
import Home from "../screens/Home/Home";
import AntiCorruption from "../screens/Policy/AntiCorruption";
import Environmental from "../screens/Policy/Environmental";
import CodeOfEthics from "../screens/Policy/CodeOfEthics";
import ETIBaseCodes from "../screens/Policy/ETIBaseCodes";
import Login from "../screens/Login/Login"
import Profile from "../screens/Profile/Profile"
import Register from "../screens/Register/Register";

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
      </Routes>
  );
};

export default AppRoutes;
