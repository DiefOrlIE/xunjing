import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Image, Dimensions, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, typography, spacing, borderRadius, BODY, HAND, KAI, SERIF } from "../../theme";
import { WhaleMark, Waveform, LinedPaper } from "../../theme/whaleKit";
import { Campus, CAMPUS_BOUNDS, RARITY_COLORS } from "../../utils/constants";
import { getActiveChests } from "../../services/chest.api";
import { getActiveNotes } from "../../services/note.api";
import { getSocket, getCurrentSocket } from "../../socket/socketClient";
import api, { fixImageUrl } from "../../services/api";
import { getCachedBounds, setCachedBounds, CampusBoundData } from "../../utils/mapCache";

const CAMPUS_CENTERS: Record<Campus, { lng: number; lat: number; zoom: number }> = {
  gulou: { lng: 118.7750, lat: 32.0575, zoom: 16 },
  xianlin: { lng: 118.9500, lat: 32.1170, zoom: 15 },
  suzhou: { lng: 120.5230, lat: 31.3230, zoom: 15 },
};

// WGS-84 → GCJ-02（浏览器GPS转高德坐标系）
const PI = Math.PI, A = 6378245.0, EE = 0.00669342162296594323;
const _tLat = (x: number, y: number): number => { let r = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x)); r += (20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3; r += (20*Math.sin(y*PI)+40*Math.sin(y/3*PI))*2/3; r += (160*Math.sin(y/12*PI)+320*Math.sin(y*PI/30))*2/3; return r; };
const _tLng = (x: number, y: number): number => { let r = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x)); r += (20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3; r += (20*Math.sin(x*PI)+40*Math.sin(x/3*PI))*2/3; r += (150*Math.sin(x/12*PI)+300*Math.sin(x/30*PI))*2/3; return r; };
const wgs84ToGcj02 = (lat: number, lng: number) => { const dLat = _tLat(lng-105, lat-35); const dLng = _tLng(lng-105, lat-35); const rad = lat/180*PI; let m = Math.sin(rad); m = 1-EE*m*m; const s = Math.sqrt(m); return { lat: lat+(dLat*180)/((A*(1-EE))/(m*s)*PI), lng: lng+(dLng*180)/(A/s*Math.cos(rad)*PI) }; };

// GCJ-02 → WGS-84（近似反向纠偏，供在 WGS-84 矢量图上显示 GCJ 数据/定位）
const gcj02ToWgs84 = (lat: number, lng: number) => { const g = wgs84ToGcj02(lat, lng); return { lat: lat * 2 - g.lat, lng: lng * 2 - g.lng }; };

// 浏览器 geolocation 坐标系归一化：iOS/桌面返回 WGS-84；安卓国产 ROM 底层走高德/厂商定位，返回的已是 GCJ-02。
// 统一产出：gcj = 逻辑/socket/距离用（全站 GCJ-02）；wgs = 画在 WGS-84 矢量底图用。
const normLoc = (lat: number, lng: number) => {
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  return isAndroid
    ? { gcj: { lat, lng }, wgs: gcj02ToWgs84(lat, lng) }
    : { gcj: wgs84ToGcj02(lat, lng), wgs: { lat, lng } };
};

let ML: any = null; // maplibre-gl
const OCEAN = { land: "#EDF5FC", land2: "#DEEDF7", water: "#33A6E0", green: "#A9E0CA", bldg: "#DBE8F5", bldgO: "#A6C6E2", road: "#FFFFFF", roadCase: "#8CBCE0", rail: "#B4CBE2", ink: "#123A5A", halo: "#FFFFFF", boundary: "#AAC3DB" };

const loadMapLibre = () => new Promise<any>((resolve) => {
  if (typeof window === "undefined") return resolve(null);
  if ((window as any).maplibregl) return resolve((window as any).maplibregl);
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css"; document.head.appendChild(link);
  if (!document.getElementById("whale-mk-css")) {
    const st = document.createElement("style"); st.id = "whale-mk-css";
    st.textContent = ".wmk{position:relative;width:0;height:0}.wmk .ping{position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:var(--c);animation:wping 2.6s ease-out infinite}.wmk .ping.b{animation-delay:1.2s}.wmk .core{position:absolute;left:0;top:0;width:15px;height:15px;transform:translate(-50%,-50%);border-radius:50%;background:var(--c);border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.3)}.wmk .tag{position:absolute;left:0;top:11px;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:700;color:var(--c);text-shadow:0 1px 2px #fff,0 0 3px #fff}.wmk.me .core{width:19px;height:19px}.wmk.me .halo{position:absolute;left:0;top:0;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(44,130,201,.14);border:1px solid rgba(44,130,201,.35)}.wmk .wicon{position:absolute;left:0;top:0;width:42px;height:42px;transform:translate(-50%,-50%);object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}@keyframes wping{0%{transform:translate(-50%,-50%) scale(.35);opacity:.55}100%{transform:translate(-50%,-50%) scale(3.4);opacity:0}}.maplibregl-ctrl-bottom-left{bottom:26px}.maplibregl-ctrl-bottom-left .maplibregl-ctrl{margin-left:12px}";
    document.head.appendChild(st);
  }
  const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js"; s.onload = () => resolve((window as any).maplibregl); s.onerror = () => resolve(null); document.head.appendChild(s);
});

