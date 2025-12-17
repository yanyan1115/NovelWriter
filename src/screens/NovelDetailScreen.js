// 小说详情页
import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet, Platform, InteractionManager } from 'react-native'
import DraggableFlatList from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { loadNovels, saveNovels, deleteNovel, exportNovelToTxt } from '../storage/storage'

const CHAPTER_BATCH_SIZE = 30

// 优化后的章节列表项
const ChapterItem = React.memo(({ item, volumeId, canLoadMore, drag, isActive, onRead, onEdit, onDelete }) => {
  return (
    <View style={[styles.chapterCard, { backgroundColor: isActive ? '#f0f8ff' : '#ffffff' }]}>
      <TouchableOpacity onLongPress={!canLoadMore ? drag : undefined} disabled={!!canLoadMore} style={styles.dragHandle}>
        <Text style={[styles.dragHandleText, canLoadMore ? { color: '#e5e7eb' } : null]}>⠿</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.chapterTitleContainer}
        onPress={() => onRead(volumeId, item.id)}
      >
        <Text style={styles.chapterTitle}>📄 {item.title}</Text>
      </TouchableOpacity>

      <View style={styles.chapterActions}>
        <TouchableOpacity
          style={[styles.chapterActionButton, styles.chapterEditButton]}
          onPress={() => onEdit(volumeId, item)}
        >
          <Text style={styles.chapterActionButtonText}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chapterActionButton, styles.chapterDeleteButton]}
          onPress={() => onDelete(volumeId, item.id)}
        >
          <Text style={styles.chapterActionButtonText}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// 优化后的卷列表项
const VolumeItem = React.memo(({ 
  item: vol, 
  novelId, 
  isSelectionMode, 
  chapterContent, 
  isCollapsed, 
  visibleChapters, 
  canLoadMore, 
  visibleCount,
  drag, 
  isActive, 
  navigation,
  onToggleCollapse, 
  onDeleteVolume, 
  onSetNovel, 
  onSetVisibleChapterCounts, 
  onReadChapter, 
  onEditChapter, 
  onDeleteChapter
}) => {
  const renderChapter = React.useCallback(({ item, drag, isActive }) => (
    <ChapterItem 
      item={item}
      volumeId={vol.id}
      canLoadMore={canLoadMore}
      drag={drag}
      isActive={isActive}
      onRead={onReadChapter}
      onEdit={onEditChapter}
      onDelete={onDeleteChapter}
    />
  ), [vol.id, canLoadMore, onReadChapter, onEditChapter, onDeleteChapter]);

  return (
    <View style={styles.volumesContainer}>
      <View style={[styles.volumeCard, { backgroundColor: isActive ? '#f0f8ff' : '#ffffff' }]}>
        <View style={styles.volumeHeaderContainer}>
          <View style={styles.volumeTitleContainer}>
            <TouchableOpacity onLongPress={drag} style={styles.dragHandle}>
              <Text style={styles.dragHandleText}>⠿</Text>
            </TouchableOpacity>
            <Text style={styles.volumeTitle}>{vol.title}</Text>
            <TouchableOpacity
              style={styles.volumeCollapseButton}
              onPress={() => onToggleCollapse(vol.id)}
            >
              <Text style={styles.volumeCollapseButtonText}>{isCollapsed ? '📂 展开' : '📁 折叠'}</Text>
            </TouchableOpacity>
          </View>

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
              onPress={() => onDeleteVolume(vol.id)}
            >
              <Text style={styles.volumeOptionText}>🗑️ 删除卷</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addChapterButton}
              onPress={() => {
                if (isSelectionMode) {
                  navigation.navigate('EditChapter', {
                    novelId,
                    volumeId: vol.id,
                    initialContent: chapterContent,
                    mode: 'add',
                  });
                } else {
                  navigation.navigate('EditChapter', {
                    novelId,
                    volumeId: vol.id,
                  });
                }
              }}
            >
              <Text style={styles.addChapterButtonText}>
              {isSelectionMode ? '📥 导入到此卷' : '✨ 添加章节'}
            </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isCollapsed && (
          <DraggableFlatList
            data={visibleChapters}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            removeClippedSubviews={true}
            initialNumToRender={10}
            windowSize={5}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            ListFooterComponent={() => (
              canLoadMore ? (
                <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => {
                      InteractionManager.runAfterInteractions(() => {
                        onSetVisibleChapterCounts(prev => ({
                          ...prev,
                          [vol.id]: Math.min(visibleCount + CHAPTER_BATCH_SIZE, (vol.chapters || []).length)
                        }))
                      })
                    }}
                    style={[styles.actionButton, styles.addButton, { marginHorizontal: 16 }]}
                  >
                    <Text style={styles.actionButtonText}>加载更多章节（{visibleCount}/{(vol.chapters || []).length}）</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            )}
            onDragEnd={({ data }) => {
              onSetNovel(prevNovel => {
                if (!prevNovel) return prevNovel;

                const updatedNovel = { ...prevNovel };
                const volumeIndex = updatedNovel.volumes.findIndex(v => v.id === vol.id);

                if (volumeIndex !== -1) {
                  const newVolume = { ...updatedNovel.volumes[volumeIndex], chapters: data };
                  updatedNovel.volumes = [...updatedNovel.volumes];
                  updatedNovel.volumes[volumeIndex] = newVolume;

                  // 异步保存
                  (async () => {
                    const novels = await loadNovels();
                    const novelIndex = novels.findIndex(n => n.id === novelId);
                    if (novelIndex !== -1) {
                      novels[novelIndex] = updatedNovel;
                      await saveNovels(novels);
                    }
                  })();
                }
                return updatedNovel;
              });
            }}
            renderItem={renderChapter}
          />
        )}
      </View>
    </View>
  );
});

