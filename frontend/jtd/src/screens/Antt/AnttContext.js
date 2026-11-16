import { createContext, useContext } from "react";

export const AnttContext = createContext({ podeEditar: false, podeComunicar: false, opcoes: null, config: null, recarregarConfig: () => {}, recarregarOpcoes: () => {} });
export const useAntt = () => useContext(AnttContext);
