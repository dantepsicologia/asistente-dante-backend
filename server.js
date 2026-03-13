const express = require('express');
const cors = require('cors');
require('dotenv').config();
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Almacenamiento temporal de conversaciones (en producción usar Redis o base de datos)
const conversations = new Map();

// Sistema de contexto para el Asistente Dante
const SYSTEM_PROMPT = `Eres el "Asistente Dante", un chatbot especializado en psicología y cursos de la plataforma ClasesDante.com.

INFORMACIÓN SOBRE LOS CURSOS:
- Psicoestadística: Estadística aplicada a la psicología, niveles de medición, frecuencias, correlaciones
- Técnicas Psicométricas: Tests, validez, confiabilidad, puntuaciones
- Técnicas Proyectivas: Rorschach, HTP, Figura Humana
- Psicoanálisis: Freud, estructura de la personalidad, mecanismos de defensa
- Psicología Criminológica: Perfil criminal, casos forenses

PRECIOS:
- 3 meses: $67.999 ARS (~$95 USD)
- 6 meses: $89.999 ARS (~$126 USD)
- 12 meses: $109.999 ARS (~$154 USD)

MÉTODOS DE PAGO:
- MercadoPago (tarjeta, débito, efectivo)
- PayPal (internacional)
- USDT (TRC20)
- Transferencia bancaria (10% descuento)

CONTACTO:
- WhatsApp: +54 9 3544 577649
- Email: info@clasesdante.com

REGLAS:
1. Responde siempre en español
2. Sé amable, profesional y cercano
3. Usa emojis ocasionalmente para hacer la conversación más amigable
4. Si no sabes algo, sugiere contactar a Dante directamente
5. Para temas complejos de psicología, da explicaciones claras y sencillas
6. Puedes generar preguntas de práctica con opciones múltiples
7. Mantén el contexto de la conversación para respuestas coherentes`;

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Asistente Dante backend funcionando' });
});

// Endpoint principal del chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    // Obtener o crear historial de conversación
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, [
        { role: 'system', content: SYSTEM_PROMPT }
      ]);
    }

    const conversationHistory = conversations.get(sessionId);

    // Agregar mensaje del usuario
    conversationHistory.push({ role: 'user', content: message });

    // Limitar historial a las últimas 20 interacciones para no exceder tokens
    const limitedHistory = conversationHistory.slice(-21);

    // Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Puedes cambiar a 'gpt-4' si tienes acceso
      messages: limitedHistory,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantMessage = completion.choices[0].message.content;

    // Guardar respuesta en el historial
    conversationHistory.push({ role: 'assistant', content: assistantMessage });

    // Limpiar historial antiguo (mantener últimas 40 mensajes)
    if (conversationHistory.length > 40) {
      conversations.set(sessionId, [
        conversationHistory[0], // Mantener system prompt
        ...conversationHistory.slice(-39)
      ]);
    }

    res.json({
      success: true,
      message: assistantMessage,
      sessionId,
    });

  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el mensaje',
      details: error.message,
    });
  }
});

// Endpoint para generar preguntas de práctica
app.post('/api/quiz', async (req, res) => {
  try {
    const { topic } = req.body;

    const prompt = `Genera una pregunta de opción múltiple sobre ${topic || 'psicología'} para estudiantes universitarios.
    
Formato requerido:
{
  "question": "Texto de la pregunta",
  "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
  "correctAnswer": 0,
  "explanation": "Explicación de por qué es la respuesta correcta"
}

Responde SOLO con el JSON, sin texto adicional.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un profesor de psicología experto en crear preguntas de examen.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content;
    const quizData = JSON.parse(response);

    res.json({
      success: true,
      quiz: quizData,
    });

  } catch (error) {
    console.error('Error en /api/quiz:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar la pregunta',
    });
  }
});

// Limpiar conversaciones antiguas cada 1 hora
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [sessionId, conversation] of conversations.entries()) {
    // Si la conversación tiene más de 1 hora de inactividad, eliminarla
    // (En una implementación real, guardaríamos timestamp de última actividad)
    if (conversations.size > 1000) {
      conversations.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Asistente Dante backend corriendo en puerto ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
});
