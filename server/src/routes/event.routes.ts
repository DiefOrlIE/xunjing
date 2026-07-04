import { Router } from "express";
import { createEvent, getMyEvents, getEventDetail, applyToEvent, stopRecruiting, cancelEvent, exitEvent, acceptApplication, rejectApplication, listEvents } from "../controllers/event.controller";
import { createReview, listReviews } from "../controllers/eventReview.controller";
import { createMemory, listMemories } from "../controllers/eventMemory.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validate, schemas } from "../middleware/validate.middleware";

const router = Router();
router.use(authMiddleware);

// GET /api/v1/events — 活动广场列表（支持筛选）
router.get("/", listEvents);

// POST /api/v1/events
router.post("/", validate(schemas.createEvent), createEvent);

// GET /api/v1/events/my
router.get("/my", getMyEvents);

// GET /api/v1/events/:id
router.get("/:id", getEventDetail);

// POST /api/v1/events/:id/apply
router.post("/:id/apply", applyToEvent);

// POST /api/v1/events/:id/stop-recruiting
router.post("/:id/stop-recruiting", stopRecruiting);

// POST /api/v1/events/:id/cancel
router.post("/:id/cancel", cancelEvent);

// POST /api/v1/events/:id/exit
router.post("/:id/exit", exitEvent);

// POST /api/v1/events/:id/applications/:userId/accept
router.post("/:id/applications/:userId/accept", acceptApplication);

// POST /api/v1/events/:id/applications/:userId/reject
router.post("/:id/applications/:userId/reject", rejectApplication);

// 活动评价（活动结束后，参与者可评）
router.get("/:id/reviews", listReviews);
router.post("/:id/review", createReview);

// 共同记忆墙（仅参与者可见/可发）
router.get("/:id/memories", listMemories);
router.post("/:id/memory", createMemory);

export default router;
