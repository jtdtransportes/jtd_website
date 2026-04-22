const API_URL = "https://jtd-website.onrender.com/api/users";

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
    const response = await fetch("https://jtd-website.onrender.com/api/contracheques/upload", {
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
    const response = await fetch("https://jtd-website.onrender.com/api/users", {
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
    const response = await fetch("https://jtd-website.onrender.com/api/contracheques", {
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
    const response = await fetch("https://jtd-website.onrender.com/api/users/admin/all", {
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

export async function deactivateUserByAdmin(token, userId) {
  try {
    const response = await fetch(`https://jtd-website.onrender.com/api/users/${userId}/deactivate`, {
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
    const response = await fetch(
      `https://jtd-website.onrender.com/api/users/${userId}/activate`,
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
    const response = await fetch("https://jtd-website.onrender.com/api/contracheques/admin/all", {
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
    const response = await fetch(
      `https://jtd-website.onrender.com/api/contracheques/${contrachequeId}`,
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