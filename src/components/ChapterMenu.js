// components/ChapterMenu.js
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native'

const SCREEN_WIDTH = Dimensions.get('window').width

export default function ChapterMenu({ novel, currentChapterId, onSelect, onClose, darkMode = false }) {
  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        {/* 防止点击目录内容触发关闭 */}
        <TouchableWithoutFeedback>
          <View style={[styles.container, darkMode && styles.containerDark]}>
            {/* 头部区域 */}
            <View style={[styles.header, darkMode && styles.headerDark]}>
              <Text style={[styles.title, darkMode && styles.titleDark]}>章节目录</Text>
              <TouchableOpacity style={[styles.closeIcon, darkMode && styles.closeIconDark]} onPress={onClose}>
                <Text style={[styles.closeIconText, darkMode && styles.closeIconTextDark]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* 分隔线 */}
            <View style={[styles.divider, darkMode && styles.dividerDark]} />
            
            {/* 目录内容 */}
            <ScrollView 
              style={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {novel?.volumes?.map((vol, volIndex) => (
                <View key={vol.id || `${volIndex}`} style={styles.volumeSection}>
                  <View style={[styles.volumeHeader, darkMode && styles.volumeHeaderDark]}>
                    <View style={[styles.volumeIndicator, darkMode && styles.volumeIndicatorDark]} />
                    <Text style={[styles.volumeTitle, darkMode && styles.volumeTitleDark]}>{vol.title}</Text>
                    <View style={[styles.chapterCount, darkMode && styles.chapterCountDark]}>
                      <Text style={[styles.chapterCountText, darkMode && styles.chapterCountTextDark]}>
                        {vol.chapters?.length || 0}章
                      </Text>
                    </View>
                  </View>
                  
                  {vol.chapters?.map((chap, chapIndex) => {
                    const isCurrentChapter = chap.id === currentChapterId
                    return (
                      <TouchableOpacity
                        key={`${vol.id || volIndex}-${chap.id || chapIndex}`}
                        style={[
                          styles.chapterItem,
                          isCurrentChapter && (darkMode ? styles.chapterItemActiveDark : styles.chapterItemActive)
                        ]}
                        onPress={() => onSelect(vol.id, chap.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.chapterContent}>
                          <Text style={[styles.chapterNumber, darkMode && styles.chapterNumberDark]}>
                            {chapIndex + 1}
                          </Text>
                          <Text style={[
                            styles.chapterText,
                            darkMode && styles.chapterTextDark,
                            isCurrentChapter && (darkMode ? styles.chapterTextActiveDark : styles.chapterTextActive)
                          ]}>
                            {chap.title}
                          </Text>
                          {isCurrentChapter && (
                            <View style={styles.currentIndicator}>
                              <Text style={styles.currentIndicatorText}>当前</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
            
            {/* 底部按钮 */}
            <View style={[styles.footer, darkMode && styles.footerDark]}>
              <TouchableOpacity style={[styles.closeButton, darkMode && styles.closeButtonDark]} onPress={onClose}>
                <Text style={styles.closeText}>关闭目录</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  container: {
    width: SCREEN_WIDTH / 2,
    backgroundColor: '#fffafc',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 3, height: 0 },
    shadowRadius: 8,
    elevation: 12,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fffafc',
  },
  headerDark: {
    backgroundColor: '#2a2a2a',
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: '#1a1a1a',
  },
  titleDark: {
    color: '#ffffff',
  },
  closeIcon: {
    width: 26,
    height: 26,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconDark: {
    backgroundColor: '#404040',
  },
  closeIconText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  closeIconTextDark: {
    color: '#cccccc',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
  },
  dividerDark: {
    backgroundColor: '#333333',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  volumeSection: {
    marginBottom: 24,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fffafc',
    marginBottom: 8,
  },
  volumeHeaderDark: {
    backgroundColor: '#2a2a2a',
  },
  volumeIndicator: {
    width: 4,
    height: 16,
    backgroundColor: '#007aff',
    borderRadius: 2,
    marginRight: 12,
  },
  volumeIndicatorDark: {
    backgroundColor: '#4C9EEB',
  },
  volumeTitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#2c3e50',
    flex: 1,
  },
  volumeTitleDark: {
    color: '#e0e0e0',
  },
  chapterCount: {
    backgroundColor: '#dee2e6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  chapterCountDark: {
    backgroundColor: '#404040',
  },
  chapterCountText: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '400',
  },
  chapterCountTextDark: {
    color: '#cccccc',
  },
  chapterItem: {
    marginHorizontal: 0,
    backgroundColor: 'transparent',
  },
  chapterItemActive: {
    backgroundColor: '#ffe4f1',
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  chapterItemActiveDark: {
    backgroundColor: '#2a3a4a',
    borderWidth: 1,
    borderColor: '#4C9EEB',
  },
  chapterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  chapterNumber: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    minWidth: 24,
    textAlign: 'center',
  },
  chapterNumberDark: {
    color: '#999999',
  },
  chapterText: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  chapterTextDark: {
    color: '#cccccc',
  },
  chapterTextActive: {
    color: '#1976d2',
    fontWeight: '500',
  },
  chapterTextActiveDark: {
    color: '#4C9EEB',
    fontWeight: '500',
  },
  currentIndicator: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  currentIndicatorText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: '#fffafc',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerDark: {
    backgroundColor: '#2a2a2a',
    borderTopColor: '#333333',
  },
  closeButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonDark: {
    backgroundColor: '#4C9EEB',
  },
  closeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '300',
  },
})