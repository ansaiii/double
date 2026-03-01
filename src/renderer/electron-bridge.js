// Electron API Bridge
window.electronAPI = {
  invoke: async (channel, ...args) => {
    if (!window.require) {
      throw new Error('Electron require not available');
    }
    const { ipcRenderer } = window.require('electron');
    return await ipcRenderer.invoke(channel, ...args);
  }
};
