// 小说书架页 - 优化版本
import React, { useEffect, useState, useMemo, useCallback } from 'react'
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
  Alert
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { loadNovels } from '../storage/storage'
import SearchBar from '../components/SearchBar'
import NovelCard from '../components/NovelCard'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

// 排序选项配置
const SORT_OPTIONS = [
  { label: '按书名排序', value: 'title', icon: '📚' },
  { label: '按更新时间排序', value: 'updatedAt', icon: '🕐' },
  { label: '按创建时间排序', value: 'createdAt', icon: '📅' },
  { label: '按阅读进度排序', value: 'progress', icon: '📖' }
]

// 状态标签配置
const STATUS_CONFIG = {
  '连载中': { color: '#28a745', bg: '#d4edda' },
  '已完结': { color: '#007bff', bg: '#d1ecf1' },
  '暂停': { color: '#ffc107', bg: '#fff3cd' },
  '草稿': { color: '#6c757d', bg: '#e2e3e5' }
}

export default function BookshelfScreen({ navigation }) {
  const [novels, setNovels] = useState([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('updatedAt') // 默认按更新时间排序
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // grid 或 list

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
    try {
      setLoading(true)
      const data = await loadNovels()
      setNovels(data || [])
    } catch (error) {
      console.error('加载小说数据失败:', error)
      Alert.alert('错误', '加载数据失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  // 页面聚焦时加载数据
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchData)
    return unsubscribe
  }, [navigation, fetchData])

  // 搜索和排序逻辑优化
  const filteredAndSortedNovels = useMemo(() => {
    let filtered = novels.filter(novel =>
      novel.title.toLowerCase().includes(search.toLowerCase().trim())
    )
    
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return a.title.localeCompare(b.title, 'zh-CN')
        case 'updatedAt':
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        case 'createdAt':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        case 'progress':
          return (b.progress || 0) - (a.progress || 0)
        default:
          return 0
      }
    })
  }, [novels, search, sortKey])

  // 渲染网格模式的小说卡片
  const renderGridNovel = useCallback(({ item }) => (
    <View style={[styles.cardContainer, { width: cardWidth }]}>
      <TouchableOpacity
        style={styles.novelCard}
        onPress={() => navigation.navigate('NovelDetail', { novelId: item.id })}
        activeOpacity={0.7}
      >
        {/* 封面区域 */}
        <View style={styles.coverContainer}>
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverIcon}>📖</Text>
            {/* 状态标签 */}
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
        </View>
        
        {/* 书籍信息 */}
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
          {/* 阅读进度 */}
          {item.progress && (
            <Text style={styles.progressText}>
              阅读进度: {Math.round(item.progress)}%
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  ), [cardWidth, navigation])

  // 渲染列表模式的小说卡片
  const renderListNovel = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.listCard}
      onPress={() => navigation.navigate('NovelDetail', { novelId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.listCover}>
        <Text style={styles.listCoverIcon}>📖</Text>
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
  ), [navigation])

  // 渲染小说项目
  const renderNovel = useCallback((props) => {
    return viewMode === 'grid' ? renderGridNovel(props) : renderListNovel(props)
  }, [viewMode, renderGridNovel, renderListNovel])

  // 渲染头部
  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      {/* 顶部操作栏 */}
      <View style={styles.topActions}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateNovel')}
          activeOpacity={0.8}
        >
        <Text style={styles.createButtonText}>✨ 创建新小说</Text>
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
    backgroundColor: '#f8f9fa'
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
    paddingVertical: 15
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18
  },
  createButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#007bff',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6
      },
      android: {
        elevation: 4
      }
    })
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15.7,
    fontWeight: '300',
  },
  viewModeButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
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
  viewModeIcon: {
    fontSize: 18,
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
    marginRight: 12
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
    marginVertical: 4,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 0.8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 2,
  },
  sortLabel: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '300',
    minWidth: 70
  },
  pickerContainer: {
    flex: 1,
    minHeight: 50
  },
  picker: {
    height: 50,
    backgroundColor: 'transparent',
    marginHorizontal: -8,
    color: '#495057'
  },
  statsContainer: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 3
  },
  statsText: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: '400'
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
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#007bff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4
      },
      android: {
        elevation: 3
      }
    })
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 249, 250, 0.9)'
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '300'
  }
})