// 逐图层重上色为海洋皮肤（水=海蓝/陆=浅纸/路=白线青描边/楼=独立色块深描边/地名=深墨白描边）
function recolorMap(map: any) {
  const layers = (map.getStyle() && map.getStyle().layers) || [];
  layers.forEach((ly: any) => {
    const id = ly.id.toLowerCase(), sl = (ly["source-layer"] || "").toLowerCase(), ty = ly.type;
    try {
      if (ty === "background") { map.setPaintProperty(ly.id, "background-color", OCEAN.land); return; }
      if (sl === "water" || sl === "waterway") { if (ty === "fill") map.setPaintProperty(ly.id, "fill-color", OCEAN.water); if (ty === "line") map.setPaintProperty(ly.id, "line-color", OCEAN.water); return; }
      if (sl === "building") { if (ty === "fill") { map.setPaintProperty(ly.id, "fill-color", OCEAN.bldg); map.setPaintProperty(ly.id, "fill-outline-color", OCEAN.bldgO); } if (ty === "fill-extrusion") map.setPaintProperty(ly.id, "fill-extrusion-color", OCEAN.bldg); return; }
      if (sl === "park" || /wood|grass|forest|park|garden|pitch|golf/.test(id)) { if (ty === "fill") map.setPaintProperty(ly.id, "fill-color", OCEAN.green); if (ty === "line") map.setPaintProperty(ly.id, "line-color", OCEAN.green); return; }
      if (sl === "landuse" || sl === "landcover") { if (ty === "fill") map.setPaintProperty(ly.id, "fill-color", OCEAN.land2); return; }
      if (sl === "transportation") { if (ty === "line") { if (/rail/.test(id)) map.setPaintProperty(ly.id, "line-color", OCEAN.rail); else if (/casing|outline/.test(id)) map.setPaintProperty(ly.id, "line-color", OCEAN.roadCase); else map.setPaintProperty(ly.id, "line-color", OCEAN.road); } if (ty === "fill") map.setPaintProperty(ly.id, "fill-color", OCEAN.road); return; }
      if (sl === "boundary") { if (ty === "line") map.setPaintProperty(ly.id, "line-color", OCEAN.boundary); return; }
      if (ty === "symbol") { map.setPaintProperty(ly.id, "text-color", OCEAN.ink); map.setPaintProperty(ly.id, "text-halo-color", OCEAN.halo); map.setPaintProperty(ly.id, "text-halo-width", 1.4); }
    } catch (e) {}
  });
}

// Web端Metro打包后 require() 直接返回字符串URL，不是 {uri} 对象，不能 .uri
const ICON_WHALEFALL = require("../../../assets/icons/icon_whalefall.png") as string;
const ICON_BIGWHALEFALL = require("../../../assets/icons/icon_bigwhalefall.png") as string;
const ICON_NOTE = require("../../../assets/icons/icon_note.png") as string;

// marker DOM 元素（涟漪 + 核心 + 标签），me=蓝色定位点，icon=悬浮图标(鲸落/巨鲸落)
function mkEl(color: string, tag: string, me?: boolean, icon?: any, pingColor?: string) {
  const d = document.createElement("div"); d.className = "wmk" + (me ? " me" : ""); (d.style as any).setProperty("--c", color);
  const pc = icon ? (pingColor || "#3FB6BD") : "";
  const pingHtml = '<span class="ping"' + (pc ? ' style="background:' + pc + '"' : '') + '></span><span class="ping b"' + (pc ? ' style="background:' + pc + '"' : '') + '></span>';
  d.innerHTML = (me ? '<span class="halo"></span>' : "") + pingHtml
    + (icon ? '<img class="wicon" src="' + icon + '" />' : '<span class="core"></span>')
    + (tag ? '<span class="tag" style="' + (icon ? "top:24px" : "") + '">' + tag + "</span>" : "");
  return d;
}

