const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "delbarrioapp-27247",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Esta línea es la que arregla los saltos de línea de la clave
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: "https://delbarrioapp-27247-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

module.exports = async (req, res) => {
  // Manejo de CORS para que acepte peticiones desde tu web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Método no permitido');
  }

  try {
    const ref = db.ref('solicitudes');
    await ref.push({
      ...req.body,
      fecha: new Date().toISOString(),
      estado: 'pendiente'
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error en Firebase:', error);
    return res.status(500).json({ error: error.message });
  }
};
