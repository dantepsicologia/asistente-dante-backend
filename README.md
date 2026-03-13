# 🤖 Asistente Dante - Backend

Backend Node.js para el chatbot de Psicología "Asistente Dante" utilizando OpenAI GPT-4.

## 📋 Requisitos

- Node.js 18+ 
- Cuenta en OpenAI con API Key

## 🚀 Instalación Local

1. **Clonar o copiar el proyecto:**
```bash
cd backend
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno:**
```bash
# El archivo .env ya está configurado con tu API key
# Si necesitas cambiarla, edita el archivo .env
```

4. **Iniciar el servidor:**
```bash
npm start
# o para desarrollo con auto-recarga:
npm run dev
```

5. **Verificar que funciona:**
Abre tu navegador y visita: `http://localhost:3000/health`

Deberías ver:
```json
{
  "status": "OK",
  "message": "Asistente Dante backend funcionando"
}
```

## 📡 Endpoints

### 1. Health Check
```
GET /health
```
Verifica que el servidor está funcionando.

### 2. Chat
```
POST /api/chat
Content-Type: application/json

{
  "message": "¿Qué es la psicoestadística?",
  "sessionId": "usuario-123"  // opcional, para mantener contexto
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "La psicoestadística es...",
  "sessionId": "usuario-123"
}
```

### 3. Generar Pregunta de Práctica
```
POST /api/quiz
Content-Type: application/json

{
  "topic": "técnicas psicométricas"
}
```

**Respuesta:**
```json
{
  "success": true,
  "quiz": {
    "question": "¿Qué mide el coeficiente alfa de Cronbach?",
    "options": ["Estabilidad", "Consistencia interna", "Validez"],
    "correctAnswer": 1,
    "explanation": "El alfa de Cronbach mide la consistencia interna..."
  }
}
```

## 🌐 Despliegue en Render (Gratuito)

1. **Crear cuenta en Render:** https://render.com

2. **Crear nuevo Web Service:**
   - Click en "New" → "Web Service"
   - Conecta tu repositorio de GitHub/GitLab
   - Selecciona el directorio `backend`

3. **Configurar el servicio:**
   - **Name**: `asistente-dante-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Agregar variables de entorno:**
   Ve a "Environment" y agrega:
   ```
   OPENAI_API_KEY=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
   FRONTEND_URL=https://tu-dominio-frontend.com
   ```

5. **Deploy:**
   Click en "Create Web Service"

6. **Obtener URL:**
   Render te dará una URL como `https://asistente-dante-backend.onrender.com`

## 🚂 Despliegue en Railway (Gratuito)

1. **Crear cuenta en Railway:** https://railway.app

2. **Crear nuevo proyecto:**
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Selecciona tu repositorio

3. **Configurar variables:**
   Ve a "Variables" y agrega:
   ```
   OPENAI_API_KEY=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
   FRONTEND_URL=https://tu-dominio-frontend.com
   ```

4. **Deploy automático:**
   Railway detectará el `package.json` y hará deploy automático

## 🔌 Conectar con el Frontend

Edita el archivo `src/components/Chatbot.tsx` y reemplaza la función `generateResponse`:

```typescript
const generateResponse = async (userMessage: string): Promise<string> => {
  try {
    const response = await fetch('https://TU-BACKEND-URL/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: 'usuario-' + Math.random().toString(36).substr(2, 9),
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      return data.message;
    } else {
      return 'Lo siento, hubo un error. Por favor intenta de nuevo.';
    }
  } catch (error) {
    console.error('Error:', error);
    return 'Error de conexión. Verifica tu internet.';
  }
};
```

## 🔒 Seguridad

- La API key de OpenAI NUNCA debe exponerse en el frontend
- El backend maneja todas las llamadas a OpenAI
- CORS está configurado para solo aceptar peticiones de tu dominio
- Las conversaciones se limpian automáticamente cada hora

## 💰 Costos de OpenAI

El backend usa `gpt-4o-mini` que es el modelo más económico:
- ~$0.15 por 1M tokens de entrada
- ~$0.60 por 1M tokens de salida

Con uso moderado (100 conversaciones/día), el costo mensual es aproximadamente **$5-10 USD**.

## 🆘 Soporte

Si tienes problemas:
1. Verifica que tu API key de OpenAI sea válida
2. Revisa los logs en Render/Railway
3. Contacta a Dante: info@clasesdante.com
