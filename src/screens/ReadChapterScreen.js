import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, PanResponder, StatusBar,
  Animated, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadNovelById, getChapterContent, saveChapterContent } from '../storage/storage';
import SettingsDrawer from '../components/SettingsDrawer';
import ChapterMenu from '../components/ChapterMenu';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 简易内存缓存，避免重复读取存储导致的等待
const contentCache = new Map(); // chapterId -> content
const getContentCached = async (chapterId) => {
  if (contentCache.has(chapterId)) return contentCache.get(chapterId);
  const content = await getChapterContent(chapterId);
  contentCache.set(chapterId, content || '');
  return content || '';
};
const prefetchContent = (chapterId) => {
  if (!chapterId || contentCache.has(chapterId)) return;
  // 低优先级预取，不阻塞主流程
  getChapterContent(chapterId)
    .then((c) => {
      contentCache.set(chapterId, c || '');
    })
    .catch(() => {});
};

export default function ReadChapterScreen({ route, navigation }) {
  const { novelId, volumeId, chapterId } = route.params;

  const [novel, setNovel] = useState(null);
  const [chapterMeta, setChapterMeta] = useState(null);
  const [chapterContent, setChapterContentState] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const scrollRef = useRef();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const autoHideControls = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!showSettings && !showMenu) {
        setShowControls(false);
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, 3000);
  };

  const showControlsWithFade = () => {
    setShowControls(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    autoHideControls();
  };

  // 偏好设置不阻塞正文首屏渲染，独立并行加载
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet(['fontSize', 'darkMode', 'fontFamily', 'fullscreenMode']);
        if (cancelled) return;
        const map = Object.fromEntries(entries);
        if (map.fontSize) setFontSize(Number(map.fontSize));
        if (map.darkMode) setDarkMode(map.darkMode === 'true');
        if (map.fontFamily) setFontFamily(map.fontFamily);
        if (map.fullscreenMode) setIsFullscreen(map.fullscreenMode === 'true');
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        // 1) 先读取当前小说（仅按ID读取，避免全量）
        const currentNovel = await loadNovelById(novelId);
        if (!mounted) return;
        setNovel(currentNovel || null);

        const currentVolume = currentNovel?.volumes?.find(v => v.id === volumeId);
        const chapterList = currentVolume?.chapters || [];
        const currentIndex = chapterList.findIndex(c => c.id === chapterId);
        if (currentIndex !== -1) {
          const meta = chapterList[currentIndex];
          setChapterMeta(meta);
          setChapterIndex(currentIndex);

          // 若旧数据仍将正文保存在对象中，直接用以抢首屏，并异步落盘为文件
          if (typeof meta?.content === 'string' && meta.content.length > 0) {
            setChapterContentState(meta.content);
            // 异步写入文件，避免后续再次从整本小说读取
            saveChapterContent(chapterId, meta.content).catch(() => {});
            // 预取相邻章节
            const prev = chapterList[currentIndex - 1]?.id;
            const next = chapterList[currentIndex + 1]?.id;
            prefetchContent(prev);
            prefetchContent(next);
          }
        } else {
          setChapterMeta(null);
          setChapterIndex(0);
        }

        // 2) 并行读取文件正文（或缓存），如果比内嵌正文更新/更全，将覆盖显示
        getContentCached(chapterId)
          .then((content) => { if (mounted && typeof content === 'string') setChapterContentState(content); })
          .catch(() => {});
      } catch (e) {
        console.error('加载章节数据失败', e);
      }
    };

    run();
    autoHideControls();
    return () => {
      mounted = false;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [novelId, volumeId, chapterId]);

  const updateFontSize = async (size) => {
    setFontSize(size);
    await AsyncStorage.setItem('fontSize', size.toString());
  };

  const updateFontFamily = async (family) => {
    setFontFamily(family);
    if (family) {
      await AsyncStorage.setItem('fontFamily', family);
    } else {
      await AsyncStorage.removeItem('fontFamily');
    }
  };

  const toggleDarkMode = async () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    await AsyncStorage.setItem('darkMode', newValue.toString());
  };

  const toggleFullscreen = async () => {
    const newValue = !isFullscreen;
    setIsFullscreen(newValue);
    await AsyncStorage.setItem('fullscreenMode', newValue.toString());
  };

  const handleSelectChapter = (volumeId, chapterId) => {
    setShowMenu(false);
    // 预取所选章节
    prefetchContent(chapterId);
    navigation.replace('ReadChapter', { novelId, volumeId, chapterId });
  };

  const goToChapter = (indexOffset) => {
    const volume = novel?.volumes?.find(v => v.id === volumeId);
    const chapterList = volume?.chapters || [];
    const newIndex = chapterIndex + indexOffset;
    if (newIndex >= 0 && newIndex < chapterList.length) {
      const newChapter = chapterList[newIndex];
      // 导航前触发预取，进一步降低切换等待
      prefetchContent(newChapter.id);
      navigation.replace('ReadChapter', { novelId, volumeId, chapterId: newChapter.id });
    }
  };

  const handleTapScreen = () => {
    if (showControls) {
      setShowControls(false);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      showControlsWithFade();
    }
  };

  useEffect(() => {
    const headerBackground = darkMode ? '#1a1a1a' : '#fffafc';
    const headerTint = darkMode ? '#f5f5f5' : '#8e8ee0';

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
    });
  }, [navigation, darkMode]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
      },
      onPanResponderGrant: () => {},
      onPanResponderRelease: (_, gesture) => {
        const isClick = Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5;
        if (isClick) {
          handleTapScreen();
          return;
        }
        if (Math.abs(gesture.dx) > 50 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          if (gesture.dx < -50) {
            goToChapter(1);
          } else if (gesture.dx > 50) {
            goToChapter(-1);
          }
        }
      }
    })
  ).current;

  const currentChapterList = novel?.volumes?.find(v => v.id === volumeId)?.chapters || [];
  const isFirstChapter = currentChapterList.length > 0 ? chapterIndex === 0 : true;
  const isLastChapter = currentChapterList.length > 0 ? chapterIndex === currentChapterList.length - 1 : true;

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
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]} edges={['bottom', 'left', 'right']}>
      <StatusBar 
        barStyle={darkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.backgroundColor}
        hidden={isFullscreen}
      />
      
      <View style={styles.readerContainer} {...panResponder.panHandlers}>
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

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScroll={(e) => {
            const contentHeight = e.nativeEvent.contentSize.height;
            const visibleHeight = e.nativeEvent.layoutMeasurement.height;
            const offsetY = e.nativeEvent.contentOffset.y;
            const totalScrollable = contentHeight - visibleHeight;
            const percent = totalScrollable > 0 ? Math.min(Math.max(offsetY / totalScrollable, 0), 1) : 0;
            setProgress(percent);
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
            }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {chapterMeta?.title || '加载中...'}
            </Text>
            
            <View style={styles.chapterInfo}>
              <Text style={[styles.chapterMeta, { color: theme.textColor }]}>
                第 {currentChapterList.length > 0 ? (chapterIndex + 1) : '-'} 章 / 共 {currentChapterList.length || '-'} 章
              </Text>
              <Text style={[styles.chapterMeta, { color: theme.textColor }]}>
                字数: {chapterContent?.length || 0}
              </Text>
            </View>
            
            {chapterContent ? (
              <Text style={[styles.content, { 
                fontSize, 
                color: theme.textColor,
                lineHeight: fontSize * 1.6,
                fontFamily: fontFamily || undefined,
                fontWeight: darkMode ? '300' : '400'
              }]}
              >
                {chapterContent}
              </Text>
            ) : (
              <View style={{ minHeight: 120, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.textColor} />
                <Text style={{ marginTop: 8, color: theme.textColor, opacity: 0.7 }}>加载正文...</Text>
              </View>
            )}
            
            <View style={styles.chapterEnd}>
              <Text style={[styles.endText, { color: theme.textColor }]}>—— 本章完 ——</Text>
              <View style={styles.endNavigation}>
                {!isFirstChapter && (
                  <TouchableOpacity 
                    style={[styles.endButton, { backgroundColor: theme.buttonBg }]}
                    onPress={() => goToChapter(-1)}
                  >
                    <Text style={[styles.endButtonText, { color: theme.buttonText }]}>← 上一章</Text>
                  </TouchableOpacity>
                )}
                {!isLastChapter && (
                  <TouchableOpacity 
                    style={[styles.endButton, { backgroundColor: theme.buttonBg }]}
                    onPress={() => goToChapter(1)}
                  >
                    <Text style={[styles.endButtonText, { color: theme.buttonText }]}>下一章 →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.progressBarContainer, { backgroundColor: theme.progressBg }]}
          pointerEvents="none"
        >
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
            ]}
            >
              ← 上一章
            </Text>
          </TouchableOpacity>
          
          <View style={styles.centerInfo}>
            <Text style={[styles.progressText, { color: theme.controlText }]}>
              {currentChapterList.length > 0 ? (chapterIndex + 1) : '-'} / {currentChapterList.length || '-'}
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
            ]}
            >
              下一章 →
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

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
            setShowSettings(false);
            autoHideControls();
          }}
        />
      )}

      {showMenu && (
        <ChapterMenu
          novel={novel}
          currentChapterId={chapterId}
          darkMode={darkMode}
          onSelect={handleSelectChapter}
          onClose={() => {
            setShowMenu(false);
            autoHideControls();
          }}
        />
      )}
    </SafeAreaView>
  );
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
    minHeight: SCREEN_HEIGHT - 200,
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
});
