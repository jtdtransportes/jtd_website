import userRepository from "../repositories/user.repository.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";

function addDaysToDateString(dateString, days) {
  const [year, month, day] = String(dateString || "")
    .split("-")
    .map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toNumber(value) {
  return Number(value || 0);
}

class UserService {
  normalizeCpf(cpf) {
    return String(cpf || "").replace(/\D/g, "");
  }

  async register(data) {
    const nome = String(data.nome || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "");
    const cpf = this.normalizeCpf(data.cpf);
    const data_nascimento = data.data_nascimento;
    const sexo = String(data.sexo || "").trim().toLowerCase();
    const telefone = String(data.telefone || "").trim();
    const sector_id = data.sector_id ? Number(data.sector_id) : null;
    const role = data.role === "admin" ? "admin" : "user";

    if (
      !nome ||
      !email ||
      !password ||
      !cpf ||
      !data_nascimento ||
      !sexo ||
      !sector_id
    ) {
      throw new Error("Preencha todos os campos obrigatórios.");
    }

    if (password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }

    if (cpf.length !== 11) {
      throw new Error("CPF inválido.");
    }

    const userByEmail = await userRepository.findByEmail(email);

    if (userByEmail) {
      throw new Error("Este e-mail já está cadastrado.");
    }

    const userByCpf = await userRepository.findByCpf(cpf);

    if (userByCpf) {
      throw new Error("Este CPF já está cadastrado.");
    }

    const password_hash = await hashPassword(password);

    const user = await userRepository.create({
      nome,
      email,
      password_hash,
      cpf,
      data_nascimento,
      sexo,
      telefone,
      sector_id,
      role,
      is_active: 1,
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }

  async login(login, password) {
    const normalizedLogin = String(login || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedLogin || !normalizedPassword) {
      throw new Error("E-mail/CPF e senha são obrigatórios.");
    }

    const user = await userRepository.findByEmailOrCpf(normalizedLogin);

    if (!user) {
      throw new Error("E-mail/CPF ou senha inválidos.");
    }

    if (!user.is_active) {
      throw new Error("Usuário inativo.");
    }

    const passwordMatch = await comparePassword(
      normalizedPassword,
      user.password_hash
    );

    if (!passwordMatch) {
      throw new Error("E-mail/CPF ou senha inválidos.");
    }

    await userRepository.updateLastLogin(user.id);

    const safeUser = await userRepository.findById(user.id);

    const token = generateToken({
      id: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
    });

    return { user: safeUser, token };
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    return user;
  }

  async updateProfile(userId, data) {
    const nome = String(data.nome || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const telefone = String(data.telefone || "").trim();
    const sexo = String(data.sexo || "").trim().toLowerCase();
    const data_nascimento = data.data_nascimento;
    const hasSectorId = Object.prototype.hasOwnProperty.call(
      data,
      "sector_id"
    );

    if (!nome || !email || !sexo || !data_nascimento) {
      throw new Error("Preencha todos os campos obrigatórios.");
    }

    const existingUser = await userRepository.findById(userId);

    if (!existingUser) {
      throw new Error("Usuário não encontrado.");
    }

    const emailInUse = await userRepository.findByEmailExcludingId(
      email,
      userId
    );

    if (emailInUse) {
      throw new Error("Este e-mail já está em uso.");
    }

    let sector_id = existingUser.sector_id || null;

    if (hasSectorId) {
      sector_id =
        data.sector_id === "" ||
        data.sector_id === null ||
        data.sector_id === undefined
          ? null
          : Number(data.sector_id);

      if (
        sector_id !== null &&
        (!Number.isInteger(sector_id) || sector_id <= 0)
      ) {
        throw new Error("Setor selecionado invalido.");
      }
    }

    const updatedUser = await userRepository.updateProfile(userId, {
      nome,
      email,
      telefone,
      sexo,
      data_nascimento,
      sector_id,
    });

    return updatedUser;
  }

  async deactivateAccount(userId) {
    const existingUser = await userRepository.findById(userId);

    if (!existingUser) {
      throw new Error("Usuário não encontrado.");
    }

    await userRepository.deactivateAccount(userId);
  }

  async changePassword(userId, currentPassword, newPassword, confirmNewPassword) {
    const current = String(currentPassword || "");
    const next = String(newPassword || "");
    const confirm = String(confirmNewPassword || "");

    if (!current || !next || !confirm) {
      throw new Error("Preencha todos os campos da senha.");
    }

    if (next.length < 6) {
      throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
    }

    if (next !== confirm) {
      throw new Error("A confirmação da nova senha não confere.");
    }

    const user = await userRepository.findWithPasswordById(userId);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    if (!user.is_active) {
      throw new Error("Usuário inativo.");
    }

    const passwordMatch = await comparePassword(current, user.password_hash);

    if (!passwordMatch) {
      throw new Error("A senha atual está incorreta.");
    }

    const samePassword = await comparePassword(next, user.password_hash);

    if (samePassword) {
      throw new Error("A nova senha não pode ser igual à senha atual.");
    }

    const newPasswordHash = await hashPassword(next);

    await userRepository.updatePassword(userId, newPasswordHash);
  }

  async listUsers() {
    return userRepository.findAll();
  }

  async listUsersForAdmin() {
    return userRepository.findAllForAdmin();
  }

  async getAdminDashboardStats() {
    const dashboard = await userRepository.getAdminDashboardStats();
    const summary = dashboard.summary || {};
    const dailyByDate = new Map(
      (dashboard.daily || []).map((item) => [
        item.login_date,
        {
          accesses: toNumber(item.access_count),
          users: toNumber(item.user_count),
        },
      ])
    );

    const today = dashboard.today || new Date().toISOString().slice(0, 10);
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = addDaysToDateString(today, index - 6);
      const dayData = dailyByDate.get(date) || { accesses: 0, users: 0 };

      return {
        date,
        accesses: dayData.accesses,
        users: dayData.users,
      };
    });

    const totalWeekAccesses = week.reduce(
      (total, day) => total + day.accesses,
      0
    );
    const totalWeekUsers = week.reduce((total, day) => total + day.users, 0);
    const totalUsers = toNumber(summary.total_users);
    const adoptedUsers = toNumber(summary.adopted_users);
    const notAdoptedUsers = toNumber(summary.not_adopted_users);
    const adoptedPercentage = totalUsers
      ? Number(((adoptedUsers / totalUsers) * 100).toFixed(1))
      : 0;
    const notAdoptedPercentage = totalUsers
      ? Number(((notAdoptedUsers / totalUsers) * 100).toFixed(1))
      : 0;

    return {
      totalUsers,
      activeUsers: toNumber(summary.active_users),
      loginsLast24Hours: toNumber(summary.logins_last_24h),
      week: {
        days: week,
        totalAccesses: totalWeekAccesses,
        averageAccessesPerDay: Number((totalWeekAccesses / 7).toFixed(1)),
        averageUsersPerDay: Number((totalWeekUsers / 7).toFixed(1)),
      },
      adoption: {
        adoptedUsers,
        notAdoptedUsers,
        adoptedPercentage,
        notAdoptedPercentage,
      },
    };
  }

  async adminDeactivateUser(userId) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    await userRepository.adminDeactivateUser(userId);
  }

  async adminActivateUser(userId) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    await userRepository.adminActivateUser(userId);
  }
}

export default new UserService();
