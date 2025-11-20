/**
 * Pushover service for sending strong alerts
 */

import { Env } from '../types/env';

/**
 * Pushover priority levels
 * https://pushover.net/api#priority
 */
export enum PushoverPriority {
  /**
   * Lowest priority: No notification/alert
   * Message will not generate any notification or sound
   */
  LOWEST = -2,
  
  /**
   * Low priority: Quiet notification
   * Message will not generate any sound, but will still display a notification
   */
  LOW = -1,
  
  /**
   * Normal priority (default)
   * Message will generate a notification and sound on the device
   */
  NORMAL = 0,
  
  /**
   * High priority: Bypass quiet hours
   * Message will generate a notification and sound, even if device is in quiet hours
   */
  HIGH = 1,
  
  /**
   * Emergency priority: Requires confirmation
   * Message will generate a notification and sound, and requires user confirmation
   * Will retry every retry seconds until acknowledged or expire seconds have passed
   */
  EMERGENCY = 2,
}

export interface PushoverRequest {
  token: string;
  user: string;
  title: string;
  message: string;
  priority?: number;
  retry?: number;
  expire?: number;
  ttl?: number;
}

interface PushoverResponse {
  status: number;
  request?: string;
  errors?: string[];
}

/**
 * Send a Pushover alert notification
 * https://pushover.net/api
 */
export async function sendPushoverAlert(
  title: string,
  message: string,
  env: Env
): Promise<void> {
  // Check if Pushover is configured
  if (!env.PUSHOVER_TOKEN || !env.PUSHOVER_USER) {
    console.warn('Pushover not configured. Skipping Pushover alert.');
    return;
  }

  // TODO: will move to config later
  // Determine priority based on time: 0h-7h Vietnam time (UTC+7) = UTC 17h-23h and 0h use EMERGENCY priority, else NORMAL priority
  const currentHour = new Date().getUTCHours();
  const priority = currentHour >= 17 || currentHour < 1 ? PushoverPriority.EMERGENCY : PushoverPriority.NORMAL;

  const pushoverMessage: PushoverRequest = {
    token: env.PUSHOVER_TOKEN ,
    user: env.PUSHOVER_USER,
    title,
    message,
    priority,
    retry: 30, // Retry every 30 seconds
    expire: 900, // Expire after 15 minutes (900 seconds)
    ttl: 28800, // Time to live: 8 hours (28800 seconds)
  };

  try {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushoverMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send Pushover alert: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Pushover API error: ${response.status} ${response.statusText}`);
    }

    const result: PushoverResponse = await response.json();
    if (result.status !== 1) {
      console.error(`Pushover API returned error: ${JSON.stringify(result)}`);
      throw new Error(`Pushover API error: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    console.log(`Pushover alert sent successfully. Request ID: ${result.request || 'N/A'}`);
  } catch (error) {
    console.error('Error sending Pushover alert:', error);
    // Don't throw - we don't want Pushover failures to break the main flow
  }
}

