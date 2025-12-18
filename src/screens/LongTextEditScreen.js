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
} from 'react-native';

export default function LongTextEditScreen({ route, navigation }) {
    const { initialValue: initialContent = '', onSave } = route.params || {};
  // 解决 React Navigation 警告：路由参数含有函数（非可序列化）
  const onSaveRef = useRef(null);
  useEffect(() => {
    if (typeof onSave === 'function') {
      onSaveRef.current = onSave;
      // 将函数从路由参数中移除，避免持久化/恢复时报错
      try { navigation.setParams({ onSave: null }); } catch (e) {}
    }
  // 仅初始化一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [content, setContent] = useState(initialContent);
  const [lastEditedAt, setLastEditedAt] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false); // 编辑模式状态
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [caretYStart, setCaretYStart] = useState(0);
  const [caretYEnd, setCaretYEnd] = useState(0);
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
  const lastEdgeDirRef = useRef(0); // 最近一次处于边缘时的方向
  const sustainUntilRef = useRef(0); // 边缘粘滞持续到的时间戳（ms）
  const speedRef = useRef(0); // 当前滚动速度（px/frame）
  const lastNonSelectingSelectionRef = useRef({ start: 0, end: 0 });
  const selectingRef = useRef(false);
  const suppressAlignUntilRef = useRef(0); // 选择结束后暂时禁止插入点对齐

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
    return () => { s1.remove(); s2.remove(); };
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '编辑消息',
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSave} style={styles.headerSaveButton}>
            <Text style={styles.headerSaveText}>☑</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [handleSave, navigation]);

  // 当光标/键盘高度变化时，尝试将光标滚动到可见区域（仅在非选择态）
  useEffect(() => {
    if (!isEditing || keyboardHeight <= 0) return;
    if (selection.start !== selection.end) return;
    // 选择刚结束后的短时间内抑制自动对齐，避免视图“跳回”旧光标位置
    if (Date.now() < suppressAlignUntilRef.current) return;

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
        scrollRef.current?.scrollTo({ y: finalY, animated: true });
      }
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
        const distFromEdge = direction === 1
          ? Math.max(0, caretAbsoluteY - (visibleBottom - threshold))
          : Math.max(0, (visibleTop + threshold) - caretAbsoluteY);
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

  return (
    <KeyboardAvoidingView
      style={styles.container}

    >
      {/* 悬浮在顶部的元信息条 */}
      <View pointerEvents="none" style={styles.metaBar}>
        <Text style={styles.metaText}>{formattedMeta}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={true}
        decelerationRate="normal" // 启用惯性滚动
        onLayout={e => setViewportH(e.nativeEvent.layout.height)}
        onScroll={e => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >

            <TextInput
              ref={contentInputRef}
              placeholder={isEditing ? "请输入内容~(˶╹ꇴ╹˶)~" : (content || "请输入内容~(˶╹ꇴ╹˶)~")}
              value={content}
              onChangeText={setContent}
              multiline
              scrollEnabled={false} // 禁用内滚，由外部 ScrollView 控制
              style={styles.contentInput}
              textAlignVertical="top"
              placeholderTextColor="#bdbdbd"
              underlineColorAndroid="transparent"
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
              onSelectionChange={e => {
                const nextSel = e.nativeEvent.selection;
                const last = lastSelectionRef.current;
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
                const isSelecting = nextSel.start !== nextSel.end;
                if (wasSelecting && !isSelecting) {
                  suppressAlignUntilRef.current = Date.now() + 600; // 抑制 600ms
                }
                selectingRef.current = isSelecting;

                lastSelectionRef.current = nextSel;
                setSelection(nextSel);
              }}
              onContentSizeChange={e => setContentH(e.nativeEvent.contentSize?.height || 0)}
              onLayout={e => setInputWidth(e.nativeEvent.layout.width)}
            />

        {/* 用于测量光标高度的隐藏视图（不使用 minHeight，以免测量失真） */}
        <View style={styles.measureWrapper} pointerEvents="none">
          <Text
            style={[styles.textMetrics, { width: inputWidth }]}
            onLayout={e => setCaretYStart(e.nativeEvent.layout.height)}
          >
            {measureTextStart}
          </Text>
          <Text
            style={[styles.textMetrics, { width: inputWidth }]}
            onLayout={e => setCaretYEnd(e.nativeEvent.layout.height)}
          >
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
});