# Auth Flow

This project uses a simple JWT-based auth flow with access tokens and refresh tokens.

## Register

1. Validate email, username, display name, and password.
2. Check that email and username are not already used.
3. Hash the password with bcrypt.
4. Create the user with `USER` role.
5. Create access and refresh tokens.
6. Store only the hashed refresh token in the database.

## Login

1. Find the user by email.
2. Compare the password with the stored hash.
3. Create a new access token and refresh token.
4. Store the hashed refresh token.
5. Return user data and tokens.

## Refresh Token

1. Verify the refresh token signature.
2. Hash the received token and look it up in the database.
3. Reject if the token is missing, expired, or revoked.
4. Revoke the old refresh token.
5. Issue a new access token and refresh token.

This gives refresh-token rotation, so an old refresh token cannot be reused after refresh.

## Logout

Logout revokes the refresh token if the client sends it. The frontend also clears stored auth data.

## Roles

Normal users get the `USER` role. Admin-only APIs use:

```text
authenticate -> requireRole("ADMIN")
```

Frontend guards are only for user experience. The real access control is checked on the backend.
