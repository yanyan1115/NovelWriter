import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import MarkdownDisplay from 'react-native-markdown-display';

const MessageItem = ({ 
  item, 
  visibleMessages, // Receive the whole array
  replyingMessageIds, 
  styles, 
  markdownStyles, 
  metadataSettings, 
  theme,
  // Handlers
  handleSwitchVersion,
  handleToggleCollapse,
  handleOpenEditModal,
  handleCopyMessage,
  handleDeleteVersion,
  handleInsertAnswerBelow,
  handleImportChapter,
  handleRegenerateAnswer,
  onSetCollapsible,
  onUndoDelete,
  onHardDelete,
  onTombstoneExpire,
  pendingUndo,
}) => {

  const isLastVisibleMessage = visibleMessages && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1].id === item.id;

  // Tombstone（墓碑行）
  if (item?.type === 'tombstone') {
    const expiresAt = typeof item.expiresAt === 'number' ? item.expiresAt : new Date(item.expiresAt).getTime();
    const [remainingMs, setRemainingMs] = useState(() => Math.max(0, expiresAt - Date.now()));

    useEffect(() => {
      const timer = setInterval(() => {
        setRemainingMs(Math.max(0, expiresAt - Date.now()));
      }, 250);
      return () => clearInterval(timer);
    }, [expiresAt]);

    const totalSeconds = Math.ceil(remainingMs / 1000);

    useEffect(() => {
      if (totalSeconds <= 0) {
        onTombstoneExpire && onTombstoneExpire(item.undoId);
      }
      // 只在到期瞬间触发一次（undoId 不变）
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalSeconds, item.undoId]);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(1, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');

    return (
      <View style={styles.messageWrapper}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: theme.inputBackground,
            borderWidth: 1,
            borderColor: theme.inputBorder,
            opacity: 0.9,
          }}
        >
          <Text style={{ color: theme.disabledText, fontSize: 13 }} numberOfLines={1}>
            已删除（{mm}:{ss} 内可撤销）
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => onHardDelete && onHardDelete(item.undoId)}
              style={{ paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: theme.disabledText, fontWeight: 'bold' }}>
                彻底删除
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onUndoDelete && onUndoDelete(item.undoId)}
              disabled={totalSeconds <= 0}
              style={{ paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: totalSeconds <= 0 ? theme.disabledText : theme.actionText, fontWeight: 'bold' }}>
                撤销
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!item || !item.versions || item.versions.length === 0) {
    return null;
  }

  // 当“当前版本分支”被删除时：隐藏正文，只保留版本切换区域（在 footer）
  const currentVersionId = item?.versions?.[item.currentVersionIndex]?.id;
  const isCurrentVersionDeleted = !!(
    pendingUndo &&
    pendingUndo.anchorMessageId === item.id &&
    pendingUndo.anchorVersionId &&
    pendingUndo.anchorVersionId === currentVersionId &&
    pendingUndo.mode === 'subtree'
  );

  const isReplying = replyingMessageIds && replyingMessageIds.length > 0;

  const MetadataView = ({ message, settings, theme }) => {
    if (!settings) return null;

    const metaStyles = StyleSheet.create({
      metadataContainer: { 
        marginTop: 8, 
        paddingLeft: message.author === 'user' ? 0 : 5, 
        paddingRight: message.author === 'user' ? 5 : 0,
        alignItems: message.author === 'user' ? 'flex-end' : 'flex-start',
      },
      metadataText: { fontSize: 10, color: theme.disabledText },
    });

    const currentVersion = message.versions[message.currentVersionIndex];
    const metadata = currentVersion.metadata || {};
    const userMeta = [];
    const assistantMeta = [];

    // User Message Metadata
    if (message.author === 'user') {
      if (settings.showWordCount && metadata.wordCount) {
        userMeta.push(`字数: ${metadata.wordCount}`);
      }
      if (settings.showTokenCount && metadata.promptTokens) {
        userMeta.push(`Tokens: ${metadata.promptTokens}`);
      }
      if (settings.showTimestamp) {
        userMeta.push(`时间: ${new Date(message.timestamp).toLocaleTimeString()}`);
      }
    }

    // Assistant Message Metadata
    if (message.author === 'assistant') {
      if (settings.showWordCount && metadata.wordCount) {
        assistantMeta.push(`字数: ${metadata.wordCount}`);
      }
      if (settings.showTokenCount) {
        if (metadata.promptTokens) assistantMeta.push(`输入: ${metadata.promptTokens}`);
        if (metadata.completionTokens) assistantMeta.push(`输出: ${metadata.completionTokens}`);
      }
      if (settings.showTokenCost && metadata.totalTokens) {
        assistantMeta.push(`总消耗: ${metadata.totalTokens}`);
      }
      if (settings.showFirstTokenTime && metadata.firstTokenTime) {
        assistantMeta.push(`首字: ${(metadata.firstTokenTime / 1000).toFixed(2)}s`);
      }
      // This is a derived metric, not from the original request, but useful.
      // if (settings.showFirstTokenTime && metadata.totalTime) {
      //   assistantMeta.push(`总耗时: ${(metadata.totalTime / 1000).toFixed(2)}s`);
      // }
      if (settings.showModelName && metadata.model) {
        assistantMeta.push(`模型: ${metadata.model}`);
      }
      if (settings.showTimestamp) {
        assistantMeta.push(`时间: ${new Date(message.timestamp).toLocaleTimeString()}`);
      }
    }

    const metadataToShow = message.author === 'user' ? userMeta : assistantMeta;

    if (metadataToShow.length === 0) return null;

    return (
      <View style={metaStyles.metadataContainer}>
        <Text style={metaStyles.metadataText}>
          🔹 {metadataToShow.join(' | ')}
        </Text>
      </View>
    );
  };

  const handleTextLayout = useCallback((event) => {
    if (item.isCollapsible || !onSetCollapsible) return;

    const { lines } = event.nativeEvent;
    if (lines.length > 1.8) {
      onSetCollapsible(item.id, true);
    }
  }, [item.id, item.isCollapsible, onSetCollapsible]);

  const handleViewLayout = useCallback((event) => {
    if (item.isCollapsible || !onSetCollapsible) return;

    const { height } = event.nativeEvent.layout;
    const singleLineHeight = (markdownStyles.body.fontSize || 16) * 1.5; // Estimate line height
    if (height > singleLineHeight * 1.8) {
      onSetCollapsible(item.id, true);
    }
  }, [item.id, item.isCollapsible, onSetCollapsible, markdownStyles.body.fontSize]);

  const currentVersionIndex = item.currentVersionIndex;
  const currentVersion = item.versions[currentVersionIndex] || { text: '' };
  const displayText = currentVersion.text ?? '';
  const canSwitchPrev = item.currentVersionIndex > 0;
  const canSwitchNext = item.currentVersionIndex < item.versions.length - 1;

  const lineHeighEstimate = (styles.messageText.fontSize || 16) * 1.5;
  const collapsedMaxHeight = lineHeighEstimate * 1.8;

  const messageContentStyle = {
    maxHeight: item.isCollapsed ? collapsedMaxHeight : undefined,
  };

  const messageContent = (
    isCurrentVersionDeleted ? null : (
      item.author === 'user' ? (
        <View style={messageContentStyle}>
          <Text 
            style={styles.messageText} 
            numberOfLines={item.isCollapsed ? 2 : undefined}
            onTextLayout={handleTextLayout}
          >
            {displayText}
          </Text>
        </View>
      ) : (
        <View onLayout={handleViewLayout} style={messageContentStyle}>
          {item.isCollapsed ? (
            <Text style={[styles.messageText, { color: theme.messageTextAssistant }]} numberOfLines={2}>
              {displayText}
            </Text>
          ) : (
            <MarkdownDisplay
              key={`${item.id}:${currentVersionIndex}:${(displayText || '').length}`}
              style={{ ...markdownStyles, body: { ...markdownStyles.body, color: theme.messageTextAssistant } }}
            >
              {displayText}
            </MarkdownDisplay>
          )}
        </View>
      )
    )
  );

  if (item.author === 'user') {
    return (
      <View style={styles.messageWrapper}>
          <View style={[styles.messageContainer, styles.userMessage]}>
            {messageContent}

          </View>
        <View style={styles.footerContainerUser}>
          {item.versions.length > 1 && (
            <View style={styles.versionSwitcher}>
              <TouchableOpacity disabled={!canSwitchPrev || isReplying} onPress={() => handleSwitchVersion(item.id, -1)}>
                <Text style={[styles.switcherText, (!canSwitchPrev || isReplying) && styles.disabledText]}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.switcherText}>{`${item.currentVersionIndex + 1} / ${item.versions.length}`}</Text>
              <TouchableOpacity disabled={!canSwitchNext || isReplying} onPress={() => handleSwitchVersion(item.id, 1)}>
                <Text style={[styles.switcherText, (!canSwitchNext || isReplying) && styles.disabledText]}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.isCollapsible && (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleToggleCollapse(item.id)}>
              <Text style={styles.actionText}>↕️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenEditModal(item.id)} disabled={isReplying}>
            <Text style={[styles.actionText, isReplying && styles.disabledText]}>编辑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleCopyMessage(currentVersion.text)} disabled={isReplying}>
            <Text style={[styles.actionText, isReplying && styles.disabledText]}>复制</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteVersion(item.id, item.currentVersionIndex)} disabled={isReplying}>
            <Text style={[styles.actionText, isReplying && styles.disabledText]}>删除</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleInsertAnswerBelow(item.id)}>
            <Text style={styles.actionText}>↓</Text>
          </TouchableOpacity>
        </View>
        <MetadataView message={item} settings={metadataSettings} theme={theme} />
      </View>
    );
  }

  // Assistant Message
  return (
    <View style={styles.messageWrapper}>
          <View style={[styles.messageContainer, styles.assistantMessage]}>
            {messageContent}

            {isReplying && isLastVisibleMessage && <View style={styles.cursor} />}
          </View>
      
      <View style={styles.footerContainerAssistant}>

        <View style={styles.versionSwitcher}>
          <TouchableOpacity disabled={!canSwitchPrev || isReplying} onPress={() => handleSwitchVersion(item.id, -1)}>
            <Text style={[styles.switcherText, (!canSwitchPrev || isReplying) && styles.disabledText]}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.switcherText}>{`${item.currentVersionIndex + 1} / ${item.versions.length}`}</Text>
          <TouchableOpacity disabled={!canSwitchNext || isReplying} onPress={() => handleSwitchVersion(item.id, 1)}>
            <Text style={[styles.switcherText, (!canSwitchNext || isReplying) && styles.disabledText]}>{'>'}</Text>
          </TouchableOpacity>
        </View>
        {item.isCollapsible && (
          <TouchableOpacity style={styles.actionButton} onPress={() => handleToggleCollapse(item.id)}>
            <Text style={styles.actionText}>↕️</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenEditModal(item.id, item.currentVersionIndex)} disabled={isReplying}>
          <Text style={[styles.actionText, isReplying && styles.disabledText]}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleCopyMessage(currentVersion.text)} disabled={isReplying}>
          <Text style={[styles.actionText, isReplying && styles.disabledText]}>复制</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteVersion(item.id, item.currentVersionIndex)} disabled={isReplying}>
          <Text style={[styles.actionText, isReplying && styles.disabledText]}>删除</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleImportChapter(currentVersion.text)} disabled={isReplying}>
          <Text style={[styles.actionText, isReplying && styles.disabledText]}>导入</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleRegenerateAnswer(item.id)} disabled={isReplying}>
          <Text style={[styles.actionText, isReplying && styles.disabledText]}>重答</Text>
        </TouchableOpacity>
      </View>
      <MetadataView message={item} settings={metadataSettings} theme={theme} />
    </View>
  );
};

export default React.memo(MessageItem);

