import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../styles/ThemeContext';

const getStyles = (theme) => StyleSheet.create({
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  modalOverlay: { 
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  panelContainer: { 
    width: '80%', 
    height: '100%', 
    backgroundColor: theme.background, 
    padding: 15,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.inputBackground, 
    borderRadius: 25, 
    paddingHorizontal: 15, 
    marginBottom: 15, 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 5 
  },
  searchInput: { 
    flex: 1, 
    height: 50, 
    marginLeft: 10, 
    fontSize: 16,
    color: theme.inputText,
  },
  newChatButton: { 
    backgroundColor: theme.messageBubbleUser, 
    borderRadius: 25, 
    padding: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: theme.borderColor 
  },
  newChatIcon: { fontSize: 20 },
  newChatButtonText: { 
    color: theme.actionText, 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginLeft: 8 
  },
  globalSettingsButton: { 
    backgroundColor: theme.inputBackground, 
    borderRadius: 25, 
    padding: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: theme.borderColor 
  },
  globalSettingsIcon: { fontSize: 20, color: '#90a4ae' },
  globalSettingsButtonText: { 
    color: theme.actionText, 
    fontSize: 16, 
    marginLeft: 8, 
    fontWeight: 'bold' 
  },
  listHeader: { 
    fontSize: 14, 
    color: theme.placeholderText, 
    marginLeft: 5, 
    marginBottom: 10 
  },
  list: { flex: 1 },
  itemContainer: { 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: theme.borderColor 
  },
  itemTitle: { 
    fontSize: 16, 
    color: theme.headerText, 
    fontWeight: '400' 
  },
  menuOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.4)' 
  },
  menuContainer: { 
    backgroundColor: theme.background, 
    borderRadius: 10, 
    padding: 10, 
    width: 200, 
    elevation: 5 
  },
  menuItem: { 
    paddingVertical: 15, 
    alignItems: 'center' 
  },
  menuText: { 
    fontSize: 18, 
    color: theme.inputText 
  },
  renameModalContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.4)' 
  },
  renameModalContent: { 
    width: '80%', 
    backgroundColor: theme.background, 
    borderRadius: 10, 
    padding: 20 
  },
  renameTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15,
    color: theme.headerText,
  },
  renameInput: { 
    borderWidth: 1, 
    borderColor: theme.borderColor, 
    borderRadius: 5, 
    padding: 10, 
    marginBottom: 20,
    color: theme.inputText,
  },
  renameButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  renameButtonText: {
    color: theme.inputText,
  }
});

const SessionPanel = ({
  isVisible,
  onClose,
  sessions,
  onSelectSession,
  onCreateNew,
  onDeleteSession,
  onRenameSession,
  onTogglePinSession,
  onGoToGlobalSettings,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [searchText, setSearchText] = React.useState('');
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [renameModalVisible, setRenameModalVisible] = React.useState(false);
  const [selectedSession, setSelectedSession] = React.useState(null);
  const [newTitle, setNewTitle] = React.useState('');
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width * 0.8)).current;

  const safeLower = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
  const q = safeLower(searchText);
  const filteredSessions = (sessions || [])
    .filter(Boolean)
    .filter(session => safeLower(session?.title).includes(q));

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -Dimensions.get('window').width * 0.8,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  const handleLongPress = React.useCallback(session => {
    setSelectedSession(session);
    setMenuVisible(true);
  }, []);

  const handleRename = () => {
    setMenuVisible(false);
    setNewTitle(selectedSession.title);
    setRenameModalVisible(true);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      '删除对话',
      `确定要删除“${selectedSession.title}”吗？此操作无法撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => onDeleteSession(selectedSession.id),
        },
      ]
    );
  };

  const handleTogglePin = () => {
    setMenuVisible(false);
    onTogglePinSession(selectedSession.id);
  };

  const onSaveRename = () => {
    if (newTitle.trim()) {
      onRenameSession(selectedSession.id, newTitle.trim());
    }
    setRenameModalVisible(false);
    setSelectedSession(null);
  };

  const renderSessionItem = React.useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => onSelectSession(item.id)}
      onLongPress={() => handleLongPress(item)}
    >
      <Text style={styles.itemTitle}>
        {item.isPinned ? '📌 ' : ''}{item.title}
      </Text>
    </TouchableOpacity>
  ), [onSelectSession, handleLongPress]);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenOverlay}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View style={[styles.panelContainer, { transform: [{ translateX: slideAnim }] }]} onStartShouldSetResponder={() => true}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.searchContainer}>
                  <Text style={{fontSize: 20}}>🧁</Text>
                  <TextInput
                      style={styles.searchInput}
                      placeholder="搜索对话"
                      placeholderTextColor={theme.placeholderText}
                      value={searchText}
                      onChangeText={setSearchText}
                  />
              </View>

              <TouchableOpacity style={styles.newChatButton} onPress={onCreateNew}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={styles.newChatIcon}>💕</Text>
                  <Text style={styles.newChatButtonText}>发起新对话</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.globalSettingsButton} onPress={onGoToGlobalSettings}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={styles.globalSettingsIcon}>❄️</Text>
                  <Text style={styles.globalSettingsButtonText}>全局设置</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.listHeader}>对话</Text>

              <FlatList
                data={filteredSessions}
                renderItem={renderSessionItem}
                keyExtractor={item => item.id}
                style={styles.list}
              />
            </SafeAreaView>
        </Animated.View>

        {/* Context Menu Modal */}
        <Modal
          transparent={true}
          visible={menuVisible}
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuContainer}>
              <TouchableOpacity style={styles.menuItem} onPress={handleRename}>
                <Text style={styles.menuText}>重命名</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleTogglePin}>
                <Text style={styles.menuText}>{selectedSession?.isPinned ? '取消固定' : '固定'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Text style={[styles.menuText, { color: 'red' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Rename Modal */}
        <Modal
          transparent={true}
          visible={renameModalVisible}
          onRequestClose={() => setRenameModalVisible(false)}
        >
          <View style={styles.renameModalContainer}>
            <View style={styles.renameModalContent}>
              <Text style={styles.renameTitle}>重命名对话</Text>
              <TextInput
                style={styles.renameInput}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus={true}
                placeholderTextColor={theme.placeholderText}
              />
              <View style={styles.renameButtons}>
                <TouchableOpacity onPress={() => setRenameModalVisible(false)}>
                  <Text style={styles.renameButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onSaveRename}>
                  <Text style={{ color: theme.actionText, fontWeight: 'bold' }}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

export default SessionPanel;
