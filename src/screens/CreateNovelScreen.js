// 创建新小说页
import React, { useState } from 'react'
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  Alert, 
  StyleSheet, 
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { loadNovels, saveNovels } from '../storage/storage'

export default function CreateNovelScreen({ navigation }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('草稿')

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入小说标题~(˶╹ꇴ╹˶)~', [{ text: '确定' }])
      return
    }
    
    try {
      const novel = {
        id: Date.now().toString(),
        title: title.trim(),
        description: description.trim(),
        status,
        updatedAt: new Date().toISOString(),
        volumes: []
      }
      
      const novels = await loadNovels()
      const updated = [...novels, novel]
      await saveNovels(updated)
      
      Alert.alert('成功', '小说创建成功！', [
        { text: '确定', onPress: () => navigation.goBack() }
      ])
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试', [{ text: '确定' }])
    }
  }

  const handleCancel = () => {
    if (title.trim() || description.trim()) {
      Alert.alert('确认', '确定要放弃创建吗？', [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: () => navigation.goBack() }
      ])
    } else {
      navigation.goBack()
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 页面标题 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>创建新小说</Text>
          <Text style={styles.headerSubtitle}>填写小说基本信息</Text>
        </View>

        {/* 表单容器 */}
        <View style={styles.formContainer}>
          {/* 小说标题输入 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>小说标题</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="请输入小说标题~(˶╹ꇴ╹˶)~"
                placeholderTextColor="#a0a0a0"
                value={title}
                onChangeText={setTitle}
                style={styles.textInput}
                maxLength={50}
              />
            </View>
            <Text style={styles.charCount}>{title.length}/50</Text>
          </View>

          {/* 小说简介输入 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>小说简介</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
              <TextInput
                placeholder="请输入小说简介（选填）"
                placeholderTextColor="#a0a0a0"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={[styles.textInput, styles.textArea]}
                maxLength={200}
              />
            </View>
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

          {/* 状态显示 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>状态</Text>
            <View style={styles.statusContainer}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{status}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部按钮组 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.cancelButton]} 
          onPress={handleCancel}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.saveButton]} 
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>创建小说</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fffafc',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  formContainer: {
    backgroundColor: '#fffafc',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#fffafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  textAreaWrapper: {
    minHeight: 120,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    lineHeight: 20,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  statusText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#fffafc',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: '#fffafc',
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#656d76',
  },
  saveButton: {
    backgroundColor: '#0969da',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
})