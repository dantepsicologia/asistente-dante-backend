const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Orígenes permitidos (incluye localhost y tu web)
const ALLOWED_ORIGINS = [
  'https://clasesdante.com',
  'https://www.clasesdante.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:4173'
];

// Configuración CORS - PERMITE LOCALHOST
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PSICOBOT_CONTEXT = `Sos "Asistente Dante" (también llamado PsicoBot), un asistente de estudios de Psicología.

Info sobre Dante:
- Es estudiante avanzado de Psicología (UNC)
- Da clases particulares y cursos online
- Especializado en: Psicoestadística, Técnicas Psicométricas, Test de Rorschach, Técnicas Proyectivas, Psicodiagnóstico, Criminología, Epistemología, Psicoanálisis

Materias disponibles:
1. Psicoestadística Unidades 1-11
2. Técnicas Psicométricas A y B
3. Test de Rorschach
4. Técnicas Proyectivas
5. Psicodiagnóstico
6. Psicología Criminológica
7. Epistemología
8. Psicoanálisis

Precios cursos: $37.999 - $109.999 ARS (según modalidad y duración)
Clases particulares: $29.999/hora ARS o $29 USD

Tono: Amigable, paciente, entusiasta. Usá emojis ocasionales (😊, 📚, 🧠, 🎯).`;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
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

// Quiz endpoint
app.post('/api/quiz', async (req, res) => {
  try {
    const { tema, dificultad = 'media' } = req.body;

    const prompt = `Generá una pregunta de opción múltiple sobre ${tema} en psicología.
Dificultad: ${dificultad}
Formato JSON:
{
  "pregunta": "texto de la pregunta",
  "opciones": ["A) opción 1", "B) opción 2", "C) opción 3", "D) opción 4"],
  "respuestaCorrecta": "A",
  "explicacion": "explicación de por qué es correcta"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sos un generador de preguntas de psicología. Respondé solo con el JSON válido.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const quiz = JSON.parse(completion.choices[0].message.content);
    res.json(quiz);

  } catch (error) {
    res.status(500).json({ error: 'Error generando el quiz' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
 
