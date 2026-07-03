# 寻鲸「航海志」UI 改动记录（Web 阶段）

> 分支 `feat/whale-journal-ui`。原则:**只换皮、不动业务逻辑**——所有 onPress/API/socket/字段/接口一律保留;不碰导航框架、不碰 `*.native.tsx`、不碰 `server/`、不碰密钥文件。未 push。
> 构建走 `expo export --platform web`(Metro),**不是** webpack(仓库里那套 webpack 是废弃且构建不出来的)。

## 1. 设计系统（地基）
- **配色** `src/theme/colors.ts`:整套换「浅滩」清新冷色(保留原 key 名 → 全 App 联动)。
  - primary `#2C82C9`(海洋蓝)· secondary `#45C0A6`(薄荷)· accent `#F97A66`(珊瑚)· background `#F2F7FB` · ink `#213F58` · gold `#E9B23F` · green `#5BB98C`。
  - 稀有度 6 级(单一来源,`constants.RARITY_COLORS = colors.rarity`):典藏`#6C63D6`/神秘`#C75BB8`/限定`#F97A66`/高端`#E9B23F`/普通`#2C82C9`/常见`#45C0A6`。
- **字体** `src/theme/typography.ts`(Web 端由 `index.ts` 运行时注入):
  - `HAND='Long Cang, Noto Serif SC, serif'` — 手写,**仅标题/落款/装饰**;缺字回退**宋体**(不是黑体,避免混排突兀)。⚠️ Long Cang 只覆盖常用简体(GB2312 级),生僻字/繁体会逐字回退。
  - `SERIF='Cormorant Garamond, Noto Serif SC'` — en 副标 / 票根 Cartouche。
  - `BODY='Noto Sans SC'` — 正文/按钮/标签(默认)。
  - `KAI='LXGW WenKai, Kaiti SC, …, serif'` — **楷体**,用于纸条信笺正文;霞鹜文楷 webfont 由 `index.ts` 注入 jsdelivr(`lxgw-wenkai-webfont`),覆盖广、全端一致(CJK 体积大)。
- **母题工具箱** `src/theme/whaleKit.tsx`(react-native-svg):`WhaleMark/Waveform/Ripple/FreqBars/Seal/Tape/DotPaper/SeaPaper/LinedPaper`(LinedPaper=信笺横线)。
- **新依赖**:`react-native-svg`(web 阶段唯一新增;expo-font/gradient 未上,留 APK 阶段)。

## 2. 底部 6 Tab（`navigation/MainTabs.tsx`）
- 去掉 emoji 图标,改**纯文字 + 选中态**(主色加粗 + 下方波形下划线)。
- Tab:好友 / 发布 / 活动广场 / 地图 / 展柜 / 我。

## 3. 六个主 Tab 专属母题
| Tab | 母题 |
|---|---|
| 展柜 | 手账:点阵纸 + 拍立得贴纸 + 和纸胶带 + 6 级手写分组;鲸藏/纸条**悬浮文字切换**(无底框);藏品左移贴近稀有度栏 |
| 活动广场 | 票根:Cartouche 衬线标题 + 登船存根卡(BOARDING 竖条 + 虚线撕裂边)+ 橡皮章状态;「我参与的」= 标题右上小字链接 |
| 我 | 船长证(印章)+ 航行数据(藏品/发起同游/参与同游并入卡内);设置项收进**列表卡**;按钮统一圆角框;退出/注销分离(注销危险红) |
| 发起同游 | 出航申请单:细墨线字段 + 方形步进器 + 印章式提交;校区含苏州 |
| 好友 | 手写标题;好友申请+添加好友**整合到右上角「+」**(有未读挂红点) |
| 地图 | 见第 4 节 |

## 4. 地图专项（`screens/map/MapScreen.tsx`）
- **底图**:Leaflet + 高德栅格瓦片 → **MapLibre GL + OpenFreeMap 矢量 + 逐层海洋染色**(水=海蓝/陆=浅纸/路=白线蓝描边/楼=独立色块深描边/地名=深墨白描边),整体蓝调与网页统一。
- **坐标系(关键)**:底图是 WGS-84,而宝箱/活动数据与定位逻辑是 GCJ-02。策略——
  - **显示层**:所有 marker + 蓝点用 `gcj02ToWgs84` 转成 WGS-84 再画(对齐底图)。
  - **逻辑层不动**:`userLocation` 仍存 GCJ-02,socket `location_update`、开箱距离判定全部照旧发 GCJ-02(和服务端一致)。
