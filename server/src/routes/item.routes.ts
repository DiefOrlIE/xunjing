import { Router } from "express";
import { listItems, createItem, getItemDetail, updateItem, deleteItem, reactivateItem, permanentlyDeleteItem, getUserCollections, getOtherUserCollections } from "../controllers/item.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware";

const router = Router();

// 所有物品路由需要认证
router.use(authMiddleware);

// ── 用户藏品相关 ──
// GET /api/v1/user/collections (注意：挂载在 /api/v1/items 下，实际路径会变，这里做两层)
// 这些路由在 index.ts 中映射: /api/v1/items/user/collections
router.get("/user/collections", getUserCollections);

// ── 管理员路由 ──
router.get("/", adminMiddleware, listItems);
router.post("/", adminMiddleware, createItem);
router.put("/:id", adminMiddleware, updateItem);
router.delete("/:id", adminMiddleware, deleteItem);
router.put("/:id/reactivate", adminMiddleware, reactivateItem);
router.delete("/:id/permanent", adminMiddleware, permanentlyDeleteItem);

// ── 公共藏品详情 ──
router.get("/:id", getItemDetail);

export default router;
