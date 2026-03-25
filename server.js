const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { google } = require('googleapis');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// CONFIGURACIÓN INICIAL
// ==========================================

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
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================================
// CONFIGURACIÓN GOOGLE DRIVE
// ==========================================

let driveAuth;
try {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    driveAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
  }
} catch (error) {
  console.error('Error configurando Google Drive:', error.message);
}

const drive = driveAuth ? google.drive({ version: 'v3', auth: driveAuth }) : null;

// IDs de carpetas de cursos
const COURSE_FOLDERS = {
  'psicoestadistica': '1v7rfRVoKmLRpYXcSzh-tGjnayhq1mIUB',
  'psicometricas-a': '1G4Fh3YSWgE_C7zggn8_4F45KmXUlu5EQ',
  'psicometricas-b': '1rBTU5cE8_zH_zLkEBy426Ez0k3Fptwdk',
  'criminologia': '1LCdOgNruPevBhGywV-Aoz7I6UaHlotJQ',
  'proyectivas': '1rgOjWLu8z9sW4ewWIP4BQKrzCaRpX1U1',
  'rorschach': '1yLSz-6N64l3DuXIlhkJ0Z0AGQs6TMwuB'
};

const getCourseFolderId = (courseName) => {
  const normalized = courseName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-');
  
  for (const [key, id] of Object.entries(COURSE_FOLDERS)) {
    if (normalized.includes(key)) return id;
  }
  return null;
};

// ==========================================
// BASE DE DATOS EN MEMORIA
// ==========================================

const pendingActivations = new Map();
const activatedStudents = [];

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

const sendActivationEmail = async (toEmail, token, courseName, duration) => {
  try {
    const activationUrl = `${process.env.FRONTEND_URL || 'https://clasesdante.com'}/activar?token=${token}`;
    
    await axios.post('https://formspree.io/f/mreozevn', {
      _subject: `Activá tu acceso a ${courseName}`,
      email: toEmail,
      message: `¡Gracias por tu compra!\n\nCurso: ${courseName}\nDuración: ${duration}\n\nPara activar tu acceso al curso, hacé click en el siguiente link:\n👉 ${activationUrl}\n\nSi no solicitaste este acceso, ignorá este email.\n\nSaludos,\nDante - ClasesDante.com`,
      _replyto: 'info@clasesdante.com'
    });
    
    return true;
  } catch (error) {
    console.error('Error enviando email:', error.message);
    return false;
  }
};

// ==========================================
// CONTEXTO DEL PSICOBOT (ACTUALIZADO)
// ==========================================

const PSICOBOT_CONTEXT = `Sos "Asistente Dante" (también llamado PsicoBot), un asistente de estudios de Psicología.

SOBRE DANTE:
- Es estudiante avanzado de Psicología en la UNC (Universidad Nacional de Córdoba)
- Da clases particulares y cursos online desde hace años
- Especializado en: Psicoestadística, Técnicas Psicométricas, Test de Rorschach, Técnicas Proyectivas, Psicodiagnóstico, Criminología, Epistemología, Psicoanálisis

MATERIAS DISPONIBLES:
1. Psicoestadística Unidades 1-11 (curso más vendido, ideal para arrancar)
2. Técnicas Psicométricas A y B (materia difícil, muchos la recursan - ¡este curso salva!)
3. Test de Rorschach
4. Técnicas Proyectivas
5. Psicología Criminológica (muy popular, contenido actualizado)
6. Epistemología
7. Psicoanálisis
8. Clases en vivo con Dante

PRECIOS CURSOS:
- 3 meses: $69.999 ARS (~$69.99 USD)
- 6 meses: $89.999 ARS (~$89.99 USD)
- 12 meses: $92.999 ARS (~$92.99 USD)
- Transferencia bancaria: 10% de descuento en todos los precios
- Clases particulares: $29.999/hora ARS o $29 USD/hora

METODOLOGÍA DE DANTE:
- Videos explicativos claros y organizados
- Material de estudio descargable
- Ejercicios resueltos paso a paso
- Atención personalizada por WhatsApp
- Garantía de aprobación: si no entendés algo, Dante te lo explica de otra forma

TONO:
- Amigable, paciente, entusiasta pero profesional
- Usá emojis ocasionales (😊, 📚, 🧠, 🎯, 💡)
- Habla como un compañero de estudios que ya pasó por eso
- Nunca sonés desesperado por vender - que la venta fluya natural`;

// ==========================================
// ENDPOINTS ORIGINALES (SIN MODIFICAR)
// ==========================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    const messages = [
      { role: 'system', content: PSICOBOT_CONTEXT },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    res.json({
      reply: completion.choices[0].message.content,
      usage: completion.usage
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error procesando el mensaje' });
  }
});

