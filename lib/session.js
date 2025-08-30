// Session management utilities
const conversations = new Map();

export function generateSessionId() {
  return Math.random().toString(16).slice(2, 8);
}

export function resolveSessionId(sessionId, { createIfDefault = true } = {}) {
  if (!sessionId) return createIfDefault ? generateSessionId() : 'default';
  if (sessionId === 'default' && createIfDefault) return generateSessionId();
  return sessionId;
}

export function getConversationHistory(sessionId) {
  const sid = sessionId ?? 'default';
  if (!conversations.has(sid)) conversations.set(sid, []);
  return conversations.get(sid);
}

export function addToConversationHistory(sessionId = 'default', role, content) {
  const history = getConversationHistory(sessionId);
  history.push({ role, content });
  // Keep only last 20 messages
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

export function clearConversation(sessionId = 'default') {
  conversations.delete(sessionId);
}