export default function NovelDetailScreen({ route, navigation }) {
  const { novelId, isSelectionMode, chapterContent } = route.params || {};
  const [novel, setNovel] = useState(null)
  const [collapsedVolumes, setCollapsedVolumes] = useState({})
  const [initializedCollapse, setInitializedCollapse] = useState(false)
  const [visibleChapterCounts, setVisibleChapterCounts] = useState({})

  const toggleVolumeCollapse = React.useCallback((volumeId) => {
    setCollapsedVolumes(prev => {
      const nextCollapsed = !prev[volumeId]
      // 当从折叠 -> 展开时，初始化该卷的可见章节数量为首屏数量
      if (nextCollapsed === false) {
        setVisibleChapterCounts(cPrev => {
          const current = cPrev[volumeId]
          if (typeof current === 'number') return cPrev
          return { ...cPrev, [volumeId]: CHAPTER_BATCH_SIZE }
        })
      }
      return {
        ...prev,
        [volumeId]: nextCollapsed,
      }
    })
  }, [])

  // 首次进入默认折叠全部卷，避免一次性渲染所有章节造成卡顿
  useEffect(() => {
    if (novel && Array.isArray(novel.volumes) && !initializedCollapse) {
      InteractionManager.runAfterInteractions(() => {
        const next = {};
        for (const v of novel.volumes) {
          next[v.id] = true; // 默认折叠
        }
        setCollapsedVolumes(next);
        setInitializedCollapse(true);
      });
    }
  }, [novel, initializedCollapse])

  useEffect(() => {
    const load = async () => {
      const novels = await loadNovels()
      let found = novels.find(n => n.id === novelId)
      if (found) {
        // 数据健壮性修复：确保 volumes/chapters 一定为数组
        let normalized = false
        if (!Array.isArray(found.volumes)) {
          found = { ...found, volumes: [] }
          normalized = true
        } else {
          let changed = false
          const fixedVolumes = found.volumes.map(v => {
            const safeChapters = Array.isArray(v?.chapters) ? v.chapters : []
            if (safeChapters !== v.chapters) changed = true
            // 只有在需要时才创建新对象，避免无谓的引用变化
            return safeChapters !== v.chapters ? { ...v, chapters: safeChapters } : v
          })
          if (changed) {
            found = { ...found, volumes: fixedVolumes }
            normalized = true
          }
        }
        if (normalized) {
          // 回写存储（仅在确实修复了数据时），避免每次进入页面都写磁盘
          const idx = novels.findIndex(n => n.id === novelId)
          if (idx !== -1) {
            const copied = [...novels]
            copied[idx] = found
            await saveNovels(copied)
          }
        }
      }
      setNovel(found)
    }
    const unsubscribe = navigation.addListener('focus', load)
    return unsubscribe
  }, [navigation, novelId])

  // 删除整本小说
  const handleDeleteNovel = React.useCallback(async () => {
    Alert.alert('删除确认', '你确定要永久删除本小说吗？此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNovel(novelId);
            navigation.navigate('Bookshelf');
          } catch (error) {
            console.error('删除小说失败:', error);
            Alert.alert('错误', '删除小说失败，请重试。');
          }
        }
      }
    ]);
  }, [novelId, navigation]);

  // 删除卷
  const handleDeleteVolume = React.useCallback((volumeId) => {
    Alert.alert('删除整卷', '确定要删除该卷及其中所有章节？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          setNovel(prevNovel => {
            if (!prevNovel) return prevNovel;

            const updatedNovel = {
              ...prevNovel,
              volumes: prevNovel.volumes.filter(v => v.id !== volumeId),
            };

            // 异步更新存储
            (async () => {
              const novels = await loadNovels();
              const novelIndex = novels.findIndex(n => n.id === novelId);
              if (novelIndex !== -1) {
                novels[novelIndex] = updatedNovel;
                await saveNovels(novels);
              }
            })();

            return updatedNovel;
          });
        }
      }
    ]);
  }, [novelId]);

  // 删除章节
  const handleDeleteChapter = React.useCallback((volumeId, chapterId) => {
    Alert.alert('删除章节确认', '确定要删除该章节吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          setNovel(prevNovel => {
            if (!prevNovel) return prevNovel;

            const updatedNovel = { ...prevNovel };
            const volumeIndex = updatedNovel.volumes.findIndex(v => v.id === volumeId);
            if (volumeIndex === -1) return prevNovel;

            const newChapters = updatedNovel.volumes[volumeIndex].chapters.filter(
              c => c.id !== chapterId
            );
            updatedNovel.volumes[volumeIndex] = {
              ...updatedNovel.volumes[volumeIndex],
              chapters: newChapters,
            };

            // 异步更新存储
            (async () => {
              const novels = await loadNovels();
              const novelIndex = novels.findIndex(n => n.id === novelId);
              if (novelIndex !== -1) {
                novels[novelIndex] = updatedNovel;
                await saveNovels(novels);
              }
            })();

            return updatedNovel;
          });
        }
      }
    ]);
  }, [novelId]);

  // 编辑章节
  const handleEditChapter = React.useCallback((volumeId, chapter) => {
    navigation.navigate('EditChapter', {
      novelId,
      volumeId,
      chapterId: chapter.id,
      initialTitle: chapter.title,
      initialContent: chapter.content,
      mode: 'edit',
    })
  }, [navigation, novelId])

  // 阅读章节
  const handleReadChapter = React.useCallback((volumeId, chapterId) => {
    navigation.navigate('ReadChapter', { novelId, volumeId, chapterId })
  }, [navigation, novelId])

  // 导出小说为TXT
  const handleExportNovel = React.useCallback(async () => {
    try {
      Alert.alert('导出中', '正在生成TXT文件，请稍候...', [{ text: '确定' }])
      
      const txtContent = await exportNovelToTxt(novelId)
      
      const fileName = `${novel.title || '未命名小说'}_${Date.now()}.txt`
      const fileUri = `${FileSystem.documentDirectory}${fileName}`
      
      await FileSystem.writeAsStringAsync(fileUri, txtContent, {
        encoding: 'utf8',
      })
      
      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `导出小说：${novel.title}`,
        })
        Alert.alert('导出成功', `小说已导出为：${fileName}`, [{ text: '确定' }])
      } else {
        Alert.alert(
          '导出成功',
          `文件已保存到：${fileUri}\n\n（当前设备不支持分享，请手动复制文件）`,
          [{ text: '确定' }]
        )
      }
    } catch (error) {
      console.error('导出小说失败', error)
      Alert.alert('导出失败', error.message || '导出过程中出现错误，请重试', [
        { text: '确定' },
      ])
    }
  }, [novelId, novel])

  const renderVolumeItem = useCallback(({ item: vol, drag, isActive }) => {
    const isCollapsed = collapsedVolumes[vol.id] ?? true;
    const chapters = Array.isArray(vol?.chapters) ? vol.chapters : [];
    const visibleCount = visibleChapterCounts[vol.id] ?? CHAPTER_BATCH_SIZE;
    const visibleChapters = chapters.slice(0, visibleCount);
    const canLoadMore = visibleCount < chapters.length;

    return (
      <VolumeItem
        item={vol}
        novelId={novelId}
        isSelectionMode={isSelectionMode}
        chapterContent={chapterContent}
        isCollapsed={isCollapsed}
        visibleChapters={visibleChapters}
        canLoadMore={canLoadMore}
        visibleCount={visibleCount}
        drag={drag}
        isActive={isActive}
        navigation={navigation}
        onToggleCollapse={toggleVolumeCollapse}
        onDeleteVolume={handleDeleteVolume}
        onSetNovel={setNovel}
        onSetVisibleChapterCounts={setVisibleChapterCounts}
        onReadChapter={handleReadChapter}
        onEditChapter={handleEditChapter}
        onDeleteChapter={handleDeleteChapter}
      />
    );
  }, [
    collapsedVolumes, 
    visibleChapterCounts, 
    novelId, 
    isSelectionMode, 
    chapterContent, 
    navigation, 
    toggleVolumeCollapse, 
    handleDeleteVolume, 
    setNovel, 
    setVisibleChapterCounts, 
    handleReadChapter, 
    handleEditChapter, 
    handleDeleteChapter
  ]);

  if (!novel) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <DraggableFlatList
          data={Array.isArray(novel?.volumes) ? novel.volumes : []}
          keyExtractor={(item) => item.id.toString()}
          initialNumToRender={5}
          windowSize={7}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          onDragEnd={({ data }) => {
            setNovel(prevNovel => {
              if (!prevNovel) return null;
              const updatedNovel = { ...prevNovel, volumes: data };

              (async () => {
                const novels = await loadNovels();
                const novelIndex = novels.findIndex(n => n.id === novelId);
                if (novelIndex !== -1) {
                  novels[novelIndex] = updatedNovel;
                  await saveNovels(novels);
                }
              })();

              return updatedNovel;
            });
          }}
          ListHeaderComponent={() => (
            <>
              <View style={styles.novelInfoCard}>
                <Text style={styles.novelTitle}>{novel.title}</Text>
                {novel.description ? (
                  <Text style={styles.novelDescription}>
                    {novel.description}
                  </Text>
                ) : null}
              </View>

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
                  style={[styles.actionButton, styles.exportButton]} 
                  onPress={handleExportNovel}
                >
                  <Text style={styles.actionButtonText}>📤 导出为TXT</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]} 
                  onPress={handleDeleteNovel}
                >
                  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>🗑️ 删除小说</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          renderItem={renderVolumeItem}
        />
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc',
  },
  
  novelInfoCard: {
    backgroundColor: '#fffafc',
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
    fontWeight: '400',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  novelDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 23,
  },

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
  exportButton: {
    backgroundColor: '#E8F9E5',
  },
  deleteButton: {
    backgroundColor: 'rgb(254, 242, 253)',
  },

  volumeHeaderContainer: {
    backgroundColor: '#fffafc',
    shadowColor: '#ffffff',
    elevation: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginBottom: 1,
    overflow: 'visible',
  },

  volumesContainer: {
    marginHorizontal: 14,
    marginBottom: 20,
  },
  volumeCard: {
    backgroundColor: '#fffafc',
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
    backgroundColor: '#fffafc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volumeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 12,
    gap: 8,
  },
  volumeEditButton: {
    backgroundColor: '#E8F4FD',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgb(191, 214, 255)',
    marginLeft: 8,
  },
  volumeDeleteButton: {
    backgroundColor: 'rgb(254, 242, 253)',
    borderWidth: 1,
    borderColor: 'rgb(254, 221, 247)',
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
  volumeCollapseButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  volumeCollapseButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4B5563',
  },

  dragHandle: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandleText: {
    fontSize: 20,
    color: '#cccccc',
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffafc',
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


