import React from 'react'
import {
  View, Text, StyleSheet,
  TouchableOpacity, Dimensions, TouchableWithoutFeedback, Platform, SafeAreaView
} from 'react-native'

const SCREEN_HEIGHT = Dimensions.get('window').height

export default function SettingsDrawer({
  fontSize,
  darkMode,
  onFontSizeChange,
  onDarkModeToggle,
  onClose,
}) {
  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        {/* 让底部内容不受点击遮罩影响 */}
        <TouchableWithoutFeedback>
          <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
            {/* 顶部拖拽指示器 */}
            <View style={styles.dragIndicator} />
            
            <Text style={[styles.title, darkMode && styles.titleDark]}>阅读设置</Text>

            {/* 字体大小控制 */}
            <View style={styles.settingSection}>
              <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>字体大小</Text>
              <View style={styles.fontControlRow}>
                <TouchableOpacity 
                  style={[styles.fontButton, darkMode && styles.fontButtonDark]}
                  onPress={() => onFontSizeChange(Math.max(12, fontSize - 2))}
                >
                  <Text style={[styles.fontButtonText, darkMode && styles.fontButtonTextDark]}>A-</Text>
                </TouchableOpacity>
                
                <View style={[styles.fontSizeDisplay, darkMode && styles.fontSizeDisplayDark]}>
                  <Text style={[styles.fontSizeText, darkMode && styles.fontSizeTextDark]}>{fontSize}</Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.fontButton, darkMode && styles.fontButtonDark]}
                  onPress={() => onFontSizeChange(Math.min(32, fontSize + 2))}
                >
                  <Text style={[styles.fontButtonText, darkMode && styles.fontButtonTextDark]}>A+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 主题模式切换 */}
            <View style={styles.settingSection}>
              <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>主题模式</Text>
              <TouchableOpacity 
                style={[styles.themeToggle, darkMode && styles.themeToggleDark]}
                onPress={onDarkModeToggle}
              >
                <View style={styles.themeContent}>
                  <Text style={styles.themeIcon}>{darkMode ? '☀️' : '🌙'}</Text>
                  <Text style={[styles.themeText, darkMode && styles.themeTextDark]}>
                    {darkMode ? '日间模式' : '夜间模式'}
                  </Text>
                </View>
                <View style={[styles.switchContainer, darkMode && styles.switchContainerDark]}>
                  <View style={[
                    styles.switchThumb, 
                    darkMode && styles.switchThumbActive,
                    darkMode && styles.switchThumbDark
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* 关闭按钮 */}
            <TouchableOpacity 
              style={[styles.closeButton, darkMode && styles.closeButtonDark]} 
              onPress={onClose}
            >
              <Text style={[styles.closeText, darkMode && styles.closeTextDark]}>完成</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    height: SCREEN_HEIGHT / 2,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    marginBottom: 18,
    textAlign: 'center',
    color: '#333333',
  },
  titleDark: {
    color: '#ffffff',
  },
  settingSection: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '00',
    marginBottom: 16,
    color: '#666666',
  },
  sectionTitleDark: {
    color: '#cccccc',
  },
  fontControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontButton: {
    width: 46,
    height: 45,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fontButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },
  fontButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  fontButtonTextDark: {
    color: '#ffffff',
  },
  fontSizeDisplay: {
    minWidth: 62,
    height: 45,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fontSizeDisplayDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },
  fontSizeText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#333333',
  },
  fontSizeTextDark: {
    color: '#ffffff',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  themeToggleDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },
  themeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeIcon: {
    fontSize: 23,
    marginRight: 12,
  },
  themeText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#333333',
  },
  themeTextDark: {
    color: '#ffffff',
  },
  switchContainer: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
    padding: 2,
    justifyContent: 'center',
  },
  switchContainerDark: {
    backgroundColor: '#007AFF',
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbDark: {
    backgroundColor: '#ffffff',
  },
  closeButton: {
    marginTop: 'auto',
    backgroundColor: '#4C9EEB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonDark: {
    backgroundColor: '#0A84FF',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
  },
  closeTextDark: {
    color: '#ffffff',
  },
})