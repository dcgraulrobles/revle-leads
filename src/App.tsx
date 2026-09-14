import {useEffect,useMemo,useState} from 'react';
import {Search, LayoutDashboard, Users, KanbanSquare, CalendarDays, Settings, Plus, MapPin, Phone, Mail, Globe, ChevronRight, X} from 'lucide-react';
import {supabase, addDenueLead, ESTRATO_MAP, STATE_CODES} from './lib';
import type {DenueRecord} from './lib';

type Lead={id:string;company_name:string;industry:string|null;state:string|null;municipality:string|null;address:string|null;phone:string|null;email:string|null;website:string|null;stage:string;updated_at:string};
const stages=[['lead','Lead'],['prospecto','Prospecto'],['negociacion','Negociación'],['ganado','Ganado'],['cerrado','Cerrado']];
const states=['Ciudad de México','Estado de México','Jalisco','Nuevo León','Puebla','Querétaro','Guanajuato','Veracruz','Yucatán','Chihuahua','Baja California','Sonora'];

export default function App(){
 const [view,setView]=useState('dashboard'); const [leads,setLeads]=useState<Lead[]>([]); const [loading,setLoading]=useState(true); const [q,setQ]=useState(''); const [state,setState]=useState(''); const [stage,setStage]=useState(''); const [selected,setSelected]=useState<Lead|null>(null);
 async function load(){setLoading(true); let query=supabase.from('leads').select('id,company_name,industry,state,municipality,phone,email,website,stage,updated_at').order('updated_at',{ascending:false}).limit(200); if(q) query=query.ilike('company_name',`%${q}%`); if(state) query=query.eq('state',state); if(stage) query=query.eq('stage',stage); const {data}=await query; setLeads((data||[]) as Lead[]); setLoading(false);}
 useEffect(()=>{load()},[q,state,stage]);
 const counts=useMemo(()=>Object.fromEntries(stages.map(([s])=>[s,leads.filter(l=>l.stage===s).length])),[leads]);
 const nav=[['dashboard','Dashboard',LayoutDashboard],['search','Buscar empresas',Search],['leads','Leads',Users],['kanban','Pipeline',KanbanSquare],['calendar','Calendario',CalendarDays],['settings','Configuración',Settings]] as const;
 return <div className="app">
  <aside><div className="brand"><div className="mark">R</div><div><b>REVLE</b><span>LEADS</span></div></div>
   <nav>{nav.map(([id,label,Icon])=><button className={view===id?'active':''} onClick={()=>setView(id)} key={id}><Icon size={18}/>{label}</button>)}</nav>
   <div className="sidefoot">Prospección inteligente<br/><small>v0.1 · MVP</small></div>
  </aside>
  <main><header><div><div className="eyebrow">REVLE LEADS</div><h1>{nav.find(n=>n[0]===view)?.[1]}</h1></div><button className="primary"><Plus size={17}/> Nuevo lead</button></header>
   {view==='dashboard'&&<Dashboard leads={leads} counts={counts}/>}
   {view==='search'&&<DenueSearch onAdded={load}/>}
   {view==='leads'&&<><div className="toolbar"><div className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar empresa..."/></div><select value={state} onChange={e=>setState(e.target.value)}><option value="">Todos los estados</option>{states.map(s=><option key={s}>{s}</option>)}</select><select value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todas las etapas</option>{stages.map(([s,l])=><option value={s} key={s}>{l}</option>)}</select></div><LeadTable leads={leads} loading={loading} onSelect={setSelected}/></>}
   {view==='kanban'&&<Kanban leads={leads} onSelect={setSelected}/>}
   {view==='calendar'&&<div className="empty"><CalendarDays size={42}/><h2>Calendario listo para conectar</h2><p>Las reuniones, visitas y seguimientos vivirán aquí.</p></div>}
   {view==='settings'&&<div className="empty"><Settings size={42}/><h2>Configuración</h2><p>Roles, usuarios, etapas e integraciones.</p></div>}
  </main>{selected&&<Detail lead={selected} close={()=>setSelected(null)} refresh={load}/>}
 </div>
}
function Dashboard({leads,counts}:{leads:Lead[];counts:Record<string,number>}){return <div className="dash"><div className="cards">{[['Total',leads.length],['Leads',counts.lead],['Prospectos',counts.prospecto],['Negociación',counts.negociacion],['Ganados',counts.ganado]].map(x=><div className="card" key={x[0] as string}><span>{x[0]}</span><strong>{x[1]}</strong></div>)}</div><div className="panel"><div className="panelhead"><h2>Actividad reciente</h2><span>Últimos leads actualizados</span></div>{leads.slice(0,6).map(l=><div className="row" key={l.id}><div className="avatar">{l.company_name.slice(0,1)}</div><div className="grow"><b>{l.company_name}</b><small>{l.industry||'Sin giro'} · {l.municipality||'—'}, {l.state||'—'}</small></div><Stage stage={l.stage}/><ChevronRight size={16}/></div>)}</div></div>}
function LeadTable({leads,loading,onSelect}:{leads:Lead[];loading:boolean;onSelect:(l:Lead)=>void}){return <div className="panel tablepanel">{loading?<p className="muted">Cargando...</p>:leads.length===0?<p className="muted">No hay resultados.</p>:<table><thead><tr><th>Empresa</th><th>Giro</th><th>Ubicación</th><th>Contacto</th><th>Etapa</th></tr></thead><tbody>{leads.map(l=><tr onClick={()=>onSelect(l)} key={l.id}><td><b>{l.company_name}</b><small>{l.website||''}</small></td><td>{l.industry||'—'}</td><td>{l.municipality||'—'}<small>{l.state||''}</small></td><td>{l.phone||l.email||'—'}</td><td><Stage stage={l.stage}/></td></tr>)}</tbody></table>}</div>}
const estratoOptions=Object.keys(ESTRATO_MAP);

function DenueSearch({onAdded}:{onAdded:()=>void}){
 const [estado,setEstado]=useState(''); const [municipio,setMunicipio]=useState(''); const [nombre,setNombre]=useState(''); const [giro,setGiro]=useState(''); const [tamano,setTamano]=useState('');
 const [results,setResults]=useState<DenueRecord[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null); const [searched,setSearched]=useState(false);
 const [pending,setPending]=useState<string|null>(null); const [status,setStatus]=useState<Record<string,{ok:boolean;message:string}>>({});

 async function search(){
  const term=(nombre||giro).trim();
  if(!term){setError('Escribe un nombre de empresa o un giro para buscar en DENUE.');return;}
  setLoading(true); setError(null); setResults([]); setStatus({}); setSearched(true);
  try{
   const entidad=estado?(STATE_CODES[estado]||'0'):'0';
   const res=await fetch(`/api/denue-search?condicion=${encodeURIComponent(term)}&entidad=${entidad}`);
   const json=await res.json();
   if(!res.ok||json.error){throw new Error(json.error||`Error ${res.status} al buscar en DENUE`);}
   let list:DenueRecord[]=json.results||[];
   if(municipio) list=list.filter(r=>r.Municipio?.toLowerCase().includes(municipio.toLowerCase()));
   if(giro&&nombre) list=list.filter(r=>r.Clase_actividad?.toLowerCase().includes(giro.toLowerCase()));
   if(tamano) list=list.filter(r=>r.Estrato===tamano);
   setResults(list);
  }catch(e){
   console.error('Error al buscar en DENUE:',e);
   setError((e as Error).message);
  }
  setLoading(false);
 }

 async function addLead(r:DenueRecord){
  setPending(r.Id);
  const result=await addDenueLead(r);
  setPending(null);
  if(result.duplicate){setStatus(s=>({...s,[r.Id]:{ok:true,message:'Ya existe como Lead'}})); return;}
  if(!result.ok){setStatus(s=>({...s,[r.Id]:{ok:false,message:result.error||'Error desconocido al agregar'}})); return;}
  setStatus(s=>({...s,[r.Id]:{ok:true,message:'Agregado como Lead'}}));
  onAdded();
 }

 return <div className="denue">
  <div className="toolbar">
   <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre de empresa"/>
   <input value={giro} onChange={e=>setGiro(e.target.value)} placeholder="Giro / actividad económica"/>
   <select value={estado} onChange={e=>setEstado(e.target.value)}><option value="">Todos los estados</option>{states.map(s=><option key={s}>{s}</option>)}</select>
   <input value={municipio} onChange={e=>setMunicipio(e.target.value)} placeholder="Municipio"/>
   <select value={tamano} onChange={e=>setTamano(e.target.value)}><option value="">Cualquier tamaño</option>{estratoOptions.map(o=><option key={o} value={o}>{o}</option>)}</select>
   <button className="primary" onClick={search} disabled={loading}>{loading?'Buscando...':'Buscar en DENUE'}</button>
  </div>
  {error&&<p className="errorbar">{error}</p>}
  <div className="panel tablepanel">
   {results.length===0
    ?<p className="muted">{loading?'Buscando...':searched?'Sin resultados para estos filtros.':'Busca por nombre de empresa o giro para ver resultados de DENUE.'}</p>
    :<table><thead><tr><th>Empresa</th><th>Giro</th><th>Ubicación</th><th>Tamaño</th><th></th></tr></thead><tbody>
     {results.map(r=><tr key={r.Id}>
      <td><b>{r.Nombre||r.Razon_social}</b><small>{r.CLEE||''}</small></td>
      <td>{r.Clase_actividad||'—'}</td>
      <td>{r.Municipio||'—'}<small>{r.Entidad||''}</small></td>
      <td>{r.Estrato||'—'}</td>
      <td>{status[r.Id]?<span className={'rowmsg '+(status[r.Id].ok?'ok':'err')}>{status[r.Id].message}</span>:<button onClick={()=>addLead(r)} disabled={pending===r.Id}>{pending===r.Id?'Agregando...':'Agregar como Lead'}</button>}</td>
     </tr>)}
    </tbody></table>}
  </div>
 </div>
}
function Stage({stage}:{stage:string}){return <span className={'stage '+stage}>{stages.find(s=>s[0]===stage)?.[1]||stage}</span>}
function Kanban({leads,onSelect}:{leads:Lead[];onSelect:(l:Lead)=>void}){return <div className="kanban">{stages.map(([s,label])=><section key={s}><div className="khead"><b>{label}</b><span>{leads.filter(l=>l.stage===s).length}</span></div>{leads.filter(l=>l.stage===s).map(l=><div className="kcard" key={l.id} onClick={()=>onSelect(l)}><b>{l.company_name}</b><small>{l.industry||'Sin giro'}</small><small>{l.municipality||'—'}, {l.state||'—'}</small></div>)}</section>)}</div>}
function Detail({lead,close,refresh}:{lead:Lead;close:()=>void;refresh:()=>void}){const [stage,setStage]=useState(lead.stage); async function save(){await supabase.from('leads').update({stage}).eq('id',lead.id);refresh();close();} return <div className="drawer"><div className="drawerhead"><div><span className="eyebrow">LEAD</span><h2>{lead.company_name}</h2></div><button onClick={close} className="icon"><X/></button></div><Stage stage={stage}/><div className="info"><div><MapPin size={16}/><span>{lead.address||lead.municipality||'Ubicación pendiente'}<br/><small>{lead.state||''}</small></span></div>{lead.phone&&<div><Phone size={16}/><span>{lead.phone}</span></div>}{lead.email&&<div><Mail size={16}/><span>{lead.email}</span></div>}{lead.website&&<div><Globe size={16}/><span>{lead.website}</span></div>}</div><label>Etapa<select value={stage} onChange={e=>setStage(e.target.value)}>{stages.map(([s,l])=><option value={s} key={s}>{l}</option>)}</select></label><button className="primary full" onClick={save}>Guardar cambios</button></div>}
