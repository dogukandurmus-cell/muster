import React, { useEffect, useMemo, useState } from 'react';
import Dexie, { Table } from 'dexie';

class AppDB extends Dexie {
  customers!: Table<any, number>;
  visits!: Table<any, number>;
  constructor() {
    super('ziyaretAppDB');
    this.version(1).stores({
      customers: '++id, name, phone, mail, city, district, address',
      visits: '++id, date, customerId, notes, outcome',
    });
  }
}
const db = new AppDB();

const todayISO = () => new Date().toISOString().slice(0,10);

const toCSV = (rows:any[], headers?:string[]) => {
  if (!rows?.length) return '';
  const cols = headers || Object.keys(rows[0]);
  const escape = (v:any) => `"${String(v??'').replaceAll('"','""')}"`;
  return [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
};

export default function App(){
  const [tab, setTab] = useState<'yeni'|'ziyaretler'|'musteriler'>('yeni');
  const [customers, setCustomers] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const countC = await db.customers.count();
      if (countC === 0) {
        await db.customers.bulkAdd([
          { name: 'Kutuyum Ambalaj', phone: '+90 555 000 00 00', mail:'info@kutuyum.com', city:'Manisa', district:'Akhisar', address: 'Akhisar/Manisa' },
          { name: 'Esin Ofset', phone: '+90 541 111 11 11', mail:'info@esinofset.com', city:'Balıkesir', district:'Merkez', address: 'Balıkesir' },
        ]);
      }
      setCustomers(await db.customers.toArray());
      setVisits((await db.visits.reverse().sortBy('id')));
    })();
  }, []);

  // PWA install + SW
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  useEffect(() => {
    const handler = (e:any) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setInstallEvent(null); });
    if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('/sw.js'); } catch(_){} }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Yeni Ziyaret state
  const [visitDate, setVisitDate] = useState<string>(todayISO());
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [notes, setNotes] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locStatus, setLocStatus] = useState<string>('');
  const [autoLocAsked, setAutoLocAsked] = useState<boolean>(false);

  const getLocation = () => {
    if (!('geolocation' in navigator)) { setLocStatus('Cihaz konumu desteklemiyor'); return; }
    setLocStatus('Konum alınıyor…');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocStatus('Konum alındı'); },
      (err) => { setLocStatus('Konum alınamadı: ' + err.message); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (tab === 'yeni' && !autoLocAsked) { getLocation(); setAutoLocAsked(true); }
  }, [tab, autoLocAsked]);

  const saveVisit = async () => {
    if (!customerId) return alert('Lütfen müşteri seçiniz');
    const payload:any = { date: visitDate, customerId, notes, outcome };
    if (lat!=null && lng!=null) { payload.lat = lat; payload.lng = lng; }
    await db.visits.add(payload);
    setVisits((await db.visits.reverse().sortBy('id')));
    setVisitDate(todayISO()); setCustomerId(undefined); setNotes(''); setOutcome(''); setLat(null); setLng(null); setLocStatus(''); setTab('ziyaretler');
  };

  const deleteVisit = async (id:number) => { if (!confirm('Bu ziyareti silmek istiyor musunuz?')) return; await db.visits.delete(id); setVisits((await db.visits.reverse().sortBy('id'))); };

  const exportVisitsCSV = () => {
    const rows = visits.map((v:any) => ({
      id: v.id, tarih: v.date,
      musteri: customers.find(c=>c.id===v.customerId)?.name || '',
      notlar: v.notes || '',
      sonuc: v.outcome || '',
      lat: v.lat ?? '', lng: v.lng ?? '',
    }));
    const csv = toCSV(rows, ['id','tarih','musteri','notlar','sonuc','lat','lng']);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ziyaretler_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newC, setNewC] = useState({ name:'', phone:'', mail:'', city:'', district:'', address:'' });
  const addCustomer = async () => {
    if (!newC.name) return alert('Müşteri adı boş olamaz');
    const id = await db.customers.add(newC);
    setCustomers(await db.customers.toArray());
    setShowNewCustomer(false);
    setNewC({ name:'', phone:'', mail:'', city:'', district:'', address:'' });
    setCustomerId(id); // yeni eklenen otomatik seçilsin
  };

  const selectedCustomer = useMemo(() => customers.find(c=>c.id===customerId), [customers, customerId]);
  const destinationParam = lat!=null && lng!=null ? `${lat},${lng}` :
    encodeURIComponent(`${selectedCustomer?.address||''} ${selectedCustomer?.district||''} ${selectedCustomer?.city||''}`.trim());

  return (
    <div className="min-h-screen p-4">
      <header className="container mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-semibold">Müşteri Ziyaret Programı</div>
        </div>
        <div className="flex items-center gap-2">
          {installEvent && (
            <button className="btn btn-primary" onClick={async () => { await installEvent.prompt(); const choice = await installEvent.userChoice; if (choice?.outcome === 'accepted') setInstallEvent(null); }}>Ana Ekrana Ekle</button>
          )}
          {isInstalled && <span className="text-xs text-green-600">Yüklendi</span>}
        </div>
      </header>

      <main className="container space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <button className={`tab ${tab==='yeni'?'tab-active':''}`} onClick={()=>setTab('yeni')}>Yeni Ziyaret</button>
          <button className={`tab ${tab==='ziyaretler'?'tab-active':''}`} onClick={()=>setTab('ziyaretler')}>Ziyaretler</button>
          <button className={`tab ${tab==='musteriler'?'tab-active':''}`} onClick={()=>setTab('musteriler')}>Müşteriler</button>
        </div>

        {tab==='yeni' && (
          <div className="card space-y-4">
            <div className="grid-2">
              <div>
                <label className="label">Tarih</label>
                <input type="date" className="input" value={visitDate} onChange={e=>setVisitDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Müşteri</label>
                <div className="flex gap-2">
                  <select className="input" value={String(customerId||'')} onChange={e=>setCustomerId(Number(e.target.value))}>
                    <option value="">Seçiniz</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button className="btn" onClick={()=>setShowNewCustomer(true)}>Yeni</button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label">Konum</label>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="btn" onClick={getLocation}>Konumu Al</button>
                {lat!=null && lng!=null && (
                  <a className="text-blue-600 underline" href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                    Haritada Aç ({lat.toFixed(5)}, {lng.toFixed(5)})
                  </a>
                )}
                {(destinationParam && destinationParam!=='') && (
                  <a className="text-blue-600 underline" href={`https://www.google.com/maps/dir/?api=1&destination=${destinationParam}&travelmode=driving`} target="_blank" rel="noreferrer">
                    Navigasyona Başla
                  </a>
                )}
              </div>
              {locStatus && <div className="text-xs text-gray-500">{locStatus}</div>}
              {lat!=null && lng!=null && (
                <div className="rounded-xl overflow-hidden border mt-2">
                  <iframe title="Harita Önizleme" className="w-full h-56" src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              )}
            </div>

            <div>
              <label className="label">Notlar</label>
              <input className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Kısa not" />
            </div>
            <div>
              <label className="label">Sonuç</label>
              <textarea className="input min-h-[100px]" value={outcome} onChange={e=>setOutcome(e.target.value)} placeholder="Ziyaret sonucu" />
            </div>

            <button className="btn btn-primary" onClick={saveVisit}>Kaydet</button>
          </div>
        )}

        {tab==='ziyaretler' && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Kayıtlı Ziyaretler</div>
              <button className="btn" onClick={exportVisitsCSV}>CSV</button>
            </div>
            <div className="space-y-3">
              {visits.length===0 && <div className="text-sm text-gray-500">Henüz kayıt yok</div>}
              {visits.map((v:any) => (
                <div key={v.id} className="p-3 rounded-xl border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{customers.find(c=>c.id===v.customerId)?.name}</div>
                      <div className="text-xs text-gray-500">{v.date}</div>
                      <div className="text-xs text-gray-500">Not: {v.notes}</div>
                      <div className="text-xs text-gray-500">Sonuç: {v.outcome}</div>
                      {(v.lat!=null && v.lng!=null) && (
                        <div className="text-xs mt-1 space-x-3">
                          <a className="text-blue-600 underline" href={`https://maps.google.com/?q=${v.lat},${v.lng}`} target="_blank" rel="noreferrer">Haritada Aç</a>
                          <a className="text-blue-600 underline" href={`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&travelmode=driving`} target="_blank" rel="noreferrer">Navigasyon</a>
                        </div>
                      )}
                    </div>
                    <button className="btn btn-ghost" onClick={()=>deleteVisit(v.id)}>Sil</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='musteriler' && (
          <CustomersTab customers={customers} setCustomers={setCustomers} />
        )}
      </main>

      {/* Yeni Müşteri Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <div className="text-lg font-semibold mb-2">Yeni Müşteri</div>
            <div className="space-y-2">
              <div><label className="label">Ad</label><input className="input" value={newC.name} onChange={e=>setNewC({...newC, name:e.target.value})}/></div>
              <div><label className="label">Telefon</label><input className="input" value={newC.phone} onChange={e=>setNewC({...newC, phone:e.target.value})}/></div>
              <div><label className="label">Mail</label><input className="input" value={newC.mail} onChange={e=>setNewC({...newC, mail:e.target.value})}/></div>
              <div className="grid-2">
                <div><label className="label">İl</label><input className="input" value={newC.city} onChange={e=>setNewC({...newC, city:e.target.value})}/></div>
                <div><label className="label">İlçe</label><input className="input" value={newC.district} onChange={e=>setNewC({...newC, district:e.target.value})}/></div>
              </div>
              <div><label className="label">Adres</label><input className="input" value={newC.address} onChange={e=>setNewC({...newC, address:e.target.value})}/></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn" onClick={()=>setShowNewCustomer(false)}>İptal</button>
              <button className="btn btn-primary" onClick={addCustomer}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomersTab({ customers, setCustomers }:{ customers:any[]; setCustomers:(v:any[])=>void; }){
  const [q, setQ] = useState('');
  const filtered = useMemo(() => customers.filter(c => [c.name, c.phone, c.mail, c.city, c.district, c.address].join(' ').toLowerCase().includes(q.toLowerCase())), [customers, q]);
  const [form, setForm] = useState({ name:'', phone:'', mail:'', city:'', district:'', address:'' });

  const remove = async (id:number) => { await db.customers.delete(id); setCustomers(await db.customers.toArray()); };
  const add = async () => { if (!form.name) return alert('Müşteri adı boş olamaz'); await db.customers.add(form); setCustomers(await db.customers.toArray()); setForm({ name:'', phone:'', mail:'', city:'', district:'', address:'' }); };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Müşteriler</div>
        <div className="flex gap-2">
          <input className="input" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {filtered.map(c => (
          <div key={c.id} className="border p-3 rounded-xl">
            <div className="font-medium">{c.name}</div>
            <div className="text-xs text-gray-500">{c.phone}</div>
            <div className="text-xs text-gray-500">{c.mail}</div>
            <div className="text-xs text-gray-500">{c.city} / {c.district}</div>
            <div className="text-xs text-gray-500">{c.address}</div>
            <div className="mt-2 flex gap-2">
              <button className="btn" onClick={async ()=>{ await db.customers.update(c.id, c); setCustomers(await db.customers.toArray()); }}>Güncelle</button>
              <button className="btn btn-ghost" onClick={()=>remove(c.id)}>Sil</button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-md font-semibold">Yeni Müşteri</div>
        <div className="grid-2">
          <div><label className="label">Ad</label><input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
          <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
          <div><label className="label">Mail</label><input className="input" value={form.mail} onChange={e=>setForm({...form, mail:e.target.value})}/></div>
          <div><label className="label">İl</label><input className="input" value={form.city} onChange={e=>setForm({...form, city:e.target.value})}/></div>
          <div><label className="label">İlçe</label><input className="input" value={form.district} onChange={e=>setForm({...form, district:e.target.value})}/></div>
          <div><label className="label">Adres</label><input className="input" value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></div>
        </div>
        <button className="btn btn-primary" onClick={add}>Kaydet</button>
      </div>
    </div>
  );
}
