import { Route, Routes } from "react-router-dom"
import Home from "../screens/Home/Home"
import AntiCorruption from "../screens/Policy/AntiCorruption"
import Environmental from "../screens/Policy/Environmental"
import CodeOfEthics from "../screens/Policy/CodeOfEthics"
import ETIBaseCodes from "../screens/Policy/ETIBaseCodes"

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="anticorruption" element={<AntiCorruption />} />
            <Route path="environmental" element={<Environmental />} />
            <Route path="codeofethics" element={<CodeOfEthics />} />
            <Route path="etibasecodes" element={<ETIBaseCodes />} />
        </Routes>
    )
}

export default AppRoutes
