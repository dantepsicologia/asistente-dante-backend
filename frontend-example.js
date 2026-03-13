// Ejemplo de cómo conectar el frontend con el backend del Asistente Dante
// Copia este código en tu archivo Chatbot.tsx para usar el backend con OpenAI

// ============================================
// CONFIGURACIÓN
// ============================================
const API_URL = 'https://TU-BACKEND-URL.onrender.com'; // Cambia esto por tu URL de Render/Railway

// ============================================
// FUNCIÓN PARA ENVIAR MENSAJES AL BACKEND
// ============================================
async function sendMessageToBackend(userMessage, sessionId) {
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: sessionId, // Para mantener el contexto de la conversación
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      return data.message;
    } else {
      console.error('Error del backend:', data.error);
      return 'Lo siento, hubo un error. Por favor intenta de nuevo.';
    }
  } catch (error) {
    console.error('Error de conexión:', error);
    return 'Error de conexión. Verifica tu internet o intenta más tarde.';
  }
}

// ============================================
// FUNCIÓN PARA GENERAR PREGUNTAS DE PRÁCTICA
// ============================================
async function generateQuizQuestion(topic) {
  try {
    const response = await fetch(`${API_URL}/api/quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: topic || 'psicología general',
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      return data.quiz;
    } else {
      console.error('Error al generar pregunta:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Error de conexión:', error);
    return null;
  }
}

// ============================================
// EJEMPLO DE USO EN REACT
// ============================================

/*
En tu componente Chatbot.tsx, reemplaza la función generateResponse con:

const generateResponse = async (userMessage: string): Promise<string> => {
  // Generar un sessionId único para cada usuario (o guardarlo en localStorage)
  const sessionId = localStorage.getItem('chatSessionId') || 
    'session-' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('chatSessionId', sessionId);
  
  return await sendMessageToBackend(userMessage, sessionId);
};
*/

// ============================================
// EJEMPLO COMPLETO DE COMPONENTE
// ============================================

/*
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';

const API_URL = 'https://tu-backend.onrender.com';

const ChatbotWithBackend = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Obtener o crear sessionId
  const getSessionId = () => {
    let sessionId = localStorage.getItem('chatSessionId');
    if (!sessionId) {
      sessionId = 'session-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chatSessionId', sessionId);
    }
    return sessionId;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          sessionId: getSessionId(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    // Tu JSX aquí...
    <div>Chatbot con Backend</div>
  );
};

export default ChatbotWithBackend;
*/

// ============================================
// VERIFICAR SI EL BACKEND ESTÁ FUNCIONANDO
// ============================================

async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    console.log('Backend status:', data);
    return data.status === 'OK';
  } catch (error) {
    console.error('Backend no disponible:', error);
    return false;
  }
}

// Exportar funciones para usar en otros archivos
export {
  sendMessageToBackend,
  generateQuizQuestion,
  checkBackendHealth,
  API_URL,
};
