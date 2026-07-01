import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Image, Dimensions, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, typography, spacing, borderRadius } from "../../theme";
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

let L: any = null;
const loadLeaflet = () => new Promise<any>((resolve) => {
  if (typeof window === "undefined") return resolve(null);
  if ((window as any).L) return resolve((window as any).L);
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(link);
  const s = document.createElement("script"); s.src = "https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4/leaflet.min.js"; s.onload = () => resolve((window as any).L); s.onerror = () => resolve(null); document.head.appendChild(s);
});

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
  const userMarkerRef = useRef<any>(null); const divRef = useRef<any>(null);
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
    loadLeaflet().then((leaf) => { if (c || !leaf || !divRef.current) return; L = leaf;
      const ct = CAMPUS_CENTERS[campus];
      const map = L.map(divRef.current, { center: [ct.lat, ct.lng], zoom: ct.zoom, zoomControl: false, attributionControl: false });
      L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", { subdomains: ["1","2","3","4"], maxZoom: 18, minZoom: 3 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map); markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map; setMapReady(true); setTimeout(() => { map.invalidateSize(); const b = bounds[campus]; map.fitBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]]); }, 200);
    }); return () => { c = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // GPS定位：直接获取最新高精度位置，WGS84→GCJ02（和之前正常工作的版本一致）
  useEffect(() => {
    if (!navigator?.geolocation) { setGpsLabel("⚠ 浏览器不支持定位"); return; }
    let first = true; let dead = false; let watchId = 0;

    const updatePos = (lat: number, lng: number) => {
      const gcj = wgs84ToGcj02(lat, lng);
      setGpsLabel(`📍 ${gcj.lat.toFixed(6)}, ${gcj.lng.toFixed(6)}`); setUserLocation(gcj);
      if (mapRef.current && L) { if (userMarkerRef.current) mapRef.current.removeLayer(userMarkerRef.current);
        const icon = L.divIcon({ className: "", html: '<div style="width:22px;height:22px;background:#2C82C9;border:4px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(44,130,201,0.75);"></div>', iconSize: [30,30], iconAnchor: [15,15] });
        userMarkerRef.current = L.marker([gcj.lat, gcj.lng], { icon, zIndexOffset: 9999 }).addTo(mapRef.current);
        /* GPS蓝点仅显示位置，不自动移动地图视角 */
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

  const updateMarkers = (ch: any[], ev: any[], nt: any[] = []) => { if (!markersRef.current || !L) return; markersRef.current.clearLayers();
    ch.forEach((c, i) => { const a = c.type === "advanced";
      const svg = a ? `<div style="filter:drop-shadow(0 3px 12px ${colors.accent}73)"><svg viewBox="0 0 40 42" width="40" height="42"><rect x="3" y="10" width="34" height="12" rx="6" fill="${colors.accent}" stroke="#C2452F" stroke-width="2.5"/><rect x="3" y="10" width="34" height="5" rx="6" fill="#FBC0B2"/><rect x="3" y="20" width="34" height="20" rx="6" fill="#E0563F" stroke="#C2452F" stroke-width="2.5"/><circle cx="20" cy="30" r="4" fill="${colors.gold}"/></svg></div>` : `<div style="filter:drop-shadow(0 3px 6px rgba(20,50,60,0.3))"><svg viewBox="0 0 36 38" width="36" height="38"><rect x="2" y="8" width="32" height="12" rx="6" fill="${colors.gold}" stroke="#8A6A1E" stroke-width="2.5"/><rect x="2" y="18" width="32" height="18" rx="6" fill="#D2982E" stroke="#8A6A1E" stroke-width="2.5"/><circle cx="18" cy="27" r="4" fill="#235F96"/></svg></div>`;
      const icon = L.divIcon({ className: "", html: svg, iconSize: a ? [40,42] : [36,38], iconAnchor: a ? [20,42] : [18,38] });
      const m = L.marker([c.coordinates.lat, c.coordinates.lng], { icon }); m.on("click", () => { setDialogData({ type: c.type === "advanced" ? "advancedChest" : "normalChest", data: { ...c, label: (a ? "💎#" : "📦#") + (i+1) } }); setDialogVisible(true); }); markersRef.current.addLayer(m);
    });
    ev.forEach((e) => { const ec = e.typeId?.color || colors.primary;
      const pin = `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))"><svg viewBox="0 0 28 36" width="28" height="36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${ec}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="5" fill="#fff"/></svg></div>`;
      const icon = L.divIcon({ className: "", html: pin, iconSize: [28,36], iconAnchor: [14,36] });
      const m = L.marker([e.meetCoordinates.lat, e.meetCoordinates.lng], { icon }); m.on("click", () => { setDialogData({ type: "event", data: e }); setDialogVisible(true); }); markersRef.current.addLayer(m);
    });
    // 纸条 markers
    nt.forEach((n: any) => {
      const noteHtml = '<div style="filter:drop-shadow(0 3px 8px rgba(255,183,77,0.5))"><svg viewBox="0 0 32 40" width="32" height="40"><rect x="3" y="4" width="26" height="32" rx="3" fill="#FFE082" stroke="#F9A825" stroke-width="2"/><line x1="8" y1="12" x2="24" y2="12" stroke="#F9A825" stroke-width="1.5"/><line x1="8" y1="17" x2="22" y2="17" stroke="#F9A825" stroke-width="1.5"/><line x1="8" y1="22" x2="20" y2="22" stroke="#F9A825" stroke-width="1.5"/><rect x="10" y="36" width="12" height="3" rx="1" fill="#F9A825"/></svg></div>';
      const icon = L.divIcon({ className: "", html: noteHtml, iconSize: [32,40], iconAnchor: [16,40] });
      const m = L.marker([n.coordinates.lat, n.coordinates.lng], { icon });
      m.on("click", () => { setDialogData({ type: "note", data: n }); setDialogVisible(true); });
      markersRef.current.addLayer(m);
    });
  };

  const getDist = (a: number, b: number, c: number, d: number) => { const R = 6371000; const dLat = (c-a)*Math.PI/180; const dLng = (d-b)*Math.PI/180; const x = Math.sin(dLat/2)**2 + Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLng/2)**2; return Math.round(R*2*Math.atan2(Math.sqrt(x), Math.sqrt(1-x))); };
  const handleUnlock = async (id: string) => { const s = socketRef.current || await getSocket(); if (!s?.connected || !userLocation) return; setUnlockingChestId(id); setDialogVisible(false); s.emit("location_update", { lat: userLocation.lat, lng: userLocation.lng, campus }); setTimeout(() => s.emit("chest_open_request", { chestId: id }), 300); };
  const handlePickupNote = async (noteId: string) => { const s = socketRef.current || await getSocket(); if (!s?.connected || !userLocation) return; setDialogVisible(false); s.emit("location_update", { lat: userLocation.lat, lng: userLocation.lng, campus }); setTimeout(() => s.emit("pickup_note", { noteId }), 300); };
  const closeDialog = () => setDialogVisible(false);
  const nc = chests.filter((c: any) => c.type === "normal"); const ac = chests.filter((c: any) => c.type === "advanced");
  const RCOLORS = RARITY_COLORS;

  const T = TouchableOpacity;
  return (
    <View style={S.ct}>
      <View style={S.tb}><View style={S.sw}>
        <T onPress={() => { setCampus(Campus.GULOU); const b=bounds.gulou; mapRef.current?.fitBounds([[b.minLat,b.minLng],[b.maxLat,b.maxLng]]); }} style={[S.sb, campus === Campus.GULOU && S.sa]}><Text style={[S.st, campus === Campus.GULOU && S.sta]}>鼓楼</Text></T>
        <T onPress={() => { setCampus(Campus.XIANLIN); const b=bounds.xianlin; mapRef.current?.fitBounds([[b.minLat,b.minLng],[b.maxLat,b.maxLng]]); }} style={[S.sb, campus === Campus.XIANLIN && S.sa]}><Text style={[S.st, campus === Campus.XIANLIN && S.sta]}>仙林</Text></T>
        <T onPress={() => { setCampus(Campus.SUZHOU); const b=bounds.suzhou; mapRef.current?.fitBounds([[b.minLat,b.minLng],[b.maxLat,b.maxLng]]); }} style={[S.sb, campus === Campus.SUZHOU && S.sa]}><Text style={[S.st, campus === Campus.SUZHOU && S.sta]}>苏州</Text></T>
      </View></View>
      {gpsLabel ? (
        <View style={S.gb}>
          <Text style={S.gt}>{gpsLabel}</Text>
          {gpsLabel.startsWith("⚠") && (
            <T style={S.gr} onPress={() => {
              setGpsLabel("🔄 重新定位中...");
              if (navigator?.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const gcj = wgs84ToGcj02(pos.coords.latitude, pos.coords.longitude);
                    setGpsLabel(`📍 ${gcj.lat.toFixed(6)}, ${gcj.lng.toFixed(6)}`);
                    setUserLocation(gcj);
                    if (mapRef.current && L) {
                      if (userMarkerRef.current) mapRef.current.removeLayer(userMarkerRef.current);
                      const icon = L.divIcon({ className: "", html: '<div style="width:22px;height:22px;background:#2C82C9;border:4px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(44,130,201,0.75);"></div>', iconSize: [30,30], iconAnchor: [15,15] });
                      userMarkerRef.current = L.marker([gcj.lat, gcj.lng], { icon, zIndexOffset: 9999 }).addTo(mapRef.current);
                      mapRef.current.setView([gcj.lat, gcj.lng], Math.max(mapRef.current.getZoom(), 16));
                    }
                    const s = getCurrentSocket(); if (s?.connected) s.emit("location_update", { lat: gcj.lat, lng: gcj.lng, campus });
                  },
                  () => setGpsLabel("⚠ 定位信号弱"),
                  { enableHighAccuracy: true, timeout: 30000 }
                );
              }
            }} activeOpacity={0.7}>
              <Text style={S.grt}>🔄 重试</Text>
            </T>
          )}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <View ref={divRef} style={{ flex: 1 }} />
        <T style={S.rf} onPress={fetchAll}><Text style={{ fontWeight: "700", color: "#FFF", fontSize: 13 }}>🔄 刷新</Text></T>
        <View style={S.cs}>
          <View style={S.ctr}><Text style={S.ci}>📦</Text><Text style={S.cn}>{nc.length}</Text></View>
          <View style={[S.ctr, S.ca]}><Text style={S.ci}>💎</Text><Text style={S.cn}>{ac.length}</Text></View>
        </View>
        <T style={S.noteBtn} onPress={() => { if (userLocation) { (navigation as any).navigate("WriteNote", { userLocation, campus }); } }}><Text style={{ fontSize: 20 }}>📝</Text></T>
        <T style={S.locBtn} onPress={() => { if (mapRef.current && userMarkerRef.current) { const p = userMarkerRef.current.getLatLng(); mapRef.current.setView([p.lat, p.lng], Math.max(mapRef.current.getZoom(), 16)); } }}><Text style={{ fontSize: 20 }}>📍</Text></T>
      </View>
      <Modal visible={dialogVisible} transparent animationType="fade"><T style={D.ov} activeOpacity={1} onPress={closeDialog}><T style={D.cd} activeOpacity={1} onPress={() => {}}>
        {dialogData?.type === "normalChest" && (() => { const c = dialogData.data; const dist = userLocation ? getDist(userLocation.lat, userLocation.lng, c.coordinates.lat, c.coordinates.lng) : null; const inR = dist != null && dist <= 20;
          return <><Text style={D.ej}>📦</Text><Text style={D.tl}>普通宝箱</Text><Text style={{fontSize:16,fontWeight:"800",color:colors.primary,marginBottom:8}}>{c.label}</Text><View style={D.tr}><View style={[D.tg, { backgroundColor: colors.success + "18" }]}><Text style={[D.tt, { color: colors.success }]}>🧑 单人</Text></View><View style={[D.tg, { backgroundColor: inR ? colors.success + "18" : colors.info + "18" }]}><Text style={[D.tt, { color: inR ? colors.success : colors.info }]}>{inR ? "✅ 可解锁" : "📡 20米内"}</Text></View></View>{dist != null && <Text style={D.dt}>📍 距离你 {dist}m</Text>}<Text style={D.dc}>靠近20米即可解锁开启</Text>{cooldowns.normal > 0 ? <View style={{ backgroundColor: colors.warning + "15", borderRadius: 12, padding: 12, marginBottom: 12, width: "100%", alignItems: "center" }}><Text style={{ color: colors.warning, fontWeight: "700", fontSize: 14 }}>⏳ 冷却中 · {Math.floor(cooldowns.normal / 60)}分{cooldowns.normal % 60}秒后解锁</Text></View> : inR ? <T style={D.ub} onPress={() => handleUnlock(c._id)}><Text style={D.ut}>🎁 解锁宝箱</Text></T> : <T style={D.pb} onPress={closeDialog}><Text style={D.pt}>知道了</Text></T>}</>;
        })()}
        {dialogData?.type === "advancedChest" && (() => { const c = dialogData.data; const dist = userLocation ? getDist(userLocation.lat, userLocation.lng, c.coordinates.lat, c.coordinates.lng) : null; const inR = dist != null && dist <= 20; const n = nearbyCounts[c._id] ?? 0; const nd = c.requiredPlayers || 3; const en = n >= nd || nd <= 1;
          return <><Text style={D.ej}>💎</Text><Text style={D.tl}>高级宝箱</Text><Text style={{fontSize:16,fontWeight:"800",color:colors.primary,marginBottom:8}}>{c.label}</Text><View style={D.tr}><View style={[D.tg, { backgroundColor: colors.rarity.典藏 + "18" }]}><Text style={[D.tt, { color: colors.rarity.典藏 }]}>{nd <= 1 ? "🧑 单人" : `👥 需${nd}人`}</Text></View><View style={[D.tg, { backgroundColor: en ? colors.success + "18" : colors.info + "18" }]}><Text style={[D.tt, { color: en ? colors.success : colors.info }]}>{en ? "✅ 可解锁" : "📡 20米内"}</Text></View></View>{dist != null && <Text style={D.dt}>📍 距离你 {dist}m</Text>}<View style={D.pbox}><Text style={D.pc}>👥 当前 {n} 人 / 需 {nd} 人</Text><View style={D.pr}><View style={[D.pf, { width: `${Math.min(100,(n/nd)*100)}%`, backgroundColor: en ? colors.success : colors.rarity.典藏 }]} /></View></View><View style={{ flexDirection: "row", gap: 8, width: "100%" }}><T style={[D.btn, { flex: 1, backgroundColor: colors.surfaceAlt }]} onPress={closeDialog}><Text>关闭</Text></T><T style={[D.btn, { flex: 1, backgroundColor: colors.info }]} onPress={() => { const s = socketRef.current; if (s?.connected && userLocation) s.emit("location_update", { lat: userLocation.lat, lng: userLocation.lng, campus }); fetchAll(); setTimeout(() => fetchAll(), 500); }}><Text style={{ color: "#FFF", fontWeight: "700" }}>🔄 刷新</Text></T><T style={[D.btn, { flex: 1, backgroundColor: en ? colors.success : "#ccc" }]} onPress={() => en && handleUnlock(c._id)}><Text style={{ color: "#FFF", fontWeight: "700" }}>{en ? "🎁 解锁" : "⏳"}</Text></T></View></>;
        })()}
        {dialogData?.type === "event" && (() => { const e = dialogData.data;
          return <><Text style={D.ej}>{e.typeId?.iconUrl || "📌"}</Text>{e.typeId?.name && <Text style={{ fontSize: 12, fontWeight: "700", color: e.typeId?.color || "#9B59B6", marginBottom: 4 }}>{e.typeId.name}</Text>}<Text style={D.tl}>{e.title || "活动"}</Text><View style={D.tr}><View style={[D.tg, { backgroundColor: colors.primary + "18" }]}><Text style={[D.tt, { color: colors.primary }]}>👤 {e.currentParticipants||0}/{e.capacity||"∞"}人</Text></View>{e.status && <View style={[D.tg, { backgroundColor: (e.status === "recruiting" ? colors.success : colors.warning) + "18" }]}><Text style={[D.tt, { color: e.status === "recruiting" ? colors.success : colors.warning }]}>{e.status === "recruiting" ? "🟢 招募中" : "⏳"}</Text></View>}</View><View style={D.ir}><Text style={D.il}>📍</Text><Text style={D.iv}>{e.locationText || "暂无位置"}</Text></View><View style={D.ir}><Text style={D.il}>🕐</Text><Text style={D.iv}>{e.startTime ? new Date(e.startTime).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "待定"}</Text></View><View style={{ flexDirection: "row", gap: 8, width: "100%" }}><T style={[D.btn, { flex: 1, backgroundColor: colors.surfaceAlt }]} onPress={closeDialog}><Text>取消</Text></T><T style={[D.btn, { flex: 1.5, backgroundColor: colors.primary }]} onPress={() => { closeDialog(); (navigation as any).navigate("EventDetail", { eventId: e._id }); }}><Text style={{ color: "#FFF", fontWeight: "700" }}>查看详情</Text></T></View></>;
        })()}
        {dialogData?.type === "note" && (() => { const n = dialogData.data; const dist = userLocation ? getDist(userLocation.lat, userLocation.lng, n.coordinates.lat, n.coordinates.lng) : null; const inR = dist != null && dist <= 20;
          return <View style={{width:"100%",alignItems:"center"}}><Text style={D.ej}>📝</Text><Text style={D.tl}>一张纸条</Text>{dist != null && <Text style={D.dt}>📍 距离你 {dist}m</Text>}<Text style={D.dc}>踏进二十步之内，便能拾起这片心情</Text>{inR ? <T style={{backgroundColor:"#F56C6C",borderRadius:20,paddingVertical:16,paddingHorizontal:32,width:"100%",alignItems:"center",marginTop:4}} onPress={() => handlePickupNote(n._id)}><Text style={{color:"#FFFFFF",fontWeight:"800",fontSize:17}}>📋 捡起这张纸条</Text></T> : <T style={D.pb} onPress={closeDialog}><Text style={D.pt}>知道了</Text></T>}</View>;
        })()}
      </T></T></Modal>
      <Modal visible={showResultModal} transparent><T style={D.ov} activeOpacity={1} onPress={() => { setShowResultModal(false); setOpenResult(null); }}><T style={D.cd} activeOpacity={1} onPress={() => {}}>
        {openResult?.success ? <><Text style={[R.rb, { backgroundColor: (RCOLORS[openResult.rarity]||colors.primary)+"20" }]}><Text style={{ color: RCOLORS[openResult.rarity]||colors.primary, fontWeight: "800" }}>{openResult.rarity}</Text></Text><Text style={R.cg}>🎉 恭喜获得 🎉</Text>{openResult.item?.imageUrl && <Image source={{ uri: fixImageUrl(openResult.item.imageUrl) }} style={R.im} resizeMode="contain" />}<Text style={R.nm}>{openResult.item?.name}</Text><T style={[R.db, { backgroundColor: RCOLORS[openResult.rarity]||colors.primary }]} onPress={() => { setShowResultModal(false); setOpenResult(null); }}><Text style={R.dt}>太棒了！</Text></T></> : <><Text style={{ fontSize: 56 }}>😢</Text><Text style={D.tl}>开箱失败</Text><Text style={D.dc}>{openResult?.error}</Text><T style={D.pb} onPress={() => { setShowResultModal(false); setOpenResult(null); }}><Text style={D.pt}>知道了</Text></T></>}
      </T></T></Modal>
      {unlockingChestId && <View style={Ld.lo}><View style={Ld.lc}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ fontWeight: "700", marginTop: 20 }}>正在开启...</Text></View></View>}
      <Modal visible={showNoteResult} transparent animationType="fade">
        <View style={{flex:1}}>
          <Pressable style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.6)"}} onPress={() => setShowNoteResult(false)} />
          <View style={{flex:1,justifyContent:"center",alignItems:"center",padding:24}} pointerEvents="box-none">
            <View style={[D.cd,{pointerEvents:"auto"}]}>
        {noteResult && <View style={{width:"100%",alignItems:"center"}}><Text style={{fontSize:56,marginBottom:12}}>📜</Text>
          <View style={{backgroundColor:"#FFF9E6",borderRadius:16,borderWidth:1,borderColor:"#E6D5A8",width:"100%"}}>
            <ScrollView style={{height:200}} contentContainerStyle={{padding:18}}>
              <Text style={{fontSize:16,lineHeight:26,color:"#4A3728"}}>{noteResult.content}</Text>
            </ScrollView>
          </View>
          {!noteResult.isAnonymous && <View style={{flexDirection:"row",alignItems:"center",marginTop:14,gap:8}}>
            <View style={{width:32,height:32,borderRadius:16,backgroundColor:"#E8D5B7",alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:16}}>👤</Text></View>
            <View><Text style={{fontWeight:"700",fontSize:14,color:"#4A3728"}}>{noteResult.authorNickname}</Text>{noteResult.authorNumericId > 0 ? <Text style={{fontSize:11,color:"#9B8C7C"}}>ID {noteResult.authorNumericId}</Text> : null}</View>
          </View>}
          <View style={{flexDirection:"row",marginTop:14,gap:24}}>
            <Text style={{fontSize:11,color:"#9B8C7C"}}>🕐 {new Date(noteResult.createdAt).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} 留下</Text>
            <Text style={{fontSize:11,color:"#9B8C7C"}}>📋 {new Date(noteResult.pickedAt).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} 拾取</Text>
          </View>
          <T style={{backgroundColor:"#C8956C",borderRadius:20,paddingVertical:16,width:"100%",alignItems:"center",marginTop:18}} onPress={() => setShowNoteResult(false)}>
            <Text style={{color:"#FFFFFF",fontWeight:"800",fontSize:16}}>📋 收起纸条</Text>
          </T></View>}
      </View></View></View></Modal>
    </View>
  );
}

