// 修改小说标题、简介、状态等信息
import React, { useEffect, useState } from 'react'
import { 
  View, 
  TextInput, 
  Alert, 
  StyleSheet, 
  Text, 
  Platform, 
  TouchableOpacity, 
  Image, 
  ScrollView 
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { loadNovels, saveNovels } from '../storage/storage'

// 状态选项
const STATUS_OPTIONS = ['连载中', '已完结', '草稿']

export default function EditNovelScreen({ route, navigation }) {
  const { novelId } = route.params
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [coverUri, setCoverUri] = useState(null) // 封面图片URI

  useEffect(() => {
    const fetchData = async () => {
      try {
        const novels = await loadNovels()
        const novel = novels.find(n => n.id === novelId)
        if (novel) {
          setTitle(novel.title || '')
          setDescription(novel.description || '')
          setStatus(novel.status || '')
          // 确保封面URI正确加载
          const savedCoverUri = novel.coverUri || null
          setCoverUri(savedCoverUri)
          console.log('加载小说数据，封面URI:', savedCoverUri)
          
          // 验证封面文件是否存在
          if (savedCoverUri && savedCoverUri.startsWith(FileSystem.documentDirectory)) {
            try {
              const fileInfo = await FileSystem.getInfoAsync(savedCoverUri)
              if (!fileInfo.exists) {
                console.warn('封面文件不存在，清除封面URI:', savedCoverUri)
                setCoverUri(null)
                // 更新存储，清除无效的封面URI
                const updatedNovels = novels.map(n => {
                  if (n.id === novelId) {
                    return { ...n, coverUri: null }
                  }
                  return n
                })
                await saveNovels(updatedNovels)
              }
            } catch (error) {
              console.warn('检查封面文件失败:', error)
            }
          }
        }
      } catch (error) {
        console.error('加载小说数据失败:', error)
      }
    }
    fetchData()
    
    // 页面聚焦时重新加载数据
    const unsubscribe = navigation.addListener('focus', fetchData)
    return unsubscribe
  }, [novelId, navigation])

  // 请求相册权限
  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          '需要权限',
          '需要访问相册权限才能上传封面图片，请在设置中开启。',
          [{ text: '确定' }]
        )
        return false
      }
    }
    return true
  }

  // 选择封面图片
  const handleSelectCover = async () => {
    try {
      console.log('开始选择封面图片...')
      
      // 请求权限
      const hasPermission = await requestPermission()
      if (!hasPermission) {
        console.log('权限被拒绝')
        return
      }

      console.log('权限已授予，打开图片选择器...')
      
      // 打开图片选择器
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', // 只选择图片
        allowsEditing: true,
        aspect: [3, 4], // 书籍封面比例
        quality: 0.8,
        allowsMultipleSelection: false,
      })

      console.log('图片选择器返回结果:', result)

      if (result.canceled) {
        console.log('用户取消了选择')
        return
      }

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0]
        console.log('选择的图片:', asset)
        
        if (asset.uri) {
          try {
            // 复制文件到应用目录
            const fileName = `cover_${novelId}_${Date.now()}.jpg`
            const destUri = `${FileSystem.documentDirectory}${fileName}`
            
            console.log('开始复制文件，从:', asset.uri, '到:', destUri)
            
            // 复制文件到应用目录
            await FileSystem.copyAsync({
              from: asset.uri,
              to: destUri,
            })
            
            console.log('封面图片已保存到:', destUri)
            setCoverUri(destUri)
            Alert.alert('成功', '封面图片已上传')
          } catch (error) {
            console.error('保存封面图片失败', error)
            Alert.alert('错误', '保存封面图片失败：' + (error.message || '未知错误'))
          }
        } else {
          console.warn('图片URI为空')
          Alert.alert('错误', '无法获取图片，请重试')
        }
      } else {
        console.warn('未选择图片')
      }
    } catch (error) {
      console.error('选择图片失败', error)
      Alert.alert('错误', '选择图片失败：' + (error.message || '未知错误'))
    }
  }

  // 删除封面
  const handleRemoveCover = () => {
    Alert.alert(
      '删除封面',
      '确定要删除封面图片吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            // 删除文件
            if (coverUri && coverUri.startsWith(FileSystem.documentDirectory)) {
              try {
                await FileSystem.deleteAsync(coverUri, { idempotent: true })
              } catch (error) {
                console.warn('删除封面文件失败', error)
              }
            }
            setCoverUri(null)
          },
        },
      ]
    )
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入书名~(˶╹ꇴ╹˶)~')
      return
    }
    
    try {
      const novels = await loadNovels()
      const updated = novels.map(n => {
        if (n.id === novelId) {
          // 确定最终要保存的封面URI
          // 如果 coverUri 有值，使用它（可能是新选择的）
          // 如果 coverUri 为 null 但 n.coverUri 有值，说明用户删除了封面，应该保存 null
          // 如果两者都为 null，保存 null
          let finalCoverUri = coverUri
          if (finalCoverUri === null && n.coverUri) {
            // 用户删除了封面，保存 null
            finalCoverUri = null
          } else if (!finalCoverUri && n.coverUri) {
            // 如果 coverUri 为空字符串等，保留原有的
            finalCoverUri = n.coverUri
          }
          
          const updatedNovel = { 
            ...n, 
            title: title.trim(), 
            description: description.trim(), 
            status, 
            coverUri: finalCoverUri, // 确保保存 coverUri
            updatedAt: new Date().toISOString() 
          }
          console.log('保存小说，封面URI:', updatedNovel.coverUri, '原始封面URI:', n.coverUri, '当前coverUri:', coverUri)
          
          return updatedNovel
        }
        return n
      })
      
      // 验证封面文件是否存在（在map之后单独处理）
      const novelToUpdate = updated.find(n => n.id === novelId)
      if (novelToUpdate && novelToUpdate.coverUri && novelToUpdate.coverUri.startsWith(FileSystem.documentDirectory)) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(novelToUpdate.coverUri)
          if (!fileInfo.exists) {
            console.warn('封面文件不存在，清除封面URI')
            novelToUpdate.coverUri = null
          } else {
            console.log('封面文件存在，路径:', novelToUpdate.coverUri)
          }
        } catch (error) {
          console.warn('检查封面文件失败:', error)
        }
      }
      
      await saveNovels(updated)
      console.log('小说信息已保存，封面URI:', coverUri)
      Alert.alert('成功', '小说信息已保存', [
        { text: '确定', onPress: () => navigation.goBack() }
      ])
    } catch (error) {
      console.error('保存失败', error)
      Alert.alert('错误', '保存失败，请重试')
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 封面图片 */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>封面</Text>
        <View style={styles.coverContainer}>
          {coverUri ? (
            <View style={styles.coverPreviewContainer}>
              <Image source={{ uri: coverUri }} style={styles.coverImage} />
              <TouchableOpacity
                style={styles.removeCoverButton}
                onPress={handleRemoveCover}
                activeOpacity={0.7}
              >
                <Text style={styles.removeCoverText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.coverPlaceholder}
              onPress={handleSelectCover}
              activeOpacity={0.7}
            >
              <Text style={styles.coverPlaceholderIcon}>📷</Text>
              <Text style={styles.coverPlaceholderText}>点击上传封面</Text>
            </TouchableOpacity>
          )}
        </View>
        {coverUri && (
          <TouchableOpacity
            style={styles.changeCoverButton}
            onPress={handleSelectCover}
            activeOpacity={0.7}
          >
            <Text style={styles.changeCoverText}>更换封面</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>书名</Text>
        <TextInput 
          placeholder="请输入书名~" 
          value={title} 
          onChangeText={setTitle} 
          style={styles.input} 
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>简介</Text>
        <TextInput 
          placeholder="请输入简介~(˶╹ꇴ╹˶)~" 
          value={description} 
          onChangeText={setDescription} 
          multiline 
          numberOfLines={4}
          style={[styles.input, styles.textArea]} 
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>状态</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={status}
            onValueChange={(itemValue) => setStatus(itemValue)}
            style={styles.picker}
            dropdownIconColor="#666"
          >
            <Picker.Item label="请选择状态" value="" />
            {STATUS_OPTIONS.map((option) => (
              <Picker.Item key={option} label={option} value={option} />
            ))}
          </Picker>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        <Text style={styles.saveButtonText}>💾 保存修改</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc'
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  inputContainer: {
    marginBottom: 24
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#fffafc',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#212529'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10
  },
  pickerContainer: {
    backgroundColor: '#fffafc',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    overflow: 'hidden'
  },
  picker: {
    height: 50,
    color: '#212529'
  },
  // 封面相关样式
  coverContainer: {
    alignItems: 'center'
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4, // 书籍封面比例
    backgroundColor: '#fffafc',
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      },
      android: {
        elevation: 2
      }
    })
  },
  coverPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 8,
    opacity: 0.5
  },
  coverPlaceholderText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '400'
  },
  coverPreviewContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6
      },
      android: {
        elevation: 4
      }
    })
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  removeCoverButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeCoverText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  changeCoverButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgb(191, 214, 255)',
    alignSelf: 'center'
  },
  changeCoverText: {
    color: '#4299E1',
    fontSize: 14,
    fontWeight: '500'
  },
  // 保存按钮样式
  saveButton: {
    backgroundColor: 'rgb(72, 169, 243)', // 清新淡雅的浅蓝色
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0,height: 1,},
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 4
      }
    })
  },
  saveButtonText: {
    color: '#EEE',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5
  }
})
