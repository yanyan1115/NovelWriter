import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { getGlobalSettings, saveGlobalSettings } from '../storage/chatStorage';
import { lightTheme, darkTheme } from './themes';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();
  const [themeSetting, setThemeSetting] = useState('system');
  const [currentTheme, setCurrentTheme] = useState(systemTheme === 'dark' ? darkTheme : lightTheme);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getGlobalSettings();
      if (settings && settings.theme) {
        setThemeSetting(settings.theme);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const newThemeName = themeSetting === 'system' ? systemTheme : themeSetting;
    setCurrentTheme(newThemeName === 'dark' ? darkTheme : lightTheme);
  }, [themeSetting, systemTheme]);

  const updateThemeSetting = async (newSetting) => {
    const settings = await getGlobalSettings();
    const newSettings = { ...settings, theme: newSetting };
    await saveGlobalSettings(newSettings);
    setThemeSetting(newSetting);
  };

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, themeSetting, updateThemeSetting }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);





































