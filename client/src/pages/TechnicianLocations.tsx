import { useEffect, useRef } from "react";
import { MapView } from "@/components/Map";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function TechnicianLocations() {
  const { data, isLoading, refetch, isFetching } = trpc.filters.technicians.latestLocations.useQuery();
  const markers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const rows = data ?? [];

  useEffect(() => () => { markers.current.forEach(marker => marker.map = null); markers.current = []; }, []);

  const addMarkers = (map: google.maps.Map) => {
    markers.current.forEach(marker => marker.map = null);
    markers.current = [];
    const available = rows.filter(row => row.location);
    if (!available.length) return;
    const bounds = new google.maps.LatLngBounds();
    available.forEach(row => {
      const position = { lat: Number(row.location!.latitude), lng: Number(row.location!.longitude) };
      if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
      bounds.extend(position);
      const marker = new google.maps.marker.AdvancedMarkerElement({ map, position, title: row.technician.name ?? "فني" });
      markers.current.push(marker);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 56);
  };

  return <main dir="rtl" className="space-y-6 p-4 md:p-7">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-bold text-teal-700">متابعة ميدانية</p><h1 className="text-2xl font-black text-slate-900">خريطة الفنيين</h1><p className="mt-1 text-sm text-slate-500">آخر موقع معروف فقط، ولا تظهر هذه البيانات إلا للمسؤول.</p></div>
      <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className={isFetching ? "ml-2 animate-spin" : "ml-2"} size={16} />تحديث المواقع</Button>
    </header>
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden p-0"><MapView className="h-[520px]" initialCenter={{ lat: 30.0444, lng: 31.2357 }} initialZoom={10} onMapReady={addMarkers} /></Card>
      <Card className="space-y-3 p-4"><h2 className="font-black">حالة الفنيين</h2>{isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل المواقع…</p> : rows.length ? rows.map(row => <div key={row.technician.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"><div><p className="font-bold">{row.technician.name || "فني بدون اسم"}</p>{row.location ? <p className="mt-1 text-xs text-slate-500">آخر تحديث: {new Date(row.location.recordedAt).toLocaleString("ar-EG")}</p> : <p className="mt-1 text-xs text-slate-500">الموقع غير متاح</p>}</div><Badge variant={row.location ? "default" : "secondary"}><MapPin size={14} className="ml-1" />{row.location ? "متاح" : "غير متاح"}</Badge></div>) : <p className="text-sm text-slate-500">لا يوجد فنيون مصرحون حالياً.</p>}</Card>
    </div>
  </main>;
}