export function MapScreen() {
  const navigation = useNavigation<any>();
  const [campus, setCampus] = useState<Campus>(Campus.GULOU);
  const [chests, setChests] = useState<any[]>([]);
  const [cooldowns, setCooldowns] = useState<{normal:number,advanced:number}>({normal:0,advanced:0});
  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteResult, setNoteResult] = useState<any>(null);
  const [showNoteResult, setShowNoteResult] = useState(false);
  const [gpsLabel, setGpsLabel] = useState("");
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [unlockingChestId, setUnlockingChestId] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [nearbyCounts, setNearbyCounts] = useState<Record<string, number>>({});
  const socketRef = useRef<any>(null); const mapRef = useRef<any>(null); const markersRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null); const divRef = useRef<any>(null); const didCenterRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [bounds, setBounds] = useState<Record<string, CampusBoundData>>(CAMPUS_BOUNDS);

  // 从服务器获取校区边界（使用管理后台配置的真实边界）
  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedBounds();
        if (cached) { setBounds(cached); return; }
      } catch {}
      try {
        const res = await api.get("/map/campus-bounds");
        if ((res as any).success && (res as any).data) {
          const map: Record<string, CampusBoundData> = { ...CAMPUS_BOUNDS };
          ((res as any).data).forEach((c: any) => {
            map[c.campus] = { minLat: c.minLat, maxLat: c.maxLat, minLng: c.minLng, maxLng: c.maxLng };
          });
          setBounds(map);
          setCachedBounds(map).catch(() => {});
        }
      } catch {}
    })();
  }, []);

  useEffect(() => { if (!divRef.current || mapRef.current) return; let c = false;
    loadMapLibre().then((ml) => { if (c || !ml || !divRef.current) return; ML = ml;
      const ct = CAMPUS_CENTERS[campus]; const w0 = gcj02ToWgs84(ct.lat, ct.lng);
      const map = new ml.Map({ container: divRef.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [w0.lng, w0.lat], zoom: ct.zoom, attributionControl: false });
      map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-left");
      map.on("load", () => {
        recolorMap(map);
        const b = bounds[campus]; const sw = gcj02ToWgs84(b.minLat, b.minLng), ne = gcj02ToWgs84(b.maxLat, b.maxLng);
        try { map.fitBounds([[sw.lng, sw.lat], [ne.lng, ne.lat]], { padding: 40, duration: 0 }); } catch (e) {}
      });
      markersRef.current = []; mapRef.current = map; setMapReady(true);
      setTimeout(() => { try { map.resize(); } catch (e) {} }, 250);
    }); return () => { c = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // GPS定位：直接获取最新高精度位置，WGS84→GCJ02（和之前正常工作的版本一致）
  useEffect(() => {
    if (!navigator?.geolocation) { setGpsLabel("⚠ 浏览器不支持定位"); return; }
    let first = true; let dead = false; let watchId = 0;

    const updatePos = (lat: number, lng: number) => {
      // gcj = 逻辑/socket/距离用；wgs = 画在底图用（安卓返回 GCJ 时会做转换，iOS 保持原样）
      const { gcj, wgs } = normLoc(lat, lng);
      setGpsLabel(`${gcj.lat.toFixed(6)}, ${gcj.lng.toFixed(6)}`); setUserLocation(gcj);
      if (mapRef.current && ML) {
        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = new ML.Marker({ element: mkEl(colors.primary, "你在这", true), anchor: "center" }).setLngLat([wgs.lng, wgs.lat]).addTo(mapRef.current);
        // 首次定位成功后自动归中一次（之后不再自动移动，避免和手动拖动打架）
        if (!didCenterRef.current) { didCenterRef.current = true; try { mapRef.current.flyTo({ center: [wgs.lng, wgs.lat], zoom: 16 }); } catch (e) {} }
      }
      const s = getCurrentSocket(); if (s?.connected) s.emit("location_update", { lat: gcj.lat, lng: gcj.lng, campus });
    };

    // 直接请求高精度GPS位置
    navigator.geolocation.getCurrentPosition(
      (pos) => updatePos(pos.coords.latitude, pos.coords.longitude),
      (err) => setGpsLabel(err.code === 1 ? "⚠ 请允许浏览器定位权限" : err.code === 3 ? "⚠ 定位超时，请检查GPS" : "⚠ 定位信号弱"),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
    // 持续追踪
    watchId = navigator.geolocation.watchPosition(
      (pos) => updatePos(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000, distanceFilter: 10 }
    );

    return () => { dead = true; if (watchId) navigator.geolocation?.clearWatch(watchId); };
  }, [campus]);

  const fetchAll = useCallback(async () => { try {
    const [cR, eR, nR] = await Promise.all([getActiveChests(campus), api.get("/map/activity-pins", { params: { campus } }), getActiveNotes(campus)]);
    if (cR.success && cR.data) { setChests(cR.data); setCooldowns((cR as any).cooldowns || {normal:0,advanced:0}); }; if (eR && (eR as any).success) setEvents((eR as any).data || []);
    if (nR.success && nR.data) setNotes(nR.data);
    updateMarkers(cR.data || [], (eR as any)?.data || [], nR.data || []);
  } catch {} }, [campus]);
  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 20000); return () => clearInterval(t); }, [fetchAll]);

  useEffect(() => { (async () => { const s = await getSocket(); if (!s) return; socketRef.current = s;
    s.on("chest_open_result", (d: any) => { setUnlockingChestId(null); setOpenResult(d.success ? { success: true, item: d.item, rarity: d.item?.rarity } : { success: false, error: d.error }); setShowResultModal(true); });
    s.on("chest_player_count", (d: any) => { setNearbyCounts(p => ({ ...p, [d.chestId]: d.currentCount })); });
    s.on("pickup_note_result", (d: any) => { if (d.success) { setNoteResult(d.data); setShowNoteResult(true); } else { setOpenResult({ success: false, error: d.error }); setShowResultModal(true); } });
    s.on("note_removed", (d: any) => { setNotes(p => p.filter(n => n._id !== d.noteId)); if (markersRef.current && L) { updateMarkers(chests, events, notes.filter(n => n._id !== d.noteId)); } });
  })(); return () => { const s = socketRef.current; if (s) { s.off("chest_open_result"); s.off("chest_player_count"); s.off("pickup_note_result"); s.off("note_removed"); } }; }, []);

  const updateMarkers = (ch: any[], ev: any[], nt: any[] = []) => {
    if (!mapRef.current || !ML) return;
    (markersRef.current || []).forEach((m: any) => m.remove()); markersRef.current = [];
    const add = (latGcj: number, lngGcj: number, color: string, tag: string, onClick: () => void, icon?: string, pingColor?: string) => {
      const w = gcj02ToWgs84(latGcj, lngGcj);
      const el = mkEl(color, tag, false, icon, pingColor); el.style.cursor = "pointer";
      el.addEventListener("click", (ev2) => { ev2.stopPropagation(); onClick(); });
      const m = new ML.Marker({ element: el, anchor: "center" }).setLngLat([w.lng, w.lat]).addTo(mapRef.current);
      markersRef.current.push(m);
    };
    ch.forEach((c, i) => { const a = c.type === "advanced";
      add(c.coordinates.lat, c.coordinates.lng, a ? colors.accent : colors.gold, a ? "巨鲸落" : "鲸落", () => { setDialogData({ type: a ? "advancedChest" : "normalChest", data: { ...c, label: "#" + (i + 1) } }); setDialogVisible(true); }, a ? ICON_BIGWHALEFALL : ICON_WHALEFALL, a ? "#F5943C" : undefined);
    });
    ev.forEach((e) => { add(e.meetCoordinates.lat, e.meetCoordinates.lng, e.typeId?.color || colors.primary, "同游", () => { setDialogData({ type: "event", data: e }); setDialogVisible(true); }); });
    nt.forEach((n: any) => { add(n.coordinates.lat, n.coordinates.lng, colors.gold, "纸条", () => { setDialogData({ type: "note", data: n }); setDialogVisible(true); }, ICON_NOTE); });
  };

  const getDist = (a: number, b: number, c: number, d: number) => { const R = 6371000; const dLat = (c-a)*Math.PI/180; const dLng = (d-b)*Math.PI/180; const x = Math.sin(dLat/2)**2 + Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLng/2)**2; return Math.round(R*2*Math.atan2(Math.sqrt(x), Math.sqrt(1-x))); };
  const handleUnlock = async (id: string) => { const s = socketRef.current || await getSocket(); if (!s?.connected || !userLocation) return; setUnlockingChestId(id); setDialogVisible(false); s.emit("location_update", { lat: userLocation.lat, lng: userLocation.lng, campus }); setTimeout(() => s.emit("chest_open_request", { chestId: id }), 300); };
  const handlePickupNote = async (noteId: string) => { const s = socketRef.current || await getSocket(); if (!s?.connected || !userLocation) return; setDialogVisible(false); s.emit("location_update", { lat: userLocation.lat, lng: userLocation.lng, campus }); setTimeout(() => s.emit("pickup_note", { noteId }), 300); };
  const closeDialog = () => setDialogVisible(false);
  const fitCampus = (camp: Campus) => { const b = bounds[camp]; const sw = gcj02ToWgs84(b.minLat, b.minLng), ne = gcj02ToWgs84(b.maxLat, b.maxLng); try { mapRef.current?.fitBounds([[sw.lng, sw.lat], [ne.lng, ne.lat]], { padding: 40, duration: 600 }); } catch (e) {} };
  const flyToMe = () => { if (mapRef.current && userLocation) { const w = gcj02ToWgs84(userLocation.lat, userLocation.lng); mapRef.current.flyTo({ center: [w.lng, w.lat], zoom: Math.max(mapRef.current.getZoom(), 16) }); } };
  const retryLocate = () => {
    setGpsLabel("重新定位中...");
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { gcj, wgs } = normLoc(pos.coords.latitude, pos.coords.longitude);
        setGpsLabel(`${gcj.lat.toFixed(6)}, ${gcj.lng.toFixed(6)}`); setUserLocation(gcj);
        if (mapRef.current && ML) {
          if (userMarkerRef.current) userMarkerRef.current.remove();
          userMarkerRef.current = new ML.Marker({ element: mkEl(colors.primary, "你在这", true), anchor: "center" }).setLngLat([wgs.lng, wgs.lat]).addTo(mapRef.current);
          mapRef.current.flyTo({ center: [wgs.lng, wgs.lat], zoom: Math.max(mapRef.current.getZoom(), 16) });
        }
        const s = getCurrentSocket(); if (s?.connected) s.emit("location_update", { lat: gcj.lat, lng: gcj.lng, campus });
      },
      () => setGpsLabel("⚠ 定位信号弱"),
      { enableHighAccuracy: true, timeout: 30000 }
    );
  };
  const nc = chests.filter((c: any) => c.type === "normal"); const ac = chests.filter((c: any) => c.type === "advanced");
  const RCOLORS = RARITY_COLORS;

  const T = TouchableOpacity;
  return (
    <View style={S.ct}>
      <View style={{ flex: 1 }}>
        <View ref={divRef} style={{ flex: 1 }} />
        {/* 左上：校区切换 pill */}
        <View style={S.campusPill}>
          <T onPress={() => { setCampus(Campus.GULOU); fitCampus(Campus.GULOU); }} style={[S.cpBtn, campus === Campus.GULOU && S.cpOn]}><Text style={[S.cpTxt, campus === Campus.GULOU && S.cpTxtOn]}>鼓楼</Text></T>
          <T onPress={() => { setCampus(Campus.XIANLIN); fitCampus(Campus.XIANLIN); }} style={[S.cpBtn, campus === Campus.XIANLIN && S.cpOn]}><Text style={[S.cpTxt, campus === Campus.XIANLIN && S.cpTxtOn]}>仙林</Text></T>
          <T onPress={() => { setCampus(Campus.SUZHOU); fitCampus(Campus.SUZHOU); }} style={[S.cpBtn, campus === Campus.SUZHOU && S.cpOn]}><Text style={[S.cpTxt, campus === Campus.SUZHOU && S.cpTxtOn]}>苏州</Text></T>
        </View>
        {/* 右上：刷新 / 定位 圆钮 */}
        <View style={S.topRight}>
          <T style={S.iconBtn} onPress={fetchAll}><Text style={S.iconGlyph}>↻</Text></T>
          <T style={S.iconBtn} onPress={flyToMe}><Text style={S.iconGlyph}>◎</Text></T>
        </View>
        {/* 右下：计数 + 写纸条 */}
        <View style={S.brStack}>
          <T style={S.noteBtn} onPress={() => { if (userLocation) { (navigation as any).navigate("WriteNote", { userLocation, campus }); } }}><Text style={S.fabGlyph}>✎</Text></T>
          <View style={S.countRow}>
            <View style={S.countChip}><Image source={require("../../../assets/icons/icon_whalefall.png")} style={S.countIcon} /><Text style={S.cn}>{nc.length}</Text></View>
            <View style={S.countChip}><Image source={require("../../../assets/icons/icon_bigwhalefall.png")} style={S.countIcon} /><Text style={S.cn}>{ac.length}</Text></View>
          </View>
        </View>
        {/* 左下：经纬度小字 + 重试 */}
        <View style={S.coordBL}>
          <Text style={S.coordTxt}>{gpsLabel || "定位中…"}</Text>
          {gpsLabel.startsWith("⚠") && <T onPress={retryLocate}><Text style={S.coordRetry}>重试</Text></T>}
        </View>
      </View>
      <Modal visible={dialogVisible} transparent animationType="fade"><T style={D.ov} activeOpacity={1} onPress={closeDialog}><T style={D.cd} activeOpacity={1} onPress={() => {}}>
        {dialogData?.type === "normalChest" && (() => { const c = dialogData.data; const dist = userLocation ? getDist(userLocation.lat, userLocation.lng, c.coordinates.lat, c.coordinates.lng) : null; const inR = dist != null && dist <= 20;
          return <View style={W.card}><View style={W.head}><Image source={require("../../../assets/icons/icon_whalefall.png")} style={W.hIcon} resizeMode="contain" /><View style={{ flex: 1 }}><Text style={W.kicker}>SEEKWHALE · 鲸落提货单</Text><Text style={W.title}>鲸落 {c.label}</Text></View></View><View style={[W.stampBox, { borderColor: inR ? colors.success : colors.info }]}><Text style={[W.stampTx, { color: inR ? colors.success : colors.info }]}>{inR ? "可拾取" : "待靠近"}</Text></View><View style={W.perf} /><View style={W.body}><View style={W.fRow}><Text style={W.fLabel}>拾取方式</Text><Text style={W.fVal}>单人 · 20 米内</Text></View>{dist != null && <View style={W.fRow}><Text style={W.fLabel}>距你</Text><Text style={W.fVal}>{dist} m</Text></View>}<Text style={W.note}>靠近 20 米即可拾取这枚鲸落。</Text></View>{cooldowns.normal > 0 ? <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}><View style={{ backgroundColor: colors.warning + "15", borderRadius: 10, padding: 11, alignItems: "center" }}><Text style={{ fontFamily: BODY, color: colors.warning, fontWeight: "700", fontSize: 13 }}>冷却中 · {Math.floor(cooldowns.normal / 60)}分{cooldowns.normal % 60}秒后可拾取</Text></View></View> : <View style={W.acts}>{inR ? <T style={[W.btn, { backgroundColor: colors.primary }]} onPress={() => handleUnlock(c._id)}><Text style={[W.btnTx, { color: "#fff" }]}>盖章拾取</Text></T> : <T style={[W.btn, { backgroundColor: colors.grid }]} onPress={closeDialog}><Text style={[W.btnTx, { color: colors.sub }]}>知道了</Text></T>}</View>}</View>;
        })()}
        {dialogData?.type === "advancedChest" && (() => { const c = dialogData.data; const dist = userLocation ? getDist(userLocation.lat, userLocation.lng, c.coordinates.lat, c.coordinates.lng) : null; const inR = dist != null && dist <= 20; const n = nearbyCounts[c._id] ?? 0; const nd = c.requiredPlayers || 3; const en = n >= nd || nd <= 1;
          return <View style={W.card}><View style={W.head}><Image source={require("../../../assets/icons/icon_bigwhalefall.png")} style={W.hIcon} resizeMode="contain" /><View style={{ flex: 1 }}><Text style={W.kicker}>SEEKWHALE · 巨鲸落提货单</Text><Text style={W.title}>巨鲸落 {c.label}</Text></View></View><View style={[W.stampBox, { borderColor: en ? colors.success : colors.rarity.典藏 }]}><Text style={[W.stampTx, { color: en ? colors.success : colors.rarity.典藏 }]}>{en ? "可拾取" : "集结中"}</Text></View><View style={W.perf} /><View style={W.body}><View style={W.fRow}><Text style={W.fLabel}>拾取条件</Text><Text style={W.fVal}>{nd <= 1 ? "单人" : `需 ${nd} 人会合`} · 20 米内</Text></View>{dist != null && <View style={W.fRow}><Text style={W.fLabel}>距你</Text><Text style={W.fVal}>{dist} m</Text></View>}<View style={W.fRow}><Text style={W.fLabel}>会合进度</Text><Text style={W.fVal}>{n} / {nd} 人</Text></View><View style={W.progTrack}><View style={[W.progFill, { width: `${Math.min(100, (n / nd) * 100)}%`, backgroundColor: en ? colors.success : colors.rarity.典藏 }]} /></View></View><View style={W.acts}><T style={[W.btn, { backgroundColor: colors.grid }]} onPress={closeDialog}><Text style={[W.btnTx, { color: colors.sub }]}>关闭</Text></T><T style={[W.btn, { backgroundColor: colors.secondary }]} onPress={() => { const s = socketRef.current; if (s?.connected && userLocation) s.emit("location_update", { lat: userLocation.lat, lng: userLocation.lng, campus }); fetchAll(); setTimeout(() => fetchAll(), 500); }}><Text style={[W.btnTx, { color: "#fff" }]}>刷新</Text></T><T style={[W.btn, { backgroundColor: en ? colors.primary : "#C9CFD6" }]} onPress={() => en && handleUnlock(c._id)}><Text style={[W.btnTx, { color: "#fff" }]}>{en ? "盖章拾取" : "等待"}</Text></T></View></View>;
        })()}
        {dialogData?.type === "event" && (() => { const e = dialogData.data;
          return <View style={W.card}><View style={W.head}>{e.typeId?.iconUrl ? <Image source={{ uri: fixImageUrl(e.typeId.iconUrl) }} style={W.hIcon} resizeMode="contain" /> : <View style={[W.hIcon, { backgroundColor: (e.typeId?.color || colors.primary) + "18", borderRadius: 12, alignItems: "center", justifyContent: "center" }]}><WhaleMark size={30} color={e.typeId?.color || colors.primary} /></View>}<View style={{ flex: 1 }}><Text style={W.kicker}>SEEKWHALE · 同游登船单{e.typeId?.name ? ` · ${e.typeId.name}` : ""}</Text><Text style={W.title} numberOfLines={2}>{e.title || "同游"}</Text></View></View>{e.status && <View style={[W.stampBox, { borderColor: e.status === "recruiting" ? colors.success : colors.warning }]}><Text style={[W.stampTx, { color: e.status === "recruiting" ? colors.success : colors.warning }]}>{e.status === "recruiting" ? "集结中" : "已启航"}</Text></View>}<View style={W.perf} /><View style={W.body}><View style={W.fRow}><Text style={W.fLabel}>船员</Text><Text style={W.fVal}>{e.currentParticipants || 0} / {e.capacity || "∞"} 人</Text></View><View style={W.fRow}><Text style={W.fLabel}>集合地</Text><Text style={[W.fVal, { flexShrink: 1, textAlign: "right", marginLeft: 12 }]} numberOfLines={1}>{e.locationText || "暂无位置"}</Text></View><View style={W.fRow}><Text style={W.fLabel}>启航时刻</Text><Text style={W.fVal}>{e.startTime ? new Date(e.startTime).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "待定"}</Text></View></View><View style={W.acts}><T style={[W.btn, { backgroundColor: colors.grid }]} onPress={closeDialog}><Text style={[W.btnTx, { color: colors.sub }]}>取消</Text></T><T style={[W.btn, { flex: 1.4, backgroundColor: colors.primary }]} onPress={() => { closeDialog(); (navigation as any).navigate("EventDetail", { eventId: e._id }); }}><Text style={[W.btnTx, { color: "#fff" }]}>查看详情</Text></T></View></View>;
        })()}
        {dialogData?.type === "note" && (() => { const n = dialogData.data; const dist = userLocation ? getDist(userLocation.lat, userLocation.lng, n.coordinates.lat, n.coordinates.lng) : null; const inR = dist != null && dist <= 20;
          return <View style={[W.card, { alignItems: "center", paddingVertical: 20, paddingHorizontal: 18 }]}><View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.secondary + "1A", borderWidth: 1, borderColor: colors.secondary + "44", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><WhaleMark size={32} color={colors.secondary} eye="#fff" /></View><Text style={{ fontFamily: SERIF, fontSize: 20, fontWeight: "700", color: colors.ink }}>一张漂流纸条</Text>{dist != null && <Text style={{ fontFamily: BODY, fontSize: 13, color: colors.info, fontWeight: "700", marginTop: 4 }}>距你 {dist} m</Text>}<Text style={{ fontFamily: KAI, fontSize: 14, color: colors.sub, textAlign: "center", marginTop: 8, lineHeight: 22 }}>踏进二十步之内，便能拾起这片心情。</Text>{inR ? <T style={[W.btn, { backgroundColor: colors.primary, width: "100%", marginTop: 16 }]} onPress={() => handlePickupNote(n._id)}><Text style={[W.btnTx, { color: "#fff" }]}>捡起这张纸条</Text></T> : <T style={[W.btn, { backgroundColor: colors.grid, width: "100%", marginTop: 16 }]} onPress={closeDialog}><Text style={[W.btnTx, { color: colors.sub }]}>知道了</Text></T>}</View>;
        })()}
      </T></T></Modal>
      <Modal visible={showResultModal} transparent><T style={D.ov} activeOpacity={1} onPress={() => { setShowResultModal(false); setOpenResult(null); }}><T style={D.cd} activeOpacity={1} onPress={() => {}}>
        {openResult?.success ? (() => { const rc = RCOLORS[openResult.rarity] || colors.primary; return <View style={W.reveal}><Text style={[W.revealKicker, { color: rc }]}>TREASURE</Text><View style={{ marginBottom: 2 }}><Waveform w={130} h={11} color={rc} sw={1.4} opacity={0.6} /></View><View style={[W.glowRing, { borderColor: rc + "55", backgroundColor: rc + "0D" }]}><View style={[W.itemFrame, { borderColor: rc }]}>{openResult.item?.imageUrl ? <Image source={{ uri: fixImageUrl(openResult.item.imageUrl) }} style={W.itemImg} resizeMode="contain" /> : <View style={[W.itemImg, { backgroundColor: rc + "18", alignItems: "center", justifyContent: "center" }]}><WhaleMark size={44} color={rc} /></View>}</View></View><Text style={W.itemName}>{openResult.item?.name}</Text><View style={[W.rarePill, { backgroundColor: rc + "1A" }]}><Text style={[W.rareTx, { color: rc }]}>{openResult.rarity}</Text></View><T style={[W.btn, { backgroundColor: rc, width: "100%", marginTop: 16 }]} onPress={() => { setShowResultModal(false); setOpenResult(null); }}><Text style={[W.btnTx, { color: "#fff" }]}>收进展柜</Text></T></View>; })() : <View style={W.reveal}><View style={{ marginBottom: 12 }}><WhaleMark size={44} color={colors.faded} /></View><Text style={W.itemName}>没能拾获</Text><Text style={W.hint}>{openResult?.error}</Text><T style={[W.btn, { backgroundColor: colors.grid, width: "100%", marginTop: 14 }]} onPress={() => { setShowResultModal(false); setOpenResult(null); }}><Text style={[W.btnTx, { color: colors.sub }]}>知道了</Text></T></View>}
      </T></T></Modal>
      {unlockingChestId && <View style={Ld.lo}><View style={Ld.lc}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ fontWeight: "700", marginTop: 20 }}>正在开启...</Text></View></View>}
      <Modal visible={showNoteResult} transparent animationType="fade">
        <View style={{flex:1}}>
          <Pressable style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.6)"}} onPress={() => setShowNoteResult(false)} />
          <View style={{flex:1,justifyContent:"center",alignItems:"center",padding:24}} pointerEvents="box-none">
            <View style={[D.cd,{pointerEvents:"auto",backgroundColor:colors.paper,paddingVertical:20,paddingHorizontal:18}]}>
        {noteResult && <View style={{width:"100%",alignItems:"center"}}>
          <View style={{width:72,height:72,borderRadius:36,backgroundColor:colors.secondary+"1A",borderWidth:1,borderColor:colors.secondary+"44",alignItems:"center",justifyContent:"center",marginBottom:8}}><WhaleMark size={34} color={colors.secondary} eye="#fff" /></View>
          <View style={{backgroundColor:colors.paper,borderRadius:12,borderWidth:1,borderColor:colors.line,width:"100%",height:190,overflow:"hidden"}}>
            <LinedPaper color={colors.line} gap={28} />
            <ScrollView style={{flex:1}} contentContainerStyle={{paddingHorizontal:18,paddingTop:5,paddingBottom:14}}>
              <Text style={{fontFamily:KAI,fontSize:16,lineHeight:28,color:colors.ink}}>{noteResult.content}</Text>
            </ScrollView>
          </View>
          {!noteResult.isAnonymous && <View style={{flexDirection:"row",alignItems:"center",marginTop:14,gap:8}}>
            <View style={{width:30,height:30,borderRadius:15,backgroundColor:colors.secondary,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:13,fontWeight:"700",color:"#fff"}}>{(noteResult.authorNickname||"?").charAt(0)}</Text></View>
            <View><Text style={{fontFamily:HAND,fontSize:17,color:colors.ink}}>{noteResult.authorNickname}</Text>{noteResult.authorNumericId > 0 ? <Text style={{fontSize:11,color:colors.faded}}>ID {noteResult.authorNumericId}</Text> : null}</View>
          </View>}
          <View style={{marginTop:14,alignItems:"center",gap:6}}>
            <Waveform w={120} h={9} color={colors.secondary} sw={1.3} opacity={0.6} />
            <View style={{flexDirection:"row",gap:20}}>
              <Text style={{fontSize:11,color:colors.faded}}>{new Date(noteResult.createdAt).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} 留下</Text>
              <Text style={{fontSize:11,color:colors.faded}}>{new Date(noteResult.pickedAt).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} 拾起</Text>
            </View>
          </View>
          <T style={{backgroundColor:colors.primary,borderRadius:8,paddingVertical:14,width:"100%",alignItems:"center",marginTop:18}} onPress={() => setShowNoteResult(false)}>
            <Text style={{color:"#FFFFFF",fontWeight:"800",fontSize:15}}>收起纸条</Text>
          </T></View>}
      </View></View></View></Modal>
    </View>
  );
}

