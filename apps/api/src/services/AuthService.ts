import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../errors/ApiError";
import type { AppRepository } from "../repositories/AppRepository";
import type { PublicUser, User } from "../types/domain";
import { sha256 } from "../utils/hash";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

interface RefreshPayload {
  sub: string;
}

export class AuthService {
  constructor(private readonly repository: AppRepository) {}

  async register(input: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }): Promise<AuthResult> {
    // check duplicates first so we don't hash for nothing
    const existingEmail = await this.repository.findUserByEmail(input.email);
    if (existingEmail) {
      throw ApiError.conflict("Email is already registered");
    }

    const existingUsername = await this.repository.findUserByUsername(input.username);
    if (existingUsername) {
      throw ApiError.conflict("Username is already taken");
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

    const user = await this.repository.createUser({
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash,
      role: "USER"
    });

    const tokens = await this.issueTokens(user);
    return {
      user: this.toPublicUser(user),
      tokens
    };
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(input.email);

    // same message for missing user / bad password (don't leak which one)
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden("User account is not active");
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const tokens = await this.issueTokens(user);
    return {
      user: this.toPublicUser(user),
      tokens
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: RefreshPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshPayload;
    } catch {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    const tokenHash = sha256(refreshToken);
    const stored = await this.repository.findRefreshToken(tokenHash);

    if (!stored) {
      throw ApiError.unauthorized("Refresh token is expired or revoked");
    }
    if (stored.revokedAt) {
      throw ApiError.unauthorized("Refresh token is expired or revoked");
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw ApiError.unauthorized("Refresh token is expired or revoked");
    }

    const user = await this.repository.findUserById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized("User no longer exists");
    }
    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden("User account is not active");
    }

    // rotate — revoke old refresh token then mint a new pair
    await this.repository.revokeRefreshToken(tokenHash);

    const tokens = await this.issueTokens(user);
    return {
      user: this.toPublicUser(user),
      tokens
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const tokenHash = sha256(refreshToken);
    await this.repository.revokeRefreshToken(tokenHash);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden("User account is not active");
    }
    return this.toPublicUser(user);
  }

  // strip password hash before sending to client
  toPublicUser(user: User): PublicUser {
    const { passwordHash, ...rest } = user;
    // passwordHash intentionally unused
    void passwordHash;
    return rest;
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessOptions: SignOptions = {
      subject: user.id,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
    };
    const refreshOptions: SignOptions = {
      subject: user.id,
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
    };

    const accessToken = jwt.sign(
      {
        role: user.role,
        email: user.email,
        username: user.username
      },
      env.JWT_ACCESS_SECRET,
      accessOptions
    );

    // refresh token payload is intentionally empty — we only need the subject + signature
    const refreshToken = jwt.sign({}, env.JWT_REFRESH_SECRET, refreshOptions);

    const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN));
    await this.repository.createRefreshToken(user.id, sha256(refreshToken), expiresAt);

    return {
      accessToken,
      refreshToken
    };
  }
}

// tiny helper for "15m" / "7d" style env values
function parseDuration(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    // fallback 7 days if env is weird
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === "s") {
    return value * 1000;
  }
  if (unit === "m") {
    return value * 60 * 1000;
  }
  if (unit === "h") {
    return value * 60 * 60 * 1000;
  }
  // days
  return value * 24 * 60 * 60 * 1000;
}
