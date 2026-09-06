import { Router } from "express";
import type { AppContext } from "../appContext";
import { PracticeController } from "../controllers/PracticeController";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  finishPracticeSessionSchema,
  listPracticeSessionsSchema,
  practiceSessionIdSchema,
  startPracticeSessionSchema,
  updatePracticeProblemSchema
} from "../validators/practiceValidators";

export function createPracticeRoutes(context: AppContext): Router {
  const router = Router();
  const practice = new PracticeController(context.services.practice);

  router.get("/practice/sessions", authenticate, validate(listPracticeSessionsSchema), asyncHandler(practice.list));
  router.post("/practice/sessions", authenticate, validate(startPracticeSessionSchema), asyncHandler(practice.start));
  router.get("/practice/sessions/:id", authenticate, validate(practiceSessionIdSchema), asyncHandler(practice.get));
  router.patch(
    "/practice/sessions/:id/problems/:problemItemId",
    authenticate,
    validate(updatePracticeProblemSchema),
    asyncHandler(practice.updateProblem)
  );
  router.post(
    "/practice/sessions/:id/finish",
    authenticate,
    validate(finishPracticeSessionSchema),
    asyncHandler(practice.finish)
  );
  router.post("/practice/sessions/:id/cancel", authenticate, validate(practiceSessionIdSchema), asyncHandler(practice.cancel));

  return router;
}
