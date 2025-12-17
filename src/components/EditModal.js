import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useTheme } from '../styles/ThemeContext';

const getStyles = (theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', // 居中显示弹窗
      alignItems: 'center',
    },
    keyboardCenterWrapper: {
      width: '92%',
      maxHeight: '85%',
    },
    modalContainer: {
      backgroundColor: theme.background,
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
      width: '100%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.headerText,
    },
    fullScreenButtonText: {
      fontSize: 14,
      color: theme.actionText,
    },
    inputContainer: {
      height: 300, // 限制输入区域最大高度
    },
    input: {
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.borderColor,
      color: theme.inputText,

      textAlignVertical: 'top',
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    button: {
      paddingVertical: 12,
      paddingHorizontal: 35,
      borderRadius: 25,
      marginHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButton: {
      backgroundColor: theme.sendButton,
    },
    cancelButton: {
      backgroundColor: 'transparent',
    },
    saveButtonText: {
      color: theme.sendButtonText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    cancelButtonText: {
      color: theme.placeholderText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    editModeContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 15,
      marginBottom: 5,
    },
    editModeButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

const EditModal = ({
  isVisible,
  onClose,
  onSave,
  initialText,
  onFullScreenEdit,
  messageAuthor,
}) => {
  const [text, setText] = useState('');
  const [editMode, setEditMode] = useState('new_version'); // 'new_version' | 'overwrite'
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  useEffect(() => {
    if (isVisible) {
      setText(initialText);
    }
  }, [isVisible, initialText]);

  const handleSave = () => {
    onSave(text, editMode);
    onClose();
  };

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'position'; // Android 用 position，使弹窗随键盘上移
  const keyboardVerticalOffset = Platform.select({ ios: 0, android: 0 });

  return (
    <Modal
      animationType="fade"
      transparent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={keyboardBehavior}
            keyboardVerticalOffset={keyboardVerticalOffset}
            style={styles.keyboardCenterWrapper}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>编辑消息</Text>
                <TouchableOpacity onPress={onFullScreenEdit}>
                  <Text style={styles.fullScreenButtonText}>全屏编辑</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, styles.inputContainer]}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                placeholderTextColor={theme.placeholderText}
              />

              {messageAuthor === 'user' && (
                <View style={styles.editModeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor:
                          editMode === 'overwrite'
                            ? theme.editModeButtonBgActive
                            : theme.editModeButtonBg,
                        paddingHorizontal: 20,
                      },
                    ]}
                    onPress={() => setEditMode('overwrite')}
                  >
                    <Text
                      style={[
                        styles.editModeButtonText,
                        {
                          color:
                            editMode === 'overwrite'
                              ? theme.editModeButtonTextActive
                              : theme.editModeButtonText,
                        },
                      ]}
                    >
                      覆盖原版本
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor:
                          editMode === 'new_version'
                            ? theme.editModeButtonBgActive
                            : theme.editModeButtonBg,
                        paddingHorizontal: 20,
                      },
                    ]}
                    onPress={() => setEditMode('new_version')}
                  >
                    <Text
                      style={[
                        styles.editModeButtonText,
                        {
                          color:
                            editMode === 'new_version'
                              ? theme.editModeButtonTextActive
                              : theme.editModeButtonText,
                        },
                      ]}
                    >
                      创建新版本
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default React.memo(EditModal);
