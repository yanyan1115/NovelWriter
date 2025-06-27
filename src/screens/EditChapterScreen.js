import React, { useState, useEffect } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { loadNovels, saveNovels } from '../storage/storage'

export default function EditChapter({ route, navigation }) {
  const { novelId, volumeId, chapterId } = route.params || {}

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isExistingChapter, setIsExistingChapter] = useState(false)

  useEffect(() => {
    const loadChapter = async () => {
      if (!chapterId) return
      const novels = await loadNovels()
      const novel = novels.find(n => n.id === novelId)
      const volume = novel?.volumes.find(v => v.id === volumeId)
      const chapter = volume?.chapters.find(c => c.id === chapterId)
      if (chapter) {
        setTitle(chapter.title)
        setContent(chapter.content)
        setIsExistingChapter(true)
      }
    }
    loadChapter()
  }, [chapterId, novelId, volumeId])

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
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
            c.id === chapterId ? { ...c, title, content } : c
          )
          return { ...vol, chapters: updatedChapters }
        } else {
          newChapterId = Date.now().toString()
          const newChapter = {
            id: newChapterId,
            title,
            content,
            createdAt: new Date().toISOString(),
          }
          return { ...vol, chapters: [...vol.chapters, newChapter] }
        }
      })

      return { ...novel, volumes: updatedVolumes }
    })

    await saveNovels(updatedNovels)

    if (route.params?.onSave) {
      route.params.onSave()
    }

    navigation.goBack()
    }  


  const handleDelete = () => {
    Alert.alert('删除章节', '是否确定删除该章节？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: async () => {
          const novels = await loadNovels()
          const updatedNovels = novels.map(novel => {
            if (novel.id !== novelId) return novel
            const updatedVolumes = novel.volumes.map(vol => {
              if (vol.id !== volumeId) return vol
              const filteredChapters = vol.chapters.filter(c => c.id !== chapterId)
              return { ...vol, chapters: filteredChapters }
            })
            return { ...novel, volumes: updatedVolumes }
          })
          await saveNovels(updatedNovels)
          navigation.goBack()
        },
      },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 章节标题输入区域 */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>章节标题</Text>
          <TextInput
            placeholder="请输入章节标题"
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
            placeholderTextColor="#999"
          />
        </View>

        {/* 章节内容输入区域 */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>章节内容</Text>
          <TextInput
            placeholder="请输入章节内容，支持粘贴..."
            value={content}
            onChangeText={setContent}
            multiline
            style={styles.contentInput}
            textAlignVertical="top"
            placeholderTextColor="#999"
          />
        </View>

        {/* 操作按钮区域 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>
              {isExistingChapter ? '更新章节' : '保存章节'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 23,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#333',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 17,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  contentInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
    height: 454, // 章节内容输入框大小
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  buttonContainer: {
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#4C9EEB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
  },
 
})