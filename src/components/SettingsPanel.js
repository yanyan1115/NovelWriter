import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../styles/ThemeContext';

const getStyles = (theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panelContainer: {
    width: '90%',
    maxHeight: Dimensions.get('window').height * 0.85,
    backgroundColor: theme.background,
    borderRadius: 20,
    paddingHorizontal: 5,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  tab: {
    flex: 1,
    paddingBottom: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    color: theme.placeholderText,
  },
  activeTabText: {
    color: theme.actionText,
    fontWeight: 'bold',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.actionText,
    borderRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.headerText,
    textAlign: 'center',
    marginBottom: 20,
  },
  settingBlock: {
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    color: theme.headerText,
    fontWeight: '600',
    marginBottom: 10,
  },
  fullScreenButtonText: {
    fontSize: 14,
    color: theme.actionText,
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    color: theme.inputText,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  inputInsideContainer: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: theme.inputText,
  },
  visibilityToggleButton: {
    padding: 12,
  },
  visibilityToggleButtonText: {
    color: theme.actionText,
    fontWeight: '600',
  },
  textArea: {
    textAlignVertical: 'top',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  slider: {
    flex: 1,
  },
  sliderValueContainer: {
    width: 55,
    height: 35,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  sliderValueText: {
    color: theme.headerText,
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 10,
    paddingHorizontal: 20,
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
  imagePickerButton: {
    backgroundColor: theme.sendButton,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  imagePickerButtonText: {
    color: theme.sendButtonText,
    fontSize: 15,
    fontWeight: 'bold',
  },
  backgroundImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 10,
  },
  removeImageButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeImageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  segmentedControlContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
    overflow: 'hidden',
    marginBottom: 10,
  },
  segmentedControlButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControlButtonActive: {
    backgroundColor: theme.messageBubbleUser,
    borderRadius: 11,
  },
  segmentedControlButtonText: {
    fontSize: 14,
    color: theme.placeholderText,
  },
  segmentedControlButtonTextActive: {
    color: theme.actionText,
    fontWeight: 'bold',
  },
});

const SegmentedControl = ({ label, options, selectedValue, onValueChange, styles }) => (
  <View style={styles.settingBlock}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.segmentedControlContainer}>
      {options.map(option => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.segmentedControlButton,
            selectedValue === option.value && styles.segmentedControlButtonActive,
          ]}
          onPress={() => onValueChange(option.value)}
        >
          <Text style={[
            styles.segmentedControlButtonText,
            selectedValue === option.value && styles.segmentedControlButtonTextActive,
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const DEFAULT_PUNCT_TOKEN_IDS = [201, 223, 271, 303, 320, 410, 428, 430, 442, 768, 811, 965, 1148, 1175, 1227, 1237, 1248, 1847, 2096, 2136, 3505, 4945, 5309, 5532, 8496, 10695, 10970, 13399, 21016, 33803, 71984];

const defaultSettings = {
  modelProvider: 'DeepSeek',
  apiBaseUrl: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
  temperature: 1.0,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  max_tokens: 6000,
  usePunctuationBias: false,
  punctuationBiasTokenIds: DEFAULT_PUNCT_TOKEN_IDS,
  bubbleWidth: '90%',
  description: '',
  systemPrompt: '',
  backgroundImage: '',
  apiKey: '',
  debugLLM: false,
  debugLogitBiasProbe: false
};

const SettingsPanel = ({ isVisible, onClose, onSave, session, navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [title, setTitle] = useState('');
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState('设定');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  useEffect(() => {
    if (isVisible && session) {
      setTitle(session.title || '');
      const currentSettings = session.settings ? JSON.parse(JSON.stringify(session.settings)) : {};
      setSettings({ ...defaultSettings, ...currentSettings });
    } else if (!isVisible) {
      setTitle('');
      setSettings({});
    }
  }, [session, isVisible]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // 保存前做一次 tokenId 校验/清洗
    let nextSettings = { ...settings };
    if (typeof nextSettings.punctuationBiasTokenIds === 'string') {
      const raw = nextSettings.punctuationBiasTokenIds.trim();
      try {
        let arr;
        if (raw.startsWith('[')) {
          arr = JSON.parse(raw);
        } else if (raw.length === 0) {
          arr = [];
        } else {
          arr = raw.split(/[\s,，]+/).filter(Boolean).map(x => parseInt(x, 10));
        }
        if (!Array.isArray(arr)) throw new Error('not array');
        nextSettings.punctuationBiasTokenIds = Array.from(new Set(arr.map(n => Number(n)).filter(n => Number.isFinite(n) && n >= 0))).sort((a,b)=>a-b);
      } catch (e) {
        nextSettings.punctuationBiasTokenIds = [];
      }
    }

    onSave(title, nextSettings);
    onClose();
  };

  const handleFullScreenEdit = (key, value) => {
    if (!navigation || !session) return;

    navigation.navigate('LongTextEdit', {
      bookId: session.bookId,
      chapterId: session.id,
      field: key,
      initialValue: value,
      headerTitle: `编辑${key === 'description' ? '说明' : '指令'}`,
      onSave: (newValue) => {
        updateSetting(key, newValue);
      },
    });
  };

  const handleChooseImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert("需要相册权限才能选择背景图片！");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      updateSetting('backgroundImage', pickerResult.assets[0].uri);
    } else if (!pickerResult.canceled && pickerResult.uri) {
      updateSetting('backgroundImage', pickerResult.uri);
    }
  };

  const bubbleWidthOptions = [
    { label: '85%', value: '85%' },
    { label: '90%', value: '90%' },
    { label: '95%', value: '95%' },
    { label: '100%', value: '100%' },
  ];

  if (!session) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView
          style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}
          behavior="padding"
        >
          <TouchableOpacity activeOpacity={1} style={styles.panelContainer}>
            <ScrollView>
              <Text style={styles.title}>对话设定 (Agent)</Text>

              <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('设定')} style={styles.tab}>
                  <Text style={[styles.tabText, activeTab === '设定' && styles.activeTabText]}>设定</Text>
                  {activeTab === '设定' && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('外观')} style={styles.tab}>
                  <Text style={[styles.tabText, activeTab === '外观' && styles.activeTabText]}>外观</Text>
                  {activeTab === '外观' && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('模型')} style={styles.tab}>
                  <Text style={[styles.tabText, activeTab === '模型' && styles.activeTabText]}>模型</Text>
                  {activeTab === '模型' && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('参数')} style={styles.tab}>
                  <Text style={[styles.tabText, activeTab === '参数' && styles.activeTabText]}>参数</Text>
                  {activeTab === '参数' && <View style={styles.activeTabIndicator} />}
                </TouchableOpacity>
              </View>

              {activeTab === '设定' && (
                <>
                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>名称 (Name)</Text>
                    <TextInput
                      style={styles.input}
                      value={title}
                      onChangeText={setTitle}
                      placeholder="为此会话设置一个名称..."
                      placeholderTextColor={theme.placeholderText}
                    />
                  </View>

                  <View style={styles.settingBlock}>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>说明 (Description)</Text>
                      <TouchableOpacity onPress={() => handleFullScreenEdit('description', settings.description || '')}>
                        <Text style={styles.fullScreenButtonText}>全屏编辑</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.input, styles.textArea, { height: 60 }]}
                      value={settings.description || ''}
                      onChangeText={v => updateSetting('description', v)}
                      placeholder="介绍你的智能体，并说明 ta 的用途"
                      placeholderTextColor={theme.placeholderText}
                      multiline
                    />
                  </View>

                  <View style={styles.settingBlock}>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>指令 (System Prompt)</Text>
                      <TouchableOpacity onPress={() => handleFullScreenEdit('systemPrompt', settings.systemPrompt || '')}>
                        <Text style={styles.fullScreenButtonText}>全屏编辑</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.input, styles.textArea, { height: 90 }]}
                      value={settings.systemPrompt || ''}
                      onChangeText={v => updateSetting('systemPrompt', v)}
                      placeholder="定义智能体的角色和行为准则..."
                      placeholderTextColor={theme.placeholderText}
                      multiline
                    />
                  </View>
                </>
              )}

              {activeTab === '外观' && (
                <>
                  <SegmentedControl
                    label="聊天气泡宽度"
                    options={bubbleWidthOptions}
                    selectedValue={settings.bubbleWidth || '90%'}
                    onValueChange={v => updateSetting('bubbleWidth', v)}
                    styles={styles}
                  />
                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>聊天背景 (Background Image)</Text>
                    <TouchableOpacity style={styles.imagePickerButton} onPress={handleChooseImage}>
                      <Text style={styles.imagePickerButtonText}>从相册选择图片</Text>
                    </TouchableOpacity>
                    {settings.backgroundImage ? (
                      <View>
                        <Image source={{ uri: settings.backgroundImage }} style={styles.backgroundImagePreview} />
                        <TouchableOpacity style={styles.removeImageButton} onPress={() => updateSetting('backgroundImage', '')}>
                          <Text style={styles.removeImageButtonText}>移除图片</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </>
              )}

              {activeTab === '模型' && (
                <>
                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>模型提供方 (Model Provider)</Text>
                    <TextInput
                      style={styles.input}
                      value={settings.modelProvider || ''}
                      onChangeText={v => updateSetting('modelProvider', v)}
                      placeholder="DeepSeek"
                      placeholderTextColor={theme.placeholderText}
                    />
                  </View>

                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>API Key</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.inputInsideContainer}
                        value={settings.apiKey || ''}
                        onChangeText={v => updateSetting('apiKey', v)}
                        placeholder="你的大模型 API Key"
                        placeholderTextColor={theme.placeholderText}
                        secureTextEntry={!isApiKeyVisible}
                      />
                      <TouchableOpacity onPress={() => setIsApiKeyVisible(!isApiKeyVisible)} style={styles.visibilityToggleButton}>
                        <Text style={styles.visibilityToggleButtonText}>{isApiKeyVisible ? '隐藏' : '显示'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>API 域名 (API Base URL)</Text>
                    <TextInput
                      style={styles.input}
                      value={settings.apiBaseUrl || ''}
                      onChangeText={v => updateSetting('apiBaseUrl', v)}
                      placeholder="https://api.deepseek.com/chat/completions"
                      placeholderTextColor={theme.placeholderText}
                    />
                  </View>

                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>模型名称 (Model)</Text>
                    <TextInput
                      style={styles.input}
                      value={settings.model || ''}
                      onChangeText={v => updateSetting('model', v)}
                      placeholder="deepseek-chat"
                      placeholderTextColor={theme.placeholderText}
                    />
                  </View>
                </>
              )}

              {activeTab === '参数' && (
                <>
                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>严谨与想象 (Temperature)</Text>
                    <View style={styles.sliderContainer}>
                      <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={2}
                        step={0.05}
                        value={settings.temperature ?? 1.0}
                        onValueChange={v => updateSetting('temperature', v)}
                        minimumTrackTintColor={theme.actionText}
                        maximumTrackTintColor={theme.borderColor}
                        thumbTintColor={theme.actionText}
                      />
                      <View style={styles.sliderValueContainer}>
                        <Text style={styles.sliderValueText}>{(settings.temperature ?? 1.0).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>存在惩罚 (Presence Penalty)</Text>
                    <View style={styles.sliderContainer}>
                      <Slider
                        style={styles.slider}
                        minimumValue={-2}
                        maximumValue={2}
                        step={0.05}
                        value={settings.presence_penalty ?? 0.0}
                        onValueChange={v => updateSetting('presence_penalty', v)}
                        minimumTrackTintColor={theme.actionText}
                        maximumTrackTintColor={theme.borderColor}
                        thumbTintColor={theme.actionText}
                      />
                      <View style={styles.sliderValueContainer}>
                        <Text style={styles.sliderValueText}>{(settings.presence_penalty ?? 0.0).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>频率惩罚 (Frequency Penalty)</Text>
                    <View style={styles.sliderContainer}>
                      <Slider
                        style={styles.slider}
                        minimumValue={-2}
                        maximumValue={2}
                        step={0.05}
                        value={settings.frequency_penalty ?? 0.0}
                        onValueChange={v => updateSetting('frequency_penalty', v)}
                        minimumTrackTintColor={theme.actionText}
                        maximumTrackTintColor={theme.borderColor}
                        thumbTintColor={theme.actionText}
                      />
                      <View style={styles.sliderValueContainer}>
                        <Text style={styles.sliderValueText}>{(settings.frequency_penalty ?? 0.0).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.settingBlock}>
                    <Text style={styles.label}>最大生成长度 (Max Tokens)</Text>
                    <TextInput
                      style={styles.input}
                      value={String(settings.max_tokens ?? 6000)}
                      onChangeText={v => {
                        const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(num)) {
                          updateSetting('max_tokens', num);
                        } else {
                          updateSetting('max_tokens', 0);
                        }
                      }}
                      onBlur={() => {
                        const currentValue = settings.max_tokens ?? 6000;
                        if (currentValue < 50) {
                          updateSetting('max_tokens', 50);
                        } else if (currentValue > 10000) {
                          updateSetting('max_tokens', 10000);
                        }
                      }}
                      placeholder="50 - 10000"
                      placeholderTextColor={theme.placeholderText}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.settingBlock}>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>标点保护 (Punctuation Bias)</Text>
                      <Switch
                        value={!!settings.usePunctuationBias}
                        onValueChange={v => updateSetting('usePunctuationBias', v)}
                      />
                    </View>
                  </View>

                  <View style={styles.settingBlock}>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>标点 TokenIds (用于 logit_bias)</Text>
                      <TouchableOpacity onPress={() => updateSetting('punctuationBiasTokenIds', DEFAULT_PUNCT_TOKEN_IDS)}>
                        <Text style={styles.fullScreenButtonText}>一键填入</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.input, styles.textArea, { height: 80 }]}
                      value={Array.isArray(settings.punctuationBiasTokenIds)
                        ? JSON.stringify(settings.punctuationBiasTokenIds)
                        : (settings.punctuationBiasTokenIds ? String(settings.punctuationBiasTokenIds) : '[]')}
                      onChangeText={(v) => {
                        const raw = (v || '').trim();
                        try {
                          let arr;
                          if (raw.startsWith('[')) {
                            arr = JSON.parse(raw);
                          } else {
                            arr = raw.split(/[\s,，]+/).filter(Boolean).map(x => parseInt(x, 10));
                          }
                          if (!Array.isArray(arr)) throw new Error('not array');
                          const cleaned = Array.from(new Set(arr.map(n => Number(n)).filter(n => Number.isFinite(n) && n >= 0))).sort((a,b)=>a-b);
                          updateSetting('punctuationBiasTokenIds', cleaned);
                        } catch (e) {
                          updateSetting('punctuationBiasTokenIds', raw);
                        }
                      }}
                      placeholder='例如：[303,320,410,...] 或 303,320,410,...'
                      placeholderTextColor={theme.placeholderText}
                      multiline
                    />
                    <Text style={{ color: theme.placeholderText, fontSize: 12, marginTop: 6 }}>
                      建议：保持与模型对应的 tokenizer 一致。若接口不支持 logit_bias，会自动回退。
                    </Text>
                  </View>

                  {__DEV__ && (
                    <View style={styles.settingBlock}>
                      <View style={styles.labelContainer}>
                        <Text style={styles.label}>调试日志 (debugLLM)</Text>
                        <Switch
                          value={!!settings.debugLLM}
                          onValueChange={v => updateSetting('debugLLM', v)}
                        />
                      </View>
                      <Text style={{ color: theme.placeholderText, fontSize: 12, marginTop: 6 }}>
                        开启后会在控制台打印 LLM 请求关键字段（temperature/presence/frequency/max_tokens、messages 数量、是否带 logit_bias），用于排查“调参无效”。
                      </Text>
                    </View>
                  )}

                  {__DEV__ && (
                    <View style={styles.settingBlock}>
                      <TouchableOpacity
                        style={[styles.imagePickerButton, { marginBottom: 10 }]}
                        onPress={() => {
                          // 触发后，立即保存设置并关闭面板，确保开关状态生效
                          const nextSettings = { ...settings, debugLogitBiasProbe: true };
                          onSave(title, nextSettings);
                          onClose();
                          // 延迟 alert，避免在面板关闭动画期间卡顿
                          setTimeout(() => {
                            alert('已触发 logit_bias 对照测试：下一次发起请求时将自动进行两次短请求对照，并在终端输出统计。');
                          }, 500);
                        }}
                      >
                        <Text style={styles.imagePickerButtonText}>logit_bias 对照测试</Text>
                      </TouchableOpacity>
                      <Text style={{ color: theme.placeholderText, fontSize: 12, marginTop: 0 }}>
                        说明：会自动做两次“短输出”请求（一次带 logit_bias，一次不带），只在终端打印标点统计，不会打印 systemPrompt 或消息内容。
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.saveButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

export default SettingsPanel;
