import userRepository from "../repositories/user.repository.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";

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

    const updatedUser = await userRepository.updateProfile(userId, {
      nome,
      email,
      telefone,
      sexo,
      data_nascimento,
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