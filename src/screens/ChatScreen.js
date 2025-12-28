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
import { analyzePunctuation, shouldAutoFixPunctuation, buildPunctuationFixPrompt } from '../utils/punctuationGuard';
import { analyzeRepetition, shouldAutoRetryForRepetition, analyzeEchoSimilarity, analyzeExactSentenceEcho, analyzeSubstringEcho, shouldAbortEarlyForSubstringEcho, buildAntiRepeatInstruction } from '../utils/repetitionGuard';

// 开发态自检：确认本文件的 PunctGuard/EchoGuard 代码确实被打包进来（避免出现“我改了但日志完全没有”的情况）
console.log('[GuardBuild] ChatScreen loaded', JSON.stringify({
  hasAnalyzePunctuation: typeof analyzePunctuation === 'function',
  hasRepetitionGuard: typeof analyzeRepetition === 'function',
}));

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

  // 关键：流式 onChunk 回调容易捕获“旧的 state”。
  // 用 ref 持有最新 visibleMessages，保证 EchoGuard/PunctGuard 读取到的就是你 UI 看到的文本。
  const visibleMessagesRef = useRef(visibleMessages);
  useEffect(() => {
    visibleMessagesRef.current = visibleMessages;
  }, [visibleMessages]);

  const [keyboardOffset, setKeyboardOffset] = useState(0);

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
  useEffect(() => {
    if (!isDirty) return;

    const save = async () => {
      if (!currentSession) return;
      const finalSession = {
        ...currentSession,
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
  }, [isDirty, allMessages, currentSession]);

  // --- Branching Logic Helpers ---

  const buildVisibleTreeWithTombstone = useCallback((allMsgs, pendingUndo) => {
    if (!allMsgs) {
      setVisibleMessages([]);
      return;
    }

    const shouldShowTombstoneAfterMessage = (msg, undo) => {
      if (!undo) return false;
      if (msg?.id !== undo.anchorMessageId) return false;
      if (undo.mode === 'subtree' && undo.anchorVersionId) {
        const curVid = msg?.versions?.[msg.currentVersionIndex]?.id;
        return curVid === undo.anchorVersionId;
      }
      return true;
    };

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
            // 软删除消息不进入可见列表（不渲染，也不作为上下文）
            if (!messageWithState.deletedAt) {
              visible.push(messageWithState);
              addedIds.add(message.id);

              // 在消息本体后插入墓碑（不替换消息，保证版本切换按钮仍在）
              if (shouldShowTombstoneAfterMessage(messageWithState, pendingUndo)) {
                visible.push(createTombstoneItem(messageWithState.id, pendingUndo?.anchorVersionId, pendingUndo));
              }
            }
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
        buildVisibleTreeWithTombstone(allMsgs, activeSession?.pendingUndo);
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
      buildVisibleTreeWithTombstone(allMsgs, selectedSession?.pendingUndo);
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
    buildVisibleTreeWithTombstone(newSession.messages || [], newSession?.pendingUndo);
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

    // === EchoGuard 可观测性：确保“我确实检查过”能出现在终端 ===
    try {
      const assistantCount = (contextMessages || []).filter(m => m && m.author === 'assistant').length;
      console.log('[EchoGuard] init', JSON.stringify({
        assistantMessageId,
        targetVersionIndex,
        contextAssistantCount: assistantCount,
      }));
    } catch (e) {
      // ignore
    }

    let chunkBuffer = '';
    let finishedTextSnapshot = '';

    // === 流式标点塌陷监测（2000字左右开始塌陷的“中后段退化”）===
    // 思路：在生成过程中分段统计（前/中/后），一旦后 1/3 明显塌陷就提前止损 abort，交给现有的“后处理/重试/修复”策略。
    // 这里只做诊断日志 + 可选提前中断（默认开启 abortOnCollapse=true；如需更保守可改 false）。
    const punctGuard = {
      enabled: true,
      startCheckAt: 900, // 经验：某些设置（较高 presence/frequency）会在 1300 左右就开始塌陷，因此提前监测
      minTotalLen: 1200,
      abortOnCollapse: true,
      checkedOnce: false,
      lastLogLen: 0,
    };

    // 流式早期“照抄/复读”检测：用于你说的“主要第一段照抄严重”
    // 关键修复：candidate 一定要来自“已写入到消息版本里的文本”（也就是你肉眼看到的文本），
    // 而不是仅依赖 chunkBuffer（chunkBuffer 会被 interval flush 清空，且可能不等于首段）。
    // 只做轻量统计，不打印正文。
    let earlyEchoChecked = false;
    let earlyEchoDebugPrinted = false;
    const earlyEchoCheckpoints = [200, 400, 700, 1000];
    const earlyEchoMaxLen = 1200; // 更贴近“第一段”

    const intervalId = setInterval(() => {
      if (chunkBuffer === '') return;
      const chunkToFlush = chunkBuffer;
      chunkBuffer = '';

      const performImmutableUpdate = (messages) => {
        return messages.map(msg => {
          if (msg.id === assistantMessageId) {
            const newVersions = [...msg.versions];
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

        // === 流式标点塌陷监测（分段统计）===
        try {
          if (punctGuard.enabled) {
            const msgNow = (visibleMessagesRef.current || []).find(m => m?.id === assistantMessageId);
            const vNow = msgNow?.versions?.[targetVersionIndex];
            const alreadyWrittenNow = vNow?.text || '';
            const mergedNow = alreadyWrittenNow + chunkBuffer;
            const curLenNow = mergedNow.length;

            // 诊断：确认 onChunk 里读取到的是“最新可见消息”（避免闭包旧值导致长度不增长，从而看不到 [PunctGuard] 日志）
            if (msgNow && punctGuard.lastLogLen === 0 && curLenNow >= punctGuard.startCheckAt) {
              try {
                console.log('[PunctGuard] ref_ok', JSON.stringify({ assistantMessageId, curLenNow }));
              } catch (e) {}
            }

            // 每增长一定长度才打印/检查一次，避免刷屏
            const shouldSample = curLenNow >= punctGuard.startCheckAt && (curLenNow - punctGuard.lastLogLen) >= 450;
            if (shouldSample) {
              punctGuard.lastLogLen = curLenNow;

              const total = mergedNow;
              const n = total.length;
              const a = Math.floor(n / 3);
              const b = Math.floor((2 * n) / 3);
              const first = total.slice(0, a);
              const mid = total.slice(a, b);
              const last = total.slice(b);

              const A = analyzePunctuation(first);
              const B = analyzePunctuation(mid);
              const C = analyzePunctuation(last);

              console.log('[PunctGuard] sample', JSON.stringify({
                assistantMessageId,
                len: n,
                first: { punctRatio: Number(A.punctRatio.toFixed(4)), maxRun: A.maxRunWithoutPunct, mixed: A.hasMixedPunct },
                mid: { punctRatio: Number(B.punctRatio.toFixed(4)), maxRun: B.maxRunWithoutPunct, mixed: B.hasMixedPunct },
                last: { punctRatio: Number(C.punctRatio.toFixed(4)), maxRun: C.maxRunWithoutPunct, mixed: C.hasMixedPunct },
              }));

              // “后 1/3”明显塌陷：punctRatio 断崖式下降 或 超长无标点串
              // 规则尽量保守：只在长度足够长时触发。
              const enough = n >= punctGuard.minTotalLen;
              const ratioDrop = (A.punctRatio >= 0.006) && (C.punctRatio <= A.punctRatio * 0.35);
              const longRunCollapse = C.maxRunWithoutPunct >= 140;
              const mixedCollapse = C.hasMixedPunct;

              const shouldAbortForCollapse = enough && (ratioDrop || longRunCollapse || mixedCollapse);
              // 经验：当 presence/frequency 较高时，模型更容易“为了多样性”牺牲断句/标点而塌陷。
              // 因此把塌陷判定做得更保守：必须满足“后段超长无标点串”，或“断崖下降 + 后段 maxRun 也偏大”。
              const conservativeCollapse = (
                longRunCollapse ||
                (ratioDrop && C.maxRunWithoutPunct >= 110) ||
                (mixedCollapse && C.maxRunWithoutPunct >= 110)
              );

              if (shouldAbortForCollapse && conservativeCollapse && punctGuard.abortOnCollapse && !punctGuard.checkedOnce) {
                punctGuard.checkedOnce = true;
                console.log('[PunctGuard] collapse_abort', JSON.stringify({
                  assistantMessageId,
                  len: n,
                  reason: ratioDrop ? 'ratio_drop' : (longRunCollapse ? 'long_run' : 'mixed_punct'),
                  firstRatio: Number(A.punctRatio.toFixed(4)),
                  lastRatio: Number(C.punctRatio.toFixed(4)),
                  lastMaxRun: C.maxRunWithoutPunct,
                }));

                // 中断本次生成：进入“分段续写（自动）”策略
                abortControllersRef.current[assistantMessageId]?.();

                // === 分段续写（自动）：让模型只续写“下一段”，每段控制在 700~900 字，避免后半段崩坏 ===
                // 设计：用一个很短的上下文：
                // - 用户原始问题（从 contextMessages 最后一条 user 取）
                // - 当前已生成内容的“尾部摘要/尾段”作为锚点（取末尾 900 字）
                // - 明确要求：只续写下一段、保持同一人称/时态/文风、必须中文全角标点
                // - 请求 max_tokens 限制在小段范围
                try {
                  setVisibleMessages(prevVisible2 => prevVisible2.map(m2 => {
                    if (m2.id !== assistantMessageId) return m2;
                    const newVersions = [...m2.versions];
                    const vv = { ...newVersions[targetVersionIndex] };
                    vv.metadata = { ...(vv.metadata || {}), punctCollapseDetected: true, punctCollapseAtLen: n, punctCollapseReason: ratioDrop ? 'ratio_drop' : (longRunCollapse ? 'long_run' : 'mixed_punct') };
                    newVersions[targetVersionIndex] = vv;
                    // 新建一个版本用于“分段续写”
                    newVersions.push({ id: uuidv4(), text: '' , metadata: { ...(vv.metadata || {}), segmentedContinuation: true } });
                    return { ...m2, versions: newVersions, currentVersionIndex: newVersions.length - 1 };
                  }));

                  const lastUser = ([...(contextMessages || [])].reverse().find(m => m?.author === 'user'));
                  const lastUserText = lastUser?.versions?.[lastUser.currentVersionIndex]?.text || '';
                  const tail = (mergedNow || '').slice(Math.max(0, (mergedNow || '').length - 900));

                  const continuationInstruction = [
                    '你正在写一篇长文本。之前的内容后半段出现了标点/符号退化。现在请“仅续写下一段”，不要重写前文。',
                    '硬性要求：',
                    '1) 必须使用中文全角标点（，。！？；：……——“”‘’），禁止混用英文半角标点。',
                    '2) 叙述段与对白段都必须有正常断句与标点。',
                    '3) 只输出接下来的 1 段（约 700~900 字），不要输出大纲、不要总结、不要解释。',
                    '4) 保持与前文一致的人称、时态、文风与信息设定。',
                    '',
                    '【用户原始需求】',
                    lastUserText,
                    '',
                    '【你已写到这里（用于承接的尾部锚点）】',
                    tail,
                    '',
                    '【现在开始续写下一段】'
                  ].join('\n');

                  const retryContext = [
                    { id: uuidv4(), author: 'user', timestamp: new Date().toISOString(), versions: [{ id: uuidv4(), text: continuationInstruction }], currentVersionIndex: 0 },
                  ];

                  // 用当前 session settings，但收紧 max_tokens，避免再次长到失控
                  const segmentSettings = { ...(currentSession?.settings || {}), max_tokens: Math.min(Number(currentSession?.settings?.max_tokens || 6000), 1200) };

                  // 注意：streamAssistantResponse 会读取 currentSession.settings；这里我们临时覆盖 settings 只能通过 getCompletion 直接调用。
                  // 为最小改动：复用 streamAssistantResponse，但在 getCompletion 内部使用 currentSession.settings。
                  // 因此这里直接走 getCompletion 一次“续写小段”，并把结果写入新版本。
                  const newVersionIndex = ((visibleMessagesRef.current || []).find(m3 => m3.id === assistantMessageId)?.versions?.length || (targetVersionIndex + 2)) - 1;

                  const abort2 = getCompletion({
                    messages: retryContext.map(x => ({ author: x.author, text: x.versions[0].text })),
                    settings: segmentSettings,
                    onChunk: (c2) => {
                      setVisibleMessages(prevVisible3 => prevVisible3.map(m3 => {
                        if (m3.id !== assistantMessageId) return m3;
                        const newVersions3 = [...m3.versions];
                        const idx3 = m3.currentVersionIndex; // 当前已切到新版本
                        const v3 = { ...newVersions3[idx3] };
                        v3.text = (v3.text || '') + c2;
                        newVersions3[idx3] = v3;
                        return { ...m3, versions: newVersions3 };
                      }));
                      setIsDirty(true);
                    },
                    onFinish: () => {
                      // 留给后处理标点修复机制兜底
                    },
                    onError: () => {},
                  });
                  abortControllersRef.current[assistantMessageId] = abort2;
                } catch (e2) {
                  // ignore
                }

                return;
              }
            }
          }
        } catch (e) {
          // ignore
        }

        // === 早期照抄/复读检测（主要第一段照抄） ===
        // 关键：candidate 从“已写入的消息版本文本”取，保证与 UI 看到的一致。
        try {
          if (!earlyEchoChecked) {
            // 从当前可见消息里取 assistant 文本前缀（已 flush 的部分 + 当前 chunkBuffer）
            const msg = (visibleMessagesRef.current || []).find(m => m.id === assistantMessageId);
            const v = msg?.versions?.[targetVersionIndex];
            const alreadyWritten = v?.text || '';
            const merged = (alreadyWritten + chunkBuffer);

            const curLen = merged.length;
            const hitCheckpoint = earlyEchoCheckpoints.some(n => curLen >= n);
            if (hitCheckpoint) {
              earlyEchoChecked = true;

              // checkpoint 日志：不论是否命中阈值，都能看到我们确实跑到这里
              try {
                console.log('[EchoGuard] checkpoint', JSON.stringify({
                  assistantMessageId,
                  len: curLen,
                  candidatePreviewLen: Math.min(earlyEchoMaxLen, merged.length),
                  hasLastAssistant: !!((contextMessages || []).some(m => m && m.author === 'assistant')),
                }));
              } catch (e) {}

              // candidate：取开头 earlyEchoMaxLen
              const candidate = merged.slice(0, earlyEchoMaxLen);

              // history：优先上一条 assistant 的“第一段/前缀”，再补最近几条 assistant
              const assistantHistory = (contextMessages || []).filter(m => m && m.author === 'assistant');
              const lastAssistant = assistantHistory.length > 0 ? assistantHistory[assistantHistory.length - 1] : null;
              const lastText = lastAssistant?.versions?.[lastAssistant.currentVersionIndex]?.text || '';
              const lastPrefix = lastText.slice(0, earlyEchoMaxLen);

              const recentTexts = assistantHistory
                .slice(-6)
                .map(m => m?.versions?.[m.currentVersionIndex]?.text || '')
                .filter(Boolean)
                .map(t => t.slice(0, earlyEchoMaxLen));

              const historyAssistantTexts = [lastPrefix, ...recentTexts].filter(Boolean);

              // 自证日志：只打印一次，用于确认 candidate/history 是否真的拿到了
              if (!earlyEchoDebugPrinted) {
                earlyEchoDebugPrinted = true;
                console.log('[EchoGuard] check', JSON.stringify({
                  assistantMessageId,
                  candidateLen: candidate.length,
                  historyCount: historyAssistantTexts.length,
                  lastPrefixLen: lastPrefix.length,
                }));
              }

              // 仍保留这两项统计用于观察（不参与判定），便于你后续对照。
              const echo = analyzeEchoSimilarity(candidate, historyAssistantTexts, { n: 12, minCandidateLen: 160, historyMax: 6 });
              const exact = analyzeExactSentenceEcho(candidate, historyAssistantTexts, { minCandidateSentences: 4, historyMax: 3, candidateSentenceCap: 14 });
              const sub = analyzeSubstringEcho(candidate, historyAssistantTexts, { candidateMaxLen: 180, historyMaxLen: 180, historyMax: 3, minMatchLen: 80, step: 4, stripPunct: true });

              console.log('[EchoGuard] substring_check', JSON.stringify({
                assistantMessageId,
                candidateLen: candidate.length,
                openingLenTarget: 150,
                historyCount: historyAssistantTexts.length,
                hit: !!sub.hit,
                bestMatchLen: sub.bestMatchLen,
                windowsChecked: sub.windowsChecked,
                // 观察项（不参与判定）
                ngram_bestScore: Number((echo.bestScore || 0).toFixed(4)),
                exact_bestExactCount: exact.bestExactCount,
                exact_bestLongestConsecutive: exact.bestLongestConsecutive,
              }));

              // 只抓“同文大段照抄”：只用 substring 作为硬证据。
              // ngram/exact 作为弱证据容易误杀，因此这里只做日志观察，不触发中断/修复。
              const shouldAbort = shouldAbortEarlyForSubstringEcho(sub, { minMatchLen: 80 });

              if (shouldAbort) {
                // 检测到“同文大段照抄”（substring 命中）时：不再中断生成（用户要求一次请求完整输出）。
                // 我们只做“记录 + 后处理首段本地修复”（在 onFinish 阶段完成），保证用户能正常使用。
                console.log('[EchoGuard] substring_hit_mark', JSON.stringify({
                  assistantMessageId,
                  requestLen: curLen,
                  substring_hit: !!sub.hit,
                  substring_bestMatchLen: sub.bestMatchLen,
                  substring_windowsChecked: sub.windowsChecked,
                }));

                setVisibleMessages(prevVisible2 => prevVisible2.map(m2 => {
                  if (m2.id !== assistantMessageId) return m2;
                  const newVersions = [...m2.versions];
                  const vv = { ...newVersions[targetVersionIndex] };
                  vv.metadata = { ...(vv.metadata || {}), echoGuardSubstringHit: true, echoGuardSubstringBestMatchLen: sub.bestMatchLen };
                  newVersions[targetVersionIndex] = vv;
                  return { ...m2, versions: newVersions };
                }));

                return;
              }
            }
          }
        } catch (e) {
          // guard 失败不影响正常生成
        }
      },
      onError: (err) => {
        // 一次性 logit_bias 对照测试结束：自动关闭开关，避免每次请求都额外消耗 2 次调用
        if (err && err.type === 'debug_probe_done' && err.probe === 'logit_bias') {
          setCurrentSession(prev => {
            if (!prev) return prev;
            const nextSettings = { ...(prev.settings || {}) };
            if (nextSettings.debugLogitBiasProbe) {
              nextSettings.debugLogitBiasProbe = false;
              // 同步落盘
              const updatedSession = { ...prev, settings: nextSettings };
              saveSession(updatedSession);
              return updatedSession;
            }
            return prev;
          });
          return;
        }

        // 其他错误：保留原行为（目前仅记录）
        if (err && err.type) {
          console.log('[LLM Error]', JSON.stringify({ type: err.type, status: err.status }));
        }
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

        // 取最终文本快照（用于标点自检/修复）
        const finalAssistantMessage = visibleMessages.find(m => m.id === assistantMessageId);
        if (finalAssistantMessage) {
          const v = finalAssistantMessage.versions?.[targetVersionIndex];
          finishedTextSnapshot = v?.text || '';
        }

        // After streaming, update allMessages with the final content from visibleMessages
        setVisibleMessages(prevVisible => {
          const finalAssistantMessage2 = prevVisible.find(m => m.id === assistantMessageId);
          if (finalAssistantMessage2) {
            // 同步快照（以 state 的最终值为准）
            const v2 = finalAssistantMessage2.versions?.[targetVersionIndex];
            finishedTextSnapshot = v2?.text || finishedTextSnapshot;

            setAllMessages(prevAll => {
              const newAll = [...prevAll];
              const msgIndex = newAll.findIndex(m => m.id === assistantMessageId);
              if (msgIndex > -1) {
                newAll[msgIndex] = finalAssistantMessage2;
              }
              return newAll;
            });
          }
          return prevVisible;
        });

        // === EchoFix：首段照抄（同文）本地修复（一次请求，不额外耗输入 token） ===
        try {
          const msgList = (visibleMessagesRef.current || []);
          const idx = msgList.findIndex(m => m?.id === assistantMessageId);
          const curMsg = idx >= 0 ? msgList[idx] : null;
          const curV = curMsg?.versions?.[targetVersionIndex];
          const curText = (curV?.text || finishedTextSnapshot || '');

          // 找“上一条 assistant”（可见列表中该消息之前最近的一条 assistant）
          let prevAssistantText = '';
          if (idx > 0) {
            for (let i = idx - 1; i >= 0; i--) {
              const m = msgList[i];
              if (m?.author === 'assistant') {
                prevAssistantText = (m?.versions?.[m.currentVersionIndex]?.text || '');
                break;
              }
            }
          }

          // 只抓同文：对比首段前 150 字（为了更稳，内部取 180 作为窗口来源）
          const OPENING_LEN = 150;
          const opening = (curText || '').slice(0, Math.min((curText || '').length, 180));
          const prevOpening = (prevAssistantText || '').slice(0, 180);

          const sub2 = analyzeSubstringEcho(opening, [prevOpening].filter(Boolean), {
            candidateMaxLen: 180,
            historyMaxLen: 180,
            historyMax: 1,
            minMatchLen: 80,
            step: 4,
            stripPunct: true,
          });

          const needFixOpening = shouldAbortEarlyForSubstringEcho(sub2, { minMatchLen: 80 });

          if (needFixOpening && curText.length > OPENING_LEN) {
            // 本地生成一个“全新开头”，避免任何长片段同文。这里不用同义改写，用结构化重写，保证稳定。
            // 取用户最后一条作为主题锚点（只截取少量，不涉及二次请求）
            let userAnchor = '';
            for (let i = msgList.length - 1; i >= 0; i--) {
              if (msgList[i]?.author === 'user') {
                userAnchor = (msgList[i]?.versions?.[msgList[i].currentVersionIndex]?.text || '');
                break;
              }
            }
            userAnchor = String(userAnchor || '').replace(/\s+/g, ' ').trim();
            const anchorShort = userAnchor.slice(0, 60);

            const rest = curText.slice(OPENING_LEN).replace(/^\s+/g, '');

            // 候选开头（长度约 120~150），避免模板化“好的/当然/下面我将”。
            const candidates = [
              `我们直接进入正题：${anchorShort ? '围绕“' + anchorShort + '”' : '围绕你的设定'}，先把关键矛盾与推进方向明确下来。`,
              `${anchorShort ? '基于“' + anchorShort + '”' : '基于你给出的要求'}，我会从当下场景切入，用一个具体动作把节奏拉起来。`,
              `先不做铺垫式重复，我会用一个新的起笔点开场，然后顺着情节往前推。${anchorShort ? '主题锚点：' + anchorShort : ''}`,
            ];

            // 选择一个不会与 prevOpening 出现 >=10 连字同文片段的开头
            const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/[，。！？：；、,.!?;:…·\[\]\(\)（）“”"'《》<>【】]/g, '');
            const prevN = norm(prevOpening);
            const hasLongCommon = (a) => {
              const an = norm(a);
              const L = 10;
              for (let i = 0; i <= an.length - L; i++) {
                const sub = an.slice(i, i + L);
                if (sub && prevN.includes(sub)) return true;
              }
              return false;
            };

            let newOpening = candidates.find(c => !hasLongCommon(c)) || candidates[0];
            // 补齐到接近 150 字，让替换更自然
            if (newOpening.length < 110) {
              newOpening += '接下来我会按剧情顺序展开，不复述前文句子，只推进新内容。';
            }
            // 控制长度（尽量接近 150）
            newOpening = newOpening.slice(0, OPENING_LEN);

            const fixed = newOpening + rest;

            console.log('[EchoFix] opening_fixed', JSON.stringify({
              assistantMessageId,
              openingLen: OPENING_LEN,
              substring_bestMatchLen: sub2.bestMatchLen,
              applied: true,
            }));

            // 写回当前版本（不新增版本、不发请求）
            setVisibleMessages(prevVisibleFix => prevVisibleFix.map(m => {
              if (m.id !== assistantMessageId) return m;
              const newVersions = [...m.versions];
              const vFix = { ...newVersions[targetVersionIndex] };
              vFix.text = fixed;
              vFix.metadata = { ...(vFix.metadata || {}), openingEchoFixed: true, openingEchoFixedLen: OPENING_LEN, openingEchoBestMatchLen: sub2.bestMatchLen };
              newVersions[targetVersionIndex] = vFix;
              return { ...m, versions: newVersions };
            }));

            setAllMessages(prevAllFix => prevAllFix.map(m => {
              if (m.id !== assistantMessageId) return m;
              const newVersions = [...m.versions];
              const vFix = { ...newVersions[targetVersionIndex] };
              vFix.text = fixed;
              vFix.metadata = { ...(vFix.metadata || {}), openingEchoFixed: true, openingEchoFixedLen: OPENING_LEN, openingEchoBestMatchLen: sub2.bestMatchLen };
              newVersions[targetVersionIndex] = vFix;
              return { ...m, versions: newVersions };
            }));

            finishedTextSnapshot = fixed;
          } else {
            console.log('[EchoFix] opening_fixed', JSON.stringify({
              assistantMessageId,
              openingLen: OPENING_LEN,
              substring_bestMatchLen: sub2.bestMatchLen,
              applied: false,
            }));
          }
        } catch (e) {
          // ignore
        }

        // === 本地后处理：英文半角标点 → 中文全角标点（非常保守，避免破坏数字/小数点）===
        try {
          const s = String(finishedTextSnapshot || '');
          if (s) {
            // 规则：
            // 1) , ? ! : ; 直接替换为中文全角
            // 2) . 只在“不是数字小数点/不是缩写”的情况下替换：
            //    - 如果 '.' 左右都是数字（如 3.14）则保留
            //    - 如果是英文缩写/域名（A.B / example.com）这种也尽量保留（很保守：左右都是 [A-Za-z] 时保留）
            const chars = Array.from(s);
            for (let i = 0; i < chars.length; i++) {
              const ch = chars[i];
              if (ch === ',') chars[i] = '，';
              else if (ch === '?') chars[i] = '？';
              else if (ch === '!') chars[i] = '！';
              else if (ch === ':') chars[i] = '：';
              else if (ch === ';') chars[i] = '；';
              else if (ch === '.') {
                const prev = chars[i - 1] || '';
                const next = chars[i + 1] || '';
                const isDigitDot = /\d/.test(prev) && /\d/.test(next);
                const isAlphaDot = /[A-Za-z]/.test(prev) && /[A-Za-z]/.test(next);
                if (!isDigitDot && !isAlphaDot) chars[i] = '。';
              }
            }
            const fixedPunct = chars.join('');
            if (fixedPunct !== s) {
              console.log('[PunctFix] halfwidth_to_fullwidth_applied', JSON.stringify({
                assistantMessageId,
                changed: true,
              }));

              setVisibleMessages(prevVisibleFix => prevVisibleFix.map(m => {
                if (m.id !== assistantMessageId) return m;
                const newVersions = [...m.versions];
                const vFix = { ...newVersions[targetVersionIndex] };
                vFix.text = fixedPunct;
                vFix.metadata = { ...(vFix.metadata || {}), halfwidthPunctFixed: true };
                newVersions[targetVersionIndex] = vFix;
                return { ...m, versions: newVersions };
              }));

              setAllMessages(prevAllFix => prevAllFix.map(m => {
                if (m.id !== assistantMessageId) return m;
                const newVersions = [...m.versions];
                const vFix = { ...newVersions[targetVersionIndex] };
                vFix.text = fixedPunct;
                vFix.metadata = { ...(vFix.metadata || {}), halfwidthPunctFixed: true };
                newVersions[targetVersionIndex] = vFix;
                return { ...m, versions: newVersions };
              }));

              finishedTextSnapshot = fixedPunct;
            }
          }
        } catch (e) {
          // ignore
        }

        // === 重复检测与自动重试（后处理，最多一次） ===
        try {
          const rep = analyzeRepetition(finishedTextSnapshot);
          const needRetry = shouldAutoRetryForRepetition(rep);

          // 防循环：每条 assistant 消息的每个版本，最多只触发一次“自动重试”
          const currentVersion = ((visibleMessagesRef.current || []).find(m => m.id === assistantMessageId)?.versions || [])[targetVersionIndex];
          const alreadyAutoRetried = !!(currentVersion && currentVersion.metadata && currentVersion.metadata.autoRetriedForRepetition);

          // 用户反馈：自动开新版本重试会浪费 token 且对“首段照抄”无效，因此禁用自动重试。
          if (needRetry && !alreadyAutoRetried && (currentSession?.settings?.enableAutoRetry !== true)) {
            // 只打标记用于观察（不重试、不新增版本）
            setVisibleMessages(prevVisible2 => prevVisible2.map(msg => {
              if (msg.id === assistantMessageId) {
                const newVersions = [...msg.versions];
                const v = { ...newVersions[targetVersionIndex] };
                v.metadata = { ...(v.metadata || {}), repetitionDetectedNoRetry: true, repetitionStats: rep };
                newVersions[targetVersionIndex] = v;
                return { ...msg, versions: newVersions };
              }
              return msg;
            }));
          }

          if (needRetry && !alreadyAutoRetried && (currentSession?.settings?.enableAutoRetry === true)) {
            // 先给“本版本”打标记：已触发过自动重试（防止极端情况下重复触发形成循环）
            setVisibleMessages(prevVisible2 => prevVisible2.map(msg => {
              if (msg.id === assistantMessageId) {
                const newVersions = [...msg.versions];
                const v = { ...newVersions[targetVersionIndex] };
                v.metadata = { ...(v.metadata || {}), autoRetriedForRepetition: true };
                newVersions[targetVersionIndex] = v;
                return { ...msg, versions: newVersions };
              }
              return msg;
            }));

            // 追加一个极短“反复读”约束，再重试一次生成（以新版本形式保存）
            setVisibleMessages(prevVisible2 => prevVisible2.map(msg => {
              if (msg.id === assistantMessageId) {
                const newVersions = [...msg.versions, { id: uuidv4(), text: '' }];
                const newIndex = newVersions.length - 1;
                return { ...msg, versions: newVersions, currentVersionIndex: newIndex };
              }
              return msg;
            }));

            // 重新构造上下文：在原 contextMessages 的基础上，额外加一句短指令（不分段续写，不浪费太多 token）
            const retryContext = [...contextMessages];
            retryContext.push({
              id: uuidv4(),
              author: 'user',
              timestamp: new Date().toISOString(),
              versions: [{ id: uuidv4(), text: buildAntiRepeatInstruction() }],
              currentVersionIndex: 0,
            });

            // 重试时轻微扰动采样，帮助跳出复读吸引子
            streamAssistantResponse(
              retryContext,
              assistantMessageId,
              // 重试写入刚才新建的版本
              ((visibleMessagesRef.current || []).find(m => m.id === assistantMessageId)?.versions?.length || (targetVersionIndex + 2)) - 1,
              lastUserMessageId
            );
            // 注意：这里会触发新的流式请求；本次 onFinish 仍会继续执行，但标点修复会在新版本上再次生效。
          }
        } catch (e) {
          console.error('重复检测/自动重试失败:', e);
        }

        // === 标点密度自检与自动修复（后处理） ===
        try {
          const analysis = analyzePunctuation(finishedTextSnapshot);
          const needFix = shouldAutoFixPunctuation(analysis, { minPunctRatio: 0.01, maxRunThreshold: 80 });
          if (needFix) {
            const fixUserMessage = {
              id: uuidv4(),
              author: 'user',
              timestamp: new Date().toISOString(),
              parentId: assistantMessageId,
              versions: [{
                id: uuidv4(),
                text: buildPunctuationFixPrompt(finishedTextSnapshot),
                metadata: { wordCount: (finishedTextSnapshot || '').length, hidden: true, purpose: 'punctuation_fix' },
              }],
              currentVersionIndex: 0,
              isCollapsed: true,
              isHidden: true,
            };

            const fixAssistantPlaceholder = {
              id: uuidv4(),
              author: 'assistant',
              timestamp: new Date().toISOString(),
              versions: [{ id: uuidv4(), text: '' }],
              currentVersionIndex: 0,
              parentId: fixUserMessage.versions[0].id,
              isCollapsed: true,
              isHidden: true,
            };

            // 追加到消息列表，但不一定展示（取决于你的渲染是否支持 isHidden；至少保证可回溯）
            setAllMessages(prevAll => [...prevAll, fixUserMessage, fixAssistantPlaceholder]);

            // 仅用“待修订文本”发起一次极短上下文请求，避免浪费 token
            const abortFix = getCompletion({
              messages: [{ author: 'user', text: fixUserMessage.versions[0].text }],
              settings: { ...currentSession.settings, max_tokens: Math.min((currentSession.settings.max_tokens || 6000), 8000) },
              onChunk: (c) => {
                // 把修复结果写入原 assistant 消息的新版本
                setVisibleMessages(prevVisible2 => prevVisible2.map(msg => {
                  if (msg.id === assistantMessageId) {
                    const newVersions = [...msg.versions, { id: uuidv4(), text: (msg.versions[targetVersionIndex]?.text || '') }];
                    const newIndex = newVersions.length - 1;
                    newVersions[newIndex] = { ...newVersions[newIndex], text: (newVersions[newIndex].text || '') + c, metadata: { ...(newVersions[newIndex].metadata || {}), autoFixedPunctuation: true } };
                    return { ...msg, versions: newVersions, currentVersionIndex: newIndex };
                  }
                  return msg;
                }));
                setIsDirty(true);
              },
              onFinish: () => {
                // 完成修复后更新 allMessages 与 sessionsList
                setAllMessages(prevAll2 => prevAll2.map(msg => {
                  if (msg.id === assistantMessageId) {
                    return visibleMessages.find(v => v.id === assistantMessageId) || msg;
                  }
                  return msg;
                }));
              },
              onError: () => {},
            });
            // 不保存 abortFix（它是内部短修复流）；需要的话可扩展为可取消
            void abortFix;
          }
        } catch (e) {
          console.error('标点自检/修复失败:', e);
        }

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
    const allContextMessages = newVisibleMessages
      .slice(0, -1)
      .filter(m => m && !m.deletedAt && m.type !== 'tombstone');
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
    const allContextMessages = visibleMessages
      .slice(0, visibleIndex)
      .filter(m => m && !m.deletedAt && m.type !== 'tombstone');
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
    const update = (messages) => {
      let changed = false;
      const updated = (messages || []).map(msg => {
        if (msg?.id === messageId && msg.isCollapsible !== isCollapsible) {
          changed = true;
          return { ...msg, isCollapsible };
        }
        return msg;
      });
      return { updated, changed };
    };

    setAllMessages(prevAll => {
      const { updated, changed } = update(prevAll);
      if (changed) {
        // 同步更新可见列表，保证“↕️ 折叠按钮”在新消息刚生成完就能显示
        setVisibleMessages(prevVisible => update(prevVisible).updated);
      }
      return changed ? updated : prevAll;
    });
    // 不需要 setIsDirty：这是纯 UI 状态
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
    const allContextMessages = visibleMessages
      .slice(0, userMessageIndex + 1)
      .filter(m => m && !m.deletedAt && m.type !== 'tombstone');
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
        // 切换版本会重建可见树；为了让墓碑与软删除状态稳定存在，这里也要按 pendingUndo 注入墓碑。
        buildVisibleTreeWithTombstone(newAll, currentSession?.pendingUndo);
        return newAll;
      }
      return prevAll;
    });
    setIsDirty(true);
  }, [buildVisibleTreeWithTombstone, currentSession]);


  const handleStopGeneration = async () => {
    // === EchoGuard：手动 stop 时做一次“首段照抄”诊断（哪怕没触发自动 abort） ===
    try {
      const liveAssistantIds = [...replyingMessageIds];
      for (const assistantMessageId of liveAssistantIds) {
        const vMsg = (visibleMessagesRef.current || []).find(m => m?.id === assistantMessageId);
        const vIndex = vMsg?.currentVersionIndex ?? 0;
        const curText = (vMsg?.versions?.[vIndex]?.text || '').slice(0, 1200);

        // 上一条 assistant：从可见列表里取“该消息之前最近的 assistant”
        const idx = (visibleMessagesRef.current || []).findIndex(m => m?.id === assistantMessageId);
        let prevAssistantText = '';
        if (idx > 0) {
          for (let i = idx - 1; i >= 0; i--) {
            const m = (visibleMessagesRef.current || [])[i];
            if (m?.author === 'assistant') {
              const vv = m?.versions?.[m.currentVersionIndex];
              prevAssistantText = (vv?.text || '').slice(0, 1200);
              break;
            }
          }
        }

        const history = prevAssistantText ? [prevAssistantText] : [];
        const echo = analyzeEchoSimilarity(curText, history, { n: 12, minCandidateLen: 80, historyMax: 1 });
        const exact = analyzeExactSentenceEcho(curText, history, { minCandidateSentences: 2, historyMax: 1, candidateSentenceCap: 18 });

        console.log('[EchoGuard] manual_stop_analysis', JSON.stringify({
          assistantMessageId,
          candidateLen: curText.length,
          historyCount: history.length,
          ngram_bestScore: Number((echo.bestScore || 0).toFixed(4)),
          exact_bestExactCount: exact.bestExactCount,
          exact_bestExactRatio: exact.bestExactRatio,
          exact_bestLongestConsecutive: exact.bestLongestConsecutive,
          exact_candSentenceCount: exact.candSentenceCount,
        }));
      }
    } catch (e) {
      // ignore
    }

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

  const handleCopyMessage = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
  }, []);

  const UNDO_WINDOW_MS = 3 * 60 * 1000;

  const createTombstoneItem = (anchorMessageId, anchorVersionId, undo) => {
    return {
      id: undo.tombstoneId,
      type: 'tombstone',
      anchorMessageId,
      anchorVersionId,
      undoId: undo.undoId,
      createdAt: undo.createdAt,
      expiresAt: undo.expiresAt,
    };
  };

  const hardDeleteByUndo = useCallback((messages, undo) => {
    if (!undo) return messages || [];

    const toDelete = new Set(undo.affectedMessageIds || []);

    // 1) 先移除被标记删除的消息节点
    let newAll = (messages || []).filter(m => !toDelete.has(m.id));

    // 2) 兜底：移除指向“被删消息的任意版本 id”的边（parentId 指向版本 id 的情况）
    const deletedVersionIds = new Set();
    for (const m of (messages || [])) {
      if (toDelete.has(m.id) && Array.isArray(m.versions)) {
        for (const v of m.versions) {
          if (v?.id) deletedVersionIds.add(v.id);
        }
      }
    }
    newAll = newAll.filter(m => !deletedVersionIds.has(m.parentId));

    // 3) 若这是“版本分支删除(subtree)”，则永久移除该版本（使其不可再切回）
    if (undo.mode === 'subtree' && undo.anchorMessageId && undo.anchorVersionId) {
      newAll = newAll.map(m => {
        if (m.id !== undo.anchorMessageId) return m;
        if (!Array.isArray(m.versions) || m.versions.length === 0) return m;

        const idx = m.versions.findIndex(v => v?.id === undo.anchorVersionId);
        if (idx === -1) return m;

        const newVersions = [...m.versions];
        newVersions.splice(idx, 1);

        if (newVersions.length === 0) {
          // 没有版本了：整条消息也应被删除
          return { ...m, __toHardDelete: true };
        }

        let newCurrentIndex = m.currentVersionIndex;
        if (newCurrentIndex >= newVersions.length) {
          newCurrentIndex = newVersions.length - 1;
        }
        // 如果当前正好在被删除的版本上，则切到就近版本
        if (m.currentVersionIndex === idx) {
          newCurrentIndex = Math.min(idx, newVersions.length - 1);
        } else if (m.currentVersionIndex > idx) {
          newCurrentIndex = m.currentVersionIndex - 1;
        }

        return { ...m, versions: newVersions, currentVersionIndex: newCurrentIndex };
      });

      newAll = newAll.filter(m => !m.__toHardDelete);
    }

    return newAll;
  }, []);

  const cleanupExpiredUndoIfNeeded = useCallback((messages, session) => {
    const undo = session?.pendingUndo;
    if (!undo) return { messages, sessionChanged: false, session: session };

    const now = Date.now();
    const expiresAt = typeof undo.expiresAt === 'number' ? undo.expiresAt : new Date(undo.expiresAt).getTime();
    if (Number.isNaN(expiresAt) || now <= expiresAt) {
      return { messages, sessionChanged: false, session: session };
    }

    // 过期：执行硬删除，并清空 pendingUndo
    const cleanedMessages = hardDeleteByUndo(messages, undo);
    const newSession = session ? { ...session, pendingUndo: null, messages: cleanedMessages } : session;
    return { messages: cleanedMessages, sessionChanged: true, session: newSession };
  }, [hardDeleteByUndo]);

  const applyUndoSoftDelete = useCallback((messages, undoId, messageIds, deletedAtIso) => {
    const setIds = new Set(messageIds);
    return (messages || []).map(m => {
      if (!m || !m.id) return m;
      if (!setIds.has(m.id)) return m;
      return { ...m, deletedAt: deletedAtIso, deletedByUndoId: undoId };
    });
  }, []);

  const undoSoftDelete = useCallback((messages, undoId) => {
    return (messages || []).map(m => {
      if (!m) return m;
      if (m.deletedByUndoId !== undoId) return m;
      return { ...m, deletedAt: null, deletedByUndoId: null };
    });
  }, []);

  const computeDeleteRangeFromVisible = useCallback((anchorMessageId, visible, extraExcludedIds = []) => {
    const idx = (visible || []).findIndex(m => m?.id === anchorMessageId);
    if (idx === -1) return [];
    const range = (visible || []).slice(idx)
      .filter(m => m && m.type !== 'tombstone')
      .map(m => m.id);

    const excluded = new Set(extraExcludedIds);
    return range.filter(id => !excluded.has(id));
  }, []);

  const computeSubtreeFromParentId = useCallback((allMsgs, rootParentId) => {
    // rootParentId 是“边”的起点：
    // - 对于 assistant 版本：rootParentId = versionId
    // - 对于用户消息：rootParentId = messageId
    // 子树定义：所有通过 parentId 链接（parentId 字段）可达的消息节点集合
    const childrenMap = new Map();
    for (const m of (allMsgs || [])) {
      const pid = m?.parentId || 'root';
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(m.id);
    }

    const result = [];
    const visited = new Set();
    const stack = [...(childrenMap.get(rootParentId) || [])];

    while (stack.length) {
      const id = stack.pop();
      if (!id || visited.has(id)) continue;
      visited.add(id);
      result.push(id);

      const next = childrenMap.get(id) || [];
      for (const c of next) stack.push(c);

      // 特别处理：assistant 消息的后续可能挂在“当前版本 id”上（但那种边是 parentId=versionId，
      // 已经包含在 childrenMap 中；这里不需要额外加）。
    }

    return result;
  }, []);

  const commitPendingUndoToState = useCallback((newSession, newAllMessages) => {
    setCurrentSession(newSession);
    setAllMessages(newAllMessages);
    // 只负责标脏，保存交给 debounce
    setIsDirty(true);
  }, []);

  const deleteRangeWithUndo = useCallback(async ({
    anchorMessageId,
    anchorParentId, // 删除子树的起点（parentId 维度）：messageId 或 versionId
    anchorVersionId, // 仅用于展示墓碑“对应哪个版本分支”
    mode = 'range', // 'range' | 'subtree'
  }) => {
    if (!currentSession) return;

    // 1) 先做过期清理（避免旧 undo 残留）
    const cleaned = cleanupExpiredUndoIfNeeded(allMessagesRef.current, currentSession);
    let baseSession = cleaned.session;
    let baseAll = cleaned.messages;

    // 2) 若已有 pendingUndo（只允许最近一次撤销），先直接硬删除旧的删段
    if (baseSession?.pendingUndo) {
      baseAll = hardDeleteByUndo(baseAll, baseSession.pendingUndo);
      baseSession = { ...baseSession, pendingUndo: null, messages: baseAll };
    }

    const now = Date.now();
    const undoId = uuidv4();
    const deletedAtIso = new Date(now).toISOString();

    // 3) 计算 affectedIds
    // - range：从 anchorMessageId 在可见列表中的位置开始到末尾（包含 anchor 本身）
    // - subtree：从 anchorParentId（messageId 或 versionId）出发，沿 parentId 收集整棵子树
    let affectedIds = [];
    if (mode === 'subtree') {
      const rootPid = anchorParentId;
      affectedIds = computeSubtreeFromParentId(baseAll, rootPid);

      // subtree 模式下：
      // - 删除版本 / 删除消息的“当前版本分支”：都不删除消息本体（否则版本切换消失），只删该版本子树
      // - 如果未来需要“删除整条消息（所有版本）”，再单独做一个入口/模式
      affectedIds = affectedIds.filter(id => id !== anchorMessageId);
    } else {
      affectedIds = computeDeleteRangeFromVisible(anchorMessageId, visibleMessages);
    }

    let finalAll = baseAll;

    // 4) 软删除标记
    finalAll = applyUndoSoftDelete(finalAll, undoId, affectedIds, deletedAtIso);

    const undo = {
      undoId,
      createdAt: now,
      expiresAt: now + UNDO_WINDOW_MS,
      tombstoneId: `tombstone_${undoId}`,
      anchorMessageId,
      anchorVersionId: anchorVersionId || null,
      anchorParentId: anchorParentId || null,
      mode,
      affectedMessageIds: affectedIds,
    };

    const newSession = { ...baseSession, pendingUndo: undo, messages: finalAll };

    // 6) 写入 state
    commitPendingUndoToState(newSession, finalAll);

    // 7) 重建 visible：过滤软删除消息 + 在“消息本体后面”插入墓碑
    setTimeout(() => {
      const visible = [];
      const messageMap = new Map(finalAll.map(m => [m.id, m]));
      const childrenMap = new Map();

      // 构建 children 映射（只考虑未删除的消息）
      for (const msg of finalAll) {
        if (msg.deletedAt) continue;
        const parentId = msg.parentId || 'root';
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId).push(msg);
      }

      const shouldShowTombstoneAfterMessage = (msg, pendingUndo) => {
        if (!pendingUndo) return false;
        // 如果 anchor 消息本体已被软删除，则不显示墓碑（避免出现“凭空的墓碑”）
        const anchorMsg = messageMap.get(pendingUndo.anchorMessageId);
        if (!anchorMsg || anchorMsg.deletedAt) return false;
        if (msg?.id !== pendingUndo.anchorMessageId) return false;
        // 若是版本删除（subtree），只在“当前选中版本 == 被删版本”时显示墓碑
        if (pendingUndo.mode === 'subtree' && pendingUndo.anchorVersionId) {
          const curVid = msg?.versions?.[msg.currentVersionIndex]?.id;
          return curVid === pendingUndo.anchorVersionId;
        }
        // 普通 range 删除：只要 anchorMessageId 匹配就显示
        return true;
      };

      // 递归构建可见消息（DFS，忽略已删除的）
      const addNode = (msgId) => {
        const msg = messageMap.get(msgId);
        if (!msg || msg.deletedAt) return;

        visible.push(msg);

        // 在消息本体后插入墓碑（不替换消息，这样版本切换按钮仍在）
        if (shouldShowTombstoneAfterMessage(msg, newSession.pendingUndo)) {
          visible.push(createTombstoneItem(msg.id, newSession.pendingUndo.anchorVersionId, newSession.pendingUndo));
        }

        const currentVersionId = msg.versions[msg.currentVersionIndex]?.id;
        if (currentVersionId && childrenMap.has(currentVersionId)) {
          childrenMap.get(currentVersionId).forEach(child => addNode(child.id));
        }
      };

      const rootMessages = childrenMap.get('root') || [];
      rootMessages.forEach(rootMsg => addNode(rootMsg.id));

      setVisibleMessages(visible);
    }, 0);

    const updatedList = await getAllSessions();
    setSessionsList(updatedList);
  }, [currentSession, visibleMessages, computeDeleteRangeFromVisible, computeSubtreeFromParentId, cleanupExpiredUndoIfNeeded, hardDeleteByUndo, applyUndoSoftDelete, commitPendingUndoToState, buildVisibleTreeWithTombstone]);

  const handleTombstoneExpire = useCallback((undoId) => {
    // 到期自动硬删除（不弹窗）
    if (!currentSession?.pendingUndo) return;
    if (currentSession.pendingUndo.undoId !== undoId) return;

    const cleanedAll = hardDeleteByUndo(allMessagesRef.current, currentSession.pendingUndo);
    const newSession = { ...currentSession, pendingUndo: null, messages: cleanedAll };
    setCurrentSession(newSession);
    setAllMessages(cleanedAll);
    buildVisibleTreeWithTombstone(cleanedAll, null);
    setIsDirty(true);
  }, [currentSession, hardDeleteByUndo, buildVisibleTreeWithTombstone]);

  const handleHardDeleteUndo = useCallback(async (undoId) => {
    if (!currentSession?.pendingUndo) return;
    if (currentSession.pendingUndo.undoId !== undoId) return;

    Alert.alert('彻底删除', '将立即永久删除该分支内容，无法撤销。确定继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '彻底删除',
        style: 'destructive',
        onPress: async () => {
          const cleanedAll = hardDeleteByUndo(allMessagesRef.current, currentSession.pendingUndo);
          const newSession = { ...currentSession, pendingUndo: null, messages: cleanedAll };
          setCurrentSession(newSession);
          setAllMessages(cleanedAll);
          buildVisibleTreeWithTombstone(cleanedAll, null);
          setIsDirty(true);

          const updatedList = await getAllSessions();
          setSessionsList(updatedList);
        },
      },
    ]);
  }, [currentSession, hardDeleteByUndo, buildVisibleTreeWithTombstone]);

  const handleUndoDelete = useCallback(async (undoId) => {
    if (!currentSession?.pendingUndo) return;
    if (currentSession.pendingUndo.undoId !== undoId) return;

    // 未过期才能撤销
    const now = Date.now();
    if (now > currentSession.pendingUndo.expiresAt) {
      // 已过期则执行硬删除
      const cleanedAll = hardDeleteByUndo(allMessagesRef.current, currentSession.pendingUndo);
      const newSession = { ...currentSession, pendingUndo: null, messages: cleanedAll };
      setCurrentSession(newSession);
      setAllMessages(cleanedAll);
      buildVisibleTreeWithTombstone(cleanedAll, null);
      setIsDirty(true);
      return;
    }

    const restoredAll = undoSoftDelete(allMessagesRef.current, undoId);
    const newSession = { ...currentSession, pendingUndo: null, messages: restoredAll };

    setCurrentSession(newSession);
    setAllMessages(restoredAll);
    buildVisibleTreeWithTombstone(restoredAll, null);
    setIsDirty(true);

    const updatedList = await getAllSessions();
    setSessionsList(updatedList);
  }, [currentSession, hardDeleteByUndo, undoSoftDelete, buildVisibleTreeWithTombstone]);

  const handleDelete = useCallback((messageId) => {
    const msg = allMessagesRef.current.find(m => m.id === messageId);
    if (!msg) return;

    const currentVid = msg?.versions?.[msg.currentVersionIndex]?.id;
    if (!currentVid) return;

    Alert.alert('删除消息', '确定要删除该消息“当前版本”及其后续分支吗？（3分钟内可撤销）', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => deleteRangeWithUndo({
          anchorMessageId: messageId,
          anchorParentId: currentVid,
          anchorVersionId: currentVid,
          mode: 'subtree',
        })
      },
    ]);
  }, [deleteRangeWithUndo]);

  const handleDeleteVersion = useCallback((messageId, versionIndex) => {
    const message = allMessagesRef.current.find(m => m.id === messageId);
    if (!message) return;

    const versionIdToDelete = message?.versions?.[versionIndex]?.id;
    if (!versionIdToDelete) return;

    Alert.alert('删除版本', '确定要删除这个版本的回答吗？这也会删除该版本下的所有后续对话。（3分钟内可撤销）', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteRangeWithUndo({
            anchorMessageId: messageId,
            anchorParentId: versionIdToDelete,
            anchorVersionId: versionIdToDelete,
            mode: 'subtree',
          });
        },
      },
    ]);
  }, [deleteRangeWithUndo]);

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
      initialContent: editingMessageInfo.text,
      onSave: (newText) => {
        // Update the text in the editing info state
        setEditingMessageInfo(prev => ({ ...prev, text: newText }));
        // Re-open the edit modal to show the updated text
        setIsEditModalVisible(true);
      },
    });
  };

  const handleSaveEdit = async (newText, editMode = 'new_version') => {
    if (!editingMessageInfo) return;

    const { id, versionIndex, author } = editingMessageInfo;
    const normalizedText = newText ?? '';

    setEditingMessageInfo(null);
    setIsEditModalVisible(false);

    setAllMessages(prevAll => {
      const messageIndex = prevAll.findIndex(m => m.id === id);
      if (messageIndex === -1) return prevAll;

      const newAll = [...prevAll];
      const messageToUpdate = { ...newAll[messageIndex] };
      const newVersions = messageToUpdate.versions.map(v => ({ ...v }));

      if (author === 'user' && editMode === 'new_version') {
        // 用户消息 + 创建新版本：总是追加一个新版本并切换过去
        const newVersion = { id: uuidv4(), text: normalizedText, metadata: { wordCount: normalizedText.length } };
        newVersions.push(newVersion);
        messageToUpdate.versions = newVersions;
        messageToUpdate.currentVersionIndex = newVersions.length - 1;
      } else {
        // 用户消息（覆盖模式）或 助手消息：总是修改指定版本
        if (versionIndex >= 0 && versionIndex < newVersions.length) {
          newVersions[versionIndex] = {
            ...newVersions[versionIndex],
            text: normalizedText,
            metadata: { ...(newVersions[versionIndex].metadata || {}), wordCount: normalizedText.length },
          };
          messageToUpdate.versions = newVersions;
          // 如果编辑的是一个非当前显示的版本，则切换过去，确保修改可见
          messageToUpdate.currentVersionIndex = versionIndex;
        } else {
          // 如果 versionIndex 无效，则不作任何修改
          return prevAll;
        }
      }

      newAll[messageIndex] = messageToUpdate;
      
      // 变更后，立即重建可见消息树
      buildVisibleTreeWithTombstone(newAll, currentSession?.pendingUndo);

      return newAll;
    });

    setIsDirty(true);
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
      onUndoDelete={handleUndoDelete}
      onHardDelete={handleHardDeleteUndo}
      onTombstoneExpire={handleTombstoneExpire}
      pendingUndo={currentSession?.pendingUndo}
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
              placeholder={isReplying ? '等待回复中...' : "在这里输入你的问题~(˶╹ꇴ╹˶)~"}
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

