import { useEffect, useRef, useState } from "react";
import { MapView } from "@/components/Map";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

function ProofList({ visitId }: { visitId: number }) {
  const { data, isLoading } = trpc.filters.workOrders.listProofs.useQuery({ visitId });
  if (isLoading) return <p className="text-xs text-slate-500">جارٍ تحميل الأدلة…</p>;
  if (!data?.length) return <p className="text-xs text-slate-500">لا توجد أدلة محفوظة لهذا الأمر.</p>;
  return <div className="mt-2 grid grid-cols-2 gap-2">{data.map(proof => proof.kind === "audio" ? <div key={proof.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2"><audio controls src={proof.url} className="w-full" /><span className="mt-1 block text-[10px] font-bold text-slate-600">تسجيل صوتي</span></div> : <a key={proof.id} href={proof.url} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={proof.url} alt={proof.kind === "signature" ? "توقيع العميل" : "صورة العمل"} className="h-24 w-full object-cover transition group-hover:scale-105" /><span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">{proof.kind === "signature" ? "توقيع" : "صورة"}</span></a>)}</div>;
}

export default function TechnicianLocations() {
  const { data, isLoading, refetch, isFetching } = trpc.filters.technicians.latestLocations.useQuery();
  const markers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const rows = data ?? [];
  const { data: orders } = trpc.filters.workOrders.list.useQuery();
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);

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
    <Card className="space-y-3 p-4"><div className="flex items-center justify-between"><h2 className="font-black">أدلة أوامر العمل</h2><ImageIcon size={18} className="text-teal-700" /></div>{(orders ?? []).filter(order => order.status === "completed").map(order => <div key={order.id} className="rounded-2xl border border-slate-100 p-3"><button type="button" onClick={() => setSelectedVisitId(selectedVisitId === order.id ? null : order.id)} className="flex w-full items-center justify-between gap-3 text-right"><span><span className="block font-bold">{order.customer?.name || "عميل"}</span><span className="mt-1 block text-xs text-slate-500">{new Date(order.visitDate).toLocaleString("ar-EG")}</span></span><span className="text-xs font-black text-teal-700">{selectedVisitId === order.id ? "إخفاء" : "عرض الأدلة"}</span></button>{selectedVisitId === order.id ? <ProofList visitId={order.id} /> : null}</div>)}{!(orders ?? []).some(order => order.status === "completed") ? <p className="text-sm text-slate-500">لا توجد أوامر مكتملة لعرض أدلتها.</p> : null}</Card>
  </main>;
}
