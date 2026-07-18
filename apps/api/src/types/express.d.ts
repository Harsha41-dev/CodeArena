import type { Role } from "./domain";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        email: string;
        username: string;
      };
    }
  }
}

export {};
