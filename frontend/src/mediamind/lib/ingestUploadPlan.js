export function pendingUploadEntries(files) {
  return files.filter((item) => item.status === 'pending' || item.status === 'failed');
}
