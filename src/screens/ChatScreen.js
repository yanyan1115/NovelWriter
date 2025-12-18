import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ImageBackground,
  useColorScheme,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightTheme, darkTheme } from '../styles/themes';
import { useTheme } from '../styles/ThemeContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as Clipboard from 'expo-clipboard';
import MarkdownDisplay from 'react-native-markdown-display';
import {
  defaultGlobalSettings,
  getAllSessions,
  getSession,
  createNewSession,
  saveSession,
  deleteSession as storageDeleteSession,
  renameSession as storageRenameSession,
  togglePinSession as storageTogglePinSession,
  getGlobalSettings,
  saveGlobalSettings,
} from '../storage/chatStorage';
import { getCompletion } from '../utils/llmClient';
import SessionPanel from '../components/SessionPanel';
import EditModal from '../components/EditModal';
import SettingsPanel from '../components/SettingsPanel';
import GlobalSettingsPanel from '../components/GlobalSettingsPanel';
import ImportChapterModal from '../components/ImportChapterModal';
import MessageItem from '../components/MessageItem';

const getMarkdownStyles = (theme, fontSize) => StyleSheet.create({
  body: { fontSize: fontSize, color: theme.markdownBody },
  heading1: { fontSize: 32, color: theme.headerText, marginTop: 10, marginBottom: 5 },
  heading2: { fontSize: 24, color: theme.headerText, marginTop: 8, marginBottom: 4 },
  code_block: {
    backgroundColor: theme.markdownCodeBlockBg,
    borderColor: theme.markdownCodeBlockBorder,
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fence: {
    backgroundColor: theme.markdownCodeBlockBg,
    borderColor: theme.markdownCodeBlockBorder,
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

const getStyles = (theme, fontSize, hasBackgroundImage, bubbleWidth) => StyleSheet.create({
  backgroundImageContainer: {
    flex: 1,
  },
  backgroundImageStyle: {
    resizeMode: 'cover',
    opacity: 1,
  },
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, backgroundColor: hasBackgroundImage ? 'transparent' : theme.background },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.overlay,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fffafc' },

  messageList: { flex: 1, paddingHorizontal: 10 },
    messageWrapper: { marginVertical: 5 },
  messageContainer: { padding: 12, borderRadius: 18, maxWidth: bubbleWidth || '90%', overflow: 'hidden' },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.messageBubbleUser,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.messageBubbleAssistant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: { fontSize: fontSize, flexShrink: 1, color: theme.messageText },
  cursor: { width: 8, height: 16, backgroundColor: theme.sendButton, marginLeft: 5 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 0,
    backgroundColor: hasBackgroundImage ? theme.inputContainerBackground : theme.background,
  },
  input: { flex: 1, minHeight: 40, maxHeight: 120, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: theme.inputBackground, borderRadius: 20, marginRight: 10, fontSize: 16, borderWidth: 1, borderColor: theme.inputBorder, color: theme.inputText },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.sendButton, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: theme.sendButtonText, lineHeight: 22 },
  footerContainerUser: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, marginRight: 5 },
  footerContainerAssistant: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, marginLeft: 5 },
  versionSwitcher: { flexDirection: 'row', alignItems: 'center', marginRight: 'auto' },
  switcherText: {
    marginHorizontal: 8,
    fontSize: 14,
    color: theme.switcherText
  },
  disabledText: { color: theme.disabledText },
  actionButton: { marginLeft: 15 },
  actionText: {
    fontSize: 14,
    color: '#f39ab5',
    fontWeight: 'bold'
  },

  toastContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 10,
  },

  metadataContainer: { marginTop: 8, paddingLeft: 5 },
  metadataText: {
    fontSize: 10,
    color: theme.disabledText
  },
});



