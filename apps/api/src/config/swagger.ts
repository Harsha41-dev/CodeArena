const json = {
  success: { type: "boolean", example: true },
  message: { type: "string", example: "OK" },
  meta: { type: "object", additionalProperties: true }
} as const;

const standardErrors = {
  400: { description: "Validation or business rule error" },
  401: { description: "Missing or invalid bearer token" },
  403: { description: "Authenticated user lacks the required role or ownership" },
  404: { description: "Requested resource was not found" },
  429: { description: "Rate limit exceeded" },
  500: { description: "Unexpected server error" }
} as const;

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "CodeArena API",
    version: "1.0.0",
    description:
      "API for my CodeArena project — auth, problems, run/submit, contests, discussions, languages, and admin test generation."
  },
  servers: [{ url: "http://localhost:4000" }],
  tags: [
    { name: "Auth" },
    { name: "Problems" },
    { name: "Test Generation" },
    { name: "Languages" },
    { name: "Submissions" },
    { name: "Contests" },
    { name: "Leaderboards" },
    { name: "Users" },
    { name: "Social" },
    { name: "System" }
  ],
  paths: {
    "/ping": {
      get: { tags: ["System"], summary: "Liveness check", responses: { 200: { description: "Pong" } } }
    },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check with executor and queue metadata",
        responses: { 200: { description: "Healthy" } }
      }
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a user",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } }
        },
        responses: { 201: { description: "Registered" }, ...standardErrors }
      }
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive access and refresh tokens",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
        },
        responses: { 200: { description: "Logged in" }, ...standardErrors }
      }
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh token",
        responses: { 200: { description: "Token pair rotated" }, ...standardErrors }
      }
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Profile" }, ...standardErrors }
      }
    },
    "/api/v1/users/me": {
      patch: {
        tags: ["Users"],
        summary: "Update current user profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProfileRequest" } } }
        },
        responses: { 200: { description: "Profile updated" }, ...standardErrors }
      }
    },
    "/api/v1/users/{username}/stats": {
      get: {
        tags: ["Users"],
        summary: "Get public user stats",
        parameters: [{ name: "username", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Stats" }, ...standardErrors }
      }
    },
    "/api/v1/admin/users": {
      get: {
        tags: ["Users"],
        summary: "List users with admin filters",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "role", in: "query", schema: { type: "string", enum: ["USER", "ADMIN"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE", "DELETED"] } }
        ],
        responses: { 200: { description: "Users page" }, ...standardErrors }
      }
    },
    "/api/v1/admin/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user by id (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "User" }, ...standardErrors }
      },
      patch: {
        tags: ["Users"],
        summary: "Update user profile fields (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUpdateUserRequest" } } }
        },
        responses: { 200: { description: "User updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Users"],
        summary: "Soft-delete user (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "User deleted" }, ...standardErrors }
      }
    },
    "/api/v1/admin/users/{id}/role": {
      patch: {
        tags: ["Users"],
        summary: "Update user role (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUpdateUserRoleRequest" } } }
        },
        responses: { 200: { description: "Role updated" }, ...standardErrors }
      }
    },
    "/api/v1/admin/users/{id}/status": {
      patch: {
        tags: ["Users"],
        summary: "Update user status (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUpdateUserStatusRequest" } } }
        },
        responses: { 200: { description: "Status updated" }, ...standardErrors }
      }
    },
    "/api/v1/tags": {
      get: { tags: ["Problems"], summary: "List problem tags", responses: { 200: { description: "Tags" } } }
    },
    "/api/v1/problems": {
      get: {
        tags: ["Problems"],
        summary: "List public problems",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "difficulty", in: "query", schema: { $ref: "#/components/schemas/Difficulty" } },
          { name: "tag", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } }
        ],
        responses: { 200: { description: "Problems page" }, ...standardErrors }
      },
      post: {
        tags: ["Problems"],
        summary: "Create a problem (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProblemRequest" } } }
        },
        responses: { 201: { description: "Problem created" }, ...standardErrors }
      }
    },
    "/api/v1/problems/{slug}": {
      get: {
        tags: ["Problems"],
        summary: "Get problem with sample test cases",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Problem" }, ...standardErrors }
      }
    },
    "/api/v1/languages": {
      get: {
        tags: ["Languages"],
        summary: "List active languages and versions",
        responses: { 200: { description: "Language catalog" }, ...standardErrors }
      }
    },
    "/api/v1/languages/{key}": {
      get: {
        tags: ["Languages"],
        summary: "Get one active language by key",
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string", example: "python" } }],
        responses: { 200: { description: "Language" }, ...standardErrors }
      }
    },
    "/api/v1/problems/{slug}/languages": {
      get: {
        tags: ["Languages", "Problems"],
        summary: "List language/version options and starter code for a public problem",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string", example: "two-sum" } }],
        responses: { 200: { description: "Problem language options" }, ...standardErrors }
      }
    },
    "/api/v1/executor/capabilities": {
      get: {
        tags: ["Languages", "System"],
        summary: "List executable language/version capabilities for the current executor",
        parameters: [
          { name: "problemSlug", in: "query", schema: { type: "string", example: "two-sum" } },
          { name: "problemId", in: "query", schema: { type: "string" } }
        ],
        responses: { 200: { description: "Executor capability matrix" }, ...standardErrors }
      }
    },
    "/api/v1/executor/health": {
      get: {
        tags: ["System"],
        summary: "Check current executor health and local Judge0 reachability",
        responses: { 200: { description: "Executor is reachable" }, ...standardErrors }
      }
    },
    "/api/v1/admin/languages": {
      get: {
        tags: ["Languages"],
        summary: "List languages including inactive entries (admin)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Admin language catalog" }, ...standardErrors }
      },
      post: {
        tags: ["Languages"],
        summary: "Create a language (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateLanguageRequest" } } }
        },
        responses: { 201: { description: "Language created" }, ...standardErrors }
      }
    },
    "/api/v1/admin/languages/sync/judge0": {
      post: {
        tags: ["Languages"],
        summary: "Sync supported languages from Judge0 without deleting local languages (admin)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Sync result" }, ...standardErrors }
      }
    },
    "/api/v1/admin/languages/{id}": {
      patch: {
        tags: ["Languages"],
        summary: "Update or disable a language (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateLanguageRequest" } } }
        },
        responses: { 200: { description: "Language updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Languages"],
        summary: "Deactivate a language (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Language disabled" }, ...standardErrors }
      }
    },
    "/api/v1/admin/languages/{id}/versions": {
      get: {
        tags: ["Languages"],
        summary: "List language versions including inactive entries (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Language versions" }, ...standardErrors }
      },
      post: {
        tags: ["Languages"],
        summary: "Create a language version and optional executor profiles (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateLanguageVersionRequest" } } }
        },
        responses: { 201: { description: "Language version created" }, ...standardErrors }
      }
    },
    "/api/v1/admin/language-versions/{id}": {
      patch: {
        tags: ["Languages"],
        summary: "Update a language version or executor profile metadata (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateLanguageVersionRequest" } } }
        },
        responses: { 200: { description: "Language version updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Languages"],
        summary: "Deactivate a language version (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Language version disabled" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/languages": {
      get: {
        tags: ["Languages", "Problems"],
        summary: "Read language/version rules for a problem (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Problem language settings" }, ...standardErrors }
      },
      patch: {
        tags: ["Languages", "Problems"],
        summary: "Enable, disable, or pin language versions for a problem (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProblemLanguagePatchRequest" } } }
        },
        responses: { 200: { description: "Problem language settings updated" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/starter-code": {
      post: {
        tags: ["Languages", "Problems"],
        summary: "Create or update problem starter code for a language/version (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpsertProblemStarterCodeRequest" } } }
        },
        responses: { 200: { description: "Starter code saved" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/starter-code/{starterCodeId}": {
      patch: {
        tags: ["Languages", "Problems"],
        summary: "Update existing problem starter code (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "problemId", in: "path", required: true, schema: { type: "string" } },
          { name: "starterCodeId", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["code"], properties: { code: { type: "string" } } }
            }
          }
        },
        responses: { 200: { description: "Starter code updated" }, ...standardErrors }
      }
    },
    "/api/v1/admin/executor/capabilities": {
      get: {
        tags: ["Languages", "System"],
        summary: "List executor capabilities with admin diagnostics",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "problemSlug", in: "query", schema: { type: "string", example: "two-sum" } },
          { name: "problemId", in: "query", schema: { type: "string" } }
        ],
        responses: { 200: { description: "Admin executor capability matrix" }, ...standardErrors }
      }
    },
    "/api/v1/admin/executor/health": {
      get: {
        tags: ["System"],
        summary: "Executor health and support counts (admin)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Executor health" }, ...standardErrors }
      }
    },
    "/api/v1/admin/judge/queue": {
      get: {
        tags: ["System"],
        summary: "Submission queue metrics (admin)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Queue metrics" }, ...standardErrors }
      }
    },
    "/api/v1/admin/health/deep": {
      get: {
        tags: ["System"],
        summary: "API, database, queue, Redis, and executor health (admin)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Deep health" }, ...standardErrors }
      }
    },
    "/api/v1/problems/{slug}/editorial": {
      get: {
        tags: ["Social"],
        summary: "Get published editorial for a problem",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
          { name: "includeDraft", in: "query", schema: { type: "boolean" } }
        ],
        responses: { 200: { description: "Editorial or null" }, ...standardErrors }
      }
    },
    "/api/v1/problems/{slug}/discussions": {
      get: {
        tags: ["Social"],
        summary: "List discussions for a problem",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Discussions" }, ...standardErrors }
      },
      post: {
        tags: ["Social"],
        summary: "Create a discussion for a problem",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProblemDiscussionRequest" } } }
        },
        responses: { 201: { description: "Discussion created" }, ...standardErrors }
      }
    },
    "/api/v1/problems/{id}/testcases": {
      post: {
        tags: ["Problems"],
        summary: "Add sample or hidden test case (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTestCaseRequest" } } }
        },
        responses: { 201: { description: "Test case created" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/assets": {
      get: {
        tags: ["Test Generation"],
        summary: "List generation assets for a problem (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Problem assets" }, ...standardErrors }
      },
      post: {
        tags: ["Test Generation"],
        summary: "Create or replace an active generation asset (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProblemAssetRequest" } } }
        },
        responses: { 201: { description: "Problem asset created" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problem-assets/{assetId}": {
      patch: {
        tags: ["Test Generation"],
        summary: "Update a generation asset (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "assetId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProblemAssetUpdateRequest" } } }
        },
        responses: { 200: { description: "Problem asset updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Test Generation"],
        summary: "Deactivate a generation asset (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "assetId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Problem asset deactivated" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/checker-mode": {
      patch: {
        tags: ["Test Generation"],
        summary: "Set standard or custom-checker judging mode for a problem (admin)",
        description:
          "CUSTOM_CHECKER requires an active CHECKER asset. Missing or failing checkers never accept official submissions.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CheckerModeRequest" } } }
        },
        responses: { 200: { description: "Checker mode updated" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/checker/preview": {
      post: {
        tags: ["Test Generation"],
        summary: "Preview the active checker without saving test cases (admin)",
        description:
          "Runs the CHECKER asset through the configured executor with input, expected output, and actual output. The response contains only verdict metadata.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CheckerPreviewRequest" } } }
        },
        responses: {
          200: {
            description: "Checker preview",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CheckerPreviewResponse" } } }
          },
          ...standardErrors
        }
      }
    },
    "/api/v1/admin/problems/{problemId}/test-generation/preview": {
      post: {
        tags: ["Test Generation"],
        summary: "Preview one generated testcase seed (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TestGenerationPreviewRequest" } } }
        },
        responses: { 200: { description: "Generated testcase preview" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/test-generation-jobs": {
      get: {
        tags: ["Test Generation"],
        summary: "List generation jobs for a problem (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Generation jobs" }, ...standardErrors }
      },
      post: {
        tags: ["Test Generation"],
        summary: "Queue a generated testcase batch (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TestGenerationJobRequest" } } }
        },
        responses: { 201: { description: "Generation job queued" }, ...standardErrors }
      }
    },
    "/api/v1/admin/test-generation-jobs/{jobId}": {
      get: {
        tags: ["Test Generation"],
        summary: "Get generation job status (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Generation job" }, ...standardErrors }
      }
    },
    "/api/v1/admin/test-generation-jobs/{jobId}/cancel": {
      post: {
        tags: ["Test Generation"],
        summary: "Cancel a pending or running generation job (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Generation job cancelled" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/testcase-batches": {
      get: {
        tags: ["Test Generation"],
        summary: "List generated testcase batches without hidden testcase bodies (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Generated testcase batches" }, ...standardErrors }
      }
    },
    "/api/v1/admin/testcase-batches/{batchId}": {
      delete: {
        tags: ["Test Generation"],
        summary: "Delete a generated testcase batch and its generated cases (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "batchId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Generated testcase batch deleted" }, ...standardErrors }
      }
    },
    "/api/v1/run": {
      post: {
        tags: ["Submissions"],
        summary: "Run code against sample test cases",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitCodeRequest" } } }
        },
        responses: { 200: { description: "Run results" }, ...standardErrors }
      }
    },
    "/api/v1/run/custom": {
      post: {
        tags: ["Submissions"],
        summary: "Run code against custom input without storing a submission",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RunCustomRequest" } } }
        },
        responses: { 200: { description: "Custom run result" }, ...standardErrors }
      }
    },
    "/api/v1/submit": {
      post: {
        tags: ["Submissions"],
        summary: "Queue a judged submission",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitCodeRequest" } } }
        },
        responses: { 201: { description: "Submission queued" }, ...standardErrors }
      }
    },
    "/api/v1/submissions": {
      get: {
        tags: ["Submissions"],
        summary: "List current user's submissions",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Submissions" }, ...standardErrors }
      }
    },
    "/api/v1/submissions/{id}": {
      get: {
        tags: ["Submissions"],
        summary: "Get submission detail and per-case results",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Submission" }, ...standardErrors }
      }
    },
    "/api/v1/submissions/{id}/events": {
      get: {
        tags: ["Submissions"],
        summary: "Stream live submission status updates with SSE",
        description:
          "Requires the same ownership/admin authorization as submission detail. Sends the current status immediately, heartbeat events while open, and closes after a terminal verdict. Payloads never include source code or hidden testcase data.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "SSE stream of submission status events",
            content: {
              "text/event-stream": {
                schema: { $ref: "#/components/schemas/SubmissionStatusEvent" }
              }
            }
          },
          ...standardErrors
        }
      }
    },
    "/api/v1/leaderboard": {
      get: {
        tags: ["Leaderboards"],
        summary: "Global leaderboard",
        responses: { 200: { description: "Leaderboard" }, ...standardErrors }
      }
    },
    "/api/v1/leaderboard/snapshot": {
      post: {
        tags: ["Leaderboards"],
        summary: "Persist today's leaderboard ranks for movement indicators (admin)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Snapshot generated" }, ...standardErrors }
      }
    },
    "/api/v1/problems/{slug}/leaderboard": {
      get: {
        tags: ["Leaderboards"],
        summary: "Problem fastest accepted submissions",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Problem leaderboard" }, ...standardErrors }
      }
    },
    "/api/v1/contests": {
      get: {
        tags: ["Contests"],
        summary: "List contests",
        responses: { 200: { description: "Contests" }, ...standardErrors }
      },
      post: {
        tags: ["Contests"],
        summary: "Create contest (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateContestRequest" } } }
        },
        responses: { 201: { description: "Contest created" }, ...standardErrors }
      }
    },
    "/api/v1/admin/contests": {
      get: {
        tags: ["Contests"],
        summary: "List contests for admin management",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Contests" }, ...standardErrors }
      },
      post: {
        tags: ["Contests"],
        summary: "Create contest (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateContestRequest" } } }
        },
        responses: { 201: { description: "Contest created" }, ...standardErrors }
      }
    },
    "/api/v1/admin/contests/{id}": {
      get: {
        tags: ["Contests"],
        summary: "Get contest detail (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Contest" }, ...standardErrors }
      },
      patch: {
        tags: ["Contests"],
        summary: "Update contest (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateContestRequest" } } }
        },
        responses: { 200: { description: "Contest updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Contests"],
        summary: "Archive contest (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Contest archived" }, ...standardErrors }
      }
    },
    "/api/v1/admin/contests/{id}/problems": {
      post: {
        tags: ["Contests"],
        summary: "Add problem to contest (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AddContestProblemRequest" } } }
        },
        responses: { 201: { description: "Contest problem added" }, ...standardErrors }
      }
    },
    "/api/v1/admin/contests/{id}/problems/{problemId}": {
      delete: {
        tags: ["Contests"],
        summary: "Remove problem from contest (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "problemId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { 200: { description: "Contest problem removed" }, ...standardErrors }
      }
    },
    "/api/v1/contests/{id}/register": {
      post: {
        tags: ["Contests"],
        summary: "Register for contest",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Registered" }, ...standardErrors }
      }
    },
    "/api/v1/contests/{id}/submit": {
      post: {
        tags: ["Contests"],
        summary: "Queue a contest submission",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitCodeRequest" } } }
        },
        responses: { 201: { description: "Contest submission queued" }, ...standardErrors }
      }
    },
    "/api/v1/contests/{id}/leaderboard": {
      get: {
        tags: ["Contests", "Leaderboards"],
        summary: "Contest leaderboard",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Contest leaderboard" }, ...standardErrors }
      }
    },
    "/api/v1/discussions": {
      get: {
        tags: ["Social"],
        summary: "List general discussions",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } }
        ],
        responses: { 200: { description: "Discussions" }, ...standardErrors }
      },
      post: {
        tags: ["Social"],
        summary: "Create a general discussion",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateGeneralDiscussionRequest" } } }
        },
        responses: { 201: { description: "Discussion created" }, ...standardErrors }
      }
    },
    "/api/v1/discussions/{id}": {
      get: {
        tags: ["Social"],
        summary: "Get discussion detail",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Discussion" }, ...standardErrors }
      },
      patch: {
        tags: ["Social"],
        summary: "Update discussion",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateDiscussionRequest" } } }
        },
        responses: { 200: { description: "Discussion updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Social"],
        summary: "Delete discussion",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Discussion deleted" }, ...standardErrors }
      }
    },
    "/api/v1/discussions/{id}/comments": {
      post: {
        tags: ["Social"],
        summary: "Add comment to discussion",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CommentRequest" } } }
        },
        responses: { 201: { description: "Comment created" }, ...standardErrors }
      }
    },
    "/api/v1/discussions/{id}/vote": {
      post: {
        tags: ["Social"],
        summary: "Upvote or downvote a discussion",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/VoteDiscussionRequest" } } }
        },
        responses: { 200: { description: "Vote recorded" }, ...standardErrors }
      }
    },
    "/api/v1/discussion-comments/{id}": {
      patch: {
        tags: ["Social"],
        summary: "Update discussion comment",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CommentRequest" } } }
        },
        responses: { 200: { description: "Comment updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Social"],
        summary: "Delete discussion comment",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Comment deleted" }, ...standardErrors }
      }
    },
    "/api/v1/admin/problems/{problemId}/editorial": {
      post: {
        tags: ["Social"],
        summary: "Create or update problem editorial (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "problemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpsertEditorialRequest" } } }
        },
        responses: { 200: { description: "Editorial saved" }, ...standardErrors }
      }
    },
    "/api/v1/admin/editorials/{id}": {
      patch: {
        tags: ["Social"],
        summary: "Update editorial draft (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateEditorialRequest" } } }
        },
        responses: { 200: { description: "Editorial updated" }, ...standardErrors }
      },
      delete: {
        tags: ["Social"],
        summary: "Delete editorial (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Editorial deleted" }, ...standardErrors }
      }
    },
    "/api/v1/admin/editorials/{id}/publish": {
      patch: {
        tags: ["Social"],
        summary: "Publish editorial (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Editorial published" }, ...standardErrors }
      }
    },
    "/api/v1/admin/editorials/{id}/unpublish": {
      patch: {
        tags: ["Social"],
        summary: "Unpublish editorial (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Editorial unpublished" }, ...standardErrors }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: json
      },
      Difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
      LegacyLanguage: { type: "string", enum: ["CPP", "JAVA", "PYTHON", "JAVASCRIPT"] },
      SubmissionStatus: {
        type: "string",
        enum: [
          "PENDING",
          "RUNNING",
          "ACCEPTED",
          "WRONG_ANSWER",
          "TIME_LIMIT_EXCEEDED",
          "MEMORY_LIMIT_EXCEEDED",
          "RUNTIME_ERROR",
          "COMPILATION_ERROR",
          "INTERNAL_ERROR"
        ]
      },
      SubmissionStatusEvent: {
        type: "object",
        required: ["submissionId", "status", "passedTestCases", "totalTestCases", "runtime", "memory", "updatedAt"],
        properties: {
          submissionId: { type: "string", example: "sub_123" },
          status: { $ref: "#/components/schemas/SubmissionStatus" },
          passedTestCases: { type: "integer", minimum: 0, example: 2 },
          totalTestCases: { type: "integer", minimum: 0, example: 12 },
          runtime: { type: "integer", nullable: true, example: 24 },
          memory: { type: "integer", nullable: true, example: 4096 },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      LanguageCategory: {
        type: "string",
        enum: [
          "GENERAL_PURPOSE",
          "SYSTEMS",
          "SCRIPTING",
          "FUNCTIONAL",
          "JVM",
          "DOTNET",
          "DATABASE",
          "SHELL",
          "EDUCATIONAL",
          "OTHER"
        ]
      },
      ExecutorType: { type: "string", enum: ["MOCK", "DOCKER", "JUDGE0"] },
      LanguageSelection: {
        type: "object",
        description:
          "Provide one language selector. language accepts a dynamic language key or a backwards-compatible legacy value; prefer languageVersionId or languageKey/version.",
        properties: {
          language: { type: "string", example: "rust" },
          languageId: { type: "string", example: "lang_python_id" },
          languageVersionId: { type: "string", example: "python_3_11_id" },
          languageKey: { type: "string", example: "python" },
          version: { type: "string", example: "3.11" }
        }
      },
      CreateLanguageRequest: {
        type: "object",
        required: ["key", "displayName", "monacoId", "fileExtension"],
        properties: {
          key: { type: "string", example: "python" },
          displayName: { type: "string", example: "Python" },
          monacoId: { type: "string", example: "python" },
          fileExtension: { type: "string", example: "py" },
          category: { $ref: "#/components/schemas/LanguageCategory" },
          isCompiled: { type: "boolean", default: false },
          isActive: { type: "boolean", default: true },
          sortOrder: { type: "integer", default: 0 }
        }
      },
      UpdateLanguageRequest: {
        allOf: [{ $ref: "#/components/schemas/CreateLanguageRequest" }],
        description: "All fields are optional for PATCH."
      },
      ExecutionProfileInput: {
        type: "object",
        required: ["executorType"],
        properties: {
          executorType: { $ref: "#/components/schemas/ExecutorType" },
          judge0Id: { type: "integer", nullable: true, example: 71 },
          dockerImage: { type: "string", nullable: true, example: "python:3.11-alpine" },
          compileCommand: { type: "string", nullable: true },
          runCommand: { type: "string", nullable: true, example: "python {source}" },
          environment: { type: "object", nullable: true, additionalProperties: true },
          limits: { type: "object", nullable: true, additionalProperties: true },
          isActive: { type: "boolean", default: true }
        }
      },
      CreateLanguageVersionRequest: {
        type: "object",
        required: ["version", "label", "sourceFileName"],
        properties: {
          version: { type: "string", example: "3.11" },
          label: { type: "string", example: "Python 3.11" },
          judge0Id: { type: "integer", nullable: true, example: 71 },
          dockerImage: { type: "string", nullable: true },
          compileCommand: { type: "string", nullable: true },
          runCommand: { type: "string", nullable: true },
          timeLimitMultiplier: { type: "number", default: 1 },
          memoryLimitMultiplier: { type: "number", default: 1 },
          sourceFileName: { type: "string", example: "main.py" },
          executableFileName: { type: "string", nullable: true },
          starterTemplate: { type: "string", nullable: true },
          isDefault: { type: "boolean", default: false },
          isActive: { type: "boolean", default: true },
          executionProfiles: { type: "array", items: { $ref: "#/components/schemas/ExecutionProfileInput" } }
        }
      },
      UpdateLanguageVersionRequest: {
        allOf: [{ $ref: "#/components/schemas/CreateLanguageVersionRequest" }],
        description: "All fields are optional for PATCH."
      },
      ProblemLanguagePatchRequest: {
        type: "object",
        required: ["languages"],
        properties: {
          languages: {
            type: "array",
            items: {
              type: "object",
              required: ["languageId", "isEnabled"],
              properties: {
                languageId: { type: "string" },
                languageVersionId: { type: "string", nullable: true },
                isEnabled: { type: "boolean" }
              }
            }
          }
        }
      },
      UpsertProblemStarterCodeRequest: {
        type: "object",
        required: ["languageId", "code"],
        properties: {
          languageId: { type: "string" },
          languageVersionId: { type: "string", nullable: true },
          code: { type: "string" }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "username", "displayName", "password"],
        properties: {
          email: { type: "string", format: "email" },
          username: { type: "string", example: "demo" },
          displayName: { type: "string", example: "Demo User" },
          password: { type: "string", format: "password", minLength: 8 }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" }
        }
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          displayName: { type: "string" },
          bio: { type: "string", nullable: true },
          avatarUrl: { type: "string", format: "uri", nullable: true },
          country: { type: "string", nullable: true },
          countryCode: { type: "string", minLength: 2, maxLength: 2, nullable: true }
        }
      },
      AdminUpdateUserRequest: {
        type: "object",
        properties: {
          displayName: { type: "string" },
          bio: { type: "string", nullable: true },
          avatarUrl: { type: "string", format: "uri", nullable: true },
          country: { type: "string", nullable: true },
          countryCode: { type: "string", minLength: 2, maxLength: 2, nullable: true }
        }
      },
      AdminUpdateUserRoleRequest: {
        type: "object",
        required: ["role"],
        properties: {
          role: { type: "string", enum: ["USER", "ADMIN"] }
        }
      },
      AdminUpdateUserStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["ACTIVE", "INACTIVE", "DELETED"] }
        }
      },
      StarterCode: {
        type: "object",
        required: ["CPP", "JAVA", "PYTHON", "JAVASCRIPT"],
        properties: {
          CPP: { type: "string" },
          JAVA: { type: "string" },
          PYTHON: { type: "string" },
          JAVASCRIPT: { type: "string" }
        }
      },
      CreateProblemRequest: {
        type: "object",
        required: [
          "slug",
          "title",
          "difficulty",
          "description",
          "constraints",
          "inputFormat",
          "outputFormat",
          "starterCode"
        ],
        properties: {
          slug: { type: "string", example: "two-sum" },
          title: { type: "string", example: "Two Sum" },
          difficulty: { $ref: "#/components/schemas/Difficulty" },
          description: { type: "string" },
          constraints: { type: "string" },
          inputFormat: { type: "string" },
          outputFormat: { type: "string" },
          starterCode: { $ref: "#/components/schemas/StarterCode" },
          tags: { type: "array", items: { type: "string" } },
          visibility: { type: "string", enum: ["PUBLIC", "PRIVATE", "ARCHIVED"] },
          checkerMode: { $ref: "#/components/schemas/CheckerMode" },
          timeLimitMs: { type: "integer", example: 2000 },
          memoryLimitMb: { type: "integer", example: 256 }
        }
      },
      CreateTestCaseRequest: {
        type: "object",
        required: ["input", "expectedOutput"],
        properties: {
          input: { type: "string" },
          expectedOutput: { type: "string" },
          isSample: { type: "boolean", default: false },
          isStrict: { type: "boolean", default: true },
          explanation: { type: "string" },
          order: { type: "integer", default: 0 }
        }
      },
      ProblemAssetType: { type: "string", enum: ["GENERATOR", "REFERENCE_SOLUTION", "VALIDATOR", "CHECKER"] },
      CheckerMode: { type: "string", enum: ["STANDARD", "CUSTOM_CHECKER"] },
      GenerationJobStatus: { type: "string", enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] },
      ProblemAssetRequest: {
        type: "object",
        required: ["type", "filename", "sourceCode"],
        properties: {
          type: { $ref: "#/components/schemas/ProblemAssetType" },
          languageId: { type: "string" },
          languageVersionId: { type: "string" },
          languageKey: { type: "string", example: "python" },
          version: { type: "string", example: "3.11" },
          filename: { type: "string", example: "generator.py" },
          sourceCode: { type: "string", maxLength: 64000 }
        }
      },
      ProblemAssetUpdateRequest: {
        type: "object",
        properties: {
          languageId: { type: "string", nullable: true },
          languageVersionId: { type: "string", nullable: true },
          languageKey: { type: "string", example: "python" },
          version: { type: "string", example: "3.11" },
          filename: { type: "string", example: "reference.py" },
          sourceCode: { type: "string", maxLength: 64000 },
          isActive: { type: "boolean" }
        }
      },
      CheckerModeRequest: {
        type: "object",
        required: ["checkerMode"],
        properties: {
          checkerMode: { $ref: "#/components/schemas/CheckerMode" }
        }
      },
      CheckerPreviewRequest: {
        type: "object",
        required: ["input", "expectedOutput", "actualOutput"],
        properties: {
          input: { type: "string", maxLength: 65536 },
          expectedOutput: { type: "string", maxLength: 65536 },
          actualOutput: { type: "string", maxLength: 65536 },
          timeLimitMs: { type: "integer", minimum: 250, maximum: 30000 },
          memoryLimitMb: { type: "integer", minimum: 16, maximum: 1024 }
        }
      },
      CheckerPreviewResponse: {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["ACCEPTED", "WRONG_ANSWER", "CHECKER_ERROR"] },
          message: { type: "string" },
          runtimeMs: { type: "integer" },
          memoryKb: { type: "integer" }
        }
      },
      TestGenerationPreviewRequest: {
        type: "object",
        required: ["seed"],
        properties: {
          seed: { type: "integer", example: 42 },
          runValidator: { type: "boolean", default: false },
          timeLimitMs: { type: "integer", minimum: 250, maximum: 30000 },
          memoryLimitMb: { type: "integer", minimum: 16, maximum: 1024 }
        }
      },
      TestGenerationJobRequest: {
        type: "object",
        required: ["batchName"],
        properties: {
          batchName: { type: "string", example: "Generated hidden tests" },
          description: { type: "string" },
          visibility: { type: "string", enum: ["SAMPLE", "HIDDEN"], default: "HIDDEN" },
          count: { type: "integer", minimum: 1, example: 25 },
          seedStart: { type: "integer", default: 1 },
          seedEnd: { type: "integer" },
          inputMode: { type: "string", enum: ["STDIN"], default: "STDIN" },
          replaceExistingGenerated: { type: "boolean", default: false },
          runValidator: { type: "boolean", default: false },
          allowEmptyInput: { type: "boolean", default: false },
          allowEmptyOutput: { type: "boolean", default: false },
          skipDuplicates: { type: "boolean", default: true },
          timeLimitMs: { type: "integer", minimum: 250, maximum: 30000, default: 2000 },
          memoryLimitMb: { type: "integer", minimum: 16, maximum: 1024, default: 256 }
        }
      },
      SubmitCodeRequest: {
        type: "object",
        required: ["code"],
        properties: {
          problemSlug: { type: "string", example: "two-sum" },
          problemId: { type: "string" },
          language: { type: "string", example: "rust" },
          languageId: { type: "string" },
          languageVersionId: { type: "string" },
          languageKey: { type: "string", example: "python" },
          version: { type: "string", example: "3.11" },
          code: { type: "string", maxLength: 64000 },
          contestId: { type: "string" }
        }
      },
      RunCustomRequest: {
        type: "object",
        required: ["problemId", "code", "input"],
        properties: {
          problemId: { type: "string" },
          language: { type: "string", example: "rust" },
          languageId: { type: "string" },
          languageVersionId: { type: "string" },
          languageKey: { type: "string", example: "python" },
          version: { type: "string", example: "3.11" },
          code: { type: "string", maxLength: 64000 },
          input: { type: "string", maxLength: 64000 }
        }
      },
      CreateContestRequest: {
        type: "object",
        required: ["title", "slug", "description", "startTime", "endTime", "problemIds"],
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          problemIds: { type: "array", items: { type: "string" } },
          visibility: { type: "string", enum: ["PUBLIC", "PRIVATE", "ARCHIVED"] }
        }
      },
      UpdateContestRequest: {
        type: "object",
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["UPCOMING", "LIVE", "ENDED"] },
          visibility: { type: "string", enum: ["PUBLIC", "PRIVATE", "ARCHIVED"] }
        }
      },
      AddContestProblemRequest: {
        type: "object",
        required: ["problemId"],
        properties: {
          problemId: { type: "string" },
          points: { type: "integer", minimum: 1, maximum: 10000 }
        }
      },
      CreateProblemDiscussionRequest: {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string" },
          content: { type: "string" }
        }
      },
      CreateGeneralDiscussionRequest: {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        }
      },
      UpdateDiscussionRequest: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        }
      },
      CommentRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string" }
        }
      },
      VoteDiscussionRequest: {
        type: "object",
        required: ["value"],
        properties: {
          value: { type: "integer", enum: [1, -1] }
        }
      },
      UpsertEditorialRequest: {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          isPublished: { type: "boolean" }
        }
      },
      UpdateEditorialRequest: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" }
        }
      }
    }
  }
};
