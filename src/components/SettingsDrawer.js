import React from 'react'
import {
  View, Text, StyleSheet,
  TouchableOpacity, Dimensions, TouchableWithoutFeedback, Platform, ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Picker } from '@react-native-picker/picker'

const SCREEN_HEIGHT = Dimensions.get('window').height

// 可用字体列表
const FONT_OPTIONS = [
  { value: null, label: '默认', file: null },
  { value: 'Song', label: '宋体', file: 'Song.ttf' },
  { value: 'Kai', label: '楷体', file: 'Kai.ttf' },
  { value: 'ShouJin', label: '瘦金体', file: 'ShouJin.ttf' },
  { value: 'ShouZha', label: '手札体', file: 'ShouZha.ttf' },
]

export default function SettingsDrawer({
  fontSize,
  fontFamily,
  darkMode,
  onFontSizeChange,
  onFontFamilyChange,
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

            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* 字体大小控制 */}
              <View style={styles.settingSection}>
                <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>字体大小</Text>
                <View style={styles.fontControlRow}>
                  <TouchableOpacity 
                    style={[styles.fontButton, darkMode && styles.fontButtonDark]}
                    onPress={() => onFontSizeChange(Math.max(12, fontSize - 1))}
                  >
                    <Text style={[styles.fontButtonText, darkMode && styles.fontButtonTextDark]}>A-</Text>
                  </TouchableOpacity>
                  
                  <View style={[styles.fontSizeDisplay, darkMode && styles.fontSizeDisplayDark]}>
                    <Text style={[styles.fontSizeText, darkMode && styles.fontSizeTextDark]}>{fontSize}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.fontButton, darkMode && styles.fontButtonDark]}
                    onPress={() => onFontSizeChange(Math.min(32, fontSize + 1))}
                  >
                    <Text style={[styles.fontButtonText, darkMode && styles.fontButtonTextDark]}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 字体选择 */}
              <View style={styles.settingSection}>
                <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>正文字体</Text>
                <View style={[styles.pickerContainer, darkMode && styles.pickerContainerDark]}>
                  <Picker
                    selectedValue={fontFamily}
                    onValueChange={(itemValue) => onFontFamilyChange && onFontFamilyChange(itemValue)}
                    style={[styles.picker, darkMode && styles.pickerDark]}
                    dropdownIconColor={darkMode ? '#cccccc' : '#666666'}
                  >
                    {FONT_OPTIONS.map((font, index) => (
                      <Picker.Item 
                        key={font.value || `default-${index}`}
                        label={font.label} 
                        value={font.value}
                      />
                    ))}
                  </Picker>
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
            </ScrollView>

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
    height: SCREEN_HEIGHT * 0.61, // 调整为屏幕高度的65%，显示更多内容
    backgroundColor: '#fffafc',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 10,
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
    marginBottom: 16, // 减小拖拽指示器底部间距
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    marginBottom: 14, // 减小标题底部间距
    textAlign: 'center',
    color: '#333333',
  },
  titleDark: {
    color: '#ffffff',
  },
  settingSection: {
    marginBottom: 18, // 稍微减小间距，让内容更紧凑
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '00',
    marginBottom: 12, // 减小区块标题底部间距
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
    backgroundColor: '#fffafc',
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
    backgroundColor: '#fffafc',
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
    backgroundColor: '#fffafc',
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
    backgroundColor: '#4C9EEB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
  pickerContainer: {
    backgroundColor: '#fffafc',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerContainerDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },
  picker: {
    height: 55,
    color: '#333333',
  },
  pickerDark: {
    color: '#ffffff',
  },
})