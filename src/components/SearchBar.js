// 搜索框组件
import React from 'react'
import { TextInput, View } from 'react-native'

export default function SearchBar({ value, onChange }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <TextInput
        placeholder="搜索书名..."
        value={value}
        onChangeText={onChange}
        style={{
          padding: 10,
          borderWidth: 1,
          borderRadius: 8,
          borderColor: '#ccc'
        }}
      />
    </View>
  )
}
