import "./App.css";
import AppRoutes from "./config/routes";
import ScrollToHash from "./utils/ScrollToHash";
import ScrollToTop from "./utils/ScrollToTop";

function App() {
  return (
    <>
      <ScrollToTop />
      <ScrollToHash />
      <AppRoutes />
    </>
  );
}

export default App;
