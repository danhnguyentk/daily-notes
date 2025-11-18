/**
 * Time utility functions
 */
export function formatVietnamTime(date: Date = new Date()): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format date and time in short format for inline keyboard buttons
 * Format: DD/MM HH:MM (e.g., "25/12 14:30")
 * @param date Date to format (defaults to current date)
 * @returns Formatted date and time string
 */
export function formatVietnamTimeShort(date: Date = new Date()): string {
  const dateStr = date.toLocaleDateString('vi-VN', { 
    day: '2-digit', 
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh'
  });
  const timeStr = date.toLocaleTimeString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: 'Asia/Ho_Chi_Minh' 
  });
  return `${dateStr} ${timeStr}`;
}