- **定位**:浏览器 `navigator.geolocation`(WGS-84);蓝点用涟漪+核心+「你在这」标签。
- **控件重做**:顶部大白条拆掉 → 浮层。校区切换 = 左上紧凑 pill;刷新/定位 = 右上圆形图标钮;写纸条 + 鲸落计数 = 右下;**经纬度 = 左下角小字**(⚠ 时带「重试」)。
- marker:鲸落(金)/巨鲸落(珊瑚)/同游(类型色)/纸条(金),带文字标签。

## 5. 去 emoji / 换 SVG
- 全 App 去掉文字前 emoji(校区、卡片 meta、分段、按钮、统计等)。
- 空状态大 emoji → **SVG 鲸标 + 波形**(`EmptyState` 组件统一改)。
- 登录三屏:🏛️/🎉 → WhaleMark;标题手写化;表单扁平化。
- 全部子页(聊天/详情/日志/反馈/管理后台/选点等):手写标题 + 扁平表头。

## 6. AI 生成图接入(2026-07-03 已接入)
图放 `client/assets/icons/`(原图 PIL 压到 ≤180px、50–75KB/张),`<Image source={require(...)}>` 接入:
- ✅ 好友展柜入口 `icon_gallery.png`——图标(28px)移到波形左侧,「TA的展柜 ›」文字下移。
- ✅ 地图鲸落 `icon_whalefall.png` / 巨鲸落 `icon_bigwhalefall.png`——marker(`mkEl`)+ 右下角计数 chip 同步换图;计数图标放大 1.5×(27px)、数字 21px、chip 加宽。
- ⏳ 活动类型(吃饭/自习/运动/其它)——4 图暂存 `client/src/ui_images/`,**走管理员后台上传 `typeId.iconUrl`,零改代码**;如需本地预览可在 `iconUrl` 空时 fallback 本地图(待鳟鱼确认)。
- 同游 / 纸条 marker 暂无对应 AI 图,继续用 `mkEl` 文字标签。

## 7. ⚠️ 临时预览脚手架（PR 前必须移除）
仅为本地免登录看效果,**不可进正式 PR**:
- `client/index.ts`:`if (Platform.OS==="web") require("./src/_mock.web")`(假数据)。
- `client/src/_mock.web.ts`(axios mock + 假用户)。
- `client/src/navigation/RootNavigator.tsx`:`{true ? <MainTabs/> : ...}`(跳过登录)——改回 `{isLoggedIn ? <MainTabs/> : <AuthStack/>}`。
- `client/_servedist.cjs`(dist 静态服务器,辅助查看)。

## 8. 后续
- AI 图接入(见 6)。
- APK 阶段:`*.native.tsx` 同款换皮 + `expo-font` 打包字体(CJK 大,注意体积)+ 重打 APK + 真机回测。
- push / PR:需先确认鳟鱼账号对 `9ykrz5wssj-oss/xunjing` 写权限;PR 前移除第 7 节脚手架。

## 9. 已知坑：`expo export` 生产构建 ≠ 开发模式

**（2026-07-02）GalleryScreen `BODY is not defined` → 白屏**

- 现象：`npx expo export --platform web` 后访问 `localhost:5190` 白屏，puppeteer 抓取报 `ReferenceError: BODY is not defined`。
- 根因：`GalleryScreen.tsx` 的 import 只写了 `{ colors, typography, spacing, borderRadius, HAND, SERIF, KAI }`，漏了 `BODY`，但样式表 `StyleSheet.create` 中 4 处用了 `fontFamily: BODY`。开发模式（Metro dev server）模块解析较宽松侥幸通过，生产构建（`expo export`）直接 ReferenceError → React 无法挂载 → 白屏。
- 修复：补上 `BODY` 导入。
- 教训：**`expo export` 后必须用 puppeteer 或手动打开浏览器验证**，不能只看构建命令返回 0 就认为成功。主题 token（`BODY`/`HAND`/`SERIF`/`KAI`）新增到新文件时，确认 import 语句完整。

