// 小说详情页
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet, ScrollView } from 'react-native'
import { loadNovels, saveNovels } from '../storage/storage'

export default function NovelDetailScreen({ route, navigation }) {
  const { novelId } = route.params
  const [novel, setNovel] = useState(null)

  useEffect(() => {
    const load = async () => {
      const novels = await loadNovels()
      const found = novels.find(n => n.id === novelId)
      setNovel(found)
    }
    const unsubscribe = navigation.addListener('focus', load)
    return unsubscribe
  }, [navigation])

  // 删除整本小说
  const handleDeleteNovel = async () => {
    Alert.alert('删除确认', '你确定要永久删除本小说吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: async () => {
          const novels = await loadNovels()
          const updated = novels.filter(n => n.id !== novelId)
          await saveNovels(updated)
          navigation.navigate('Bookshelf')
        }
      }
    ])
  }

  // 删除卷
  const handleDeleteVolume = (volumeId) => {
  Alert.alert('删除整卷', '确定要删除该卷及其中所有章节？', [
    { text: '取消', style: 'cancel' },
    {
      text: '删除',
      style: 'destructive',
      onPress: async () => {
        if (!novel) return
        const updatedNovel = { ...novel }
        updatedNovel.volumes = updatedNovel.volumes.filter(v => v.id !== volumeId)

        const novels = await loadNovels()
        const novelIndex = novels.findIndex(n => n.id === novelId)
        if (novelIndex === -1) return
        novels[novelIndex] = updatedNovel

        await saveNovels(novels)
        setNovel(updatedNovel)
      }
    }
  ])
}

  // 删除章节
  const handleDeleteChapter = (volumeId, chapterId) => {
    Alert.alert('删除章节确认', '确定要删除该章节吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          if (!novel) return
          const updatedNovel = { ...novel }
          const volumeIndex = updatedNovel.volumes.findIndex(v => v.id === volumeId)
          if (volumeIndex === -1) return

          updatedNovel.volumes[volumeIndex].chapters = updatedNovel.volumes[volumeIndex].chapters.filter(
            c => c.id !== chapterId
          )

          const novels = await loadNovels()
          const novelIndex = novels.findIndex(n => n.id === novelId)
          if (novelIndex === -1) return
          novels[novelIndex] = updatedNovel

          await saveNovels(novels)
          setNovel(updatedNovel)
        }
      }
    ])
  }

  // 编辑章节
  const handleEditChapter = (volumeId, chapter) => {
    navigation.navigate('EditChapter', {
      novelId,
      volumeId,
      chapterId: chapter.id,
      initialTitle: chapter.title,
      initialContent: chapter.content,
      mode: 'edit',
    })
  }

  // 阅读章节
  const handleReadChapter = (volumeId, chapterId) => {
    navigation.navigate('ReadChapter', { novelId, volumeId, chapterId })
  }

  if (!novel) return null

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 小说基本信息卡片 */}
        <View style={styles.novelInfoCard}>
          <Text style={styles.novelTitle}>{novel.title}</Text>
          {novel.description ? (
            <Text style={styles.novelDescription}>
              {novel.description}
            </Text>
          ) : null}
        </View>

        {/* 操作按钮区域 */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]} 
            onPress={() => navigation.navigate('EditNovel', { novelId })}
          >
            <Text style={styles.actionButtonText}>✏️ 编辑小说信息</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.addButton]} 
            onPress={() => navigation.navigate('EditVolume', { novelId })}
          >
            <Text style={styles.actionButtonText}>✨ 添加卷</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]} 
            onPress={handleDeleteNovel}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>🗑️ 删除小说</Text>
          </TouchableOpacity>
        </View>



       {/* 卷章节列表 */}
