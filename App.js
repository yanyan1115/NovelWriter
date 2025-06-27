import React, { useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { Text, TouchableOpacity } from 'react-native'

import { useFonts } from 'expo-font'
import AppLoading from 'expo-app-loading' // 如果用的是 SDK 48+ 可用 ActivityIndicator 替代

// 导入页面
import BookshelfScreen from './src/screens/BookshelfScreen'
import CreateNovelScreen from './src/screens/CreateNovelScreen'
import NovelDetailScreen from './src/screens/NovelDetailScreen'
import EditNovelScreen from './src/screens/EditNovelScreen'
import EditVolumeScreen from './src/screens/EditVolumeScreen'
import EditChapterScreen from './src/screens/EditChapterScreen'
import ReadChapterScreen from './src/screens/ReadChapterScreen'

const Stack = createStackNavigator()

export default function App() {
  const [isDarkNav, setIsDarkNav] = useState(false)

  // ✅ 加载项目中的字体
  const [fontsLoaded] = useFonts({
    Kai: require('./assets/fonts/Kai.ttf'),
    ShouZha: require('./assets/fonts/ShouZha.ttf'),
    ShouJin: require('./assets/fonts/ShouJin.ttf'),
    Song: require('./assets/fonts/Song.ttf'),
  })

  if (!fontsLoaded) {
    return <AppLoading />
  }

  const ToggleNavThemeButton = () => (
    <TouchableOpacity onPress={() => setIsDarkNav(!isDarkNav)} style={{ marginRight: 12 }}>
      <Text style={{ fontSize: 18 }}>{isDarkNav ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  )

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Bookshelf"
        screenOptions={{
          headerStyle: {
            backgroundColor: isDarkNav ? '#1e1e1e' : '#ffffff',
            shadowColor: 'transparent',
            elevation: 0,
          },
          headerTintColor: isDarkNav ? '#eeeeee' : '#8e8ee0',
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '300',
            fontFamily: 'Song', // ✅ 使用加载的中文字体
          },
          headerRight: () => <ToggleNavThemeButton />,
        }}
      >
        <Stack.Screen name="Bookshelf" component={BookshelfScreen} options={{ title: '📚 我的书架' }} />
        <Stack.Screen name="CreateNovel" component={CreateNovelScreen} options={{ title: '✍️ 新建小说' }} />
        <Stack.Screen name="NovelDetail" component={NovelDetailScreen} options={{ title: '📖 小说详情' }} />
        <Stack.Screen name="EditNovel" component={EditNovelScreen} options={{ title: '🛠️ 编辑小说' }} />
        <Stack.Screen name="EditVolume" component={EditVolumeScreen} options={{ title: '📦 编辑卷' }} />
        <Stack.Screen name="EditChapter" component={EditChapterScreen} options={{ title: '📄 编辑章节' }} />
        <Stack.Screen name="ReadChapter" component={ReadChapterScreen} options={{ title: '📘 阅读' }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
