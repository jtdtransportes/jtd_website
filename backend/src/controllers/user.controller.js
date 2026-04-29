import userService from "../services/user.service.js";

class UserController {
  async register(req, res) {
    try {
      const result = await userService.register(req.body);

      return res.status(201).json({
        ok: true,
        message: "Usuário cadastrado com sucesso.",
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async login(req, res) {
    try {
      const { login, password } = req.body;

      const result = await userService.login(login, password);

      return res.status(200).json({
        ok: true,
        message: "Login realizado com sucesso.",
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async profile(req, res) {
    try {
      const user = await userService.getProfile(req.user.id);

      return res.status(200).json({
        ok: true,
        user,
      });
    } catch (error) {
      return res.status(404).json({
        ok: false,
        message: error.message,
      });
    }
  }
  async updateProfile(req, res) {
    try {
      const user = await userService.updateProfile(req.user.id, req.body);

      return res.status(200).json({
        ok: true,
        message: "Perfil atualizado com sucesso.",
        user,
      });
    } catch (error) {
      if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json({
          ok: false,
          message: "Setor selecionado nao existe.",
        });
      }

      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async deactivateAccount(req, res) {
    try {
      await userService.deactivateAccount(req.user.id);

      return res.status(200).json({
        ok: true,
        message: "Conta desativada com sucesso.",
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;

      await userService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
        confirmNewPassword
      );

      return res.status(200).json({
        ok: true,
        message: "Senha atualizada com sucesso.",
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
  async listUsers(req, res) {
    try {
      const users = await userService.listUsers();

      return res.status(200).json({
        ok: true,
        users,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async listUsersForAdmin(req, res) {
    try {
      const users = await userService.listUsersForAdmin();

      return res.status(200).json({
        ok: true,
        users,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
  async adminDeactivateUser(req, res) {
    try {
      await userService.adminDeactivateUser(req.params.id);

      return res.status(200).json({
        ok: true,
        message: "Usuário desativado com sucesso.",
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }

  async adminActivateUser(req, res) {
    try {
      await userService.adminActivateUser(req.params.id);

      return res.status(200).json({
        ok: true,
        message: "Usuário ativado com sucesso.",
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }


}

export default new UserController();