<View style={styles.volumesContainer}>
  {novel.volumes.map((vol) => (
    <View key={vol.id} style={styles.volumeCard}>
      {/* 卷头部区域容器，带浅阴影 */}
      <View style={styles.volumeHeaderContainer}>
        {/* 卷标题 */}
        <View style={styles.volumeTitleContainer}>
          <Text style={styles.volumeTitle}>{vol.title}</Text>
        </View>

        {/* 操作按钮区域 */}
        <View style={styles.volumeButtonsContainer}>
          <TouchableOpacity
            style={styles.volumeEditButton}
            onPress={() =>
              navigation.navigate('EditVolume', {
                novelId,
                volumeId: vol.id,
                initialTitle: vol.title,
              })
            }
          >
            <Text style={styles.volumeOptionText}>✏️ 编辑卷</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.volumeDeleteButton}
            onPress={() => handleDeleteVolume(vol.id)}
          >
            <Text style={styles.volumeOptionText}>🗑️ 删除卷</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addChapterButton}
            onPress={() =>
              navigation.navigate('EditChapter', {
                novelId,
                volumeId: vol.id,
              })
            }
          >
            <Text style={styles.addChapterButtonText}>✨ 添加章节</Text>
          </TouchableOpacity>
        </View>
      </View>


              {/* 章节列表 */}
              <View style={styles.chaptersContainer}>
                {vol.chapters.map(chap => (
                  <View key={chap.id} style={styles.chapterCard}>
                    {/* 章节标题（可点击阅读） */}
                    <TouchableOpacity
                      style={styles.chapterTitleContainer}
                      onPress={() => handleReadChapter(vol.id, chap.id)}
                    >
                      <Text style={styles.chapterTitle}>📄 {chap.title}</Text>
                    </TouchableOpacity>

                    {/* 章节操作按钮 */}
                    <View style={styles.chapterActions}>
                      <TouchableOpacity
                        style={[styles.chapterActionButton, styles.chapterEditButton]}
                        onPress={() => handleEditChapter(vol.id, chap)}
                      >
                        <Text style={styles.chapterActionButtonText}>编辑</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.chapterActionButton, styles.chapterDeleteButton]}
                        onPress={() => handleDeleteChapter(vol.id, chap.id)}
                      >
                        <Text style={styles.chapterActionButtonText}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // 小说信息卡片
  novelInfoCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  novelTitle: {
    fontSize: 21,
    fontWeight: 400,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  novelDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 23,
  },

  // 操作按钮区域
  actionButtonsContainer: {
    marginHorizontal: 21,
    marginBottom: 13,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 9.5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    color: '#4299E1',
  },
  editButton: {
    backgroundColor: '#E8F4FD',
  },
  addButton: {
    backgroundColor: '#E8F4FD',
  },
  deleteButton: {
    backgroundColor: 'rgb(254, 242, 253)',
  },

  // 卷章节容器
  volumeHeaderContainer: {
  backgroundColor: '#ffffff',
  shadowColor: '#ffffff',
  elevation: 1,
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  marginBottom: 1, // 微调与章节区的连接
  overflow: 'visible',
},

  volumesContainer: {
    marginHorizontal: 14,
    marginBottom: 20,
  },
  volumeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  volumeTitle: {
    fontSize: 17,
    fontWeight: '300',
    color: '#1a1a1a',
    flex: 1,
  },
  volumeTitleContainer: {
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: '#ffffff',
},
volumeButtonsContainer: {
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'center',
  paddingHorizontal: 4,
  paddingBottom: 12,
  gap: 8, // 如果不支持 gap，可用 marginLeft 代替
},
volumeEditButton: {
  backgroundColor: '#E8F4FD', // 淡蓝背景
  paddingVertical: 4,
  paddingHorizontal: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'rgb(191, 214, 255)', // 蓝边框
  marginLeft: 8,
},
volumeDeleteButton: {
  backgroundColor: 'rgb(254, 242, 253)', // 淡粉红背景
  borderWidth: 1,
  borderColor: 'rgb(254, 221, 247)', // 粉边框
  paddingVertical: 4,
  paddingHorizontal: 10,
  borderRadius: 8,
  marginLeft: 8,
},
volumeOptionText: {
  fontSize: 14,
  fontWeight: '400',
  color: '#4299E1',
},
  addChapterButton: {
    backgroundColor: '#E8F4FD',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgb(191, 214, 255)',
  },
  addChapterButtonText: {
    color: '#4299E1',
    fontSize: 14,
    fontWeight: '400',
  },

  // 章节容器
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginVertical: 4,
  marginHorizontal: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  // 章节标题区域
  chapterTitleContainer: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  chapterTitle: {
    fontSize: 15.3,
    color: '#4299E1',
    fontWeight: '400',
  },

  // 章节操作按钮
  chapterActions: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  chapterActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 6,
  },
  chapterActionButtonText: {
    color: '#4299E1',
    fontSize: 14,
    fontWeight: '500',
  },
  chapterEditButton: {
    backgroundColor: '#E8F4FD',
    borderWidth: 1,
    borderColor: 'rgb(191, 214, 255)',
  },
  chapterDeleteButton: {
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: 'rgb(255, 197, 201)',
  },
})