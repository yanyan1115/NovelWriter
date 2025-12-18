// 单个小说展示卡片 
import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

export default function NovelCard({ novel, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        backgroundColor: '#fffafc',
        padding: 12,
        marginBottom: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View style={{ width: 60, height: 80, backgroundColor: '#ddd', borderRadius: 6, marginRight: 12 }}>
        {/* 可替换为 Image 组件显示封面图 */}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{novel.title}</Text>
        <Text numberOfLines={2} style={{ color: '#555', fontSize: 14, marginTop: 4 }}>{novel.description}</Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 6 }}>状态：{novel.status}</Text>
      </View>
    </TouchableOpacity>
  )
}
