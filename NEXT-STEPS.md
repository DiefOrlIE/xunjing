# 寻鲸「航海志」UI · 下一步执行计划

> 承接 `WHALE-UI-CHANGELOG.md`。分支 `feat/whale-journal-ui`,web 阶段,只换皮不动逻辑,未 push。
> 三项任务:A 图标替换 · B 递归覆盖审计 · C 前后端接口核对。

## 执行进度(2026-07-03)
- **A 图标替换**:✅ 好友展柜入口 + 地图鲸落/巨鲸落 marker 与右下角计数已接入;活动类型 4 图走后台上传(零改码)。
- **B 覆盖审计**:✅ 实跑导航复查——19 屏全覆盖换皮,孤儿屏 `ActivityTypeList` 确认不可达。10 功能屏母题深化=**暂不做**(见任务 B 结论)。
- **C 接口核对**:✅ 静态通过(services 零改动 + 契约字段/事件名/坐标系未变);⏳ 动态冒烟待真后端环境。
- ⚠️ **遗留**:分支里混入 `loggg.txt`(误 commit 的操作日志,待清理);临时预览脚手架待 PR 前移除。

---

## 任务 A · AI 图标替换(位图 PNG) — ✅ 已完成(2026-07-03)

图标已放 `client/assets/icons/`(原图 PIL 压到 ≤180px、50–75KB/张),用 `<Image source={require(...)}>` 接入。

| 图标 | 落地 | 接入点(代码) | 尺寸 |
|---|---|---|---|
| 好友「展柜」入口 | ✅ `icon_gallery.png` | `FriendListScreen.tsx` → 图标移到波形左侧(28px)、文字「TA的展柜 ›」下移 | 28px |
| 地图 鲸落 marker + 右下计数 | ✅ `icon_whalefall.png` | `MapScreen.tsx` `mkEl()` + `countChip`(计数图标放大 1.5×→27px) | marker 32–40 / chip 27px |
| 地图 巨鲸落 marker + 右下计数 | ✅ `icon_bigwhalefall.png` | 同上 | 同上 |
| 活动类型(吃饭/自习/运动/其它) | ⏳ 走后台 | **管理员后台上传 `iconUrl`**,`ActivitySquareScreen`/`PublishEventScreen` 已读该字段,零改码;本地图暂存 `client/src/ui_images/`(可选做 fallback 默认图) | 28–32px |
| 同游 / 纸条 marker | 保持文字标签 | 暂无对应 AI 图,继续用 `mkEl` 文字 | — |

**未接入的活动类型图**:`ui_images/` 里的 4 张(食/学/运动/其它)统一提示词=手绘航海志绳纹圆框、浅滩配色。若要本地看效果可在 `iconUrl` 空时 fallback 本地图(需鳟鱼确认)。

---

## 任务 B · 递归覆盖审计(所有可达屏) — ✅ 已完成(2026-07-03)

实跑 `grep` 复查,导航实际注册屏组件 = **19 个**(3 登录 + 6 主 Tab + 10 子屏),全部已换皮,核实无遗漏未换皮屏。

**已上专属母题(9 屏)**:展柜(手账)· 活动广场(票根)· 我(船长证)· 发起同游(出航单)· 地图(海洋)· 好友(船员名录)· 登录三屏(鲸标);另 WriteNote 已信笺化。

**已换皮 = token + 手写标题 + 扁平表头(9 功能屏)**:
`ChatScreen · UserGalleryScreen · ItemDetailScreen · EventDetailScreen · GroupChatScreen · MapPickerScreen · AdminPanelScreen · FeedbackScreen · LogFeedScreen`。

**孤儿屏(导航不可达,忽略)**:`log/ActivityTypeListScreen.tsx`(未在任何 stack 注册,也无 `navigate` 指向)——已核实确认。

**复查命令**(改导航后重跑):
```
cd client/src && grep -rhoE 'name="[A-Za-z]+" component=\{[A-Za-z]+\}' navigation/ | sort -u
```

**母题深化决策 = 暂不做**。理由:上述 9 功能屏(聊天/详情/后台/反馈/日志)已 token+手写标题+扁平表头,视觉一致性达标;为它们强加母题会扩大改动面、抬高白屏风险,违背「只换皮」的克制原则。若日后想点缀,Chat/EventDetail 优先级最高,Admin 体量大只保头即可。

---

## 任务 C · 前后端接口核对 — ✅ 静态通过 / ⏳ 动态待真后端

**静态核对结论(2026-07-03)**:接口契约完好,纯样式重构未破坏任何调用。证据:

1. **services 零改动**:`git diff main..HEAD -- client/src/services/` **为空**——所有 endpoint / payload schema 基线保持。
2. **屏内数据层调用配对一致**:过滤所有被改屏中涉及 `api/socket/await/service 函数` 的增删行,逐条为「-/+ 内容相同、仅换容器或挪位」:
   - `getMyNotes()` / `location_update` socket emit / `updateProfile({studentId})` —— 端点、字段、事件名一字未改。
   - 两处伴随微调:`fetchMyEvents` 改成展开时才拉(等价)、`updateProfile` 加成功 Alert(纯增益)——均不破坏后端契约。
3. **坐标专项 ✅**:socket 上报仍是 `s.emit("location_update", { lat: gcj.lat, lng: gcj.lng, campus })`(**GCJ-02**);`gcj02ToWgs84` 只用于显示层画点,不影响上报与开箱距离判定。
4. **⏳ 动态冒烟(未做,需真环境)**:`124.222.230.80:3000` 在线 + 登录后逐条走:加好友 / 存学号 / 设密码 / 发活动 / 开箱 / 写+拾纸条 / GPS 蓝点 / 看展柜——确认调用未断、数据回填正常、开箱距离无偏。此步需鳟鱼在真环境验(阿卡酱无账号/后端不可达)。

---

## 收尾(PR 前必做)

1. **移除临时预览脚手架**(见 CHANGELOG §7):`_mock.web.ts`、`_servedist.cjs`、`index.ts` 的 mock require、`RootNavigator` 的 `{true?}` 跳过登录 → 改回 `{isLoggedIn?…}`。
2. **确认 push 权限**:鳟鱼账号对 `9ykrz5wssj-oss/xunjing` 是否可直推,否则 fork+PR。
3. **APK 阶段**(单独排期):`*.native.tsx` 同款换皮 + `expo-font` 打包字体(CJK 体积)+ 重打 APK + 真机回测。

## 验证 & 提交
- 每屏改后:`expo export` + 字体 token 静态自查(CHANGELOG §12)+ 条件允许时浏览器实测。
- 每对话提交 git;push/PR 前先问鳟鱼。