const S = StyleSheet.create({
  ct: { flex: 1, backgroundColor: colors.background },
  campusPill: { position: "absolute", top: 52, left: 12, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 999, padding: 3, zIndex: 30, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 5 },
  cpBtn: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999 },
  cpOn: { backgroundColor: colors.primary },
  cpTxt: { fontFamily: BODY, fontSize: 12.5, fontWeight: "700", color: colors.sub },
  cpTxtOn: { color: "#fff" },
  topRight: { position: "absolute", top: 52, right: 12, gap: 8, zIndex: 30 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.95)", justifyContent: "center", alignItems: "center", shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 4 },
  iconGlyph: { fontSize: 20, color: colors.primary, fontWeight: "700" },
  brStack: { position: "absolute", right: 12, bottom: 24, alignItems: "flex-end", gap: 12, zIndex: 30 },
  countRow: { flexDirection: "row", gap: 9 },
  countChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  countIcon: { width: 27, height: 27, borderRadius: 6 },
  cn: { fontWeight: "800", fontSize: 21, color: colors.ink },
  noteBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
  fabGlyph: { fontSize: 22, color: "#fff", fontWeight: "700" },
  coordBL: { position: "absolute", left: 12, bottom: 4, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(27,58,91,0.72)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, zIndex: 30 },
  coordTxt: { color: "#fff", fontSize: 11, fontWeight: "600" },
  coordRetry: { color: "#fff", fontSize: 11, fontWeight: "700", textDecorationLine: "underline" },
});
const D = StyleSheet.create({
  ov: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 32 }, cd: { borderRadius: 16, width: "100%", maxWidth: 344, overflow: "hidden" },
  ej: { fontSize: 56, marginBottom: 12 }, eimg: { width: 66, height: 66, marginBottom: 12, resizeMode: "contain" }, tl: { fontSize: 18, fontWeight: "800", color: "#2D3436", marginBottom: 12, textAlign: "center" },
  tr: { flexDirection: "row", gap: 8, marginBottom: 16 }, tg: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 }, tt: { fontWeight: "700", fontSize: 13 },
  dc: { fontSize: 16, color: "#636E72", textAlign: "center", marginBottom: 8 }, dt: { fontSize: 16, color: "#3498DB", textAlign: "center", fontWeight: "700", marginBottom: 8 },
  pb: { width: "100%", padding: 14, borderRadius: 24, alignItems: "center", backgroundColor: colors.primary }, pt: { fontSize: 17, fontWeight: "700", color: "#FFF" },
  pbox: { width: "100%", padding: 14, borderRadius: 16, alignItems: "center", backgroundColor: colors.rarity.典藏 + "08", borderWidth: 1, borderColor: colors.rarity.典藏 + "20", marginBottom: 8 },
  ub: { width: "100%", padding: 15, borderRadius: 24, alignItems: "center", backgroundColor: "#27AE60" }, ut: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  pc: { fontWeight: "800", fontSize: 18, color: "#9B59B6", marginBottom: 4 }, pr: { width: "100%", height: 6, backgroundColor: "#9B59B620", borderRadius: 3 }, pf: { height: 6, borderRadius: 3 },
  btn: { padding: 14, borderRadius: 24, alignItems: "center" }, ir: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 8 }, il: { fontSize: 16, marginRight: 8, width: 28, textAlign: "center" }, iv: { fontSize: 15, color: "#2D3436", flex: 1 },
});
const W = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: "hidden", width: "100%" },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 17, paddingTop: 16, paddingBottom: 12 },
  hIcon: { width: 50, height: 50 },
  kicker: { fontFamily: SERIF, fontSize: 11.5, color: colors.gold, letterSpacing: 2, marginBottom: 1 },
  title: { fontFamily: SERIF, fontSize: 22, fontWeight: "700", color: colors.ink, lineHeight: 26 },
  stampBox: { position: "absolute", top: 13, right: 13, borderWidth: 1.5, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 2, transform: [{ rotate: "-8deg" }] },
  stampTx: { fontFamily: BODY, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  perf: { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors.faded, marginHorizontal: 13 },
  body: { paddingHorizontal: 17, paddingVertical: 13, gap: 9 },
  fRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fLabel: { fontFamily: BODY, fontSize: 12.5, color: colors.sub },
  fVal: { fontFamily: BODY, fontSize: 13.5, fontWeight: "700", color: colors.ink },
  note: { fontFamily: KAI, fontSize: 13, color: colors.sub, lineHeight: 20 },
  progTrack: { height: 6, backgroundColor: colors.grid, borderRadius: 3, overflow: "hidden" },
  progFill: { height: 6, borderRadius: 3 },
  acts: { flexDirection: "row", gap: 8, paddingHorizontal: 15, paddingBottom: 15, paddingTop: 3 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 9, alignItems: "center" },
  btnTx: { fontFamily: BODY, fontSize: 14, fontWeight: "800" },
  reveal: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: "hidden", width: "100%", alignItems: "center", paddingVertical: 20, paddingHorizontal: 18 },
  revealKicker: { fontFamily: SERIF, fontSize: 12, letterSpacing: 4, marginBottom: 4 },
  glowRing: { padding: 10, borderRadius: 14, borderWidth: 1, marginTop: 6, marginBottom: 4 },
  itemFrame: { padding: 7, backgroundColor: "#fff", borderRadius: 10, borderWidth: 2 },
  itemImg: { width: 142, height: 120, borderRadius: 5 },
  itemName: { fontFamily: SERIF, fontSize: 21, fontWeight: "700", color: colors.ink, marginTop: 12 },
  rarePill: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 999, marginTop: 7 },
  rareTx: { fontFamily: BODY, fontSize: 13, fontWeight: "800" },
  hint: { fontFamily: KAI, fontSize: 12.5, color: colors.faded, marginTop: 10, textAlign: "center" },
});
const R = StyleSheet.create({
  rb: { paddingHorizontal: 20, paddingVertical: 4, borderRadius: 9999, marginBottom: 8 }, cg: { fontWeight: "600", marginBottom: 16 }, im: { width: 160, height: 160, borderRadius: 16, marginBottom: 12 },
  nm: { fontSize: 18, fontWeight: "800", color: "#2D3436", marginBottom: 20 }, db: { width: "100%", padding: 14, borderRadius: 24, alignItems: "center" }, dt: { fontSize: 18, fontWeight: "800", color: "#FFF" },
});
const Ld = StyleSheet.create({
  lo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 100 } as any,
  lc: { backgroundColor: "#FFF", borderRadius: 24, padding: 32, alignItems: "center" },
});
