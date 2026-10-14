export function mathverseBrowserOptions() {
  if (process.env.CHROME_EXECUTABLE) return { executablePath: process.env.CHROME_EXECUTABLE };
  return process.platform === 'win32' ? { channel: 'msedge' } : {};
}
