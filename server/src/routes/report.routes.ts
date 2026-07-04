import { Router } from "express";
import { createReport } from "../controllers/report.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();
router.use(authMiddleware);

// 提交举报
router.post("/", createReport);

export default router;
