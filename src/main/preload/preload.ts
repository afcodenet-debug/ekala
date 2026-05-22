import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  printReceipt: (receiptData: any) => ipcRenderer.invoke('print-receipt', receiptData),
  printTableAssignment: (tableData: any) => ipcRenderer.invoke('print-table-assignment', tableData),
  generateReceiptPDF: (receiptData: any) => ipcRenderer.invoke('generate-receipt-pdf', receiptData)
});