const S = StyleSheet.create({
  ct: { flex: 1, backgroundColor: colors.background }, tb: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, elevation: 8 }, sw: { flexDirection: "row", backgroundColor: "#f0f0f0", borderRadius: 16, padding: 4 }, sb: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" }, sa: { backgroundColor: colors.primary }, st: { fontWeight: "700", color: "#999" }, sta: { color: "#fff" },
  gb: { backgroundColor: "rgba(44,130,201,0.92)", paddingVertical: 4, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, gt: { color: "#fff", fontWeight: "700", fontSize: 12 }, gr: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }, grt: { color: "#fff", fontWeight: "700", fontSize: 11 },
  rf: { position: "absolute", top: 12, left: 12, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, elevation: 6, zIndex: 30 },
  cs: { position: "absolute", top: 12, right: 12, gap: 8, alignItems: "flex-end" },
  ctr: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }, ca: { borderWidth: 1.5, borderColor: colors.rarity.典藏 + "50" }, ci: { fontSize: 22 }, cn: { fontWeight: "800", fontSize: 18, color: "#333" },
  sqBtn: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }, locBtn: { position: "absolute", bottom: 120, right: 12, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.95)", justifyContent: "center", alignItems: "center", elevation: 4, zIndex: 30 }, noteBtn: { position: "absolute", bottom: 180, right: 12, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,224,130,0.95)", justifyContent: "center", alignItems: "center", elevation: 4, zIndex: 30 },
});
const D = StyleSheet.create({
  ov: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 32 }, cd: { backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, alignItems: "center" },
  ej: { fontSize: 56, marginBottom: 12 }, tl: { fontSize: 18, fontWeight: "800", color: "#2D3436", marginBottom: 12, textAlign: "center" },
  tr: { flexDirection: "row", gap: 8, marginBottom: 16 }, tg: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 }, tt: { fontWeight: "700", fontSize: 13 },
  dc: { fontSize: 16, color: "#636E72", textAlign: "center", marginBottom: 8 }, dt: { fontSize: 16, color: "#3498DB", textAlign: "center", fontWeight: "700", marginBottom: 8 },
  pb: { width: "100%", padding: 14, borderRadius: 24, alignItems: "center", backgroundColor: colors.primary }, pt: { fontSize: 17, fontWeight: "700", color: "#FFF" },
  pbox: { width: "100%", padding: 14, borderRadius: 16, alignItems: "center", backgroundColor: colors.rarity.典藏 + "08", borderWidth: 1, borderColor: colors.rarity.典藏 + "20", marginBottom: 8 },
  ub: { width: "100%", padding: 15, borderRadius: 24, alignItems: "center", backgroundColor: "#27AE60" }, ut: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  pc: { fontWeight: "800", fontSize: 18, color: "#9B59B6", marginBottom: 4 }, pr: { width: "100%", height: 6, backgroundColor: "#9B59B620", borderRadius: 3 }, pf: { height: 6, borderRadius: 3 },
  btn: { padding: 14, borderRadius: 24, alignItems: "center" }, ir: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 8 }, il: { fontSize: 16, marginRight: 8, width: 28, textAlign: "center" }, iv: { fontSize: 15, color: "#2D3436", flex: 1 },
});
const R = StyleSheet.create({
  rb: { paddingHorizontal: 20, paddingVertical: 4, borderRadius: 9999, marginBottom: 8 }, cg: { fontWeight: "600", marginBottom: 16 }, im: { width: 160, height: 160, borderRadius: 16, marginBottom: 12 },
  nm: { fontSize: 18, fontWeight: "800", color: "#2D3436", marginBottom: 20 }, db: { width: "100%", padding: 14, borderRadius: 24, alignItems: "center" }, dt: { fontSize: 18, fontWeight: "800", color: "#FFF" },
});
const Ld = StyleSheet.create({
  lo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 100 } as any,
  lc: { backgroundColor: "#FFF", borderRadius: 24, padding: 32, alignItems: "center" },
});
