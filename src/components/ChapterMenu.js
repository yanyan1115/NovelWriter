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

export default function ChapterMenu({ novel, currentChapterId, onSelect, onClose }) {
  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        {/* 防止点击目录内容触发关闭 */}
        <TouchableWithoutFeedback>
          <View style={styles.container}>
            {/* 头部区域 */}
            <View style={styles.header}>
              <Text style={styles.title}>章节目录</Text>
              <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* 分隔线 */}
            <View style={styles.divider} />
            
            {/* 目录内容 */}
            <ScrollView 
              style={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {novel?.volumes.map((vol, volIndex) => (
                <View key={vol.id} style={styles.volumeSection}>
                  <View style={styles.volumeHeader}>
                    <View style={styles.volumeIndicator} />
                    <Text style={styles.volumeTitle}>{vol.title}</Text>
                    <View style={styles.chapterCount}>
                      <Text style={styles.chapterCountText}>
                        {vol.chapters.length}章
                      </Text>
                    </View>
                  </View>
                  
                  {vol.chapters.map((chap, chapIndex) => {
                    const isCurrentChapter = chap.id === currentChapterId
                    return (
                      <TouchableOpacity
                        key={chap.id}
                        style={[
                          styles.chapterItem,
                          isCurrentChapter && styles.chapterItemActive
                        ]}
                        onPress={() => onSelect(vol.id, chap.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.chapterContent}>
                          <Text style={styles.chapterNumber}>
                            {chapIndex + 1}
                          </Text>
                          <Text style={[
                            styles.chapterText,
                            isCurrentChapter && styles.chapterTextActive
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
            <View style={styles.footer}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 3, height: 0 },
    shadowRadius: 8,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: '#1a1a1a',
  },
  closeIcon: {
    width: 26,
    height: 26,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
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
    backgroundColor: '#f1f3f5',
    marginBottom: 8,
  },
  volumeIndicator: {
    width: 4,
    height: 16,
    backgroundColor: '#007aff',
    borderRadius: 2,
    marginRight: 12,
  },
  volumeTitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#2c3e50',
    flex: 1,
  },
  chapterCount: {
    backgroundColor: '#dee2e6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  chapterCountText: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '400',
  },
  chapterItem: {
    marginHorizontal: 0,
    backgroundColor: 'transparent',
  },
  chapterItemActive: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#bbdefb',
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
  chapterText: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  chapterTextActive: {
    color: '#1976d2',
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
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  closeButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '300',
  },
})