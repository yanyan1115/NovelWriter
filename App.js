import 'react-native-gesture-handler'
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';

import { useFonts } from 'expo-font';
import { initializeStorage } from './src/storage/storage'; // 导入初始化函数
import { ThemeProvider, useTheme } from './src/styles/ThemeContext';

// 导入页面
import BookshelfScreen from './src/screens/BookshelfScreen';
import CreateNovelScreen from './src/screens/CreateNovelScreen'
import NovelDetailScreen from './src/screens/NovelDetailScreen'
import EditNovelScreen from './src/screens/EditNovelScreen'
import EditVolumeScreen from './src/screens/EditVolumeScreen'
import EditChapterScreen from './src/screens/EditChapterScreen'
import ReadChapterScreen from './src/screens/ReadChapterScreen'
import ChatScreen from './src/screens/ChatScreen'
import LongTextEditScreen from './src/screens/LongTextEditScreen'
import BackupScreen from './src/screens/BackupScreen' // 导入备份页面

const Stack = createStackNavigator()

const AppNavigator = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Bookshelf"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fffafc',
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: '#8e8ee0',
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '300',
          fontFamily: 'Song',
        },
      }}
    >
      <Stack.Screen name="Bookshelf" component={BookshelfScreen} options={{ title: '📚 我的书架' }} />
      <Stack.Screen name="CreateNovel" component={CreateNovelScreen} options={{ title: '✍️ 新建小说' }} />
      <Stack.Screen name="NovelDetail" component={NovelDetailScreen} options={{ title: '📖 小说详情' }} />
      <Stack.Screen name="EditNovel" component={EditNovelScreen} options={{ title: '🛠️ 编辑小说' }} />
      <Stack.Screen name="EditVolume" component={EditVolumeScreen} options={{ title: '📦 编辑卷' }} />
      <Stack.Screen name="EditChapter" component={EditChapterScreen} options={{ title: '📄 编辑章节' }} />
      <Stack.Screen name="ReadChapter" component={ReadChapterScreen} options={{ title: '📘 阅读' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chatbox' }} />
      <Stack.Screen name="LongTextEdit" component={LongTextEditScreen} options={{ title: '编辑', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.actionText }} />
      <Stack.Screen name="Backup" component={BackupScreen} options={{ title: '🛡️ 备份与恢复' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [storageInitialized, setStorageInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeStorage();
      setStorageInitialized(true);
    };
    init();
  }, []);

  const [fontsLoaded] = useFonts({
    Kai: require('./assets/fonts/Kai.ttf'),
    ShouZha: require('./assets/fonts/ShouZha.ttf'),
    ShouJin: require('./assets/fonts/ShouJin.ttf'),
    Song: require('./assets/fonts/Song.ttf'),
  })

  if (!fontsLoaded || !storageInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8e8ee0" />
      </View>
    )
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ThemeProvider>
  )
}
