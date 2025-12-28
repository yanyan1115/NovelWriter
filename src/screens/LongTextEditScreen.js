import React, { useState, useEffect, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  Keyboard,
  Dimensions,
  InteractionManager,
  Animated,
  Easing,
  Alert,
} from 'react-native';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function LongTextEditScreen({ route, navigation }) {
  // 兼容不同入口传参：initialValue / initialContent
  const { initialValue, initialContent, onSave } = route.params || {};
  const initialContentResolved = (typeof initialValue === 'string' ? initialValue : (typeof initialContent === 'string' ? initialContent : ''));
  // 解决 React Navigation 警告：路由参数含有函数（非可序列化）
  const onSaveRef = useRef(null);
  useEffect(() => {
    if (typeof onSave === 'function') {
      onSaveRef.current = onSave;
      // 将函数从路由参数中移除，避免持久化/恢复时报错
      try {
        navigation.setParams({ onSave: null });
      } catch (e) {}
    }
    // 仅初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [content, setContent] = useState(initialContentResolved);
  const [lastEditedAt, setLastEditedAt] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false); // 编辑模式状态
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [caretYStart, setCaretYStart] = useState(0);
  const [caretYEnd, setCaretYEnd] = useState(0);
  const lastUserScrollAtRef = useRef(0); // 用户主动滚动时间戳，用于抑制“点击后自动对齐”造成的跳动
  const pendingAlignToCaretRef = useRef(false); // 标记下一次 caretY 更新需要对齐到当前光标（典型：点击/移动光标后）
  const scrollIsAutoRef = useRef(false); // 标记当前 onScroll 是否由 scrollTo 引起，避免误判为用户滚动
  const [inputWidth, setInputWidth] = useState(0);
  const [viewportH, setViewportH] = useState(Dimensions.get('window').height);
  const [contentH, setContentH] = useState(0);
  const scrollYRef = useRef(0);

  const scrollRef = useRef(null);
  const contentInputRef = useRef(null);
  const autoScrollRafRef = useRef(null);
  const lastSelectionRef = useRef({ start: 0, end: 0 });
  const activeHandleRef = useRef('end'); // 'start' | 'end'
  const autoScrollDirRef = useRef(0); // -1 | 0 | 1（持续方向）
  const sustainUntilRef = useRef(0); // 边缘粘滞持续到的时间戳（ms）
  const speedRef = useRef(0); // 当前滚动速度（px/frame）
  const selectingRef = useRef(false);
  const suppressAlignUntilRef = useRef(0); // 选择结束后暂时禁止插入点对齐

  // 搜索与替换状态
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState([]); // [{start, end}]
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [replaceFlash, setReplaceFlash] = useState(null); // {start,end,id}
  const undoRef = useRef(null); // {prevContent, prevSelection, ts}
  const undoTimerRef = useRef(null);

  const searchAnim = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const searchInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    setLastEditedAt(new Date());
  }, [content]);

  // Listen for keyboard show/hide and record keyboard height
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
      setIsEditing(true);
    };
    const onHide = () => {
      setKeyboardHeight(0);
      setIsEditing(false); // 键盘收起，退出编辑模式
      contentInputRef.current?.blur(); // 主动失焦
    };

    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  // Ctrl+F / Cmd+F（在 RN iOS 物理键盘、部分 Android 平板上生效）
  useEffect(() => {
    const sub = Keyboard.addListener('keyPress', (e) => {
      // RN 对硬件键盘支持有限：尽量兼容，失败也不影响
      const key = e?.key;
      const ctrlKey = e?.ctrlKey;
      const metaKey = e?.metaKey;
      if ((ctrlKey || metaKey) && (key === 'f' || key === 'F')) {
        openSearchPanel();
      }
    });
    return () => sub?.remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formattedMeta = useMemo(() => {
    const hours = String(lastEditedAt.getHours()).padStart(2, '0');
    const minutes = String(lastEditedAt.getMinutes()).padStart(2, '0');
    const count = content.trim().length;
    return `今天 ${hours}:${minutes}  共 ${count} 字`;
  }, [content, lastEditedAt]);

  const handleSave = useCallback(() => {
    const fn = onSaveRef.current;
    if (typeof fn === 'function') {
      fn(content);
    }
    navigation.goBack();
  }, [content, navigation]);

  const animateSearch = useCallback(
    (open) => {
      Animated.timing(searchAnim, {
        toValue: open ? 1 : 0,
        duration: open ? 220 : 180,
        easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [searchAnim]
  );

  const openSearchPanel = useCallback(() => {
    setIsSearchOpen(true);
    animateSearch(true);
    // 不强制打断编辑，但给搜索框焦点；小延迟保证面板已渲染
    setTimeout(() => {
      searchInputRef.current?.focus?.();
    }, 80);
  }, [animateSearch]);

  const closeSearchPanel = useCallback(() => {
    animateSearch(false);
    setTimeout(() => {
      setIsSearchOpen(false);
      setIsReplaceOpen(false);
    }, 200);
  }, [animateSearch]);

  const toggleSearchPanel = useCallback(() => {
    if (isSearchOpen) closeSearchPanel();
    else openSearchPanel();
  }, [closeSearchPanel, isSearchOpen, openSearchPanel]);

  // 计算匹配（防抖 + 分块）
  const computeMatches = useCallback(
    (text, query, _caseSensitive) => {
      if (!query) return [];
      const escaped = escapeRegExp(query);
      if (!escaped) return [];

      const flags = _caseSensitive ? 'g' : 'gi';
      let re;
      try {
        re = new RegExp(escaped, flags);
      } catch (e) {
        return [];
      }

      const results = [];
      const CHUNK = 20000; // 分块搜索避免超长文本阻塞 UI
      const overlap = Math.min(query.length + 2, 64);
      let offset = 0;

      while (offset < text.length) {
        const end = Math.min(text.length, offset + CHUNK);
        const slice = text.slice(offset, end);
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(slice)) !== null) {
          const start = offset + m.index;
          const len = m[0]?.length ?? query.length;
          if (len <= 0) {
            // 防止 0 长度导致死循环
            re.lastIndex += 1;
            continue;
          }
          results.push({ start, end: start + len });
          if (results.length > 5000) break; // 防止极端情况
        }
        if (results.length > 5000) break;
        if (end >= text.length) break;
        offset = end - overlap;
      }

      // 去重（跨块重叠）
      results.sort((a, b) => a.start - b.start);
      const dedup = [];
      for (const r of results) {
        const last = dedup[dedup.length - 1];
        if (!last || r.start !== last.start || r.end !== last.end) dedup.push(r);
      }
      return dedup;
    },
    []
  );

  const runSearch = useCallback(
    (q, _caseSensitive) => {
      const nextMatches = computeMatches(content, q, _caseSensitive);
      setMatches(nextMatches);
      setActiveMatchIndex((prev) => {
        if (nextMatches.length === 0) return 0;
        // 尽量保持当前索引在范围内
        return Math.min(prev, nextMatches.length - 1);
      });
    },
    [computeMatches, content]
  );

  // 输入/内容变化时更新搜索结果（防抖）
  useEffect(() => {
    if (!isSearchOpen) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      runSearch(searchQuery, caseSensitive);
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, caseSensitive, content, isSearchOpen, runSearch]);

  const currentMatch = useMemo(() => {
    if (!matches.length) return null;
    return matches[Math.min(activeMatchIndex, matches.length - 1)] || null;
  }, [activeMatchIndex, matches]);

  const scrollToMatch = useCallback(
    (match) => {
      if (!match) return;
      // 设置 selection，让系统把光标/选择移动到匹配处
      suppressAlignUntilRef.current = Date.now() + 250;
      setSelection({ start: match.start, end: match.end });
      lastSelectionRef.current = { start: match.start, end: match.end };

      // 估算滚动：用隐藏 Text 测量 match.end 之前的高度
      // 我们复用现有 caretYEnd 机制：临时把 end 设到 match.end，会触发 measureTextEnd 变化
      // 但 selection state 更新是异步，使用 InteractionManager 等待布局后滚动
      InteractionManager.runAfterInteractions(() => {
        const paddingTop = 40;
        const paddingBottom = keyboardHeight > 0 ? keyboardHeight : 24;
        const availableHeight = viewportH - keyboardHeight;
        const currentScrollY = scrollYRef.current;

        // caretYEnd 会在 selection 更新后更新，这里再取一次最新值（可能仍旧值，但下一次 effect 也会对齐）
        const caretAbsoluteY = caretYEnd + paddingTop;

        let targetY = caretAbsoluteY - availableHeight / 2;
        const maxY = Math.max(0, paddingTop + contentH + paddingBottom - viewportH);
        let finalY = Math.min(Math.max(0, targetY), maxY);

        // 键盘遮挡保护：尽量让目标落在键盘上方 50px
        if (keyboardHeight > 0) {
          const keyboardTop = currentScrollY + availableHeight;
          if (caretAbsoluteY > keyboardTop - 50) {
            finalY = Math.min(maxY, caretAbsoluteY - (availableHeight * 0.65));
          }
        }

        scrollRef.current?.scrollTo({ y: finalY, animated: true });
      });
    },
    [caretYEnd, contentH, keyboardHeight, viewportH]
  );

  const goNext = useCallback(() => {
    if (!matches.length) return;
    // 一旦用户开始导航到“下一个”，就视为确认当前修改，撤销失效
    clearUndo();
    const next = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(next);
    scrollToMatch(matches[next]);
  }, [activeMatchIndex, clearUndo, matches, scrollToMatch]);

  const goPrev = useCallback(() => {
    if (!matches.length) return;
    const prev = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(prev);
    scrollToMatch(matches[prev]);
  }, [activeMatchIndex, matches, scrollToMatch]);

  const highlightParts = useMemo(() => {
    // 覆盖层高亮：允许编辑态显示（TextInput 文字透明，覆盖层显示高亮）
    if (!isSearchOpen) return null;
    if (!searchQuery || matches.length === 0) return null;

    const parts = [];
    let last = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (m.start < last) continue;
      if (m.start > last) {
        parts.push({ type: 'text', text: content.slice(last, m.start), key: `t-${last}-${m.start}-${i}` });
      }
      parts.push({
        type: 'match',
        text: content.slice(m.start, m.end),
        key: `m-${m.start}-${m.end}-${i}`,
        isActive: i === activeMatchIndex,
      });
      last = m.end;
    }
    if (last < content.length) {
      parts.push({ type: 'text', text: content.slice(last), key: `t-${last}-tail-${content.length}` });
    }
    return parts;
  }, [activeMatchIndex, content, isEditing, isSearchOpen, matches, searchQuery]);

  const doReplaceCurrent = useCallback(() => {
    if (!currentMatch || !searchQuery) return;

    const before = content;
    const prevSel = selection;

    const start = currentMatch.start;
    const end = currentMatch.end;

    const next = before.slice(0, start) + replaceQuery + before.slice(end);
    const newCaret = start + replaceQuery.length;

    // 撤销：在点击“下一个”导航之前都可撤销
    undoRef.current = { prevContent: before, prevSelection: prevSel, ts: Date.now() };
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    setContent(next);
    setSelection({ start: newCaret, end: newCaret });
    lastSelectionRef.current = { start: newCaret, end: newCaret };

    const flashId = Date.now();
    setReplaceFlash({ start, end: start + replaceQuery.length, id: flashId });
    setTimeout(() => {
      setReplaceFlash((p) => (p?.id === flashId ? null : p));
    }, 2000);

    // 重新搜索并定位到下一个（避免循环：替换后重新计算 matches，再选择一个合理的索引）
    InteractionManager.runAfterInteractions(() => {
      const nextMatches = computeMatches(next, searchQuery, caseSensitive);
      setMatches(nextMatches);
      if (nextMatches.length === 0) {
        setActiveMatchIndex(0);
        return;
      }
      // 找到 newCaret 后的第一个匹配
      const idx = nextMatches.findIndex((m) => m.start >= newCaret);
      const nextIdx = idx === -1 ? 0 : idx;
      setActiveMatchIndex(nextIdx);
      scrollToMatch(nextMatches[nextIdx]);
    });
  }, [caseSensitive, computeMatches, content, currentMatch, replaceQuery, scrollToMatch, searchQuery, selection]);

  const doReplaceAll = useCallback(() => {
    if (!searchQuery) return;
    const ms = computeMatches(content, searchQuery, caseSensitive);
    if (!ms.length) return;

    Alert.alert(
      '确认替换',
      `将替换全部 ${ms.length} 个匹配项，是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '继续',
          style: 'destructive',
          onPress: () => {
            const before = content;
            const prevSel = selection;

            const escaped = escapeRegExp(searchQuery);
            const flags = caseSensitive ? 'g' : 'gi';
            let re;
            try {
              re = new RegExp(escaped, flags);
            } catch (e) {
              return;
            }

            const next = before.replace(re, replaceQuery);

            // 撤销：在点击“下一个”导航之前都可撤销
            undoRef.current = { prevContent: before, prevSelection: prevSel, ts: Date.now() };
            if (undoTimerRef.current) {
              clearTimeout(undoTimerRef.current);
              undoTimerRef.current = null;
            }

            setContent(next);
            // 光标定位到文末（更稳），同时不打断编辑
            const newCaret = Math.min(next.length, prevSel.end);
            setSelection({ start: newCaret, end: newCaret });
            lastSelectionRef.current = { start: newCaret, end: newCaret };

            // 替换完成后清理高亮闪烁
            setReplaceFlash(null);

            InteractionManager.runAfterInteractions(() => {
              const nextMatches = computeMatches(next, searchQuery, caseSensitive);
              setMatches(nextMatches);
              setActiveMatchIndex(nextMatches.length ? 0 : 0);
              if (nextMatches.length) scrollToMatch(nextMatches[0]);
            });
          },
        },
      ]
    );
  }, [caseSensitive, computeMatches, content, replaceQuery, scrollToMatch, searchQuery, selection]);

  const doUndo = useCallback(() => {
    const u = undoRef.current;
    if (!u) return;
    setContent(u.prevContent);
    setSelection(u.prevSelection || { start: 0, end: 0 });
    lastSelectionRef.current = u.prevSelection || { start: 0, end: 0 };
    clearUndo();
    setReplaceFlash(null);
  }, [clearUndo]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '编辑消息',
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={toggleSearchPanel}
            style={styles.headerIconButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.headerIconText, isSearchOpen ? styles.headerIconTextActive : null]}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={styles.headerSaveButton}>
            <Text style={styles.headerSaveText}>☑</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [handleSave, isSearchOpen, navigation, toggleSearchPanel]);

  // 当光标/键盘高度变化时，尝试将光标滚动到可见区域（仅在非选择态）
  // 当光标/键盘高度变化时，尝试将光标滚动到可见区域（仅在非选择态）
  // 关键：只在“需要时”对齐（例如用户点击/移动光标后），不要在用户滚动页面期间持续对齐，
  // 否则会出现：用户在位置 a 处点出光标 -> 滚动到别处 b -> 再点击 b，视图却跳回 a（旧 caretY 导致）。
  useEffect(() => {
    if (!isEditing || keyboardHeight <= 0) return;
    if (selection.start !== selection.end) return;

    const now = Date.now();
    // 选择刚结束后的短时间内抑制自动对齐，避免视图“跳回”旧光标位置
    if (now < suppressAlignUntilRef.current) return;

    // 如果用户刚刚手动滚动过（尤其是快速甩动+惯性滚动后立刻点击），抑制自动对齐
    if (now - lastUserScrollAtRef.current < 1200) return;

    // 只有在明确标记“需要对齐到当前光标”的情况下才执行。
    // 该标记会在 selection 变化（点击/移动光标）时置为 true，并在对齐后清掉。
    if (!pendingAlignToCaretRef.current) return;

    // 当前有效的插入点 Y（非选择态时等于 end）
    const activeCaretY = caretYEnd;

    InteractionManager.runAfterInteractions(() => {
      const paddingTop = 40; // from styles.scrollContent
      const paddingBottom = keyboardHeight > 0 ? keyboardHeight : 24;
      const scrollY = scrollYRef.current;
      const availableHeight = viewportH - keyboardHeight;
      const visibleTop = scrollY;
      const visibleBottom = scrollY + availableHeight;

      const caretAbsoluteY = activeCaretY + paddingTop;

      const topBound = visibleTop + 60; // 顶部缓冲区
      const bottomBound = visibleBottom - 60; // 底部缓冲区

      let targetY = scrollY;
      if (caretAbsoluteY > bottomBound) {
        targetY = caretAbsoluteY - availableHeight / 2; // 滚动到屏幕中间
      } else if (caretAbsoluteY < topBound) {
        targetY = caretAbsoluteY - 80; // 留出更多顶部空间
      }

      // clamp 到内容边界
      const maxY = Math.max(0, paddingTop + contentH + paddingBottom - viewportH);
      const finalY = Math.min(Math.max(0, targetY), maxY);
      if (Math.abs(finalY - scrollY) > 1) {
        scrollIsAutoRef.current = true;
        scrollRef.current?.scrollTo({ y: finalY, animated: true });
        // 给一个短暂窗口，让 scrollTo 触发的 onScroll 不要被当成“用户滚动”
        setTimeout(() => {
          scrollIsAutoRef.current = false;
        }, 250);
      }

      // 对齐完成，清掉 pending 标记，避免后续 caretY 的异步更新触发“跳回旧位置”
      pendingAlignToCaretRef.current = false;
    });
  }, [caretYEnd, keyboardHeight, isEditing, viewportH, selection, contentH]);

  const measureTextStart = useMemo(() => {
    let before = content.slice(0, selection.start);
    if (!before || before.endsWith('\n')) before += '\u200B';
    return before;
  }, [content, selection.start]);

  const measureTextEnd = useMemo(() => {
    let before = content.slice(0, selection.end);
    if (!before || before.endsWith('\n')) before += '\u200B';
    return before;
  }, [content, selection.end]);

  // 长文本选择时，拖动手柄至边缘时自动滚动（持续滚动：边缘粘滞 + 速度平滑）
  useEffect(() => {
    const stopAutoScroll = () => {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      autoScrollDirRef.current = 0;
    };

    // 条件：编辑中 + 键盘弹出 + 存在选择范围
    if (!isEditing || keyboardHeight <= 0 || selection.start === selection.end) {
      stopAutoScroll();
      return;
    }
    // 全选时不触发自动滚动，避免页面自动滑到底部
    if (selection.start === 0 && selection.end >= content.length) {
      stopAutoScroll();
      return;
    }

    const paddingTop = 40;
    const paddingBottom = keyboardHeight > 0 ? keyboardHeight : 24;
    const threshold = 120; // 边缘触发滚动区域更大，提升灵敏度
    const SUSTAIN_MS = 220; // 离开边缘后仍持续滚动的时间

    const scrollTick = () => {
      const now = Date.now();
      const availableHeight = viewportH - keyboardHeight;
      const currentScrollY = scrollYRef.current;
      const visibleTop = currentScrollY;
      const visibleBottom = currentScrollY + availableHeight;
      const maxY = Math.max(0, paddingTop + contentH + paddingBottom - viewportH);

      // 使用正在拖动的手柄对应的 Y 值
      const activeCaretY = activeHandleRef.current === 'start' ? caretYStart : caretYEnd;
      const caretAbsoluteY = activeCaretY + paddingTop;

      const prevDir = autoScrollDirRef.current;
      let direction = 0; // -1: up, 1: down
      let edgeTriggered = false;

      if (caretAbsoluteY > visibleBottom - threshold) {
        direction = 1;
        edgeTriggered = true;
      } else if (caretAbsoluteY < visibleTop + threshold) {
        direction = -1;
        edgeTriggered = true;
      } else if (prevDir !== 0 && now < sustainUntilRef.current) {
        // 边缘粘滞：即使暂时离开边缘，也保持之前方向一段时间
        direction = prevDir;
      }

      if (direction === 0) {
        stopAutoScroll();
        return;
      }

      // 计算速度（对目标速度做平滑，避免突变）；边缘触发时按距离计算，否则使用一个中等速度以维持滚动
      let ratio = 0.6; // sustain 时的默认比率
      if (edgeTriggered) {
        const distFromEdge =
          direction === 1
            ? Math.max(0, caretAbsoluteY - (visibleBottom - threshold))
            : Math.max(0, visibleTop + threshold - caretAbsoluteY);
        ratio = Math.min(1, distFromEdge / threshold);
        // 更新粘滞持续时间
        sustainUntilRef.current = now + SUSTAIN_MS;
      }

      const targetSpeed = 2 + ratio * 14; // 2-16 px/frame
      if (prevDir !== direction) speedRef.current = 2; // 方向变化时重置
      speedRef.current += (targetSpeed - speedRef.current) * 0.35; // 平滑逼近
      const speed = Math.max(2, Math.min(16, speedRef.current));

      // 边界保护：到顶/到底停止
      if (direction === -1 && currentScrollY <= 0) {
        stopAutoScroll();
        return;
      }
      if (direction === 1 && currentScrollY >= maxY) {
        stopAutoScroll();
        return;
      }

      autoScrollDirRef.current = direction;

      const nextY = Math.max(0, Math.min(maxY, currentScrollY + speed * direction));
      if (Math.abs(nextY - currentScrollY) > 0.5) {
        scrollRef.current?.scrollTo({ y: nextY, animated: false });
      }

      autoScrollRafRef.current = requestAnimationFrame(scrollTick);
    };

    scrollTick();
    return stopAutoScroll;
  }, [selection, caretYStart, caretYEnd, isEditing, keyboardHeight, viewportH, contentH, content]);

  const searchTranslateY = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 0],
  });
  const searchOpacity = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const showNoResult = isSearchOpen && searchQuery && matches.length === 0;

  const showUndo = !!undoRef.current;

  const clearUndo = useCallback(() => {
    undoRef.current = null;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  return (
    <KeyboardAvoidingView style={styles.container}>
      {/* 悬浮在顶部的元信息条 */}
      <View pointerEvents="none" style={styles.metaBar}>
        <Text style={styles.metaText}>{formattedMeta}</Text>
      </View>

      {/* 搜索/替换面板 */}
      {(isSearchOpen || searchAnim.__getValue?.() > 0) && (
        <Animated.View
          style={[
            styles.searchPanel,
            {
              opacity: searchOpacity,
              transform: [{ translateY: searchTranslateY }],
            },
          ]}
          pointerEvents={isSearchOpen ? 'auto' : 'none'}
        >
          <View style={styles.searchRow}>
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setActiveMatchIndex(0);
              }}
              placeholder="搜索"
              placeholderTextColor="rgba(255,255,255,0.75)"
              style={styles.searchInput}
              returnKeyType="search"
              blurOnSubmit={false}
              onSubmitEditing={() => goNext()}
              onKeyPress={(e) => {
                const k = e?.nativeEvent?.key;
                if (k === 'Enter') {
                  // RN 没法稳定区分 Shift+Enter：尽量兼容 Enter
                  goNext();
                }
              }}
            />

            <View style={styles.counterWrap}>
              {showNoResult ? (
                <Text style={styles.counterText}>未找到</Text>
              ) : (
                <Text style={styles.counterText}>
                  {matches.length ? `${activeMatchIndex + 1}/${matches.length}` : '0/0'}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={goPrev}
              style={[styles.searchBtn, !matches.length && styles.searchBtnDisabled]}
              disabled={!matches.length}
              activeOpacity={0.7}
            >
              <Text style={styles.searchBtnText}>上一个</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={goNext}
              style={[styles.searchBtn, !matches.length && styles.searchBtnDisabled]}
              disabled={!matches.length}
              activeOpacity={0.7}
            >
              <Text style={styles.searchBtnText}>下一个</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsReplaceOpen((v) => !v)}
              style={styles.searchBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.searchBtnText}>替换</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCaseSensitive((v) => !v)}
              style={[styles.searchBtn, caseSensitive && styles.searchBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.searchBtnText}>Aa</Text>
            </TouchableOpacity>

            {showUndo && (
              <TouchableOpacity onPress={doUndo} style={[styles.searchBtn, styles.undoBtn]} activeOpacity={0.85}>
                <Text style={styles.searchBtnText}>撤销</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={closeSearchPanel} style={styles.searchCloseBtn} activeOpacity={0.7}>
              <Text style={styles.searchBtnText}>关闭</Text>
            </TouchableOpacity>
          </View>

          {/* 选项收纳到第一行，节省空间 */}

          {isReplaceOpen && (
            <View style={styles.replaceArea}>
              <View style={styles.replaceRow}>
                <Text style={styles.replaceLabel}>替换为：</Text>
                <TextInput
                  ref={replaceInputRef}
                  value={replaceQuery}
                  onChangeText={setReplaceQuery}
                  placeholder="替换文本"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  style={styles.replaceInput}
                  returnKeyType="done"
                />
              </View>
              <View style={styles.replaceBtnRow}>
                <TouchableOpacity
                  onPress={doReplaceCurrent}
                  style={[styles.replaceBtn, (!matches.length || !searchQuery) && styles.searchBtnDisabled]}
                  disabled={!matches.length || !searchQuery}
                  activeOpacity={0.7}
                >
                  <Text style={styles.searchBtnText}>替换当前</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={doReplaceAll}
                  style={[styles.replaceBtn, (!searchQuery || !matches.length) && styles.searchBtnDisabled]}
                  disabled={!searchQuery || !matches.length}
                  activeOpacity={0.7}
                >
                  <Text style={styles.searchBtnText}>全部替换</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={true}
        decelerationRate="normal" // 启用惯性滚动
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
          // 记录用户主动滚动时间，用于抑制“自动对齐光标”导致的回跳。
          // 注意：scrollTo 触发的 onScroll 在 RN 里也会进来，所以需要用标记排除。
          if (!scrollIsAutoRef.current) {
            lastUserScrollAtRef.current = Date.now();
          }
        }}
        onScrollBeginDrag={() => {
          // 用户开始拖动（包含惯性快速滑动的场景）
          lastUserScrollAtRef.current = Date.now();
        }}
        onMomentumScrollBegin={() => {
          // 惯性滚动开始（快速甩动时更可靠）
          lastUserScrollAtRef.current = Date.now();
        }}
        onMomentumScrollEnd={() => {
          // 惯性滚动结束：把时间戳也更新为结束时刻，确保“刚滚完就点 b”也能被抑制
          lastUserScrollAtRef.current = Date.now();
        }}
        scrollEventThrottle={16}
      >
        {/* 高亮覆盖层：用于“编辑态也实时高亮”。
            做法：覆盖层渲染带背景的高亮文本；TextInput 文字设为透明，仅保留光标/选择与输入能力。
            注意：如果未开启搜索或没有匹配，则不启用透明模式，避免影响正常阅读。 */}
        {isSearchOpen && highlightParts && matches.length > 0 && (
          <View style={[styles.highlightOverlay, { minHeight: contentH }]} pointerEvents="none">
            <Text style={styles.overlayText}>
              {highlightParts.map((p) => {
                if (p.type === 'text') {
                  return (
                    <Text key={p.key} style={styles.overlayText}>
                      {p.text}
                    </Text>
                  );
                }
                return (
                  <Text key={p.key} style={[styles.overlayText, styles.matchHighlight, p.isActive ? styles.matchActive : null]}>
                    {p.text}
                  </Text>
                );
              })}
            </Text>
          </View>
        )}

        <TextInput
          ref={contentInputRef}
          placeholder={isEditing ? '请输入内容~(˶╹ꇴ╹˶)~' : content || '请输入内容~(˶╹ꇴ╹˶)~'}
          value={content}
          onChangeText={setContent}
          multiline
          scrollEnabled={false} // 禁用内滚，由外部 ScrollView 控制
          style={[
            styles.contentInput,
            isSearchOpen && searchQuery && matches.length > 0 ? styles.contentInputTransparent : null,
            isSearchOpen && searchQuery && matches.length > 0 ? styles.contentInputLowOpacity : null,
          ]}
          textAlignVertical="top"
          placeholderTextColor="#bdbdbd"
          underlineColorAndroid="transparent"
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          onSelectionChange={(e) => {
            const nextSel = e.nativeEvent.selection;
            const last = lastSelectionRef.current;

            // 光标/选择被用户改变（点击/拖动/键盘移动）时，下一次允许对齐到最新光标位置
            pendingAlignToCaretRef.current = true;

            let handle = activeHandleRef.current;
            if (nextSel.start !== last.start && nextSel.end === last.end) {
              handle = 'start';
            } else if (nextSel.end !== last.end && nextSel.start === last.start) {
              handle = 'end';
            } else if (nextSel.start !== last.start && nextSel.end !== last.end) {
              // 同时变化时，取变化幅度更大的那个作为活动手柄
              const dStart = Math.abs(nextSel.start - last.start);
              const dEnd = Math.abs(nextSel.end - last.end);
              handle = dEnd >= dStart ? 'end' : 'start';
            }
            activeHandleRef.current = handle;

            // 选择态切换检测：从“有范围”到“单点”（选择结束）时，短暂抑制插入点对齐，避免跳回旧位置
            const wasSelecting = selectingRef.current;
            const _isSelecting = nextSel.start !== nextSel.end;
            if (wasSelecting && !_isSelecting) {
              suppressAlignUntilRef.current = Date.now() + 600; // 抑制 600ms
            }
            selectingRef.current = _isSelecting;

            lastSelectionRef.current = nextSel;
            setSelection(nextSel);

            // 搜索打开时，如果用户把光标移动到某个匹配附近，尝试同步当前高亮索引（不打断编辑）
            if (isSearchOpen && matches.length) {
              const pos = nextSel.end;
              const idx = matches.findIndex((m) => pos >= m.start && pos <= m.end);
              if (idx !== -1 && idx !== activeMatchIndex) setActiveMatchIndex(idx);
            }
          }}
          onContentSizeChange={(e) => setContentH(e.nativeEvent.contentSize?.height || 0)}
          onLayout={(e) => setInputWidth(e.nativeEvent.layout.width)}
        />

        {/* 用于测量光标高度的隐藏视图（不使用 minHeight，以免测量失真） */}
        <View style={styles.measureWrapper} pointerEvents="none">
          <Text style={[styles.textMetrics, { width: inputWidth }]} onLayout={(e) => setCaretYStart(e.nativeEvent.layout.height)}>
            {measureTextStart}
          </Text>
          <Text style={[styles.textMetrics, { width: inputWidth }]} onLayout={(e) => setCaretYEnd(e.nativeEvent.layout.height)}>
            {measureTextEnd}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 15,
    paddingTop: 40, // 为悬浮条留出空间
    paddingBottom: 24,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  headerSaveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerSaveText: {
    fontSize: 24,
    color: '#f39ab5',
    fontWeight: '600',
  },
  headerIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 2,
  },
  headerIconText: {
    fontSize: 20,
    color: '#b37b8e',
  },
  headerIconTextActive: {
    color: '#f39ab5',
  },
  metaBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#fffafc',
    zIndex: 10,
  },
  metaText: {
    fontSize: 13,
    color: '#b37b8e',
    textAlign: 'center',
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#8f6575',
    width: '100%',
    minHeight: Dimensions.get('window').height * 0.8, // 确保初始可点击区域足够大
  },
  // 用于隐藏测量的文本样式：必须与 TextInput 的字体和行高一致，但不能包含 minHeight
  textMetrics: {
    fontSize: 16,
    lineHeight: 24,
    color: '#8f6575',
    width: '100%',
  },
  measureWrapper: {
    position: 'absolute',
    top: 0,
    left: -9999, // 移出屏幕外
    opacity: 0,
  },

  // 搜索面板
  searchPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 6,
    zIndex: 50,
    backgroundColor: 'rgba(143, 101, 117, 0.75)',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchInput: {
    minWidth: 140,
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
  },
  counterWrap: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  counterText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
  },
  searchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  replaceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginRight: 8,
  },
  searchBtnDisabled: {
    opacity: 0.35,
  },
  searchCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // searchOptionsRow / optionChip / undoChip 已收纳进第一行按钮区，为节省空间保留样式但不再使用
  searchOptionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  optionChipActive: {
    backgroundColor: 'rgba(243,154,181,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  optionChipText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: '#fff',
  },
  undoChip: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(80, 200, 120, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  undoChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  searchBtnActive: {
    backgroundColor: 'rgba(243,154,181,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  undoBtn: {
    backgroundColor: 'rgba(80, 200, 120, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  replaceArea: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  replaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replaceLabel: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
  },
  replaceInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
  },
  replaceBtnRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  // 高亮覆盖层（仅浏览态）
  highlightOverlay: {
    position: 'absolute',
    left: 15,
    right: 15,
    top: 40,
    zIndex: 5,
  },
  overlayText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#8f6575',
  },
  matchHighlight: {
    backgroundColor: 'rgba(255, 235, 59, 0.65)',
    color: '#8f6575',
  },
  matchActive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.95)',
  },
  contentInputTransparent: {
    color: 'transparent',
    // Android 上仅设置 color 可能仍会隐约绘制字形（抗锯齿/阴影导致“重影”）。
    // 同时把 textShadow 置空并把 textShadowColor 设为透明，进一步消除残影。
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  contentInputLowOpacity: {
    // 荣耀/部分 Android 机型上，透明文字仍可能出现残影；将整体 opacity 降到极低可以彻底避免字形叠加。
    // 不用 0，避免光标/选择手柄在某些系统上也被隐藏。
    opacity: 0.02,
  },
});