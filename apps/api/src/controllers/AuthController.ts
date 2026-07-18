import type { Request, Response } from "express";
import type { AuthService } from "../services/AuthService";
import { sendSuccess } from "../utils/apiResponse";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    // body is already validated by zod middleware
    const email = req.body.email as string;
    const username = req.body.username as string;
    const displayName = req.body.displayName as string;
    const password = req.body.password as string;

    const result = await this.authService.register({
      email,
      username,
      displayName,
      password
    });

    sendSuccess(res, "Registered successfully", result, undefined, 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const email = req.body.email as string;
    const password = req.body.password as string;

    const result = await this.authService.login({ email, password });
    sendSuccess(res, "Logged in successfully", result);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.body.refreshToken as string;
    const result = await this.authService.refresh(refreshToken);
    sendSuccess(res, "Token refreshed", result);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    // refresh token is optional — frontend might already have cleared storage
    const refreshToken = req.body.refreshToken as string | undefined;
    await this.authService.logout(refreshToken);
    sendSuccess(res, "Logged out", {});
  };

  me = async (req: Request, res: Response): Promise<void> => {
    // authenticate middleware always sets req.user for this route
    const userId = req.user!.id;
    const user = await this.authService.me(userId);
    sendSuccess(res, "Current user", user);
  };
}