## 10. 构建 & 本地查看
```
cd client
npx expo export --platform web      # 产物 → dist/
node _servedist.cjs                 # 本地 http://localhost:5190
```
改代码后需重新 export 再刷新(无热更;`expo start --web` 跑不起来,缺 @expo/metro-runtime)。

## 11. 第二轮迭代细化(2026-07-02)
- **地图**:海洋色板由偏绿调成**蓝调**(与网页统一);顶栏拆成浮层——校区 pill 左上、刷新/定位圆钮右上、写纸条 FAB + 鲸落计数右下、**经纬度左下角小字**;缩放控件移左下(经纬度上方);**首次定位成功自动归中一次**(`didCenterRef`,失败停校区中心,不抢手动拖动)。
- **好友**:申请+添加合并到右上「+」(去圆圈、深蓝字、对齐标题底);成员卡片重构为**船员名录(方案 A)**——无卡片、发丝分隔、头像+手写名+楷体消息+频率波形+「TA的展柜」文字入口。
- **活动广场**:删掉「活动广场/我参与的」分段(占空间),「我参与的」改为**与「共 n 个活动」同排的右上小字链接**;搜索框 + 类型 chips 变窄变矮。
- **展柜**:鲸藏/纸条切换改**悬浮文字**(去底框);藏品左移贴近稀有度栏。
- **纸条(方案 A · 漂流瓶信笺)**:弃暖棕 → **浅蓝信笺**;正文**楷体 + 信笺横线**(`LinedPaper`),**落款/名称用手写体**;头像用首字母;去 emoji;覆盖 展柜列表/详情 + 地图拾取弹窗/结果弹窗 + 写纸条页。
- **我**:船长证印章放大 1.5×(size 93)并锚定右边框/下分割栏距离不变(`top:67`);学号左对齐;按钮收进列表卡。
- **假数据**:`_mock.web.ts` 补 3 条纸条(展柜纸条可见)。

## 12. 自查纪律(防白屏复发)
新增/改动屏后,除 `expo export` 外必做:
```
# 字体 token 用了但没 import 的静态自查(白屏根因那类）
f=<screen.tsx>; imp=$(grep -m1 'from "../../theme"' "$f")
for tok in BODY HAND SERIF KAI; do grep -qE "\b$tok\b" <(grep -vE 'from ".*theme"' "$f") && (echo "$imp"|grep -qE "\b$tok\b" || echo "⚠ 缺 $tok"); done
```
条件成熟时用 puppeteer/浏览器实际打开验证渲染(不能只看构建返回 0)。

## 13. 前后端接口核对(2026-07-03,任务 C)
纯样式重构未破坏接口契约,静态核对通过:
- `git diff main..HEAD -- client/src/services/` **为空**——所有 endpoint/payload schema 基线保持。
- 被改屏中数据层调用(`getMyNotes` / `location_update` socket emit / `updateProfile({studentId})`)增删行逐条 -/+ 一致,仅换容器/挪位;两处伴随微调(`fetchMyEvents` 展开时才拉、`updateProfile` 加成功 Alert)等价或纯增益。
- **坐标专项**:socket 上报仍 `{ lat: gcj.lat, lng: gcj.lng }`(GCJ-02),`gcj02ToWgs84` 只用于显示层画点。
- ⏳ 动态冒烟(连真后端登录逐条走)需鳟鱼在真环境验。

## 14. 遗留清理项(PR 前)
- **`loggg.txt`**(仓库根,294 行)——误 commit 进 `4745c95` 的操作日志,建议 `git rm` + 加 `.gitignore`(踩删文件红线,待鳟鱼定)。
- 临时预览脚手架(见 §7)。
- 未跟踪原图目录 `client/src/ui_images/`(7 张,~11.7MB)——压缩版已进 `assets/icons/`,原图留否待定。
