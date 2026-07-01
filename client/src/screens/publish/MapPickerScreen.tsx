import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { Campus, CAMPUS_BOUNDS } from "../../utils/constants";
import { getCachedBounds, setCachedBounds, CampusBoundData } from "../../utils/mapCache";
import api from "../../services/api";

const CAMPUS_CENTERS: Record<Campus, { lng: number; lat: number; zoom: number }> = {
  gulou: { lng: 118.7750, lat: 32.0575, zoom: 16 },
  xianlin: { lng: 118.9500, lat: 32.1170, zoom: 15 },
  suzhou: { lng: 120.5230, lat: 31.3230, zoom: 15 },
};

let L: any = null;

export function MapPickerScreen({ route, navigation }: any) {
  const { campus: initialCampus, onSelect } = route.params || {};
  const [campus] = useState<Campus>(initialCampus || Campus.GULOU);
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [bounds, setBounds] = useState<Record<string, CampusBoundData>>(CAMPUS_BOUNDS);
  const mapRef = useRef<any>(null); const markerRef = useRef<any>(null); const divRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try { const cached = await getCachedBounds(); if (cached) { setBounds(cached); return; } } catch {}
      try {
        const res = await api.get("/map/campus-bounds");
        if ((res as any).success && (res as any).data) {
          const map: Record<string, CampusBoundData> = { ...CAMPUS_BOUNDS };
          ((res as any).data).forEach((c: any) => { map[c.campus] = { minLat: c.minLat, maxLat: c.maxLat, minLng: c.minLng, maxLng: c.maxLng }; });
          setBounds(map); setCachedBounds(map).catch(() => {});
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return; let cancelled = false;
    const load = (): Promise<any> => {
      if ((window as any).L) return Promise.resolve((window as any).L);
      return new Promise<any>((resolve) => {
        const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(link);
        const s = document.createElement("script"); s.src = "https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4/leaflet.min.js"; s.onload = () => resolve((window as any).L); document.head.appendChild(s);
      });
    };
    load().then((leaf) => {
      if (cancelled || !leaf || !divRef.current) return; L = leaf;
      const ct = CAMPUS_CENTERS[campus];
      const map = L.map(divRef.current, { center: [ct.lat, ct.lng], zoom: ct.zoom, zoomControl: false, attributionControl: false });
      L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", { subdomains: ["1","2","3","4"], maxZoom: 18, minZoom: 3 }).addTo(map);
      map.on("click", (e: any) => { const { lat, lng } = e.latlng; setSelectedCoord({ lat, lng }); if (markerRef.current) map.removeLayer(markerRef.current);
        const ic = L.divIcon({ className: "", html: '<div style="width:28px;height:36px;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.3))"><svg viewBox="0 0 28 36" width="28" height="36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#FF6B6B" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="5" fill="#fff"/></svg></div>', iconSize: [28,36], iconAnchor: [14,36] });
        markerRef.current = L.marker([lat, lng], { icon: ic }).addTo(map); });
      mapRef.current = map; setTimeout(() => { map.invalidateSize(); const b = bounds[campus]; map.fitBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]]); }, 200);
    });
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  const confirm = () => { if (selectedCoord && onSelect) { onSelect(selectedCoord); navigation.goBack(); } };

  return (
    <View style={styles.ct}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backText}>← 返回</Text></TouchableOpacity>
        <Text style={styles.title}>选择位置</Text>
        <TouchableOpacity style={[styles.confirmBtn, !selectedCoord && { opacity: 0.4 }]} onPress={confirm} disabled={!selectedCoord}><Text style={styles.confirmText}>确认</Text></TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}><View ref={divRef} style={{ flex: 1 }} /></View>
      {selectedCoord && <View style={styles.coordBar}><Text style={styles.coordText}>📍 {selectedCoord.lat.toFixed(5)}, {selectedCoord.lng.toFixed(5)}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  ct: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 56, paddingBottom: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 4, zIndex: 20 },
  backText: { ...typography.h2, color: colors.primary }, title: { fontFamily: HAND, fontSize: 20, color: colors.ink },
  confirmBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.lg }, confirmText: { ...typography.bodyBold, color: "#FFF" },
  coordBar: { position: "absolute", bottom: 50, left: 16, right: 16, backgroundColor: "rgba(39,174,96,0.9)", borderRadius: 12, padding: spacing.md }, coordText: { color: "#FFF", fontWeight: "700", textAlign: "center" },
});
