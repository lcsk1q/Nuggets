import { soundNotification } from './soundNotification';

export interface AppNotificationSettings {
  messagesEnabled: boolean;
  friendRequestsEnabled: boolean;
  mentionsEnabled: boolean;
  incomingCallsEnabled: boolean;
  serverMessagesEnabled: boolean;
  soundEnabled: boolean;
  showContent: boolean;
}

const DEFAULT_SETTINGS: AppNotificationSettings = {
  messagesEnabled: true,
  friendRequestsEnabled: true,
  mentionsEnabled: true,
  incomingCallsEnabled: true,
  serverMessagesEnabled: true,
  soundEnabled: true,
  showContent: true
};

class NotificationService {
  private settings: AppNotificationSettings = DEFAULT_SETTINGS;

  constructor() {
    this.loadSettings();
  }

  public getSettings(): AppNotificationSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<AppNotificationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('nuggets_notification_settings', JSON.stringify(this.settings));
    } catch (e) {}
  }

  public loadSettings() {
    try {
      const stored = localStorage.getItem('nuggets_notification_settings');
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {}
  }

  public getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return 'denied';
    }
  }

  public notify(options: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    type?: 'message' | 'friend_request' | 'mention' | 'call' | 'server';
    onClick?: () => void;
  }) {
    const { title, body, icon = '/icon.png', tag, type = 'message', onClick } = options;

    // Check setting flags
    if (type === 'message' && !this.settings.messagesEnabled) return;
    if (type === 'friend_request' && !this.settings.friendRequestsEnabled) return;
    if (type === 'mention' && !this.settings.mentionsEnabled) return;
    if (type === 'call' && !this.settings.incomingCallsEnabled) return;
    if (type === 'server' && !this.settings.serverMessagesEnabled) return;

    // Sound effect
    if (this.settings.soundEnabled) {
      if (type === 'message' || type === 'mention' || type === 'server') {
        soundNotification.playMessageChime();
      } else if (type === 'friend_request') {
        soundNotification.playFriendRequestChime();
      }
    }

    // System OS/Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const displayBody = this.settings.showContent ? body : 'Você recebeu uma nova notificação.';
        const notification = new Notification(title, {
          body: displayBody,
          icon,
          tag,
          badge: icon
        });

        if (onClick) {
          notification.onclick = () => {
            window.focus();
            onClick();
            notification.close();
          };
        } else {
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }
      } catch (e) {
        console.warn('Could not display system notification:', e);
      }
    }
  }
}

export const notificationService = new NotificationService();
