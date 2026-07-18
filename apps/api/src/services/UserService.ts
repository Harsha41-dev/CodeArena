import { ApiError } from "../errors/ApiError";
import type { AppRepository, ListUsersInput } from "../repositories/AppRepository";
import type { PublicUser, Role, UserStatus } from "../types/domain";
import { AuthService } from "./AuthService";

// profile + admin user management
// AuthService is reused for toPublicUser / me so we don't duplicate that mapping
export class UserService {
  private readonly authService: AuthService;

  constructor(private readonly repository: AppRepository) {
    this.authService = new AuthService(repository);
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.authService.me(userId);
    return user;
  }

  async updateMe(
    userId: string,
    input: {
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      country?: string | null;
      countryCode?: string | null;
    }
  ): Promise<PublicUser> {
    const user = await this.repository.updateUser(userId, input);
    const publicUser = this.authService.toPublicUser(user);
    return publicUser;
  }

  async getByUsername(username: string): Promise<PublicUser> {
    const user = await this.repository.findUserByUsername(username);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return this.authService.toPublicUser(user);
  }

  async getStats(username: string) {
    const user = await this.repository.findUserByUsername(username);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const stats = await this.repository.getUserStats(user.id);
    return stats;
  }

  async adminList(input: ListUsersInput) {
    const page = await this.repository.listUsers(input);
    return page;
  }

  async adminGet(id: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(id);

    // treat deleted users as not found for admin get too
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    if (user.status === "DELETED") {
      throw ApiError.notFound("User not found");
    }

    return this.authService.toPublicUser(user);
  }

  async adminUpdate(
    id: string,
    input: {
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      country?: string | null;
      countryCode?: string | null;
    }
  ): Promise<PublicUser> {
    const user = await this.repository.updateUser(id, input);
    return this.authService.toPublicUser(user);
  }

  async adminUpdateRole(actorId: string, id: string, role: Role): Promise<PublicUser> {
    // don't let an admin demote/promote themselves by accident
    if (actorId === id) {
      throw ApiError.badRequest("Admin cannot change their own role");
    }

    const user = await this.repository.updateUser(id, { role });
    return this.authService.toPublicUser(user);
  }

  async adminUpdateStatus(actorId: string, id: string, status: UserStatus): Promise<PublicUser> {
    // admin shouldn't lock themselves out
    if (actorId === id && status !== "ACTIVE") {
      throw ApiError.badRequest("Admin cannot deactivate their own account");
    }

    let deletedAt: Date | null = null;
    if (status === "DELETED") {
      deletedAt = new Date();
    }

    const user = await this.repository.updateUser(id, {
      status,
      deletedAt
    });
    return this.authService.toPublicUser(user);
  }

  async adminDelete(actorId: string, id: string): Promise<void> {
    if (actorId === id) {
      throw ApiError.badRequest("Admin cannot delete their own account");
    }

    // soft delete — set status + deletedAt
    await this.repository.updateUser(id, {
      status: "DELETED",
      deletedAt: new Date()
    });
  }
}