const ChatScreen = ({ navigation }) => {
  const [sessionsList, setSessionsList] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(defaultGlobalSettings);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isSettingsPanelVisible, setIsSettingsPanelVisible] = useState(false);
  const [isGlobalSettingsPanelVisible, setIsGlobalSettingsPanelVisible] = useState(false);
  const [allMessages, setAllMessages] = useState([]); // Holds all messages of the session, including all branches
  const [visibleMessages, setVisibleMessages] = useState([]); // Holds the messages of the currently active branch
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [replyingMessageIds, setReplyingMessageIds] = useState([]);
  const isReplying = replyingMessageIds.length > 0;
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingMessageInfo, setEditingMessageInfo] = useState(null);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importChapterContent, setImportChapterContent] = useState('');
  const [isDirty, setIsDirty] = useState(false); // Tracks if the session needs saving
  const flatListRef = useRef();
  const abortControllersRef = useRef({});
  const allMessagesRef = useRef(allMessages);
  allMessagesRef.current = allMessages;
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [toastConfig, setToastConfig] = useState({ visible: false, message: '' });

  // Theme and Style Management
  const { updateThemeSetting } = useTheme(); // Keep for updating the global context
  const systemTheme = useColorScheme();
  const { 
    theme: themeSetting, 
    fontSize = 16, 
  } = globalSettings || defaultGlobalSettings;

  const metadataSettings = useMemo(() => {
    const { theme, fontSize, ...rest } = globalSettings || defaultGlobalSettings;
    return rest;
  }, [globalSettings]);

  const currentThemeName = themeSetting === 'system' ? systemTheme : themeSetting;
  const theme = currentThemeName === 'dark' ? darkTheme : lightTheme;

  const hasBackgroundImage = !!currentSession?.settings?.backgroundImage;
  const styles = useMemo(() => getStyles(theme, fontSize, hasBackgroundImage, currentSession?.settings?.bubbleWidth), [theme, fontSize, hasBackgroundImage, currentSession?.settings?.bubbleWidth]);
  const markdownStyles = useMemo(() => getMarkdownStyles(theme, fontSize), [theme, fontSize]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardOffset(e.endCoordinates.height);
        // Add a small delay to allow the layout to update before scrolling
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 250);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardOffset(0);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // Debounced save effect
  const currentSessionRef = useRef(currentSession);
  currentSessionRef.current = currentSession;

  useEffect(() => {
    if (!isDirty) return;

    const save = async () => {
      // Use the ref to get the latest currentSession, avoiding stale closures.
      if (!currentSessionRef.current) return;
      const finalSession = {
        ...currentSessionRef.current,
        messages: allMessages,
      };
      await saveSession(finalSession);
      setIsDirty(false); // Reset dirty state after saving
    };

    const handler = setTimeout(() => {
      save();
    }, 1000); // Debounce for 1 second

    return () => {
      clearTimeout(handler);
    };
  }, [isDirty, allMessages]);



  // --- Branching Logic Helpers ---

  const buildVisibleTree = useCallback((allMsgs) => {
    if (!allMsgs) {
      setVisibleMessages([]);
      return;
    }
    const visible = [];
    const addedIds = new Set();
    const messageMap = new Map(allMsgs.map(m => [m.id, m]));

    // Create a map of children for each parent
    const childrenMap = new Map();
    for (const msg of allMsgs) {
        if (msg && msg.parentId) { // Check if msg and msg.parentId are valid
            if (!childrenMap.has(msg.parentId)) {
                childrenMap.set(msg.parentId, []);
            }
            childrenMap.get(msg.parentId).push(msg);
        } else if (msg && !msg.parentId) { // Handle root messages that might have parentId: null or undefined
            if (!childrenMap.has('root')) {
                childrenMap.set('root', []);
            }
            childrenMap.get('root').push(msg);
        }
    }

    const addNodeAndDescendants = (message) => {
        if (!message || addedIds.has(message.id)) {
            return;
        }

        const messageWithState = messageMap.get(message.id);
        if (messageWithState) {
            visible.push(messageWithState);
            addedIds.add(message.id);
        } else {
            return; // Should not happen if allMsgs is consistent
        }

        const currentVersionId = message.versions[message.currentVersionIndex].id;
        const children = childrenMap.get(currentVersionId) || [];

        // The children are already in the correct order from allMsgs
        for (const child of children) {
            addNodeAndDescendants(child);
        }
    };

    const rootMessages = childrenMap.get('root') || [];
    for (const rootMessage of rootMessages) {
        addNodeAndDescendants(rootMessage);
    }
    setVisibleMessages(visible);
  }, [setVisibleMessages]);

  // Initial loading logic
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [loadedSessionsList, loadedGlobalSettings] = await Promise.all([
        getAllSessions(),
        getGlobalSettings(),
      ]);
      setSessionsList(loadedSessionsList);
      setGlobalSettings(loadedGlobalSettings);

      let activeSession;
      if (loadedSessionsList.length === 0) {
        activeSession = await createNewSession();
        setSessionsList([{
          id: activeSession.id,
          title: activeSession.title,
          updatedAt: activeSession.updatedAt
        }]);
      } else {
        activeSession = await getSession(loadedSessionsList[0].id);
      }

      if (activeSession) {
        setCurrentSession(activeSession);
        const allMsgs = activeSession.messages || [];
        setAllMessages(allMsgs);
        // Initially, the visible branch is the one ending with the last message.
        buildVisibleTree(allMsgs);
      }
      setIsLoading(false);
    };

    loadData();
  }, []);



  // Dynamically set navigation options
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity onPress={() => setIsPanelVisible(true)} disabled={isReplying}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.headerTitle }}>
            Chatbox
          </Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => setIsSettingsPanelVisible(true)} 
          disabled={isReplying}
          style={{ marginRight: 15 }}
        >
          <Text style={{ fontSize: 20, color: theme.settingsButton }}>🌟</Text>
        </TouchableOpacity>
      ),
      headerTintColor: theme.actionText,
      headerStyle: {
        backgroundColor: theme.background,
        shadowOpacity: 0, // for iOS
        elevation: 0, // for Android
      },
    });
  }, [navigation, isReplying, theme]);

  const handleSelectSession = async (sessionId) => {
    if (isReplying) return;
    if (sessionId === currentSession?.id) {
      setIsPanelVisible(false);
      return;
    }
    const selectedSession = await getSession(sessionId);
    if (selectedSession) {
      setCurrentSession(selectedSession);
      const allMsgs = selectedSession.messages || [];
      setAllMessages(allMsgs);
      buildVisibleTree(allMsgs);
    }
    setIsPanelVisible(false);
  };

  const handleCreateNewSession = async () => {
    if (isReplying) return;
    const newSession = await createNewSession();
    const allSessions = await getAllSessions();
    setSessionsList(allSessions);
    setCurrentSession(newSession);
    setAllMessages(newSession.messages || []);
    buildVisibleTree(newSession.messages || []);
    setIsPanelVisible(false);
  };

  const handleDeleteSession = async (sessionId) => {
    await storageDeleteSession(sessionId);
    let updatedList = await getAllSessions();

    if (updatedList.length === 0) {
      // If all sessions are deleted, create a new one
      const newSession = await createNewSession();
      updatedList = await getAllSessions();
      setSessionsList(updatedList);
      handleSelectSession(newSession.id);
    } else if (currentSession?.id === sessionId) {
      // If the current session was deleted, find its index to select the next one
      const deletedIndex = sessionsList.findIndex(s => s.id === sessionId);
      // Select the next session, or the previous one if the last one was deleted
      const nextIndex = deletedIndex >= updatedList.length ? updatedList.length - 1 : deletedIndex;
      setSessionsList(updatedList);
      handleSelectSession(updatedList[nextIndex].id);
    } else {
      // Otherwise, just refresh the list without switching
      setSessionsList(updatedList);
    }
  };

  const handleRenameSession = async (sessionId, newTitle) => {
    await storageRenameSession(sessionId, newTitle);
    const updatedList = await getAllSessions();
    setSessionsList(updatedList);
    if (currentSession?.id === sessionId) {
      setCurrentSession(prev => ({ ...prev, title: newTitle }));
    }
  };

  const handleTogglePinSession = async (sessionId) => {
    await storageTogglePinSession(sessionId);
    const updatedList = await getAllSessions();
    setSessionsList(updatedList);
  };

  const streamAssistantResponse = (contextMessages, assistantMessageId, targetVersionIndex, lastUserMessageId) => {
    setReplyingMessageIds(prev => [...prev, assistantMessageId]);

    let chunkBuffer = '';
    const intervalId = setInterval(() => {
      if (chunkBuffer === '') return;
      const chunkToFlush = chunkBuffer;
      chunkBuffer = '';

      const performImmutableUpdate = (messages) => {
        return messages.map(msg => {
          if (msg.id === assistantMessageId) {
            const newVersions = msg.versions.map(v => ({ ...v }));
            const newVersion = { ...newVersions[targetVersionIndex] };
            newVersion.text += chunkToFlush;
            newVersions[targetVersionIndex] = newVersion;
            return { ...msg, versions: newVersions };
          }
          return msg;
        });
      };

      setVisibleMessages(prevVisible => {
        return prevVisible.map(msg => {
          if (msg.id === assistantMessageId) {
            const newVersions = [...msg.versions];
            const newVersion = { ...newVersions[targetVersionIndex] };
            newVersion.text += chunkToFlush;
            newVersions[targetVersionIndex] = newVersion;
            return { ...msg, versions: newVersions };
          }
          return msg;
        });
      });
      setIsDirty(true);
    }, 100);

    const formattedMessages = contextMessages.map(msg => {
      const version = msg.versions[msg.currentVersionIndex];
      return { author: msg.author, text: version.text };
    });

    const abort = getCompletion({
      messages: formattedMessages,
      settings: currentSession.settings,
      onChunk: (chunk) => {
        chunkBuffer += chunk;
      },
      onFinish: async () => {
        clearInterval(intervalId);
        // Final flush to capture any remaining chunks
        if (chunkBuffer.length > 0) {
          const finalChunk = chunkBuffer;
          setVisibleMessages(prevVisible => {
            return prevVisible.map(msg => {
              if (msg.id === assistantMessageId) {
                const newVersions = [...msg.versions];
                const newVersion = { ...newVersions[targetVersionIndex] };
                newVersion.text += finalChunk;
                newVersions[targetVersionIndex] = newVersion;
                return { ...msg, versions: newVersions };
              }
              return msg;
            });
          });
        }
        chunkBuffer = ''; // Clear buffer

        // After streaming, update allMessages with the final content from visibleMessages
        setVisibleMessages(prevVisible => {
          const finalAssistantMessage = prevVisible.find(m => m.id === assistantMessageId);
          if (finalAssistantMessage) {
            setAllMessages(prevAll => {
              const newAll = [...prevAll];
              const msgIndex = newAll.findIndex(m => m.id === assistantMessageId);
              if (msgIndex > -1) {
                newAll[msgIndex] = finalAssistantMessage;
              }
              // We don't need to call buildVisibleTree here as the visible tree is already correct.
              return newAll;
            });
          }
          return prevVisible;
        });

        setReplyingMessageIds(prev => prev.filter(id => id !== assistantMessageId));
        delete abortControllersRef.current[assistantMessageId];
        setIsDirty(true);
        const updatedList = await getAllSessions();
        setSessionsList(updatedList);
      },
      onMetadata: (metadata) => {
        const performMetadataUpdate = (messages) => {
          let newMessages = [...messages];

          // Find and update the assistant message
          const assistantMsgIndex = newMessages.findIndex(m => m.id === assistantMessageId);
          if (assistantMsgIndex > -1) {
            const newMsg = { ...newMessages[assistantMsgIndex] };
            const newVersions = [...newMsg.versions];
            const targetVersion = { ...newVersions[targetVersionIndex] };

            targetVersion.metadata = {
              ...(targetVersion.metadata || {}),
              wordCount: targetVersion.text.length,
              model: metadata.model,
              firstTokenTime: metadata.firstTokenTime,
              totalTime: metadata.totalTime,
              completionTokens: metadata.usage?.completion_tokens,
              totalTokens: metadata.usage?.total_tokens,
            };
            newVersions[targetVersionIndex] = targetVersion;
            newMsg.versions = newVersions;
            newMessages[assistantMsgIndex] = newMsg;
          }

          // Find and update the corresponding user message
          if (lastUserMessageId && metadata.usage?.prompt_tokens) {
            const userMsgIndex = newMessages.findIndex(m => m.id === lastUserMessageId);
            if (userMsgIndex > -1) {
              const newMsg = { ...newMessages[userMsgIndex] };
              const newVersions = [...newMsg.versions];
              // Assume we update the current version of the user message
              const userVersionIndex = newMsg.currentVersionIndex;
              const targetVersion = { ...newVersions[userVersionIndex] };

              targetVersion.metadata = {
                ...(targetVersion.metadata || {}),
                promptTokens: metadata.usage.prompt_tokens,
              };
              newVersions[userVersionIndex] = targetVersion;
              newMsg.versions = newVersions;
              newMessages[userMsgIndex] = newMsg;
            }
          }
          return newMessages;
        };

        setVisibleMessages(prevVisible => {
          return performMetadataUpdate(prevVisible);
        });
        setAllMessages(prevAll => {
          return performMetadataUpdate(prevAll);
        });
        setIsDirty(true);
      },
    });
    abortControllersRef.current[assistantMessageId] = abort;
  };

  const handleSend = async () => {
    if (inputText.trim().length === 0 || !currentSession || isReplying) return;

    const lastVisibleMessage = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;
    let parentId = 'root';
    if (lastVisibleMessage) {
      if (lastVisibleMessage.author === 'assistant') {
        parentId = lastVisibleMessage.versions[lastVisibleMessage.currentVersionIndex].id;
      } else {
        parentId = lastVisibleMessage.id;
      }
    }

    const userMessage = {
      id: uuidv4(),
      author: 'user',
      timestamp: new Date().toISOString(),
      parentId: parentId,
      versions: [{
        id: uuidv4(),
        text: inputText.trim(),
        metadata: { wordCount: inputText.trim().length }
      }],
      currentVersionIndex: 0,
      isCollapsed: false,
    };

    const assistantPlaceholder = {
      id: uuidv4(),
      author: 'assistant',
      timestamp: new Date().toISOString(),
      versions: [{ id: uuidv4(), text: '' }],
      currentVersionIndex: 0,
      parentId: userMessage.versions[0].id,
    };

    const newAllMessages = [...allMessages, userMessage, assistantPlaceholder];
    const newVisibleMessages = [...visibleMessages, userMessage, assistantPlaceholder];

    setAllMessages(newAllMessages);
    setVisibleMessages(newVisibleMessages);
    setInputText('');
    setIsDirty(true);

    // Scroll to bottom after a short delay to allow UI to update
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const limit = globalSettings.contextMessageLimit;
    const allContextMessages = newVisibleMessages.slice(0, -1);
    const context = (limit === Infinity || !limit || allContextMessages.length <= limit)
      ? allContextMessages
      : allContextMessages.slice(-limit);
    const lastUserMessage = context.length > 0 ? context[context.length - 1] : null;
    streamAssistantResponse(context, assistantPlaceholder.id, 0, lastUserMessage?.id);
  };

  const handleRegenerateAnswer = useCallback((messageId) => {

    const visibleIndex = visibleMessages.findIndex(m => m.id === messageId);
    if (visibleIndex === -1) return;

    const limit = globalSettings.contextMessageLimit;
    const allContextMessages = visibleMessages.slice(0, visibleIndex);
    const contextMessages = (limit === Infinity || !limit || allContextMessages.length <= limit)
      ? allContextMessages
      : allContextMessages.slice(-limit);

    setAllMessages(prevAll => {
      const newAll = prevAll.map(msg => {
        if (msg.id === messageId) {
          const newMsg = { ...msg };
          newMsg.isCollapsed = false;
          const newVersion = { id: uuidv4(), text: '', isCollapsed: false };
          // Ensure versions array is a new copy before pushing
          newMsg.versions = [...newMsg.versions, newVersion];
          const newVersionIndex = newMsg.versions.length - 1;
          newMsg.currentVersionIndex = newVersionIndex;

          const newVisibleBranch = contextMessages.concat(newMsg);
          setVisibleMessages(newVisibleBranch);

          const lastUserMessage = contextMessages.length > 0 ? contextMessages[contextMessages.length - 1] : null;
          streamAssistantResponse(contextMessages, messageId, newVersionIndex, lastUserMessage?.id);

          return newMsg;
        }
        return msg;
      });
      return newAll;
    });
    setIsDirty(true);
  }, [isReplying, visibleMessages, globalSettings.contextMessageLimit, streamAssistantResponse]);

  const handleSetCollapsible = useCallback((messageId, isCollapsible) => {
    setAllMessages(prevAll => {
      const hasChanged = prevAll.some(msg => msg.id === messageId && msg.isCollapsible !== isCollapsible);
      if (!hasChanged) {
        return prevAll;
      }
      return prevAll.map(msg => {
        if (msg.id === messageId) {
          return { ...msg, isCollapsible: isCollapsible };
        }
        return msg;
      });
    });
    // No need to set isDirty here, as this is a UI state, not data to be saved.
  }, []);

  const handleImportChapter = useCallback((content) => {
    setImportChapterContent(content);
    setIsImportModalVisible(true);
  }, []);

  const handleInsertAnswerBelow = useCallback((messageId) => {

    const userMessageIndex = visibleMessages.findIndex(m => m.id === messageId);
    if (userMessageIndex === -1) return;

    const userMessage = visibleMessages[userMessageIndex];

    const limit = globalSettings.contextMessageLimit;
    const allContextMessages = visibleMessages.slice(0, userMessageIndex + 1);
    const contextMessages = (limit === Infinity || !limit || allContextMessages.length <= limit)
      ? allContextMessages
      : allContextMessages.slice(-limit);

    const assistantPlaceholder = {
      id: uuidv4(),
      author: 'assistant',
      timestamp: new Date().toISOString(),
      versions: [{ id: uuidv4(), text: '' }],
      currentVersionIndex: 0,
      parentId: userMessage.versions[userMessage.currentVersionIndex].id,
      isCollapsed: false,
    };

    setAllMessages(prevAll => {
      const parentIndex = prevAll.findIndex(m => m.id === userMessage.id);
      if (parentIndex === -1) {
        return [...prevAll, assistantPlaceholder];
      }
      const newAll = [
        ...prevAll.slice(0, parentIndex + 1),
        assistantPlaceholder,
        ...prevAll.slice(parentIndex + 1)
      ];
      return newAll;
    });

    const newVisibleMessages = [
      ...visibleMessages.slice(0, userMessageIndex + 1),
      assistantPlaceholder,
      ...visibleMessages.slice(userMessageIndex + 1),
    ];
    setVisibleMessages(newVisibleMessages);

    streamAssistantResponse(contextMessages, assistantPlaceholder.id, 0, userMessage.id);
    
    setIsDirty(true);
  }, [isReplying, visibleMessages, globalSettings.contextMessageLimit, streamAssistantResponse]);

  const handleSwitchVersion = useCallback((messageId, direction) => {
    setAllMessages(prevAll => {
      let changed = false;
      const newAll = prevAll.map(msg => {
        if (msg.id === messageId) {
          const newIndex = msg.currentVersionIndex + direction;
          if (newIndex >= 0 && newIndex < msg.versions.length) {
            changed = true;
            return { ...msg, currentVersionIndex: newIndex };
          }
        }
        return msg;
      });

      if (changed) {
        buildVisibleTree(newAll);
        return newAll;
      }
      return prevAll;
    });
    setIsDirty(true);
  }, [buildVisibleTree]);


  const handleStopGeneration = async () => {
    Object.values(abortControllersRef.current).forEach(abort => abort());
    abortControllersRef.current = {};
    setReplyingMessageIds([]);

    // Perform an immediate save, bypassing the debounced save
    setAllMessages(currentAllMessages => {
      if (!currentSession) return currentAllMessages; // Guard against null session
      const finalSession = {
        ...currentSession,
        messages: currentAllMessages,
      };
      saveSession(finalSession);
      return currentAllMessages;
    });
  };

  const showToast = (message) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setToastConfig({ visible: true, message });
    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setToastConfig({ visible: false, message: '' });
    }, 2000);
  };

  const handleCopyMessage = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
    showToast('复制成功');
  }, []);

  const deleteMessage = async (messageId) => {
    const newAllMessages = allMessages.filter(m => m.id !== messageId && m.parentId !== messageId);
    setAllMessages(newAllMessages);
    buildVisibleTree(newAllMessages);
    setIsDirty(true);
    const updatedList = await getAllSessions();
    setSessionsList(updatedList);
  };

  const handleDelete = useCallback((messageId) => {
    Alert.alert('删除消息', '确定要删除这条消息及其后续所有消息吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteMessage(messageId) },
    ]);
  }, [deleteMessage]);

  const handleDeleteVersion = useCallback((messageId, versionIndex) => {
    const message = allMessagesRef.current.find(m => m.id === messageId);
    if (!message) return;

    if (message.versions.length === 1) {
      handleDelete(messageId);
      return;
    }

    Alert.alert('删除版本', '确定要删除这个版本的回答吗？这也会删除该版本下的所有后续对话。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const versionIdToDelete = message.versions[versionIndex].id;
          setAllMessages(prevAll => {
            // Filter out children of the deleted version first
            let intermediateMessages = prevAll.filter(m => m.parentId !== versionIdToDelete);

            // Then, update the target message itself immutably
            const finalMessages = intermediateMessages.map(msg => {
              if (msg.id === messageId) {
                const newVersions = [...msg.versions];
                newVersions.splice(versionIndex, 1);
                
                let newCurrentIndex = msg.currentVersionIndex;
                if (newCurrentIndex >= versionIndex) {
                  newCurrentIndex = Math.max(0, newCurrentIndex - 1);
                }
                return { ...msg, versions: newVersions, currentVersionIndex: newCurrentIndex };
              }
              return msg;
            });

            buildVisibleTree(finalMessages);
            return finalMessages;
          });
          setIsDirty(true);
        },
      },
    ]);
  }, [handleDelete, buildVisibleTree]);

  const handleOpenEditModal = useCallback((messageId, versionIndex = null) => {
    const message = allMessagesRef.current.find(m => m.id === messageId);
    if (!message) return;

    const vIndex = versionIndex ?? message.currentVersionIndex;
    const textToEdit = message.versions[vIndex].text;
    
    setEditingMessageInfo({ id: messageId, versionIndex: vIndex, text: textToEdit, author: message.author });
    setIsEditModalVisible(true);
  }, []);

  const handleFullScreenEdit = () => {
    if (!editingMessageInfo) return;

    // Close the modal before navigating
    setIsEditModalVisible(false);

    navigation.navigate('LongTextEdit', {
      initialValue: editingMessageInfo.text,
      onSave: (newText) => {
        // Update the text in the editing info state
        setEditingMessageInfo(prev => ({ ...prev, text: newText }));
        // Re-open the edit modal to show the updated text
        setIsEditModalVisible(true);
      },
    });
  };

    const handleSaveEdit = async (newText, editMode = 'new_version') => {
    if (newText.trim() === '') {
      newText = ' ';
    }
    if (!editingMessageInfo) return;

    const { id, versionIndex } = editingMessageInfo;

    // Close the modal immediately
    setEditingMessageInfo(null);
    setIsEditModalVisible(false);

    // Create a new messages array with the edits.
    const newAllMessages = allMessages.map(msg => {
      if (msg.id === id) {
        const newMsg = { ...msg };
        const newVersions = msg.versions.map(v => ({ ...v }));
        if (newMsg.author === 'user') {
          if (editMode === 'overwrite') {
            newVersions[versionIndex].text = newText;
            newMsg.versions = newVersions;
          } else {
            const newVersion = { id: uuidv4(), text: newText, metadata: { wordCount: newText.length } };
            newVersions.push(newVersion);
            newMsg.versions = newVersions;
            newMsg.currentVersionIndex = newVersions.length - 1;
          }
        } else {
          newVersions[versionIndex].text = newText;
          newMsg.versions = newVersions;
        }
        return newMsg;
      }
      return msg;
    });

    // Update the state with the new messages array.
    setAllMessages(newAllMessages);
    buildVisibleTree(newAllMessages);

    // Construct the final session object to be saved.
    const finalSession = {
      ...currentSession,
      messages: newAllMessages,
    };

    // Explicitly await the save operation to ensure it completes.
    await saveSession(finalSession);

    // Only after a successful save, mark the state as not dirty.
    setIsDirty(false);
  };

  const handleSaveSettings = async (newTitle, newSettings) => {
    if (!currentSession) return;

    // Create the updated session object
    const updatedSession = { 
      ...currentSession, 
      title: newTitle,
      settings: newSettings 
    };

    // Update the state immediately for a responsive UI
    setCurrentSession(updatedSession);

    // saveSession handles both the full session data and the metadata list
    await saveSession(updatedSession);

    // Refresh the sessions list in the panel to show the new title
    const updatedList = await getAllSessions();
    setSessionsList(updatedList);
  };

  const handleSaveGlobalSettings = async (newSettings) => {
    // First, update the global theme context for other components
    if (newSettings.theme && newSettings.theme !== globalSettings.theme) {
      await updateThemeSetting(newSettings.theme);
    }
    // Then, save the settings and update the local state for ChatScreen
    setGlobalSettings(newSettings);
    await saveGlobalSettings(newSettings);
  };

  const renderMessageItem = useCallback(({ item }) => (
    <MessageItem
      item={item}
      visibleMessages={visibleMessages} // Pass the whole array
      replyingMessageIds={replyingMessageIds}
      styles={styles}
      markdownStyles={markdownStyles}
      metadataSettings={metadataSettings}
      theme={theme}
      handleSwitchVersion={handleSwitchVersion}
      handleToggleCollapse={handleToggleCollapse}
      handleOpenEditModal={handleOpenEditModal}
      handleCopyMessage={handleCopyMessage}
      handleDeleteVersion={handleDeleteVersion}
      handleInsertAnswerBelow={handleInsertAnswerBelow}
      handleImportChapter={handleImportChapter}
      handleRegenerateAnswer={handleRegenerateAnswer}
      onSetCollapsible={handleSetCollapsible}
    />
  ), [visibleMessages, replyingMessageIds, styles, markdownStyles, metadataSettings, theme, handleSwitchVersion, handleToggleCollapse, handleOpenEditModal, handleCopyMessage, handleDeleteVersion, handleInsertAnswerBelow, handleImportChapter, handleRegenerateAnswer, handleSetCollapsible]);

    const handleToggleCollapse = useCallback((messageId) => {
    const updateMessages = (messages) => {
      return (messages || []).map(msg => {
        if (msg.id === messageId) {
          return { ...msg, isCollapsed: !msg.isCollapsed };
        }
        return msg;
      });
    };

    setAllMessages(prevAll => updateMessages(prevAll));
    setVisibleMessages(prevVisible => updateMessages(prevVisible));
    
    setIsDirty(true);
  }, []);



  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {toastConfig.visible && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Text style={{color: 'white', fontSize: 16}}>✓</Text>
            <Text style={styles.toastText}>{toastConfig.message}</Text>
          </View>
        </View>
      )}
      {currentSession && (
        <SettingsPanel
          isVisible={isSettingsPanelVisible}
          onClose={() => setIsSettingsPanelVisible(false)}
          onSave={handleSaveSettings}
          session={currentSession}
          navigation={navigation}
        />
      )}
      {globalSettings && (
        <GlobalSettingsPanel
          isVisible={isGlobalSettingsPanelVisible}
          onClose={() => setIsGlobalSettingsPanelVisible(false)}
          onSave={handleSaveGlobalSettings}
          globalSettings={globalSettings}
        />
      )}
       <EditModal
        isVisible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={handleSaveEdit}
        initialText={editingMessageInfo?.text || ''}
        onFullScreenEdit={handleFullScreenEdit}
        messageAuthor={editingMessageInfo?.author || ''}
      />
      <ImportChapterModal
        isVisible={isImportModalVisible}
        onClose={() => setIsImportModalVisible(false)}
        chapterContent={importChapterContent}
      />
       <SessionPanel
          isVisible={isPanelVisible}
          onClose={() => setIsPanelVisible(false)}
          sessions={sessionsList}
          onSelectSession={handleSelectSession}
          onCreateNew={handleCreateNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onTogglePinSession={handleTogglePinSession}
          onGoToGlobalSettings={() => {
            setIsPanelVisible(false); // Close session panel
            setIsGlobalSettingsPanelVisible(true); // Open global settings
          }}
        />

      <View style={[styles.container, { paddingBottom: keyboardOffset }]}>
        <ImageBackground 
          source={{ uri: currentSession?.settings?.backgroundImage }}
          style={styles.backgroundImageContainer}
          imageStyle={styles.backgroundImageStyle}
        >


          {hasBackgroundImage && <View style={styles.overlay} />}

          <FlatList
            ref={flatListRef}
            data={visibleMessages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={{ paddingBottom: 10 }}
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isReplying ? '💌等待回复中...' : "在这里输入你的问题~(˶╹ꇴ╹˶)~"}
              placeholderTextColor={theme.placeholderText}
              multiline
              editable={!isReplying}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={isReplying ? handleStopGeneration : handleSend}
            >
              <Text style={[styles.sendButtonText, { fontSize: isReplying ? 20 : 26 }]}>{isReplying ? '■' : '➹'}</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>
    </SafeAreaView>
  );
};



export default ChatScreen;

