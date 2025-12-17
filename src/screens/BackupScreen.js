import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { listBackups, restoreFromBackup, deleteBackup } from '../storage/storage';
import { useNavigation } from '@react-navigation/native';

const BackupItem = React.memo(({ item, onRestore, onDelete }) => (
  <View style={styles.backupItem}>
    <View style={styles.backupInfo}>
      <Text style={styles.backupName} numberOfLines={1}>{item.name.replace('.json', '')}</Text>
      <Text style={styles.backupDate}>
        创建于: {new Date(item.date).toLocaleString('zh-CN')}
      </Text>
    </View>
    <View style={styles.backupActions}>
      <TouchableOpacity style={[styles.button, styles.restoreButton]} onPress={() => onRestore(item.name)}>
        <Text style={styles.buttonText}>恢复</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={() => onDelete(item.name)}>
        <Text style={styles.buttonText}>删除</Text>
      </TouchableOpacity>
    </View>
  </View>
));

export default function BackupScreen() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const loadBackupList = useCallback(async () => {
    setLoading(true);
    const backupFiles = await listBackups();
    setBackups(backupFiles);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadBackupList);
    return unsubscribe;
  }, [navigation, loadBackupList]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBackupList();
    setRefreshing(false);
  }, [loadBackupList]);

  const handleRestore = useCallback((fileName) => {
    Alert.alert(
      '恢复确认',
      `你确定要从这个备份恢复吗？\n\n这将覆盖当前所有的书架数据，此操作不可撤销！`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认恢复',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await restoreFromBackup(fileName);
              Alert.alert('恢复成功', '数据已成功恢复。应用将返回书架。', [
                { text: '好的', onPress: () => navigation.navigate('Bookshelf') },
              ]);
            } catch (error) {
              Alert.alert('恢复失败', error.message || '恢复过程中发生未知错误。');
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [navigation]);

  const handleDelete = useCallback((fileName) => {
    Alert.alert(
      '删除确认',
      `你确定要永久删除备份文件 "${fileName}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await deleteBackup(fileName);
            await loadBackupList(); // Refresh the list
          },
        },
      ]
    );
  }, [loadBackupList]);

  const renderBackupItem = useCallback(({ item }) => (
    <BackupItem item={item} onRestore={handleRestore} onDelete={handleDelete} />
  ), [handleRestore, handleDelete]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗄️</Text>
        <Text style={styles.emptyTitle}>没有找到任何备份</Text>
        <Text style={styles.emptySubtitle}>应用会在每次启动时自动创建备份。</Text>
    </View>
  );

  return (
    <View style={styles.container}>
        {loading && backups.length === 0 ? (
            <ActivityIndicator size="large" color="#8e8ee0" style={styles.loadingIndicator} />
        ) : (
            <FlatList
                data={backups}
                keyExtractor={(item) => item.name}
                renderItem={renderBackupItem}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8e8ee0']} />
                }
            />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc',
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  backupItem: {
    backgroundColor: '#fffafc',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backupInfo: {
    flex: 1,
    marginRight: 12,
  },
  backupName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#343a40',
  },
  backupDate: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  restoreButton: {
    backgroundColor: '#28a745',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});





