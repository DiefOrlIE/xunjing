# 寻鲸「航海志」UI · 下一步执行计划

> 承接 `WHALE-UI-CHANGELOG.md`。分支 `feat/whale-journal-ui`,web 阶段,只换皮不动逻辑,未 push。
> 三项任务:A 图标替换 · B 递归覆盖审计 · C 前后端接口核对。

---

## 任务 A · AI 图标替换(位图 PNG)

生成后放 `client/assets/icons/`,用 `<Image source={require(...)}>` 接入(activity 类型走后台上传,零改码)。统一提示词前缀见 CHANGELOG 对话记录:手绘航海志、浅滩配色、扁平、透明底、正方形、2–3× 尺寸。

| 图标 | 现状 | 接入点(代码) | 建议尺寸 |
|---|---|---|---|
| 好友「展柜」入口 | 文字「TA的展柜 ›」 | `screens/friends/FriendListScreen.tsx` → `rosterGalleryTxt`(换成 `<Image>`) | 20–24px |
| 活动类型(吃饭/自习/运动/其它) | `typeId.iconUrl` 空→不显示 | **管理员后台上传 `iconUrl`**,`ActivitySquareScreen`/`PublishEventScreen` 已读该字段,零改码 | 28–32px |
| 地图 鲸落/巨鲸落/同游/纸条 marker | 文字标签(`mkEl` tag) | `screens/map/MapScreen.tsx` → `mkEl()` 里把 tag 文本换成 `<img src>`(marker 是 DOM 元素) | 32–40px |

**执行要点**:先出一套(风格必须一致),接一个验证观感,再批量。marker 是 MapLibre 的 DOM 元素,直接改 `mkEl` 的 innerHTML 加 `<img>` 即可。

---

## 任务 B · 递归覆盖审计(所有可达屏)

导航可达屏共 **19 个**,全部已过航海志换皮(配色 token + 标题;不再是旧珊瑚粉/emoji)。

**已上专属母题(8 屏)**:展柜(手账)· 活动广场(票根)· 我(船长证)· 发起同游(出航单)· 地图(海洋)· 好友(船员名录)· 登录三屏(鲸标)。

**已换皮 = token + 手写标题 + 扁平表头,但未上专属母题(10 屏,功能屏,可按需再深化)**:
`ChatScreen · UserGalleryScreen · ItemDetailScreen · EventDetailScreen · GroupChatScreen · WriteNoteScreen(已信笺化)· MapPickerScreen · AdminPanelScreen · FeedbackScreen · LogFeedScreen`。

**孤儿屏(导航不可达,可忽略)**:`log/ActivityTypeListScreen.tsx`(未在任何 stack 注册,也无 `navigate` 指向)。

**复查命令**(改导航后重跑,确认无新增未换皮屏):
```
cd client/src && grep -rhoE 'Screen name="[A-Za-z]+" component=\{[A-Za-z]+\}' navigation/ | sort -u
```

**待你定**:上表 10 个功能屏是「保持换皮即可」还是「挑几个上专属母题」(如 Chat/EventDetail 值得做,Admin 太大可只保头)。

---

## 任务 C · 前后端接口核对

**结论(预期)**:本次是纯样式重构,**未改任何 API 调用/字段/handler**,接口契约应完好。需系统性验证:

1. **静态**:`git diff main..feat/whale-journal-ui -- <screen>` 逐屏确认——改动只在 style/JSX 排布,`*.api` 调用、payload 字段、`socket.emit` 事件名一行未动。
2. **服务契约清单**:核对 `client/src/services/*.api.ts` 里的 endpoint 与 `server/src` 路由/字段一致(本次没动 services,基线即真实契约)。服务文件:`auth / user / friend / event / collection / chest / note / feedback / chat / map` 等。
3. **动态冒烟**(连真后端):`124.222.230.80:3000` 在线时,登录后逐条走:加好友 / 存学号 / 设密码 / 发活动 / 开箱 / 写+拾纸条 / GPS 蓝点 / 看展柜,确认调用未断、数据回填正常。
4. **坐标专项**:地图换了 MapLibre + `gcj02ToWgs84` 显示层转换,但**发给服务端的仍是 GCJ-02**(`location_update`/开箱距离)——需真机/真数据验一次开箱距离判定没偏(逻辑未改,风险低)。

---

## 收尾(PR 前必做)

1. **移除临时预览脚手架**(见 CHANGELOG §7):`_mock.web.ts`、`_servedist.cjs`、`index.ts` 的 mock require、`RootNavigator` 的 `{true?}` 跳过登录 → 改回 `{isLoggedIn?…}`。
2. **确认 push 权限**:鳟鱼账号对 `9ykrz5wssj-oss/xunjing` 是否可直推,否则 fork+PR。
3. **APK 阶段**(单独排期):`*.native.tsx` 同款换皮 + `expo-font` 打包字体(CJK 体积)+ 重打 APK + 真机回测。

## 验证 & 提交
- 每屏改后:`expo export` + 字体 token 静态自查(CHANGELOG §12)+ 条件允许时浏览器实测。
- 每对话提交 git;push/PR 前先问鳟鱼。
