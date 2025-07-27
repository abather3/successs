import React from 'react';

/**
 * Sound notification system for session warnings
 * Provides audio alerts for different warning stages
 */

class SoundNotificationManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Initialize audio context on first user interaction
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  /**
   * Play subtle warning sound (soft beep)
   */
  playSubtleWarning(): void {
    if (!this.enabled || !this.audioContext) return;
    
    this.playBeep(800, 0.1, 200); // Higher pitch, softer volume, shorter duration
  }

  /**
   * Play urgent warning sound (attention-grabbing)
   */
  playUrgentWarning(): void {
    if (!this.enabled || !this.audioContext) return;
    
    // Play three ascending beeps
    this.playBeep(600, 0.3, 150);
    setTimeout(() => this.playBeep(700, 0.3, 150), 200);
    setTimeout(() => this.playBeep(800, 0.3, 150), 400);
  }

  /**
   * Play expiry warning sound (final warning)
   */
  playExpiryWarning(): void {
    if (!this.enabled || !this.audioContext) return;
    
    // Play descending urgent beeps
    this.playBeep(1000, 0.4, 100);
    setTimeout(() => this.playBeep(800, 0.4, 100), 150);
    setTimeout(() => this.playBeep(600, 0.4, 200), 300);
  }

  /**
   * Generate and play a beep sound
   */
  private playBeep(frequency: number, volume: number, duration: number): void {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }

  /**
   * Enable/disable sound notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Resume audio context (required for some browsers)
   */
  resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// Export singleton instance
export const soundNotifications = new SoundNotificationManager();

/**
 * Hook for using sound notifications with user preferences
 */
export const useSoundNotifications = () => {
  const playSubtleWarning = () => soundNotifications.playSubtleWarning();
  const playUrgentWarning = () => soundNotifications.playUrgentWarning();
  const playExpiryWarning = () => soundNotifications.playExpiryWarning();
  
  const setEnabled = (enabled: boolean) => {
    soundNotifications.setEnabled(enabled);
    localStorage.setItem('soundNotificationsEnabled', enabled.toString());
  };

  const isEnabled = () => {
    const stored = localStorage.getItem('soundNotificationsEnabled');
    return stored !== null ? stored === 'true' : true;
  };

  React.useEffect(() => {
    // Initialize from localStorage
    const enabled = isEnabled();
    soundNotifications.setEnabled(enabled);

    // Resume audio context on user interaction
    const handleUserInteraction = () => {
      soundNotifications.resume();
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  return {
    playSubtleWarning,
    playUrgentWarning,
    playExpiryWarning,
    setEnabled,
    isEnabled: isEnabled()
  };
};

export default soundNotifications;
