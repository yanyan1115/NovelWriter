import { StyleSheet } from 'react-native'

export const commonStyles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 6,
    marginBottom: 12,
    fontSize: 16,
  },
  buttonPrimary: {
    backgroundColor: '#007aff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: 'white',
    fontWeight: 'bold',
  },
})
