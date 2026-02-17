// api/submit.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Esta configuración usa variables de entorno para seguridad
const serviceAccount = {
  projectId: "delbarrioapp-27247",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: "https://delbarrioapp-27247-default-rtdb.firebaseio.com"
  });
}

const db = getDatabase();

export default async function handler(req, res) {
  // Habilitar CORS para que funcione desde cualquier celular
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { type, data } = req.body;
    
    // Aquí definimos a dónde va cada cosa
    let refPath = '';
    if (type === 'solicitud') refPath = 'solicitudes';
    else if (type === 'candidato') refPath = 'postulantes';
    else if (type === 'garantia') refPath = 'garantias';
    else if (type === 'valoracion') refPath = 'valoraciones'; // Ojo con la lógica de valoración
    else return res.status(400).json({ error: 'Tipo desconocido' });

    // Enviamos a Firebase desde el servidor (esto SÍ funciona sin VPN)
    await db.ref(refPath).push(data);

    return res.status(200).json({ success: true, message: 'Enviado correctamente' });
  } catch (error) {
    console.error("Error en Vercel:", error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
}
