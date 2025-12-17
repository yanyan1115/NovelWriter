// 新增/编辑卷
import React, { useState, useEffect } from 'react'
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { loadNovels, saveNovels } from '../storage/storage'

export default function EditVolumeScreen({ route, navigation }) {
  const { novelId, volumeId } = route.params || {}
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [novelTitle, setNovelTitle] = useState('')

  const isEditing = !!volumeId

  useEffect(() => {
    const load = async () => {
      try {
        const novels = await loadNovels()
        const novel = novels.find(n => n.id === novelId)
        
        if (novel) {
          setNovelTitle(novel.title)
          if (isEditing) {
            const volume = novel.volumes?.find(v => v.id === volumeId)
            if (volume) {
              setTitle(volume.title)
            }
          }
        }
      } catch (error) {
        Alert.alert('错误', '加载数据失败')
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [novelId, volumeId, isEditing])

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入卷标题~(˶╹ꇴ╹˶)~')
      return
    }

    setLoading(true)
    try {
      const novels = await loadNovels()
      const updatedNovels = novels.map(novel => {
        if (novel.id !== novelId) return novel

        const volumes = novel.volumes || []
        if (isEditing) {
          // 编辑卷
          const updatedVolumes = volumes.map(v =>
            v.id === volumeId ? { ...v, title: title.trim() } : v
          )
          return { ...novel, volumes: updatedVolumes }
        } else {
          // 添加卷
          const newVolume = {
            id: Date.now().toString(),
            title: title.trim(),
            chapters: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          return { ...novel, volumes: [...volumes, newVolume] }
        }
      })

      await saveNovels(updatedNovels)
      Alert.alert(
        '成功', 
        `${isEditing ? '编辑' : '创建'}卷成功`,
        [{ text: '确定', onPress: () => navigation.goBack() }]
      )
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (title.trim() && title.trim() !== (isEditing ? '' : '')) {
      Alert.alert(
        '确认',
        '您有未保存的更改，确定要离开吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '离开', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      )
    } else {
      navigation.goBack()
    }
  }

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? '编辑卷' : '新建卷'}
          </Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.headerButton, styles.saveButton]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>保存</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 内容区域 */}
        <View style={styles.content}>
          {/* 小说信息 */}
          <View style={styles.novelInfo}>
            <Text style={styles.novelInfoLabel}>所属小说</Text>
            <Text style={styles.novelInfoTitle}>{novelTitle}</Text>
          </View>

          {/* 卷标题输入 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>卷标题</Text>
            <TextInput
              placeholder="请输入卷标题~(˶╹ꇴ╹˶)~"
              value={title}
              onChangeText={setTitle}
              style={styles.textInput}
              multiline={false}
              maxLength={100}
              autoFocus={!isEditing}
              editable={!loading}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          {/* 提示信息 */}
          <View style={styles.tipSection}>
            <Text style={styles.tipText}>
              💡 卷是组织章节的单位，一个卷可以包含多个章节
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fffafc',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center'
  },
  headerButtonText: {
    fontSize: 16,
    color: '#007AFF'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#333'
  },
  saveButton: {
    backgroundColor: '#4C9EEB'
  },
  saveButtonText: {
    fontSize: 15.5,
    color: '#FFFFFF',
    fontWeight: '300'
  },
  content: {
    flex: 1,
    padding: 16
  },
  novelInfo: {
    backgroundColor: '#fffafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  novelInfoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  novelInfoTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#333'
  },
  inputSection: {
    backgroundColor: '#fffafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '300',
    color: '#333',
    marginBottom: 12
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fffafc',
    textAlignVertical: 'top',
    minHeight: 44
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4
  },
  tipSection: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF'
  },
  tipText: {
    fontSize: 14,
    color: '#4299E1',
    lineHeight: 20
  }
})