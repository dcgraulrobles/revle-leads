import {createClient} from '@supabase/supabase-js';
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

// Mapeo oficial de Estrato (texto DENUE) -> employee_stratum (SMALLINT en public.leads)
export const ESTRATO_MAP: Record<string, number> = {
 '0 a 5 personas':1,
 '6 a 10 personas':2,
 '11 a 30 personas':3,
 '31 a 50 personas':4,
 '51 a 100 personas':5,
 '101 a 250 personas':6,
 '251 y más personas':7,
};

export function stratumFromDenue(estrato:string|null|undefined):number|null{
 if(!estrato) return null;
 const norm=estrato.trim().toLowerCase();
 for(const [label,value] of Object.entries(ESTRATO_MAP)) if(label.toLowerCase()===norm) return value;
 return null;
}

// Códigos de entidad INEGI usados para acotar la búsqueda en DENUE
export const STATE_CODES:Record<string,string>={
 'Ciudad de México':'09','Estado de México':'15','Jalisco':'14','Nuevo León':'19','Puebla':'21',
 'Querétaro':'22','Guanajuato':'11','Veracruz':'30','Yucatán':'31','Chihuahua':'08','Baja California':'02','Sonora':'26',
};

export type DenueRecord={
 Id:string; Nombre:string; Razon_social:string; Clase_actividad:string; Estrato:string;
 Calle:string; Num_Exterior:string; Num_Interior:string; Colonia:string; CP:string; Localidad:string;
 Municipio:string; Entidad:string; Telefono:string; Correo_e:string; Sitio_internet:string;
 Latitud:string; Longitud:string; CLEE:string;
};

function denueAddress(r:DenueRecord):string|null{
 const parts=[[r.Calle,r.Num_Exterior].filter(Boolean).join(' '),r.Colonia,r.Localidad,r.CP?`CP ${r.CP}`:''].filter(Boolean);
 return parts.length?parts.join(', '):null;
}

function toNumberOrNull(v:string|null|undefined):number|null{
 if(!v) return null;
 const n=Number(v);
 return Number.isFinite(n)?n:null;
}

// Construye el payload de INSERT usando únicamente columnas existentes en public.leads
export function denueToLeadInsert(r:DenueRecord,ownerId:string|null){
 return {
  stage:'lead',
  source:'DENUE',
  source_id:r.Id||null,
  denue_clee:r.CLEE||null,
  company_name:r.Nombre||r.Razon_social||'Sin nombre',
  industry:r.Clase_actividad||null,
  state:r.Entidad||null,
  municipality:r.Municipio||null,
  address:denueAddress(r),
  phone:r.Telefono||null,
  email:r.Correo_e||null,
  website:r.Sitio_internet||null,
  employee_stratum:stratumFromDenue(r.Estrato),
  latitude:toNumberOrNull(r.Latitud),
  longitude:toNumberOrNull(r.Longitud),
  owner_id:ownerId,
 };
}

async function leadExists(denueClee:string|null,sourceId:string|null):Promise<boolean>{
 if(denueClee){
  const {data,error}=await supabase.from('leads').select('id').eq('denue_clee',denueClee).limit(1);
  if(error) console.warn('No se pudo verificar duplicados por denue_clee:',error);
  else if(data&&data.length>0) return true;
 }
 if(sourceId){
  const {data,error}=await supabase.from('leads').select('id').eq('source_id',sourceId).limit(1);
  if(error) console.warn('No se pudo verificar duplicados por source_id:',error);
  else if(data&&data.length>0) return true;
 }
 return false;
}

export type AddLeadResult={ok:boolean;duplicate?:boolean;error?:string};

// Flujo completo: DENUE resultado -> conversión de estrato -> INSERT public.leads
export async function addDenueLead(r:DenueRecord):Promise<AddLeadResult>{
 const {data:{user}}=await supabase.auth.getUser();
 const payload=denueToLeadInsert(r,user?.id??null);

 if(await leadExists(payload.denue_clee,payload.source_id)) return {ok:false,duplicate:true};

 const {error}=await supabase.from('leads').insert(payload);
 if(error){
  console.error('Error al insertar lead desde DENUE:',error,payload);
  const detail=[error.message,error.details,error.hint].filter(Boolean).join(' — ');
  return {ok:false,error:detail||'Error desconocido al insertar en Supabase'};
 }
 return {ok:true};
}
