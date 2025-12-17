// 小说书架页 - 优化版本
import React, { useEffect, useState, useMemo, useCallback, useLayoutEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  RefreshControl,
  Alert,
  Image
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { loadNovels, stressTestChapters, importNovelFromTxt, getStorageInfo, checkStorageSpace, cleanupStorage, cleanupOrphanStorage, saveChapterContent, saveNovels } from '../storage/storage'
import SearchBar from '../components/SearchBar'

const { width: screenWidth } = Dimensions.get('window')

// 状态标签配置
const STATUS_CONFIG = {
  '连载中': { color: '#28a745', bg: '#d4edda' },
  '已完结': { color: '#007bff', bg: '#d1ecf1' },
  '暂停': { color: '#ffc107', bg: '#fff3cd' },
  '草稿': { color: '#6c757d', bg: '#e2e3e5' }
}

// 优化后的列表项组件
const NovelItem = React.memo(({ item, viewMode, cardWidth, onNovelPress }) => {
  const handlePress = () => onNovelPress(item.id);

  if (viewMode === 'list') {
    return (
      <TouchableOpacity
        style={styles.listCard}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.listCover}>
          {item.coverUri ? (
            <Image 
              source={{ uri: item.coverUri }} 
              style={styles.listCoverImage}
              onError={(error) => {
                console.warn('加载封面图片失败:', item.coverUri, error)
              }}
            />
          ) : (
            <Text style={styles.listCoverIcon}>📖</Text>
          )}
        </View>
        <View style={styles.listInfo}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.listMeta}>
            {item.updatedAt ? 
              `更新于 ${new Date(item.updatedAt).toLocaleDateString('zh-CN')}` : 
              '暂无更新时间'
            }
          </Text>
          {item.progress && (
            <Text style={styles.listProgress}>
              阅读进度: {Math.round(item.progress)}%
            </Text>
          )}
        </View>
        <View style={styles.listStatus}>
          {item.status && (
            <View style={[
              styles.listStatusBadge,
              { backgroundColor: STATUS_CONFIG[item.status]?.bg || '#e2e3e5' }
            ]}>
              <Text style={[
                styles.listStatusText,
                { color: STATUS_CONFIG[item.status]?.color || '#6c757d' }
              ]}>
                {item.status}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Grid view as default
  return (
    <View style={[styles.cardContainer, { width: cardWidth }]}>
      <TouchableOpacity
        style={styles.novelCard}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.coverContainer}>
          {item.coverUri ? (
            <View style={styles.coverImageContainer}>
              <Image 
                source={{ uri: item.coverUri }} 
                style={styles.coverImage}
                onError={(error) => {
                  console.warn('加载封面图片失败:', item.coverUri, error)
                }}
              />
              {item.status && (
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: STATUS_CONFIG[item.status]?.bg || '#e2e3e5' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: STATUS_CONFIG[item.status]?.color || '#6c757d' }
                  ]}>
                    {item.status}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverIcon}>📖</Text>
              {item.status && (
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: STATUS_CONFIG[item.status]?.bg || '#e2e3e5' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: STATUS_CONFIG[item.status]?.color || '#6c757d' }
                  ]}>
                    {item.status}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.updateTime}>
            {item.updatedAt ? 
              `更新于 ${new Date(item.updatedAt).toLocaleDateString('zh-CN')}` : 
              '暂无更新时间'
            }
          </Text>
          {item.progress && (
            <Text style={styles.progressText}>
              阅读进度: {Math.round(item.progress)}%
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});

// 排序选项配置
const SORT_OPTIONS = [
  { label: '按书名排序', value: 'title', icon: '📚' },
  { label: '按更新时间排序', value: 'updatedAt', icon: '🕐' },
  { label: '按创建时间排序', value: 'createdAt', icon: '📅' },
  { label: '按阅读进度排序', value: 'progress', icon: '📖' }
]

export default function BookshelfScreen({ navigation, route }) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Chat')} style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 18 }}>🌸</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Backup')} style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 18 }}>🛡️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const [novels, setNovels] = useState([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('updatedAt') // 默认按更新时间排序
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // grid 或 list
  const [storageInfo, setStorageInfo] = useState(null) // 存储空间信息
  const [storageWarning, setStorageWarning] = useState(null) // 存储警告
  const [largeImporting, setLargeImporting] = useState(false) // 大文件测试导入中标记

  const { isSelectionMode, chapterContent } = route.params || {};

  const handleNovelPress = useCallback((novelId) => {
    if (isSelectionMode) {
      navigation.navigate('NovelDetail', {
        novelId: novelId,
        isSelectionMode: true,
        chapterContent: chapterContent,
      });
    } else {
      navigation.navigate('NovelDetail', { novelId: novelId });
    }
  }, [navigation, isSelectionMode, chapterContent]);

  // 仅开发调试使用：一键触发章节压力测试
  const handleRunStressTest = useCallback(async () => {
    try {
      // 简单保护：避免在空书架上跑压测
      if (!novels || novels.length === 0) {
        Alert.alert('提示', '当前书架为空，请先创建至少一本小说再运行压力测试。')
        return
      }

      Alert.alert(
        '压力测试',
        '将自动在第一本小说中疯狂新增/删除章节，可能会有明显卡顿，仅建议在测试环境中使用。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '开始',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await stressTestChapters({
                  // 不传 novelId / volumeId：默认选第一本小说、第一卷
                  rounds: 5,
                  chaptersPerRound: 20,
                  contentLength: 8000,
                })
                if (result?.success) {
                  Alert.alert('完成', '章节压力测试已结束，请查看日志与应用表现。')
                } else {
                  const msg =
                    result?.message ||
                    '压力测试因存储空间不足提前结束，请清理数据或降低测试参数（章节数量 / 正文字数）后重试。'
                  Alert.alert('存储受限', msg)
                }
              } catch (e) {
                console.error('运行压力测试失败', e)
                Alert.alert('错误', '压力测试过程中发生错误，请查看控制台日志。')
              }
            },
          },
        ]
      )
    } catch (e) {
      console.error('准备压力测试失败', e)
    }
  }, [novels])

  // 仅开发调试使用：导入超大TXT（>1.5MB）
  const handleImportLargeNovelForTest = useCallback(async () => {
    try {
      if (largeImporting) {
        Alert.alert('提示', '已有大文件导入任务在进行中，请稍候完成后再试。');
        return;
      }

      Alert.alert(
        '导入大文件测试',
        '将生成并导入一个超过1.5MB的TXT文件。为缩短等待时间，将使用较少的章节数、每章体积更大。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '开始',
            style: 'destructive',
            onPress: async () => {
              setLargeImporting(true);
              try {
                const title = `超大测试小说 ${new Date().toLocaleTimeString()}`;

                // 目标总大小 ~1.6MB（略高于1.5MB）
                const targetSize = Math.floor(1.6 * 1024 * 1024);
                const chaptersTarget = 8; // 控制章节数，减少文件写次数与解析耗时
                const perChapterSize = Math.ceil(targetSize / chaptersTarget);

                const unit = '这是一个用于填充的大段文本，用来快速凑满测试文件大小。';
                let largeContent = `这是小说《${title}》的开头。\n\n`;

                for (let i = 1; i <= chaptersTarget; i++) {
                  largeContent += `第${i}章 测试章节${i}\n\n`;
                  const repeat = Math.ceil(perChapterSize / unit.length);
                  largeContent += unit.repeat(repeat) + "\n\n";
                }

                Alert.alert('导入中', '正在处理大文件并解析章节，请耐心等待...', [{ text: '确定' }]);

                const newNovel = await importNovelFromTxt(largeContent, title);

                // 立即刷新书架
                try { await fetchData(); } catch (_) {}

                Alert.alert('导入成功', `小说《${newNovel.title}》已成功导入！`, [{ text: '确定' }]);
              } catch (e) {
                console.error('导入大文件失败', e);
                Alert.alert('错误', '导入大文件过程中发生错误，请查看控制台日志。');
              } finally {
                setLargeImporting(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      console.error('准备导入大文件测试失败', e);
    }
  }, [largeImporting, fetchData]);

  // 根据屏幕宽度动态调整列数
  const numColumns = useMemo(() => {
    if (viewMode === 'list') return 1
    if (screenWidth < 400) return 2  // 小屏幕2列
    if (screenWidth < 600) return 2  // 中等屏幕2列
    return 3  // 大屏幕3列
  }, [viewMode])

  // 计算每个卡片的宽度
  const cardWidth = useMemo(() => {
    if (viewMode === 'list') return '100%'
    const padding = 20 // 左右边距
    const gap = 12 // 卡片间距
    const totalGap = gap * (numColumns - 1)
    return (screenWidth - padding * 2 - totalGap) / numColumns
  }, [numColumns, viewMode])

  // 加载数据函数
  const fetchData = useCallback(async () => {
    let data = []
    try {
      setLoading(true)
      data = await loadNovels()
      setNovels(data || [])
    } catch (error) {
      console.error('加载小说数据失败:', error)
      Alert.alert('错误', '加载数据失败，请重试')
    } finally {
      setLoading(false)
    }

    // 在后台刷新存储信息，必要时清理孤立数据，避免阻塞首屏
    try {
      let info = await getStorageInfo()
      // 若书架为空但仍有占用，则清理孤立数据（旧版本残留的章节文件/分片等）
      if ((data?.length || 0) === 0 && (info?.estimatedSizeMB || 0) > 0) {
        try { await cleanupOrphanStorage() } catch (e) { console.warn('清理孤立数据失败', e) }
        info = await getStorageInfo()
      }
      setStorageInfo(info)

      const checkResult = await checkStorageSpace(0)
      setStorageWarning(checkResult)

      if (checkResult.level === 'danger') {
        Alert.alert(
          '存储空间警告',
          checkResult.message + '\n\n建议：\n1. 导出重要小说备份\n2. 删除不必要的小说\n3. 清理存储空间',
          [{ text: '知道了' }]
        )
      }
    } catch (storageErr) {
      console.warn('检查存储空间失败', storageErr)
    }
  }, [])

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  // 清理存储空间
  const handleCleanupStorage = useCallback(async () => {
    Alert.alert(
      '清理存储空间',
      '这将删除备份数据以释放存储空间。你的小说数据不会受到影响。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清理',
          onPress: async () => {
            try {
              const success = await cleanupStorage()
              if (success) {
                Alert.alert('清理成功', '已清理备份数据，释放了部分存储空间。')
                // 刷新存储信息
                const info = await getStorageInfo()
                setStorageInfo(info)
                const checkResult = await checkStorageSpace(0)
                setStorageWarning(checkResult)
              } else {
                Alert.alert('清理失败', '清理过程中出现错误，请重试。')
              }
            } catch (error) {
              console.error('清理存储失败', error)
              Alert.alert('清理失败', error.message || '清理过程中出现错误，请重试。')
            }
          },
        },
      ]
    )
  }, [])

  // 从TXT文件导入小说
  const handleImportNovel = useCallback(async () => {
    try {
      // 选择文件
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/plain',
        copyToCacheDirectory: true,
      })

      if (result.canceled) {
        return
      }

      const file = result.assets[0]
      if (!file) {
        Alert.alert('导入失败', '未选择文件')
        return
      }

      Alert.alert('导入中', '正在读取文件并解析章节，请稍候...', [{ text: '确定' }])

      // 读取文件内容，尝试多种编码
      // 优先使用 fetch 读取（避免 expo-file-system 老API的弃用/异常）
      let txtContent
      let readSuccess = false
      try {
        const res = await fetch(file.uri)
        if (res && res.ok) {
          txtContent = await res.text()
          if (txtContent && txtContent.trim().length > 0) {
            readSuccess = true
          }
        }
      } catch (e) {
        console.log('fetch 读取失败，尝试 legacy FileSystem', e)
      }

      // 兜底：若 fetch 失败，再尝试 legacy API
      if (!readSuccess) {
        try {
          txtContent = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' })
          if (txtContent && txtContent.trim().length > 0) {
            readSuccess = true
          }
        } catch (readError) {
          console.log('legacy FileSystem.readAsStringAsync 也失败', readError)
        }
      }

      if (!readSuccess || !txtContent) {
        Alert.alert(
          '导入失败',
          '无法读取文件内容。请确认文件为UTF-8编码，或将文件另存为UTF-8后再试。',
          [{ text: '确定' }]
        )
        return
      }

      if (!txtContent || txtContent.trim().length === 0) {
        Alert.alert('导入失败', '文件内容为空', [{ text: '确定' }])
        return
      }

      // 尝试从文件名推断标题
      let novelTitle = null
      if (file.name) {
        const nameWithoutExt = file.name.replace(/\.txt$/i, '').trim()
        if (nameWithoutExt) {
          novelTitle = nameWithoutExt
        }
      }

      // 导入小说
      const newNovel = await importNovelFromTxt(txtContent, novelTitle)

      Alert.alert(
        '导入成功',
        `小说《${newNovel.title}》已成功导入！\n共识别到 ${newNovel.volumes[0]?.chapters?.length || 0} 个章节`,
        [
          {
            text: '确定',
            onPress: () => {
              fetchData() // 刷新列表
            },
          },
        ]
      )
    } catch (error) {
      console.error('导入小说失败', error)
      Alert.alert('导入失败', error.message || '导入过程中出现错误，请重试', [
        { text: '确定' },
      ])
    }
  }, [fetchData])

  // 页面聚焦时加载数据
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchData)
    return unsubscribe
  }, [navigation, fetchData])

  // 搜索和排序逻辑优化
  const filteredAndSortedNovels = useMemo(() => {
    const safeLower = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
    const q = safeLower(search).trim();

    let filtered = (novels || [])
      .filter(Boolean)
      .filter(novel => safeLower(novel?.title).includes(q));
    
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'title': {
          const at = a?.title ?? '';
          const bt = b?.title ?? '';
          return at.localeCompare(bt, 'zh-CN');
        }
        case 'updatedAt':
          return new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0)
        case 'createdAt':
          return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
        case 'progress':
          return (b?.progress || 0) - (a?.progress || 0)
        default:
          return 0
      }
    })
  }, [novels, search, sortKey])

  // 渲染小说项目
  const renderNovel = useCallback(({ item }) => (
    <NovelItem 
      item={item} 
      viewMode={viewMode} 
      cardWidth={cardWidth} 
      onNovelPress={handleNovelPress} 
    />
  ), [viewMode, cardWidth, handleNovelPress]);

  // 渲染头部
  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      {/* 顶部操作栏 */}
      <View style={styles.topActions}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateNovel')}
          activeOpacity={0.7}
        >
          <Text style={styles.createButtonText} numberOfLines={1}>✨ 创建新小说</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createButton, styles.importButton]}
          onPress={handleImportNovel}
          activeOpacity={0.7}
        >
          <Text style={[styles.createButtonText, styles.importButtonText]} numberOfLines={1}>📥 导入TXT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewModeButton}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          activeOpacity={0.8}
        >
          <Text style={styles.viewModeIcon}>
            {viewMode === 'grid' ? '☰' : '⊞'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 搜索框 */}
      <SearchBar 
        value={search} 
        onChange={setSearch}
        placeholder="搜索小说标题..."
      />

      {/* 仅开发环境显示的调试按钮 */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={handleRunStressTest}
            activeOpacity={0.8}
          >
            <Text style={styles.debugButtonText}>🧪 运行章节压力测试</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.debugButton, { marginTop: 8, opacity: largeImporting ? 0.6 : 1 }]}
            onPress={handleImportLargeNovelForTest}
            activeOpacity={0.8}
            disabled={largeImporting}
          >
            <Text style={styles.debugButtonText}>{largeImporting ? '⏳ 正在导入大文件…' : '📦 导入 >1.5MB 小说测试'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 排序选择器 */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>
          {SORT_OPTIONS.find(opt => opt.value === sortKey)?.icon} 排序：
        </Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={sortKey}
            onValueChange={setSortKey}
            style={styles.picker}
          >
            {SORT_OPTIONS.map(option => (
              <Picker.Item 
                key={option.value}
                label={option.label} 
                value={option.value} 
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* 统计信息 */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          📚 共 {filteredAndSortedNovels.length} 本小说
          {search && ` · 筛选结果`}
        </Text>
        {/* 存储空间信息 */}
        {storageInfo && (
          <View style={styles.storageInfoContainer}>
            <Text style={[
              styles.storageText,
              storageWarning?.level === 'danger' && styles.storageTextDanger,
              storageWarning?.level === 'warning' && styles.storageTextWarning
            ]}>
              💾 存储: {storageInfo.estimatedSizeMB}MB
              {storageWarning?.level === 'danger' && ' ⚠️'}
              {storageWarning?.level === 'warning' && ' ⚡'}
            </Text>
            {storageWarning && storageWarning.level !== 'ok' && (
              <TouchableOpacity
                style={styles.cleanupButton}
                onPress={handleCleanupStorage}
                activeOpacity={0.7}
              >
                <Text style={styles.cleanupButtonText}>清理</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  ), [search, sortKey, filteredAndSortedNovels.length, viewMode, navigation])

  // 渲染空状态
  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>
        {search ? '🔍' : '📚'}
      </Text>
      <Text style={styles.emptyTitle}>
        {search ? '没有找到相关小说' : '书架还是空的'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {search 
          ? '尝试调整搜索关键词' 
          : '快去创建第一本小说开始你的创作之旅吧！'
        }
      </Text>
      {!search && (
        <TouchableOpacity
          style={styles.emptyAction}
          onPress={() => navigation.navigate('CreateNovel')}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyActionText}>➕ 立即创建</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [search, navigation])

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <FlatList
        data={filteredAndSortedNovels}
        keyExtractor={(item) => item.id}
        renderItem={renderNovel}
        numColumns={numColumns}
        key={`${numColumns}-${viewMode}`} // 强制重新渲染当列数或视图模式改变时
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={[
          styles.listContent,
          filteredAndSortedNovels.length === 0 && styles.emptyListContent
        ]}
        columnWrapperStyle={numColumns > 1 ? styles.row : null}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007bff']}
            tintColor="#007bff"
          />
        }
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={6}
        getItemLayout={viewMode === 'list' ? (data, index) => ({
          length: 80,
          offset: 80 * index,
          index,
        }) : undefined}
      />
      
      {/* 加载指示器 */}
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>📖 正在加载书架...</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc'
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 4
  },
  debugContainer: {
    marginTop: 0,
    marginBottom: 10,
  },
  debugButton: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FFEEBA',
  },
  debugButtonText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
    gap: 10,
    paddingHorizontal: 1
  },
  createButton: {
    flex: 1,
    backgroundColor: '#E8F4FD', // 清新淡雅的浅蓝色
    borderColor: 'rgb(224, 234, 253)', 
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
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
  importButton: {
    backgroundColor: '#E8F9E5', // 清新淡雅的浅绿色
    borderWidth: 1,
    borderColor: 'rgb(222, 251, 208)',
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
  createButtonText: {
    color: '#4299E1', // 柔和的蓝绿色文字
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  importButtonText: {
    color: '#4A90A4', // 柔和的绿色文字
  },
  viewModeButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 44, // 与 createButton 和 importButton 保持一致的高度
    borderColor: '#dee2e6',
    minHeight: 35,
    ...Platform.select({
      ios: {
        shadowColor: '#D0D5DA',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 2
      },
      android: {
        elevation: 2
      }
    })
  },
  viewModeIcon: {
    fontSize: 16,
    color: '#495057'
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12
  },
  cardContainer: {
    marginBottom: 12
  },
  novelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8
      },
      android: {
        elevation: 4
      }
    })
  },
  coverContainer: {
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative'
  },
  coverImageContainer: {
    width: '100%',
    aspectRatio: 3/4, // 书籍封面比例
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f3f4'
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 3/4, // 书籍封面比例
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  coverIcon: {
    fontSize: 32,
    opacity: 0.5
  },
  statusBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  statusText: {
    fontSize: 10,
    fontWeight: '400'
  },
  bookInfo: {
    alignItems: 'center'
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 18
  },
  updateTime: {
    fontSize: 11,
    color: '#6c757d',
    marginBottom: 4
  },
  progressText: {
    fontSize: 10,
    color: '#007bff',
    fontWeight: '300'
  },
  // 列表模式样式
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6
      },
      android: {
        elevation: 2
      }
    })
  },
  listCover: {
    width: 50,
    height: 65,
    backgroundColor: '#f1f3f4',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden'
  },
  listCoverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  listCoverIcon: {
    fontSize: 20,
    opacity: 0.5
  },
  listInfo: {
    flex: 1
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#212529',
    marginBottom: 4
  },
  listMeta: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2
  },
  listProgress: {
    fontSize: 11,
    color: '#007bff',
    fontWeight: '300'
  },
  listStatus: {
    alignItems: 'flex-end'
  },
  listStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  listStatusText: {
    fontSize: 11,
    fontWeight: '400'
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: '#E8ECEF', // 更淡的边框
    minHeight: 40, // 稍微增加高度，确保文字完整显示
    ...Platform.select({
      ios: {
        shadowColor: '#D0D5DA',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3
      },
      android: {
        elevation: 0.5
      }
    })
  },
  sortLabel: {
    fontSize: 15.5,
    color: '#6B7A8A', // 更柔和的文字颜色
    fontWeight: '400',
    minWidth: 65
  },
  pickerContainer: {
    flex: 1,
    minHeight: 45,
    justifyContent: 'center'
  },
  picker: {
    height: 50,
    backgroundColor: 'transparent',
    marginHorizontal: -8,
    color: '#6B7A8A' // 更柔和的文字颜色
  },
  statsContainer: {
    alignItems: 'center',
    marginTop: 7,
    marginBottom: 1
  },
  statsText: {
    fontSize: 13,
    color: '#8A9BA8', // 更柔和的文字颜色
    fontWeight: '400'
  },
  storageInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8
  },
  storageText: {
    fontSize: 12,
    color: '#8A9BA8',
    fontWeight: '400'
  },
  storageTextWarning: {
    color: '#F59E0B' // 警告颜色（橙色）
  },
  storageTextDanger: {
    color: '#EF4444' // 危险颜色（红色）
  },
  cleanupButton: {
    backgroundColor: '#FEF3C7', // 淡黄色背景
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  cleanupButtonText: {
    fontSize: 11,
    color: '#92400E', // 深棕色文字
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
    opacity: 0.6
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#343a40',
    textAlign: 'center',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24
  },
  emptyAction: {
    backgroundColor: '#E8F4F8', // 与创建按钮一致的淡雅颜色
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1E7F0',
    ...Platform.select({
      ios: {
        shadowColor: '#B8D4E3',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      },
      android: {
        elevation: 2
      }
    })
  },
  emptyActionText: {
    color: '#4A90A4', // 与创建按钮文字一致的颜色
    fontSize: 15,
    fontWeight: '500'
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 250, 252, 0.9)'
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '300'
  }
})