import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values'; // Required for uuid
import { v4 as uuidv4 } from 'uuid';

const SESSIONS_LIST_KEY = '@sessions_list';
const SESSION_PREFIX = '@session_';
const GLOBAL_SETTINGS_KEY = '@global_settings';

// --- Default Global Settings ---
export const defaultGlobalSettings = {
  theme: 'system', // 'light', 'dark', 'system'
  fontSize: 16,
  contextMessageLimit: Infinity, // 5, 10, 20, 50, Infinity
  // 元数据
  showWordCount: false,
  showTokenCount: true,
  showTokenCost: false,
  showModelName: true,
  showTimestamp: true,
  showFirstTokenTime: true,
};


// --- Default Settings ---
const defaultSettings = {
  systemPrompt: '你是一个得力的AI助手。',
  modelProvider: 'SiliconFlow',
  apiKey: '',
  apiBaseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
  model: 'deepseek-ai/DeepSeek-V3',
  temperature: 0.7,
  description: '',
  backgroundImage: '',
};

// --- Private Helper Functions ---

const getSessionsList = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(SESSIONS_LIST_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Failed to get sessions list.', e);
    return [];
  }
};

const saveSessionsList = async (sessionsList) => {
  try {
    const jsonValue = JSON.stringify(sessionsList);
    await AsyncStorage.setItem(SESSIONS_LIST_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save sessions list.', e);
  }
};

// --- Public API ---

/**
 * Gets the global application settings.
 */
export const getGlobalSettings = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (jsonValue != null) {
      const loadedSettings = JSON.parse(jsonValue);
      // Convert "Infinity" string back to Infinity number type
      if (loadedSettings.contextMessageLimit === 'Infinity') {
        loadedSettings.contextMessageLimit = Infinity;
      }
      return { ...defaultGlobalSettings, ...loadedSettings };
    }
    return defaultGlobalSettings;
  } catch (e) {
    console.error('Failed to get global settings.', e);
    return defaultGlobalSettings;
  }
};

/**
 * Saves the global application settings.
 */
export const saveGlobalSettings = async (settings) => {
  try {
    // Create a serializable copy to avoid mutating the original object
    const serializableSettings = { ...settings };
    if (serializableSettings.contextMessageLimit === Infinity) {
      serializableSettings.contextMessageLimit = 'Infinity'; // Replace Infinity with a string
    }
    const jsonValue = JSON.stringify(serializableSettings);
    await AsyncStorage.setItem(GLOBAL_SETTINGS_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save global settings.', e);
  }
};

/**
 * Gets all session metadata, sorted by pinned status and then by date.
 */
export const getAllSessions = async () => {
  const sessions = await getSessionsList();
  sessions.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  return sessions;
};

/**
 * Gets the full content of a single session.
 */
export const getSession = async (sessionId) => {
  if (!sessionId) return null;
  try {
    const jsonValue = await AsyncStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error(`Failed to load session ${sessionId}.`, e);
    return null;
  }
};

/**
 * Saves the full content of a session and updates its metadata in the list.
 */
export const saveSession = async (session) => {
  if (!session || !session.id) {
    console.error('Cannot save session without an ID.');
    return;
  }
  try {
    session.updatedAt = new Date().toISOString();

    // 1. Save the full session object
    const jsonValue = JSON.stringify(session);
    await AsyncStorage.setItem(`${SESSION_PREFIX}${session.id}`, jsonValue);

    // 2. Update the metadata in the sessions list
    const sessionsList = await getSessionsList();
    const sessionIndex = sessionsList.findIndex(s => s.id === session.id);
    const metadata = {
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      isPinned: session.isPinned || false,
    };

    if (sessionIndex > -1) {
      sessionsList[sessionIndex] = metadata;
    } else {
      // This case should ideally be handled by createNewSession
      sessionsList.unshift(metadata);
    }

    await saveSessionsList(sessionsList);

  } catch (e) {
    console.error(`Failed to save session ${session.id}.`, e);
  }
};

/**
 * Creates a brand new session and adds it to the top of the list.
 */
export const createNewSession = async () => {
  const newSession = {
    id: uuidv4(),
    title: '新对话',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isPinned: false,
    settings: { ...defaultSettings },
    messages: [
      {
        id: uuidv4(),
        parentId: 'root',
        author: 'assistant',
        timestamp: new Date().toISOString(),
        versions: [
          {
            id: uuidv4(),
            text: '你好！有什么可以帮助你的吗？',
          },
        ],
        currentVersionIndex: 0,
        isCollapsed: false,
      },
    ],
  };

  // 1. Save the full session object
  const jsonValue = JSON.stringify(newSession);
  await AsyncStorage.setItem(`${SESSION_PREFIX}${newSession.id}`, jsonValue);

  // 2. Add the new session's metadata to the list
  const sessionsList = await getSessionsList();
  const metadata = {
    id: newSession.id,
    title: newSession.title,
    updatedAt: newSession.updatedAt,
    isPinned: newSession.isPinned,
  };
  sessionsList.unshift(metadata);
  await saveSessionsList(sessionsList);

  return newSession;
};

/**
 * Deletes a session and its metadata.
 */
export const deleteSession = async (sessionId) => {
  if (!sessionId) return;
  try {
    // 1. Remove the session content
    await AsyncStorage.removeItem(`${SESSION_PREFIX}${sessionId}`);

    // 2. Remove the session from the metadata list
    let sessionsList = await getSessionsList();
    sessionsList = sessionsList.filter(s => s.id !== sessionId);
    await saveSessionsList(sessionsList);

  } catch (e) {
    console.error(`Failed to delete session ${sessionId}.`, e);
  }
};

/**
 * Renames a session.
 */
export const renameSession = async (sessionId, newTitle) => {
  if (!sessionId || !newTitle) return;
  const session = await getSession(sessionId);
  if (session) {
    session.title = newTitle;
    await saveSession(session); // saveSession will handle updating the list
  }
};

/**
 * Toggles the pinned status of a session.
 */
export const togglePinSession = async (sessionId) => {
  if (!sessionId) return;
  const session = await getSession(sessionId);
  if (session) {
    session.isPinned = !session.isPinned;
    await saveSession(session); // saveSession will handle updating the list
  }
};
