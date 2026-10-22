module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/src'],
  modulePathIgnorePatterns: ['<rootDir>/lib/', '<rootDir>/example/'],
  // The first render transforms React Native itself on a cold cache.
  testTimeout: 30000,
};
