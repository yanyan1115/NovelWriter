import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
} from 'react-native';
import { loadNovels, saveNovels } from '../storage/storage';
import { useTheme } from '../styles/ThemeContext';

const getStyles = (theme) => StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    height: '70%',
    backgroundColor: theme.background,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.headerText,
  },
  titleInput: {
    width: '100%',
    height: 45,
    borderColor: theme.borderColor,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16,
    color: theme.inputText,
    backgroundColor: theme.inputBackground,
  },
  selectorContainer: {
    flexDirection: 'row',
    width: '100%',
    flex: 1,
  },
  listContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 10,
    margin: 5,
    padding: 10,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: theme.headerText,
  },
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  selectedItem: {
    backgroundColor: theme.messageBubbleUser,
  },
  itemText: {
    fontSize: 16,
    color: theme.inputText,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    width: '40%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.disabledText,
  },
  importButton: {
    backgroundColor: theme.sendButton,
  },
  buttonText: {
    color: theme.sendButtonText,
    fontWeight: 'bold',
  },
});

const ImportChapterModal = ({ isVisible, onClose, chapterContent }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [novels, setNovels] = useState([]);
  const [selectedNovelId, setSelectedNovelId] = useState(null);
  const [selectedVolumeId, setSelectedVolumeId] = useState(null);
  const [chapterTitle, setChapterTitle] = useState('');

  useEffect(() => {
    if (isVisible) {
      const fetchNovels = async () => {
        const loadedNovels = await loadNovels();
        setNovels(loadedNovels);
      };
      fetchNovels();
      const defaultTitle = `新章节 - ${new Date().toLocaleDateString()}`;
      setChapterTitle(defaultTitle);
    } else {
      setNovels([]);
      setSelectedNovelId(null);
      setSelectedVolumeId(null);
      setChapterTitle('');
    }
  }, [isVisible, chapterContent]);

  const handleImport = async () => {
    if (!chapterTitle.trim()) {
      Alert.alert('错误', '请输入章节标题~(˶╹ꇴ╹˶)~。');
      return;
    }
    if (!selectedNovelId || !selectedVolumeId) {
      Alert.alert('错误', '请选择要导入的小说和卷~(˶╹ꇴ╹˶)~');
      return;
    }

    const allNovels = await loadNovels();
    const novelIndex = allNovels.findIndex(n => n.id === selectedNovelId);
    if (novelIndex === -1) return;

    const volumeIndex = allNovels[novelIndex].volumes.findIndex(v => v.id === selectedVolumeId);
    if (volumeIndex === -1) return;

    const newChapter = {
      id: Date.now().toString(),
      title: chapterTitle.trim(),
      content: chapterContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allNovels[novelIndex].volumes[volumeIndex].chapters.push(newChapter);

    await saveNovels(allNovels);

    Alert.alert('成功', '章节已成功导入！');
    onClose();
  };

  const renderNovelItem = React.useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.item, selectedNovelId === item.id && styles.selectedItem]}
      onPress={() => {
        setSelectedNovelId(item.id);
        setSelectedVolumeId(null);
      }}>
      <Text style={styles.itemText}>{item.title}</Text>
    </TouchableOpacity>
  ), [selectedNovelId]);

  const renderVolumeItem = React.useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.item, selectedVolumeId === item.id && styles.selectedItem]}
      onPress={() => setSelectedVolumeId(item.id)}>
      <Text style={styles.itemText}>{item.title}</Text>
    </TouchableOpacity>
  ), [selectedVolumeId]);

  const selectedNovel = novels.find(n => n.id === selectedNovelId);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>导入到章节</Text>

          <TextInput
            style={styles.titleInput}
            value={chapterTitle}
            onChangeText={setChapterTitle}
            placeholder="输入新章节标题"
            placeholderTextColor={theme.placeholderText}
          />

          <View style={styles.selectorContainer}>
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>选择小说</Text>
              <FlatList
                data={novels}
                renderItem={renderNovelItem}
                keyExtractor={item => item.id}
              />
            </View>

            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>选择卷</Text>
              {selectedNovel && (
                <FlatList
                  data={selectedNovel.volumes}
                  renderItem={renderVolumeItem}
                  keyExtractor={item => item.id}
                />
              )}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.buttonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.importButton]}
              onPress={handleImport}
              disabled={!selectedVolumeId}>
              <Text style={styles.buttonText}>导入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ImportChapterModal;
