// aqui estava o código como era antes:
const API_BASE_URL = "https://jtd-website.onrender.com";
// const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000";
const API_URL = `${API_BASE_URL}/api/users`;
const CONTRACHEQUES_API_URL = `${API_BASE_URL}/api/contracheques`;
const POPS_API_URL = `${API_BASE_URL}/api/pops`;

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return {
      ok: false,
      message: text?.startsWith("<!DOCTYPE")
        ? "O backend retornou HTML em vez de JSON. Verifique a rota da API."
        : "Resposta inválida do servidor.",
    };
  }

  return response.json();
}

export async function registerUser(data) {
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return await parseResponse(response);
  } catch (error) {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}

export async function loginUser(data) {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return await parseResponse(response);
  } catch (error) {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}

export async function getProfile(token) {
  try {
    const response = await fetch(`${API_URL}/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return await parseResponse(response);
  } catch (error) {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}

export async function updateProfile(token, data) {
  try {
    const response = await fetch(`${API_URL}/updateProfile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    return await parseResponse(response);
  } catch (error) {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}

export async function deactivateAccount(token) {
  try {
    const response = await fetch(`${API_URL}/deactivate`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return await parseResponse(response);
  } catch (error) {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
  
  
}
export async function changePassword(token, data) {
  try {
    const response = await fetch(`${API_URL}/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
  
}

export async function uploadContracheque(token, formData) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch("https://jtd-website.onrender.com/api/contracheques/upload", {
    const response = await fetch(`${CONTRACHEQUES_API_URL}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        message: "O backend não retornou JSON. Verifique se a rota existe.",
      };
    }

    return await response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}
export async function getUsers(token) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch("https://jtd-website.onrender.com/api/users", {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
  
}
export async function getMyContracheques(token) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch("https://jtd-website.onrender.com/api/contracheques", {
    const response = await fetch(CONTRACHEQUES_API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}
export async function getAllUsers(token) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch("https://jtd-website.onrender.com/api/users/admin/all", {
    const response = await fetch(`${API_URL}/admin/all`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}

export async function getAdminDashboard(token) {
  try {
    const response = await fetch(`${API_URL}/admin/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return await parseResponse(response);
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel conectar ao backend.",
    };
  }
}

export async function deactivateUserByAdmin(token, userId) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch(`https://jtd-website.onrender.com/api/users/${userId}/deactivate`, {
    const response = await fetch(`${API_URL}/${userId}/deactivate`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}
export async function activateUserByAdmin(token, userId) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch(
    //   `https://jtd-website.onrender.com/api/users/${userId}/activate`,
    //   {
    const response = await fetch(
      `${API_URL}/${userId}/activate`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
  
}
export async function getAllContrachequesForAdmin(token) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch("https://jtd-website.onrender.com/api/contracheques/admin/all", {
    const response = await fetch(`${CONTRACHEQUES_API_URL}/admin/all`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}

export async function removeContrachequeByAdmin(token, contrachequeId) {
  try {
    // aqui estava o código como era antes:
    // const response = await fetch(
    //   `https://jtd-website.onrender.com/api/contracheques/${contrachequeId}`,
    //   {
    const response = await fetch(
      `${CONTRACHEQUES_API_URL}/${contrachequeId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar ao backend.",
    };
  }
}

export async function getMyPops(token) {
  try {
    const response = await fetch(POPS_API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel conectar ao backend.",
    };
  }
}

export async function uploadPop(token, formData) {
  try {
    const response = await fetch(`${POPS_API_URL}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel conectar ao backend.",
    };
  }
}

export async function getAllPopsForAdmin(token) {
  try {
    const response = await fetch(`${POPS_API_URL}/admin/all`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel conectar ao backend.",
    };
  }
}

export async function removePopByAdmin(token, popId) {
  try {
    const response = await fetch(`${POPS_API_URL}/${popId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel conectar ao backend.",
    };
  }
}
