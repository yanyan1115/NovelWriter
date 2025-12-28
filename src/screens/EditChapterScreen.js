import React, { useState, useEffect, useMemo, useLayoutEffect, useCallback, useRef } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  Keyboard,
  Dimensions,
  InteractionManager,
} from 'react-native'
import { loadNovels, saveNovels, getChapterContent, saveChapterContent } from '../storage/storage'

export default function EditChapter({ route, navigation }) {
  const { novelId, volumeId, chapterId } = route.params || {}
  const onSaveRef = useRef(null)
  useEffect(() => {
    const fn = route?.params?.onSave
    if (typeof fn === 'function') {
      onSaveRef.current = fn
      try { navigation.setParams({ onSave: null }) } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [lastEditedAt, setLastEditedAt] = useState(new Date())
  const [isEditing, setIsEditing] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [caretYStart, setCaretYStart] = useState(0)
  const [caretYEnd, setCaretYEnd] = useState(0)
  const [inputWidth, setInputWidth] = useState(0)
  const [viewportH, setViewportH] = useState(Dimensions.get('window').height)
  const [contentH, setContentH] = useState(0)
  const [isSelecting, setIsSelecting] = useState(false)
  const scrollYRef = useRef(0)

  const scrollRef = useRef(null)
  const contentInputRef = useRef(null)
  const autoScrollRafRef = useRef(null)
  const lastSelectionRef = useRef({ start: 0, end: 0 })
  const activeHandleRef = useRef('end') // 'start' | 'end'
  const autoScrollDirRef = useRef(0) // -1 | 0 | 1（持续方向）
  const sustainUntilRef = useRef(0) // 边缘粘滞持续到的时间戳（ms）
  const speedRef = useRef(0) // 当前滚动速度（px/frame）
  const selectingRef = useRef(false)
  const suppressAlignUntilRef = useRef(0) // 选择结束后暂时禁止插入点对齐
  const touchingRef = useRef(false) // 是否在手指按下/拖动中
  const lastTouchYRef = useRef(null) // 最近一次触摸的屏幕绝对 Y（pageY）
  const lastTouchAtRef = useRef(0) // 最近一次触摸时间戳
  const lastSelSetAtRef = useRef(0) // 限流 selection 状态更新
  const caretYStartRef = useRef(0)
  const caretYEndRef = useRef(0)
  const viewportTopYRef = useRef(0) // ScrollView 可视区域在屏幕上的绝对 top

  useEffect(() => {
    let cancelled = false

    const loadChapter = async () => {
      if (!chapterId) return

      // 先从轻量的正文缓存读取，保证首屏更快
      try {
        const text = await getChapterContent(chapterId)
        if (!cancelled && typeof text === 'string') setContent(text)
      } catch (_) {}

      // 再读取 meta（title 等）。旧版本可能把 content 也塞在 novels 里，这里只做兜底 & 迁移
      const novels = await loadNovels()
      const novel = novels.find(n => n.id === novelId)
      const volume = novel?.volumes.find(v => v.id === volumeId)
      const chapter = volume?.chapters.find(c => c.id === chapterId)
      if (!chapter) return

      if (!cancelled) setTitle(chapter.title ?? '')

      // 若缓存里没有正文，则用旧字段兜底，并写回缓存
      // 注意：这里不能用闭包里的 content（它可能是初始值 ''），否则会覆盖 getChapterContent 刚加载到的新正文
      if (!cancelled) {
        setContent(prev => {
          if (prev && prev.length > 0) return prev
          if (typeof chapter.content === 'string' && chapter.content.length > 0) {
            try { saveChapterContent(chapterId, chapter.content) } catch (_) {}
            return chapter.content
          }
          return prev
        })
      }
    }

    loadChapter()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, novelId, volumeId])

  useEffect(() => {
    setLastEditedAt(new Date())
  }, [title, content])

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (e) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0)
      setIsEditing(true)
      // 键盘变化会影响可视高度与 viewport 的屏幕位置，稍后测量一次
      requestAnimationFrame(measureViewportTop)
    }
    const onHide = () => {
      setKeyboardHeight(0)
      setIsEditing(false)
      contentInputRef.current?.blur()
      requestAnimationFrame(measureViewportTop)
    }

    const s1 = Keyboard.addListener(showEvt, onShow)
    const s2 = Keyboard.addListener(hideEvt, onHide)
    return () => { s1.remove(); s2.remove() }
  }, [])

  const measureViewportTop = useCallback(() => {
    // 读取 ScrollView 在屏幕中的 y 坐标，用于把 pageY 转换为视口内局部坐标
    scrollRef.current?.measureInWindow?.((x, y, w, h) => {
      if (typeof y === 'number') viewportTopYRef.current = y
    })
  }, [])

  const formattedMeta = useMemo(() => {
    const d = lastEditedAt instanceof Date ? lastEditedAt : new Date()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const contentStr = typeof content === 'string' ? content : ''
    const count = contentStr.trim().length
    return `今天 ${hours}:${minutes}  共 ${count} 字`
  }, [content, lastEditedAt])

  const handleSave = useCallback(async () => {
    const t = (title || '').trim()
    const ct = (content || '').trim()
    if (!t || !ct) {
      Alert.alert('提示', '章节标题和内容不能为空')
      return
    }

    const novels = await loadNovels()
    let newChapterId = chapterId

    const updatedNovels = novels.map(novel => {
      if (novel.id !== novelId) return novel
      const updatedVolumes = novel.volumes.map(vol => {
        if (vol.id !== volumeId) return vol
        if (chapterId) {
          const updatedChapters = vol.chapters.map(c =>
            c.id === chapterId ? { ...c, title: t, updatedAt: new Date().toISOString() } : c
          )
          return { ...vol, chapters: updatedChapters }
        } else {
          newChapterId = Date.now().toString()
          const newChapter = {
            id: newChapterId,
            title: t,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          return { ...vol, chapters: [...vol.chapters, newChapter] }
        }
      })
      return { ...novel, volumes: updatedVolumes }
    })

    try {
      await saveChapterContent(newChapterId || chapterId, ct)
    } catch (e) {
      console.warn('写入章节正文失败', e)
    }

    await saveNovels(updatedNovels)

    const fn = onSaveRef.current
    if (typeof fn === 'function') fn()

    navigation.goBack()
  }, [chapterId, content, navigation, novelId, title, volumeId])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: chapterId ? '编辑章节' : '新建章节',
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSave} style={styles.headerSaveButton}>
            <Text style={styles.headerSaveText}>☑</Text>
          </TouchableOpacity>
        </View>
      ),
    })
  }, [handleSave, navigation, chapterId])

  // 当光标/键盘高度变化时，尝试将光标滚动到可见区域（仅在非选择态）
  useEffect(() => {
    if (!isEditing || keyboardHeight <= 0) return
    if (selection.start !== selection.end) return
    if (Date.now() < suppressAlignUntilRef.current) return

    const activeCaretY = caretYEnd

    InteractionManager.runAfterInteractions(() => {
      const paddingTop = 80 // Title height + meta height
      const scrollY = scrollYRef.current
      const availableHeight = viewportH - keyboardHeight
      const visibleTop = scrollY
      const visibleBottom = scrollY + availableHeight

      const caretAbsoluteY = activeCaretY + paddingTop

      const topBound = visibleTop + 60
      const bottomBound = visibleBottom - 60

      let targetY = scrollY
      if (caretAbsoluteY > bottomBound) {
        targetY = caretAbsoluteY - availableHeight / 2
      } else if (caretAbsoluteY < topBound) {
        targetY = caretAbsoluteY - 80
      }

      const paddingBottom = keyboardHeight > 0 ? keyboardHeight : 24
      const maxY = Math.max(0, paddingTop + contentH + paddingBottom - viewportH)
      const finalY = Math.min(Math.max(0, targetY), maxY)
      if (Math.abs(finalY - scrollY) > 1) {
        scrollRef.current?.scrollTo({ y: finalY, animated: true })
        scrollYRef.current = finalY
      }
    })
  }, [caretYEnd, keyboardHeight, isEditing, viewportH, selection, contentH])

  const measureTextStart = useMemo(() => {
    let before = content.slice(0, selection.start)
    if (!before || before.endsWith('\n')) before += '\u200B'
    return before
  }, [content, selection.start])

  const measureTextEnd = useMemo(() => {
    let before = content.slice(0, selection.end)
    if (!before || before.endsWith('\n')) before += '\u200B'
    return before
  }, [content, selection.end])

  // 长文本选择：混合策略（触摸坐标优先 + 插入点坐标回退），并以 ScrollView 视口为基准判定边缘
  useEffect(() => {
    const stopAutoScroll = () => {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current)
        autoScrollRafRef.current = null
      }
      autoScrollDirRef.current = 0
    }

    if (!isEditing || keyboardHeight <= 0) {
      stopAutoScroll()
      return
    }

    const threshold = 120 // 边缘触发区域高度（增大一些会更灵敏）
    const SUSTAIN_MS = 220
    const paddingTop = 80

    const scrollTick = () => {
      const now = Date.now()

      // 必须处于选择态（正在拉伸选择范围），否则不自动滚动
      if (!selectingRef.current) {
        stopAutoScroll()
        return
      }

      const currentScrollY = scrollYRef.current
      const availableHeight = viewportH - keyboardHeight
      const topEdge = threshold
      const bottomEdge = availableHeight - threshold

      // 选择触摸坐标优先；若触摸事件不可得（例如拖拽原生选择手柄），回退到插入点屏幕坐标
      const touchFresh = touchingRef.current && (now - lastTouchAtRef.current) < 120
      let yLocal
      if (touchFresh && typeof lastTouchYRef.current === 'number') {
        // 将 pageY 转为视口内局部坐标
        yLocal = lastTouchYRef.current - viewportTopYRef.current
      } else {
        const activeCaretYLocal = activeHandleRef.current === 'start' ? caretYStartRef.current : caretYEndRef.current
        const caretAbsoluteY = activeCaretYLocal + paddingTop
        yLocal = caretAbsoluteY - currentScrollY
      }

      const paddingBottom = keyboardHeight > 0 ? keyboardHeight : 24
      const maxY = Math.max(0, paddingTop + contentH + paddingBottom - viewportH)

      const prevDir = autoScrollDirRef.current
      let direction = 0
      let edgeTriggered = false

      if (yLocal > bottomEdge) {
        direction = 1
        edgeTriggered = true
      } else if (yLocal < topEdge) {
        direction = -1
        edgeTriggered = true
      } else if (prevDir !== 0 && now < sustainUntilRef.current) {
        direction = prevDir
      }

      if (direction === 0) {
        // 未触发边缘：停止循环，等下一次 selection/caret 变化再重新触发（更省电，也避免无意义占用导致卡顿）
        stopAutoScroll()
        return
      }

      // 边缘距离 -> 速度映射（更平滑、更稳定，避免卡顿）
      const distFromEdge = direction === 1 ? Math.max(0, yLocal - bottomEdge) : Math.max(0, topEdge - yLocal)
      const ratio = Math.min(1, distFromEdge / threshold)
      const targetSpeed = 2 + ratio * 14 // 2-16 px/frame（更接近 LongTextEdit 的体验）
      if (prevDir !== direction) speedRef.current = 2
      speedRef.current += (targetSpeed - speedRef.current) * 0.35
      const speed = Math.max(2, Math.min(16, speedRef.current))

      if (edgeTriggered) sustainUntilRef.current = now + SUSTAIN_MS

      if ((direction === -1 && currentScrollY <= 0) || (direction === 1 && currentScrollY >= maxY)) {
        stopAutoScroll()
        return
      }

      autoScrollDirRef.current = direction

      const nextY = Math.max(0, Math.min(maxY, currentScrollY + speed * direction))
      if (Math.abs(nextY - currentScrollY) > 0.5) {
        scrollRef.current?.scrollTo({ y: nextY, animated: false })
        // 主动维护 scrollY，避免依赖 onScroll 的异步回传造成滞后
        scrollYRef.current = nextY
      }

      autoScrollRafRef.current = requestAnimationFrame(scrollTick)
    }

    if (!autoScrollRafRef.current) {
      autoScrollRafRef.current = requestAnimationFrame(scrollTick)
    }

    return stopAutoScroll
  }, [isEditing, keyboardHeight, viewportH, contentH])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={true}
        overScrollMode={Platform.OS === 'android' ? 'never' : 'auto'}
        decelerationRate="normal"
        onLayout={e => { setViewportH(e.nativeEvent.layout.height); requestAnimationFrame(measureViewportTop) }}
        onScroll={e => {
          scrollYRef.current = e.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={16}
      >
        <TextInput
          placeholder="标题"
          value={title}
          onChangeText={setTitle}
          style={styles.titleInput}
          placeholderTextColor="#b0b0b0"
          returnKeyType="done"
        />

        <Text style={styles.metaText}>{formattedMeta}</Text>

        <TextInput
          ref={contentInputRef}
          placeholder={isEditing ? "请输入正文..." : (content || "点击开始输入...")}
          value={content}
          onChangeText={setContent}
          multiline
          scrollEnabled={false}
          style={styles.contentInput}
          textAlignVertical="top"
          placeholderTextColor="#bdbdbd"
          underlineColorAndroid="transparent"
          onTouchStart={e => { touchingRef.current = true; lastTouchYRef.current = e.nativeEvent.pageY; lastTouchAtRef.current = Date.now() }}
          onTouchMove={e => { lastTouchYRef.current = e.nativeEvent.pageY; lastTouchAtRef.current = Date.now() }}
          onTouchEnd={() => { touchingRef.current = false; lastTouchYRef.current = null; lastTouchAtRef.current = 0 }}
          onTouchCancel={() => { touchingRef.current = false; lastTouchYRef.current = null; lastTouchAtRef.current = 0 }}

          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          onSelectionChange={e => {
            const nextSel = e.nativeEvent.selection
            const last = lastSelectionRef.current
            let handle = activeHandleRef.current
            if (nextSel.start !== last.start && nextSel.end === last.end) {
              handle = 'start'
            } else if (nextSel.end !== last.end && nextSel.start === last.start) {
              handle = 'end'
            } else if (nextSel.start !== last.start && nextSel.end !== last.end) {
              const dStart = Math.abs(nextSel.start - last.start)
              const dEnd = Math.abs(nextSel.end - last.end)
              handle = dEnd >= dStart ? 'end' : 'start'
            }
            activeHandleRef.current = handle

            const wasSelecting = selectingRef.current
            const isSelectingNow = nextSel.start !== nextSel.end
            if (wasSelecting && !isSelectingNow) {
              suppressAlignUntilRef.current = Date.now() + 600
            }
            selectingRef.current = isSelectingNow
            setIsSelecting(isSelectingNow)

            lastSelectionRef.current = nextSel

            // 限流 selection 的状态更新（只在需要测量或每 ~60ms 才触发一次渲染）
            const now = Date.now()
            if (!isSelectingNow || now - lastSelSetAtRef.current > 60) {
              lastSelSetAtRef.current = now
              setSelection(nextSel)
            }
          }}
          onContentSizeChange={e => setContentH(e.nativeEvent.contentSize?.height || 0)}
          onLayout={e => setInputWidth(e.nativeEvent.layout.width)}
        />

        <View style={styles.measureWrapper} pointerEvents="none">
          <Text
            style={[styles.textMetrics, { width: inputWidth }]}
            onLayout={e => {
              const h = e.nativeEvent.layout.height
              if (Math.abs(h - caretYStartRef.current) > 1) {
                caretYStartRef.current = h
                setCaretYStart(h)
              }
            }}
          >
            {measureTextStart}
          </Text>
          <Text
            style={[styles.textMetrics, { width: inputWidth }]}
            onLayout={e => {
              const h = e.nativeEvent.layout.height
              if (Math.abs(h - caretYEndRef.current) > 1) {
                caretYEndRef.current = h
                setCaretYEnd(h)
              }
            }}
          >
            {measureTextEnd}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdfd',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
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
    color: '#8e8ee0',
    fontWeight: '600',
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
    paddingHorizontal: 2, // 微调对齐
  },
  metaText: {
    fontSize: 13,
    color: '#8f8f8f',
    marginBottom: 12,
    paddingHorizontal: 2, // 微调对齐
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1f1f1f',
    width: '100%',
    minHeight: Dimensions.get('window').height * 0.8,
    paddingHorizontal: 2, // 微调对齐
  },
  textMetrics: {
    fontSize: 16,
    lineHeight: 24,
    color: 'transparent',
  },
  measureWrapper: {
    position: 'absolute',
    top: 80, // 与正文内容区的 padding/margin 保持一致
    left: 17, // paddingHorizontal + contentInput paddingHorizontal
    opacity: 0,
    zIndex: -1,
  },
})