app.post('/api/quiz', async (req, res) => {
  try {
    const { tema, dificultad = 'media' } = req.body;

    const prompt = `Generá UNA pregunta de opción múltiple sobre ${tema} en psicología.
Dificultad: ${dificultad}

IMPORTANTE: Respondé SOLO con este formato JSON, sin texto adicional:
{
  "pregunta": "Texto de la pregunta aquí",
  "opciones": [
    "A) Primera opción",
    "B) Segunda opción", 
    "C) Tercera opción",
    "D) Cuarta opción"
  ],
  "respuestaCorrecta": "A",
  "explicacion": "Explicación detallada de por qué es correcta la respuesta y por qué las otras no"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sos un generador de preguntas de psicología para estudiantes de la UNC. Respondé SOLO con el JSON válido, sin markdown, sin explicaciones previas.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    let response = completion.choices[0].message.content.trim();
    
    if (response.startsWith('```json')) {
      response = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
    } else if (response.startsWith('```')) {
      response = response.replace(/```\n?/, '').replace(/```$/, '').trim();
    }

    const quiz = JSON.parse(response);
    res.json(quiz);

  } catch (error) {
    console.error('Error en quiz:', error);
    res.status(500).json({ 
      error: 'Error generando el quiz',
      fallback: {
        pregunta: "¿Cuál es el objetivo principal de la Psicología?",
        opciones: ["A) Curar enfermedades mentales", "B) Comprender y explicar el comportamiento humano", "C) Prescribir medicamentos", "D) Realizar cirugías"],
        respuestaCorrecta: "B",
        explicacion: "La psicología se define como la ciencia que estudia el comportamiento y los procesos mentales."
      }
    });
  }
});

// ==========================================
// NUEVOS ENDPOINTS - SISTEMA DE PAGOS
// ==========================================

// Webhook de MercadoPago
app.post('/webhook/mercadopago', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (type === 'payment' && data && data.id) {
      const paymentId = data.id;
      const { status, payer, transaction_amount, additional_info } = req.body;
      const payerEmail = payer?.email || 'no-email@example.com';
      
      if (status === 'approved') {
        const token = uuidv4();
        const courseName = additional_info?.items?.[0]?.title || 'Curso de Psicología';
        const duration = '3 meses';
        
        pendingActivations.set(token, {
          payerEmail,
          courseName,
          duration,
          amount: transaction_amount,
          paymentId,
          createdAt: new Date(),
          activated: false
        });
        
        await sendActivationEmail(payerEmail, token, courseName, duration);
        console.log('Pago aprobado. Token:', token);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(200).send('OK');
  }
});

// Verificar estado de activación
app.get('/api/activacion/:token', (req, res) => {
  const { token } = req.params;
  const activation = pendingActivations.get(token);
  
  if (!activation) {
    return res.status(404).json({ error: 'Token no encontrado o expirado' });
  }
  
  if (activation.activated) {
    return res.status(400).json({ error: 'Este curso ya fue activado' });
  }
  
  res.json({
    courseName: activation.courseName,
    duration: activation.duration,
    payerEmail: activation.payerEmail
  });
});

// Activar curso
app.post('/api/activar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { studentEmail, studentName } = req.body;
    
    const activation = pendingActivations.get(token);
    
    if (!activation) {
      return res.status(404).json({ error: 'Token no válido' });
    }
    
    if (activation.activated) {
      return res.status(400).json({ error: 'Este curso ya fue activado' });
    }
    
    const folderId = getCourseFolderId(activation.courseName);
    
    if (!folderId) {
      return res.status(400).json({ error: 'Curso no encontrado' });
    }
    
    if (drive) {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: 'reader',
          type: 'user',
          emailAddress: studentEmail
        }
      });
    }
    
    activation.activated = true;
    activation.studentEmail = studentEmail;
    activation.studentName = studentName;
    activation.activatedAt = new Date();
    
    activatedStudents.push(activation);
    
    // Email al estudiante
    await axios.post('https://formspree.io/f/mreozevn', {
      _subject: `Acceso activado: ${activation.courseName}`,
      email: studentEmail,
      message: `¡Hola ${studentName}!\n\nTu acceso al curso ya está activado:\n\n📚 ${activation.courseName}\n⏱️ Duración: ${activation.duration}\n\nAccedé a tu material acá:\nhttps://drive.google.com/drive/folders/${folderId}\n\nIMPORTANTE: Tenés permiso de LECTURA (ver videos online).\n\n¿Dudas? WhatsApp: +5493544577649\n\n¡Éxitos! 📚\n\nDante - ClasesDante.com`,
      _replyto: 'info@clasesdante.com'
    });
    
    res.json({ 
      success: true, 
      message: 'Curso activado correctamente',
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`
    });
    
  } catch (error) {
    console.error('Error activando curso:', error);
    res.status(500).json({ error: 'Error al activar el curso' });
  }
});

// Listar activaciones pendientes
app.get('/admin/pendientes', (req, res) => {
  const pending = Array.from(pendingActivations.entries())
    .filter(([_, data]) => !data.activated)
    .map(([token, data]) => ({
      token,
      ...data,
      createdAt: data.createdAt.toISOString()
    }));
  
  res.json(pending);
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
  if (drive) {
    console.log('✅ Google Drive conectado');
  } else {
    console.log('⚠️ Google Drive no configurado');
  }
});
