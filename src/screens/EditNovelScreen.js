// 修改小说标题、简介、状态等信息
import React, { useEffect, useState } from 'react'
import { View, TextInput, Button, Alert } from 'react-native'
import { loadNovels, saveNovels } from '../storage/storage'

export default function EditNovelScreen({ route, navigation }) {
  const { novelId } = route.params
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const novels = await loadNovels()
      const novel = novels.find(n => n.id === novelId)
      if (novel) {
        setTitle(novel.title)
        setDescription(novel.description)
        setStatus(novel.status)
      }
    }
    fetchData()
  }, [])

  const handleSave = async () => {
    const novels = await loadNovels()
    const updated = novels.map(n => {
      if (n.id === novelId) {
        return { ...n, title, description, status, updatedAt: new Date().toISOString() }
      }
      return n
    })
    await saveNovels(updated)
    navigation.goBack()
  }

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="书名" value={title} onChangeText={setTitle} style={{ borderBottomWidth: 1, marginBottom: 20 }} />
      <TextInput placeholder="简介" value={description} onChangeText={setDescription} multiline style={{ borderBottomWidth: 1, marginBottom: 20 }} />
      <TextInput placeholder="状态（连载中 / 已完结 / 草稿）" value={status} onChangeText={setStatus} style={{ borderBottomWidth: 1, marginBottom: 20 }} />
      <Button title="保存修改" onPress={handleSave} />
    </View>
  )
}
