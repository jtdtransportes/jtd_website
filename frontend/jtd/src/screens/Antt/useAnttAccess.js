import { useEffect, useState } from "react";
import { anttApi } from "../../services/anttService";

// Cache curto em memória para não consultar o backend a cada troca de página.
let cache = { token: null, ok: false, at: 0 };

/** true quando há usuário autenticado E autorizado no módulo ANTT (usado para exibir o item de menu). */
export default function useAnttAccess() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const fresh = cache.token === token && Date.now() - cache.at < 5 * 60 * 1000;
  const [ok, setOk] = useState(token && fresh ? cache.ok : false);

  useEffect(() => {
    if (!token) { setOk(false); return undefined; }
    if (cache.token === token && Date.now() - cache.at < 5 * 60 * 1000) { setOk(cache.ok); return undefined; }
    let vivo = true;
    anttApi.acesso().then((r) => {
      const permitido = Boolean(r?.ok && r.acesso);
      cache = { token, ok: permitido, at: Date.now() };
      if (vivo) setOk(permitido);
    });
    return () => { vivo = false; };
  }, [token]);

  return ok;
}
