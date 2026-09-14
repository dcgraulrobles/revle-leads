import type {Config} from '@netlify/functions';

const DENUE_BASE = 'https://www.inegi.org.mx/app/api/denue/v1/consulta';

export default async (req: Request) => {
 const token = Netlify.env.get('DENUE_TOKEN');
 if (!token) {
  return Response.json({error: 'DENUE_TOKEN no está configurado en las variables de entorno del sitio. Agrega tu token de INEGI DENUE para habilitar la búsqueda.'}, {status: 500});
 }

 const url = new URL(req.url);
 const condicion = url.searchParams.get('condicion')?.trim();
 const entidad = url.searchParams.get('entidad')?.trim() || '0';
 if (!condicion) {
  return Response.json({error: 'El parámetro "condicion" (nombre de empresa o giro) es requerido.'}, {status: 400});
 }

 const denueUrl = `${DENUE_BASE}/BuscarEntidad/${encodeURIComponent(condicion)}/${encodeURIComponent(entidad)}/1/60/${token}`;

 try {
  const res = await fetch(denueUrl);
  const text = await res.text();
  if (!res.ok) {
   return Response.json({error: `DENUE respondió con estado ${res.status}: ${text.slice(0, 300)}`}, {status: 502});
  }
  let data: unknown;
  try {
   data = JSON.parse(text);
  } catch {
   return Response.json({error: `DENUE devolvió una respuesta inesperada: ${text.slice(0, 300)}`}, {status: 502});
  }
  return Response.json({results: Array.isArray(data) ? data : []});
 } catch (e) {
  return Response.json({error: `No se pudo conectar con el servicio DENUE: ${(e as Error).message}`}, {status: 502});
 }
};
// Refresh Netlify deploy preview

export const config: Config = {
 path: '/api/denue-search',
};
