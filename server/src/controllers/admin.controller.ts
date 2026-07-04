import { Response } from "express";
import { AuthRequest } from "../types";
import { User } from "../models/User";
import { Item } from "../models/Item";
import { UserCollection } from "../models/UserCollection";
import { Chest } from "../models/Chest";
import { Event } from "../models/Event";
import { CampusConfig } from "../models/CampusConfig";
import { ChestStatus, ChestType, ActivityStatus, Campus } from "../config/constants";
import { isInCampus, clearCampusCache } from "../utils/campus";
import { refreshChests } from "../services/chest.service";
import { ChestConfig } from "../models/ChestConfig";
import { logger } from "../utils/logger";

export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [totalUsers, activeChests, activeEvents] = await Promise.all([
      User.countDocuments(),
      Chest.countDocuments({ status: ChestStatus.ACTIVE }),
      Event.countDocuments({ status: { $in: [ActivityStatus.RECRUITING, ActivityStatus.WAITING, ActivityStatus.ONGOING] } }),
    ]);

    res.json({
      success: true,
      data: { totalUsers, activeChests, activeEvents },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createChest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { type, campus, coordinates, requiredPlayers } = req.body;
    if (!type || !campus || !coordinates) {
      res.status(400).json({ success: false, error: "缺少参数" }); return;
    }
    if (!Object.values(Campus).includes(campus)) {
      res.status(400).json({ success: false, error: "无效的校区" }); return;
    }
    if (!isInCampus(coordinates.lat, coordinates.lng, campus)) {
      res.status(400).json({ success: false, error: "坐标不在校区范围内" }); return;
    }
    const rp = type === "advanced" ? (requiredPlayers && requiredPlayers >= 1 && requiredPlayers <= 4 ? requiredPlayers : (2 + Math.floor(Math.random() * 3))) : 1;
    const chest = await Chest.create({
      campus,
      type: type === "advanced" ? ChestType.ADVANCED : ChestType.NORMAL,
      coordinates,
      requiredPlayers: rp,
      status: ChestStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 6 * 3600 * 1000),
    });
    logger.info(`[管理员] 手动生成宝箱: ${campus} ${type} at (${coordinates.lat}, ${coordinates.lng})`);
    res.status(201).json({ success: true, data: chest, message: "宝箱已生成" });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function listChests(req: AuthRequest, res: Response): Promise<void> {
  try {
    const chests = await Chest.find({ status: ChestStatus.ACTIVE }).sort({ createdAt: 1 });
    res.json({ success: true, data: chests });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function removeChest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const chest = await Chest.findByIdAndUpdate(req.params.id, { status: ChestStatus.EXPIRED });
    if (!chest) { res.status(404).json({ success: false, error: "宝箱不存在" }); return; }
    logger.info(`[管理员] 删除宝箱: ${req.params.id}`);
    res.json({ success: true, message: "宝箱已删除" });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function getCampusBounds(req: AuthRequest, res: Response): Promise<void> {
  try {
    const configs = await CampusConfig.find();
    res.json({ success: true, data: configs });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function updateCampusBounds(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { campus, minLng, maxLng, minLat, maxLat } = req.body;
    if (!campus || minLng == null || maxLng == null || minLat == null || maxLat == null) {
      res.status(400).json({ success: false, error: "缺少参数" }); return;
    }
    await CampusConfig.findOneAndUpdate(
      { campus },
      { campus, minLng, maxLng, minLat, maxLat, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    clearCampusCache();
    logger.info(`[管理员] 更新校区边界: ${campus}`);
    res.json({ success: true, message: "校区边界已更新" });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function giftItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { userId, itemId, itemIds } = req.body;
    // 兼容旧版单itemId和新版itemIds数组
    const ids: string[] = itemIds || (itemId ? [itemId] : []);
    if (!userId || ids.length === 0) {
      res.status(400).json({ success: false, error: "缺少参数：需要 userId 和 itemId/itemIds" }); return;
    }

    // 通过数字ID查找用户
    const user = await User.findOne({ userId: Number(userId) });
    if (!user) {
      res.status(404).json({ success: false, error: `未找到用户ID: ${userId}` }); return;
    }

    // 查找所有藏品（包括已停用的）
    const items = await Item.find({ _id: { $in: ids } });
    if (items.length === 0) {
      res.status(404).json({ success: false, error: "藏品不存在" }); return;
    }

    // 批量添加藏品
    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { userId: user._id, itemId: item._id },
        update: {
          $inc: { count: 1 },
          $set: { lastAcquiredAt: new Date() },
          $setOnInsert: { acquiredAt: new Date() },
        },
        upsert: true,
      },
    }));
    await UserCollection.bulkWrite(bulkOps);

    // 更新用户统计
    await User.findByIdAndUpdate(user._id, {
      $inc: { "stats.totalCollections": items.length },
    });

    const names = items.map((i) => `${i.name}(${i.rarity})`).join("、");
    logger.info(`[管理员] 赠送给用户 ${userId} (${user.nickname}) 藏品×${items.length}: ${names}`);
    res.json({ success: true, message: `已赠送给 ${user.nickname} ${items.length} 件藏品：${names}` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function getChestConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    const configs = await ChestConfig.find();
    const data: any = { gulou: { maxNormalChests: 3, advancedChance: 0.2, normalCooldownHours: 1, advancedCooldownHours: 1 }, xianlin: { maxNormalChests: 3, advancedChance: 0.2, normalCooldownHours: 1, advancedCooldownHours: 1 } };
    configs.forEach((c) => { data[c.campus] = { maxNormalChests: c.maxNormalChests, advancedChance: c.advancedChance, normalCooldownHours: c.normalCooldownHours ?? 1, advancedCooldownHours: c.advancedCooldownHours ?? 1 }; });
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function updateChestConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { campus, maxNormalChests, advancedChance, normalCooldownHours, advancedCooldownHours } = req.body;
    if (!campus || maxNormalChests == null || advancedChance == null) {
      res.status(400).json({ success: false, error: "缺少参数" }); return;
    }
    const upd: any = { campus, maxNormalChests, advancedChance, updatedAt: new Date() };
    if (normalCooldownHours != null) upd.normalCooldownHours = normalCooldownHours;
    if (advancedCooldownHours != null) upd.advancedCooldownHours = advancedCooldownHours;
    await ChestConfig.findOneAndUpdate({ campus }, upd,
      { upsert: true, new: true }
    );
    logger.info(`[管理员] 更新宝箱配置: ${campus} maxChests=${maxNormalChests} advancedChance=${advancedChance}`);
    res.json({ success: true, message: "宝箱配置已更新" });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function refreshAllChests(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 清空所有活跃宝箱
    const result = await Chest.updateMany(
      { status: ChestStatus.ACTIVE },
      { $set: { status: ChestStatus.EXPIRED } }
    );
    logger.info(`[管理员] 一键刷新：清空 ${result.modifiedCount} 个宝箱`);
    // 重新生成
    await refreshChests();
    const newCount = await Chest.countDocuments({ status: ChestStatus.ACTIVE });
    logger.info(`[管理员] 一键刷新：重新生成后 ${newCount} 个活跃宝箱`);
    res.json({ success: true, message: `已清空并重新生成，当前 ${newCount} 个活跃宝箱` });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function getDropConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { DropConfig } = await import("../models/DropConfig");
    const configs = await DropConfig.find();
    const data: any = {};
    configs.forEach((c: any) => { data[c.chestType] = c.weights; });
    res.json({ success: true, data });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function updateDropConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { chestType, weights } = req.body;
    if (!chestType || !weights) { res.status(400).json({ success: false, error: "缺少参数" }); return; }
    const { DropConfig } = await import("../models/DropConfig");
    await DropConfig.findOneAndUpdate({ chestType }, { chestType, weights }, { upsert: true, new: true });
    logger.info("[管理员] 更新爆率配置: " + chestType);
    res.json({ success: true, message: "爆率配置已更新" });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

/** 通过数字用户ID查询藏品持有量（供管理后台赠送使用） */
export async function getUserItemCounts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) { res.status(400).json({ success: false, error: "无效的用户ID" }); return; }
    const user = await User.findOne({ userId });
    if (!user) { res.status(404).json({ success: false, error: "用户不存在" }); return; }
    const collections = await UserCollection.find({ userId: user._id, count: { $gt: 0 } });
    const counts: Record<string, number> = {};
    for (const c of collections) {
      counts[c.itemId.toString()] = (counts[c.itemId.toString()] || 0) + c.count;
    }
    res.json({ success: true, data: counts });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}
