// src/storage/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage'

// --- 小说存储key 和接口 ---
const STORAGE_KEY_NOVELS = 'novels'

export const saveNovels = async (novels) => {
  try {
    const json = JSON.stringify(novels)
    await AsyncStorage.setItem(STORAGE_KEY_NOVELS, json)
  } catch (e) {
    console.error('保存小说失败', e)
  }
}

export const loadNovels = async () => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_NOVELS)
    return json ? JSON.parse(json) : []
  } catch (e) {
    console.error('读取小说失败', e)
    return []
  }
}

// --- 章节存储key 和接口 ---
const STORAGE_KEY_CHAPTERS = 'chapters'

export const getChaptersByNovelId = async (novelId) => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_CHAPTERS)
    const allChapters = json ? JSON.parse(json) : []
    return allChapters.filter(c => c.novelId === novelId)
  } catch (e) {
    console.error('读取章节失败', e)
    return []
  }
}

export const deleteChapterById = async (chapterId) => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_CHAPTERS)
    let allChapters = json ? JSON.parse(json) : []
    allChapters = allChapters.filter(c => c.id !== chapterId)
    await AsyncStorage.setItem(STORAGE_KEY_CHAPTERS, JSON.stringify(allChapters))
  } catch (e) {
    console.error('删除章节失败', e)
  }
}

export const updateChapterById = async (chapterId, updatedFields) => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_CHAPTERS)
    let allChapters = json ? JSON.parse(json) : []
    allChapters = allChapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, ...updatedFields }
      }
      return c
    })
    await AsyncStorage.setItem(STORAGE_KEY_CHAPTERS, JSON.stringify(allChapters))
  } catch (e) {
    console.error('更新章节失败', e)
  }
}

export const createChapter = async (chapter) => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_CHAPTERS)
    const allChapters = json ? JSON.parse(json) : []
    const newChapter = { id: Date.now().toString(), ...chapter }
    allChapters.push(newChapter)
    await AsyncStorage.setItem(STORAGE_KEY_CHAPTERS, JSON.stringify(allChapters))
    return newChapter
  } catch (e) {
    console.error('创建章节失败', e)
    return null
  }
}
