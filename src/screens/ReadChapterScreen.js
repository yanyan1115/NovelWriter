import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  StatusBar,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { loadNovels, getChapterContent, saveChapterContent } from '../storage/storage'
import SettingsDrawer from '../components/SettingsDrawer'
import ChapterMenu from '../components/ChapterMenu'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function ReadChapterScreen({ route, navigation }) {
  const { novelId, volumeId, chapterId } = route.params

  const [novel, setNovel] = useState(null)
  const [chapter, setChapter] = useState(null)
  const [chapterContent, setChapterContent] = useState('')
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState(null)
  const [darkMode, setDarkMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const scrollRef = useRef()
  const fadeAnim = useRef(new Animated.Value(1)).current
  const hideTimer = useRef(null)

  // 自动隐藏控制栏
  const autoHideControls = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!showSettings && !showMenu) {
        setShowControls(false)
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start()
      }
    }, 3000)
  }

  // 显示控制栏
  const showControlsWithFade = () => {
    setShowControls(true)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
    autoHideControls()
  }

  useEffect(() => {
    let cancelled = false

    const fetch = async () => {
      const novels = await loadNovels()
      const novel = novels.find(n => n.id === novelId)
      const volume = novel?.volumes.find(v => v.id === volumeId)
      const chapterList = volume?.chapters || []
      const currentIndex = chapterList.findIndex(c => c.id === chapterId)
      const ch = chapterList[currentIndex]

      if (!cancelled) {
        setNovel(novel)
        setChapter(ch)
        setChapterIndex(currentIndex)
        setChapterContent(typeof ch?.content === 'string' ? ch.content : '')
      }

      // 设置项读取可以并行，避免阻塞首屏
      const [savedSize, savedDark, savedFont, savedFullscreen] = await Promise.all([
        AsyncStorage.getItem('fontSize'),
        AsyncStorage.getItem('darkMode'),
        AsyncStorage.getItem('fontFamily'),
        AsyncStorage.getItem('fullscreenMode'),
      ])

      if (!cancelled) {
        if (savedSize) setFontSize(Number(savedSize))
        if (savedDark) setDarkMode(savedDark === 'true')
        if (savedFont) setFontFamily(savedFont)
        if (savedFullscreen) setIsFullscreen(savedFullscreen === 'true')
      }

      // 正文优先走独立存储（更快/更稳定，避免 novels 体积过大导致解析变慢）
      try {
        const text = await getChapterContent(chapterId)
        if (!cancelled && typeof text === 'string') {
          setChapterContent(text)
          // 回填缓存，避免下次仍从大对象读取（兼容旧数据）
          try { await saveChapterContent(chapterId, text) } catch (_) {}
        }
      } catch (_) {}
    }

    fetch()
    autoHideControls()

    return () => {
      cancelled = true
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [novelId, volumeId, chapterId])

  const updateFontSize = async (size) => {
    setFontSize(size)
    await AsyncStorage.setItem('fontSize', size.toString())
  }

  const updateFontFamily = async (family) => {
    setFontFamily(family)
    if (family) {
      await AsyncStorage.setItem('fontFamily', family)
    } else {
      await AsyncStorage.removeItem('fontFamily')
    }
  }

  const toggleDarkMode = async () => {
    const newValue = !darkMode
    setDarkMode(newValue)
    await AsyncStorage.setItem('darkMode', newValue.toString())
  }

  const toggleFullscreen = async () => {
    const newValue = !isFullscreen
    setIsFullscreen(newValue)
    await AsyncStorage.setItem('fullscreenMode', newValue.toString())
  }

  const handleSelectChapter = (volumeId, chapterId) => {
    setShowMenu(false)
    navigation.replace('ReadChapter', { novelId, volumeId, chapterId })
  }

  const goToChapter = (indexOffset) => {
    const volume = novel?.volumes.find(v => v.id === volumeId)
    const chapterList = volume?.chapters || []
    const newIndex = chapterIndex + indexOffset
    if (newIndex >= 0 && newIndex < chapterList.length) {
      const newChapter = chapterList[newIndex]
      navigation.replace('ReadChapter', { novelId, volumeId, chapterId: newChapter.id })
    }
  }

  const handleTapScreen = () => {
    console.log('Screen tapped, showControls:', showControls) // 调试日志
    if (showControls) {
      // 隐藏控制栏
      setShowControls(false)
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start()
      // 清除自动隐藏定时器
      if (hideTimer.current) clearTimeout(hideTimer.current)
    } else {
      // 显示控制栏
      showControlsWithFade()
    }
  }

  useEffect(() => {
    const headerBackground = darkMode ? '#1a1a1a' : '#fffafc'
    const headerTint = darkMode ? '#f5f5f5' : '#8e8ee0'

    navigation.setOptions({
      headerStyle: {
        backgroundColor: headerBackground,
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerTintColor: headerTint,
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '300',
        fontFamily: 'Song',
        color: headerTint,
      },
    })
  }, [navigation, darkMode])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // 只有水平滑动距离大于20才处理翻页
        return Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
      },
      onPanResponderGrant: () => {
        // 记录触摸开始，用于判断是否为点击
      },
      onPanResponderRelease: (_, gesture) => {
        // 判断是否为点击（移动距离很小）
        const isClick = Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5
        
        if (isClick) {
          // 点击屏幕切换控制栏
          handleTapScreen()
          return
        }
        
        // 左右滑动翻页
        if (Math.abs(gesture.dx) > 50 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          if (gesture.dx < -50) {
            goToChapter(1) // 左滑下一章
          } else if (gesture.dx > 50) {
            goToChapter(-1) // 右滑上一章
          }
        }
      }
    })
  ).current

  if (!chapter) return null

  const currentChapterList = novel?.volumes.find(v => v.id === volumeId)?.chapters || []
  const isFirstChapter = chapterIndex === 0
  const isLastChapter = chapterIndex === currentChapterList.length - 1

  const theme = {
    backgroundColor: darkMode ? '#1a1a1a' : '#fffafc',
    textColor: darkMode ? '#e0e0e0' : '#333333',
    titleColor: darkMode ? '#ffffff' : '#000000',
    borderColor: darkMode ? '#333333' : '#e0e0e0',
    controlBg: darkMode ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 250, 252, 0.95)',
    controlText: darkMode ? '#ffffff' : '#333333',
    buttonBg: darkMode ? '#333333' : '#fffafc',
    buttonText: darkMode ? '#ffffff' : '#333333',
    buttonBorder: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
    progressBg: darkMode ? '#333333' : '#fde2e4',
    progressFill: darkMode ? '#4C9EEB' : '#ffc2d1',
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar 
        barStyle={darkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.backgroundColor}
        hidden={isFullscreen}
      />
      
      <View style={styles.readerContainer} {...panResponder.panHandlers}>
        {/* 顶部控制栏 */}
        <Animated.View 
          style={[
            styles.topControls, 
            { backgroundColor: theme.controlBg, opacity: fadeAnim },
            !showControls && styles.hidden
          ]}
          pointerEvents={showControls ? 'auto' : 'none'}
        >
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[styles.controlButton, { 
              backgroundColor: theme.buttonBg,
              borderColor: theme.buttonBorder
            }]}
          >
            <Text style={[styles.controlText, { color: theme.buttonText }]}>← 返回</Text>
          </TouchableOpacity>
          
          <View style={styles.topRightControls}>
            <TouchableOpacity 
              onPress={() => setShowMenu(true)} 
              style={[styles.controlButton, { 
                backgroundColor: theme.buttonBg,
                borderColor: theme.buttonBorder
              }]}
            >
              <Text style={[styles.controlText, { color: theme.buttonText }]}>📖 目录</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setShowSettings(true)} 
              style={[styles.controlButton, { 
                backgroundColor: theme.buttonBg,
                borderColor: theme.buttonBorder
              }]}
            >
              <Text style={[styles.controlText, { color: theme.buttonText }]}>⚙️ 设置</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* 阅读区域 */}
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScroll={(e) => {
            const contentHeight = e.nativeEvent.contentSize.height
            const visibleHeight = e.nativeEvent.layoutMeasurement.height
            const offsetY = e.nativeEvent.contentOffset.y
            const totalScrollable = contentHeight - visibleHeight
            const percent = totalScrollable > 0 ? Math.min(Math.max(offsetY / totalScrollable, 0), 1) : 0
            setProgress(percent)
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleTapScreen}
            style={styles.contentTouchable}
          >
            <Text style={[styles.title, { 
              fontSize: fontSize + 4, 
              color: theme.titleColor,
              fontFamily: fontFamily || 'Song',
              marginTop: showControls ? 0 : 20
            }]}>
              {chapter.title}
            </Text>
            
            <View style={styles.chapterInfo}>
              <Text style={[styles.chapterMeta, { color: theme.textColor }]}>
                第 {chapterIndex + 1} 章 / 共 {currentChapterList.length} 章
              </Text>
              <Text style={[styles.chapterMeta, { color: theme.textColor }]}>
                字数: {chapterContent?.length || 0}
              </Text>
            </View>
            
            <Text style={[styles.content, { 
              fontSize, 
              color: theme.textColor,
              lineHeight: fontSize * 1.6,
              fontFamily: fontFamily || undefined,
              fontWeight: darkMode ? '300' : '400'
            }]}>
              {chapterContent}
            </Text>
            
            {/* 章节结束提示 */}
            <View style={styles.chapterEnd}>
              <Text style={[styles.endText, { color: theme.textColor }]}>
                —— 本章完 ——
              </Text>
              <View style={styles.endNavigation}>
                {!isFirstChapter && (
                  <TouchableOpacity 
                    style={[styles.endButton, { backgroundColor: theme.buttonBg }]}
                    onPress={() => goToChapter(-1)}
                  >
                    <Text style={[styles.endButtonText, { color: theme.buttonText }]}>
                      ← 上一章
                    </Text>
                  </TouchableOpacity>
                )}
                {!isLastChapter && (
                  <TouchableOpacity 
                    style={[styles.endButton, { backgroundColor: theme.buttonBg }]}
                    onPress={() => goToChapter(1)}
                  >
                    <Text style={[styles.endButtonText, { color: theme.buttonText }]}>
                      下一章 →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* 阅读进度条 */}
        <View style={[styles.progressBarContainer, { backgroundColor: theme.progressBg }]}>
          <View style={[
            styles.progressBarFill, 
            { 
              height: `${progress * 100}%`,
              width: '100%',
              backgroundColor: theme.progressFill,
              borderRadius: 3,
            }
          ]} />
          <Text style={[styles.progressPercent, { color: theme.textColor }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>

        {/* 底部控制栏 */}
        <Animated.View 
          style={[
            styles.bottomBar, 
            { 
              backgroundColor: theme.controlBg,
              borderTopColor: theme.borderColor,
              opacity: fadeAnim
            },
            !showControls && styles.hidden
          ]}
          pointerEvents={showControls ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={[styles.navButton, isFirstChapter && styles.disabledButton]}
            onPress={() => goToChapter(-1)}
            disabled={isFirstChapter}
          >
            <Text style={[
              styles.navText, 
              { color: isFirstChapter ? '#999' : theme.progressFill }
            ]}>
              ← 上一章
            </Text>
          </TouchableOpacity>
          
          <View style={styles.centerInfo}>
            <Text style={[styles.progressText, { color: theme.controlText }]}>
              {chapterIndex + 1} / {currentChapterList.length}
            </Text>
            <Text style={[styles.progressDetail, { color: theme.controlText }]}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.navButton, isLastChapter && styles.disabledButton]}
            onPress={() => goToChapter(1)}
            disabled={isLastChapter}
          >
            <Text style={[
              styles.navText, 
              { color: isLastChapter ? '#999' : theme.progressFill }
            ]}>
              下一章 →
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* 设置抽屉弹窗 */}
      {showSettings && (
        <SettingsDrawer
          fontSize={fontSize}
          fontFamily={fontFamily}
          darkMode={darkMode}
          fullscreen={isFullscreen}
          onFontSizeChange={updateFontSize}
          onFontFamilyChange={updateFontFamily}
          onDarkModeToggle={toggleDarkMode}
          onFullscreenToggle={toggleFullscreen}
          onClose={() => {
            setShowSettings(false)
            autoHideControls()
          }}
        />
      )}

      {/* 目录弹窗 */}
      {showMenu && (
        <ChapterMenu
          novel={novel}
          currentChapterId={chapterId}
          darkMode={darkMode}
          onSelect={handleSelectChapter}
          onClose={() => {
            setShowMenu(false)
            autoHideControls()
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  readerContainer: {
    flex: 1,
    position: 'relative',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  topRightControls: {
    flexDirection: 'row',
  },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    // 移除阴影效果，避免日间模式下的视觉残留
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  controlText: {
    fontSize: 14,
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  contentTouchable: {
    flex: 1,
    minHeight: SCREEN_HEIGHT - 200, // 确保内容区域足够大，可以接收点击
  },
  title: {
    marginBottom: 16,
    textAlign: 'left',
    paddingVertical: 8,
    fontWeight: '300',
    fontFamily: 'Song',
  },
  chapterInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  chapterMeta: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: '300',
  },
  content: {
    textAlign: 'justify',
    letterSpacing: 1,
    marginBottom: 40,
  },
  chapterEnd: {
    alignItems: 'center',
    marginTop: 40,
    paddingVertical: 20,
  },
  endText: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 20,
    fontWeight: '300',
  },
  endNavigation: {
    flexDirection: 'row',
    gap: 16,
  },
  endButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  endButtonText: {
    fontSize: 14,
    fontWeight: '300',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  navText: {
    fontSize: 14,
    fontWeight: '300',
  },
  centerInfo: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '300',
  },
  progressDetail: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  progressBarContainer: {
    position: 'absolute',
    right: 4,
    top: 50,
    bottom: 60,
    width: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressPercent: {
    position: 'absolute',
    right: 12,
    top: '50%',
    fontSize: 10,
    transform: [{ translateY: -6 }],
  },
  hidden: {
    pointerEvents: 'none',
  },
})