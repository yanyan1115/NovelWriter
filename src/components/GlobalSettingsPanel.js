import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
  TextInput,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { defaultGlobalSettings } from '../storage/chatStorage';
import { useTheme } from '../styles/ThemeContext';

const getStyles = (theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelContainer: {
    width: Dimensions.get('window').width * 0.9,
    backgroundColor: theme.background,
    borderRadius: 20,
    paddingVertical: 25,
    paddingHorizontal: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
    color: theme.headerText,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 12,
  },
  tabButtonText: {
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
  contentContainer: {
    marginTop: 20,
    minHeight: 220,
    paddingHorizontal: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    color: theme.headerText,
    fontWeight: '600',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.headerText,
    fontWeight: '500',
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
    alignItems: 'center',
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
  segmentedControlContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
    overflow: 'hidden',
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

const SettingSwitch = ({ label, value, onValueChange, styles, theme }) => (
  <View style={styles.row}>
    <Text style={styles.settingLabel}>{label}</Text>
    <Switch 
      value={value} 
      onValueChange={onValueChange} 
      trackColor={{ false: theme.borderColor, true: theme.actionText }}
      thumbColor={value ? "#fff" : "#fff"}
    />
  </View>
);

const SettingSlider = ({ label, value, onValueChange, min, max, step, styles, theme }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.sliderContainer}>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={theme.actionText}
        maximumTrackTintColor={theme.borderColor}
        thumbTintColor={theme.actionText}
      />
      <View style={styles.sliderValueContainer}>
        <Text style={styles.sliderValueText}>{value}</Text>
      </View>
    </View>
  </View>
);

const SegmentedControl = ({ label, options, selectedValue, onValueChange, styles }) => (
    <View style={styles.inputGroup}>
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

const GlobalSettingsPanel = ({ isVisible, onClose, onSave, globalSettings }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [settings, setSettings] = useState({ ...defaultGlobalSettings, ...globalSettings });
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setSettings({ ...defaultGlobalSettings, ...globalSettings });
    }
  }, [globalSettings, isVisible]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const themeOptions = [
    { label: '浅色', value: 'light' },
    { label: '深色', value: 'dark' },
  ];

  const contextLimitOptions = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '不限制', value: Infinity },
  ];

  const renderTabContent = () => {
    if (activeTab === 0) {
      return (
        <View>
          <SegmentedControl
            label="主题 (Theme)"
            options={themeOptions}
            selectedValue={settings.theme}
            onValueChange={v => updateSetting('theme', v)}
            styles={styles}
          />
          <SettingSlider
            label="字体大小 (Font Size)"
            value={settings.fontSize}
            onValueChange={v => updateSetting('fontSize', v)}
            min={10}
            max={22}
            step={1}
            styles={styles}
            theme={theme}
          />
          <SegmentedControl
            label="上下文消息数量上限"
            options={contextLimitOptions}
            selectedValue={settings.contextMessageLimit}
            onValueChange={v => updateSetting('contextMessageLimit', v)}
            styles={styles}
          />
        </View>
      );
    }
    return (
      <View>
        <SettingSwitch label="显示消息的字数统计" value={settings.showWordCount} onValueChange={v => updateSetting('showWordCount', v)} styles={styles} theme={theme} />
        <SettingSwitch label="显示消息的Token数量" value={settings.showTokenCount} onValueChange={v => updateSetting('showTokenCount', v)} styles={styles} theme={theme} />
        <SettingSwitch label="显示消息的Token消耗" value={settings.showTokenCost} onValueChange={v => updateSetting('showTokenCost', v)} styles={styles} theme={theme} />
        <SettingSwitch label="显示模型名称" value={settings.showModelName} onValueChange={v => updateSetting('showModelName', v)} styles={styles} theme={theme} />
        <SettingSwitch label="显示消息的时间戳" value={settings.showTimestamp} onValueChange={v => updateSetting('showTimestamp', v)} styles={styles} theme={theme} />
        <SettingSwitch label="显示首字耗时" value={settings.showFirstTokenTime} onValueChange={v => updateSetting('showFirstTokenTime', v)} styles={styles} theme={theme} />
      </View>
    );
  };

  if (!settings) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.panelContainer}>
          <Text style={styles.title}>全局设置</Text>

          <View style={styles.tabsContainer}>
            <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab(0)}>
              <Text style={[styles.tabButtonText, activeTab === 0 && styles.activeTabText]}>显示 & 行为</Text>
              {activeTab === 0 && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab(1)}>
              <Text style={[styles.tabButtonText, activeTab === 1 && styles.activeTabText]}>元数据</Text>
              {activeTab === 1 && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            {renderTabContent()}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default GlobalSettingsPanel;
