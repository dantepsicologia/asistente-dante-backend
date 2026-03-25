const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

// MercadoPago SDK
const { MercadoPagoConfig, Preference } = require('mercadopago');
const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
});

const app = express();
const PORT = process.env.PORT || 3001;

// Orígenes permitidos
const ALLOWED_ORIGINS = [
  'https://clasesdante.com',
  'https://www.clasesdante.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:4173'
];

// Configuración CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Inicializar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Drive (si está configurado)
let drive;
try {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const { google } = require('googleapis');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    drive = google.drive({ version: 'v3', auth });
    console.log('✅ Google Drive conectado');
  }
} catch (error) {
  console.log('⚠️ Google Drive no configurado:', error.message);
}

// Almacenamiento temporal de activaciones pendientes
const pendingActivations = new Map();

// ============================================
// ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mercadopago: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'configured' : 'missing'
  });
});

// Crear preferencia de MercadoPago
app.post('/api/crear-preferencia', async (req, res) => {
  try {
    const { curso, duracion, precio, email } = req.body;
    
    if (!curso || !duracion || !precio) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const preference = new Preference(mpClient);
    
    const result = await preference.create({
      body: {
        items: [
          {
            title: `${curso} - ${duracion}`,
            unit_price: Number(precio),
            quantity: 1,
            currency_id: 'ARS'
          }
        ],
        back_urls: {
          success: 'https://clasesdante.com/activar',
          failure: 'https://clasesdante.com/activar',
          pending: 'https://clasesdante.com/activar'
        },
        auto_return: 'approved',
        notification_url: 'https://asistente-dante-backend.onrender.com/webhook/mercadopago',
        payer: {
          email: email || 'cliente@clasesdante.com'
        },
        external_reference: `${curso}_${Date.now()}`
      }
    });
    
    res.json({
      init_point: result.init_point,
      preference_id: result.id
    });
    
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    res.status(500).json({ error: 'Error al crear preferencia' });
  }
});

// Webhook de MercadoPago
app.post('/webhook/mercadopago', async (req, res) => {
  console.log('📨 Webhook recibido:', req.body);
  
  try {
    const { type, data } = req.body;
    
    if (type === 'payment' && data && data.id) {
      // Aquí procesarías el pago aprobado
      // Enviar email de activación, dar acceso al Drive, etc.
      console.log('✅ Pago aprobado ID:', data.id);
      
      // TODO: Implementar lógica de activación automática
      // 1. Enviar email con link de activación
      // 2. Guardar en base de datos
      // 3. Preparar acceso a Drive
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error');
  }
});

// Verificar estado de activación
app.get('/api/activacion/:token', (req, res) => {
  const { token } = req.params;
  const activation = pendingActivations.get(token);
  
  if (!activation) {
    return res.status(404).json({ error: 'Token no válido o expirado' });
  }
  
  res.json({
    curso: activation.curso,
    duracion: activation.duracion,
    expira: activation.expiresAt
  });
});

// Activar acceso
app.post('/api/activar/:token', async (req, res) => {
  const { token } = req.params;
  const { email } = req.body;
  
  const activation = pendingActivations.get(token);
  
  if (!activation) {
    return res.status(404).json({ error: 'Token no válido o expirado' });
  }
  
  try {
    // Aquí darías acceso al Drive
    // await drive.permissions.create({...})
    
    // Marcar como activado
    pendingActivations.delete(token);
    
    res.json({ success: true, message: 'Acceso activado correctamente' });
  } catch (error) {
    console.error('Error al activar:', error);
    res.status(500).json({ error: 'Error al activar acceso' });
  }
});

// Chat endpoint (el que ya tenías)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Sos Dante, un profesor de psicología experto en psicometría.' },
        ...(history || []),
        { role: 'user', content: message }
      ]
    });
    
    res.json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ error: 'Error en el chat' });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});