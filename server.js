const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

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
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
- Intensivo: $37.999 ARS (~$53 USD) - 3 meses de acceso
- Extensivo 3 meses: $67.999 ARS (~$95 USD)
- Extensivo 6 meses: $89.999 ARS (~$126 USD) 
- Extensivo 12 meses: $109.999 ARS (~$154 USD)
- Transferencia bancaria: 15% de descuento en todos los precios
- Clases particulares: $29.999/hora ARS o $29 USD/hora

METODOLOGÍA DE DANTE:
- Videos explicativos claros y organizados
- Material de estudio descargable
- Ejercicios resueltos paso a paso
- Atención personalizada por WhatsApp
- Garantía de aprobación: si no entendés algo, Dante te lo explica de otra forma

ESTRATEGIA DE VENTA (IMPORTANTE - ACTUÁ COMO ASESOR, NO COMO VENDEDOR):
- Detectá la necesidad del estudiante: preguntá en qué materia está trabado/a, qué le cuesta más
- Si menciona Técnicas Psicométricas, enfatizá que es la materia más difícil y que "muchos la recursan, pero con el curso se ahorran eso"
- Si no sabe qué curso elegir, recomendá Psicoestadística como punto de partida ideal
- Usá prueba social: "muchos estudiantes de la UNC...", "es el curso más elegido..."
- Creá urgencia sutil: "las vacantes para clases particulares son limitadas", "el precio puede actualizarse"
- Ofrecé el quiz interactivo para que practiquen y vean que necesitan reforzar
- Siempre terminá con una pregunta de cierre: "¿Te gustaría que te pase el link del curso?" o "¿Querés que reservemos una clase particular para ver tus dudas específicas?"

TONO:
- Amigable, paciente, entusiasta pero profesional
- Usá emojis ocasionales (😊, 📚, 🧠, 🎯, 💡)
- Habla como un compañero de estudios que ya pasó por eso
- Nunca sonés desesperado por vender - que la venta fluya natural`;

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

// Quiz endpoint - genera preguntas de opción múltiple
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
    
    // Limpiar posibles markdown
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

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
