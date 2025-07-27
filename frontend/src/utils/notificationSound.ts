// Notification sound utility
export class NotificationSound {
  private static instance: NotificationSound;
  private audioContext: AudioContext | null = null;
  private soundsEnabled: boolean = true;
  private volume: number = 0.5;

  private constructor() {
    // Initialize audio context on first user interaction
    this.initializeAudioContext();
  }

  public static getInstance(): NotificationSound {
    if (!NotificationSound.instance) {
      NotificationSound.instance = new NotificationSound();
    }
    return NotificationSound.instance;
  }

  private initializeAudioContext() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context on user interaction if suspended
      if (this.audioContext.state === 'suspended') {
        const resumeAudio = () => {
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
          }
          document.removeEventListener('click', resumeAudio);
          document.removeEventListener('keydown', resumeAudio);
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('keydown', resumeAudio);
      }
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  // Play notification sound using Web Audio API
  public playNotificationBeep(type: 'success' | 'info' | 'warning' | 'error' = 'info') {
    if (!this.soundsEnabled || !this.audioContext) return;

    try {
      this.playMelodySound(type);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  // Play more appealing melody sounds
  private playMelodySound(type: 'success' | 'info' | 'warning' | 'error') {
    if (!this.audioContext) return;

    const melodies = {
      success: [
        { freq: 523.25, duration: 0.15 }, // C5
        { freq: 659.25, duration: 0.15 }, // E5
        { freq: 783.99, duration: 0.15 }, // G5
        { freq: 1046.50, duration: 0.25 } // C6
      ],
      info: [
        { freq: 659.25, duration: 0.2 }, // E5
        { freq: 783.99, duration: 0.2 }, // G5
        { freq: 659.25, duration: 0.2 }  // E5
      ],
      warning: [
        { freq: 440.00, duration: 0.3 }, // A4
        { freq: 523.25, duration: 0.3 }, // C5
        { freq: 440.00, duration: 0.3 }  // A4
      ],
      error: [
        { freq: 349.23, duration: 0.2 }, // F4
        { freq: 293.66, duration: 0.2 }, // D4
        { freq: 261.63, duration: 0.4 }  // C4
      ]
    };

    const melody = melodies[type];
    let currentTime = this.audioContext.currentTime;

    melody.forEach((note, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.setValueAtTime(note.freq, currentTime);
      oscillator.type = 'sine';

      // Create envelope (attack, sustain, release)
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.8, currentTime + 0.02); // Attack
      gainNode.gain.setValueAtTime(this.volume * 0.6, currentTime + note.duration * 0.7); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration); // Release

      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration);

      currentTime += note.duration;
    });
  }

  // Play chord sound for more richness
  private playChordSound(frequencies: number[], duration: number = 0.8) {
    if (!this.audioContext) return;

    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.audioContext.destination);

    // Create envelope for the chord
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.05);
    gainNode.gain.setValueAtTime(this.volume * 0.2, this.audioContext.currentTime + duration * 0.7);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    frequencies.forEach(freq => {
      const oscillator = this.audioContext!.createOscillator();
      oscillator.connect(gainNode);
      oscillator.frequency.setValueAtTime(freq, this.audioContext!.currentTime);
      oscillator.type = 'sine';
      oscillator.start(this.audioContext!.currentTime);
      oscillator.stop(this.audioContext!.currentTime + duration);
    });
  }

  // Play enhanced sound with harmonics
  private playEnhancedSound(baseFreq: number, duration: number = 0.5, harmonics: number[] = [1, 2, 3]) {
    if (!this.audioContext) return;

    const mainGain = this.audioContext.createGain();
    mainGain.connect(this.audioContext.destination);

    // Create envelope
    mainGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    mainGain.gain.linearRampToValueAtTime(this.volume * 0.6, this.audioContext.currentTime + 0.02);
    mainGain.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime + duration * 0.8);
    mainGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    // Create harmonics
    harmonics.forEach((harmonic, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const harmonicGain = this.audioContext!.createGain();

      oscillator.connect(harmonicGain);
      harmonicGain.connect(mainGain);

      oscillator.frequency.setValueAtTime(baseFreq * harmonic, this.audioContext!.currentTime);
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      
      // Reduce volume of higher harmonics
      harmonicGain.gain.setValueAtTime(1 / (harmonic * 1.5), this.audioContext!.currentTime);

      oscillator.start(this.audioContext!.currentTime);
      oscillator.stop(this.audioContext!.currentTime + duration);
    });
  }

  // Play audio file notification
  public async playAudioFile(fileName: string) {
    if (!this.soundsEnabled) return;

    try {
      const audio = new Audio(`/audio/${fileName}`);
      audio.volume = this.volume;
      await audio.play();
    } catch (error) {
      console.warn('Failed to play audio file:', error);
      // Fallback to beep sound
      this.playNotificationBeep('info');
    }
  }

  // Play queue-specific notifications
  public playQueueNotification(eventType: 'customer_added' | 'customer_serving' | 'customer_completed' | 'priority_customer') {
    switch (eventType) {
      case 'customer_added':
        this.playCustomerAddedSound();
        break;
      case 'customer_serving':
        this.playCustomerServingSound();
        break;
      case 'customer_completed':
        this.playCustomerCompletedSound();
        break;
      case 'priority_customer':
        this.playPriorityCustomerSound();
        break;
      default:
        this.playNotificationBeep('info');
    }
  }

  // Custom queue notification sounds
  private playCustomerAddedSound() {
    if (!this.audioContext) return;
    
    // Pleasant ascending chime
    const notes = [
      { freq: 523.25, duration: 0.15 }, // C5
      { freq: 659.25, duration: 0.15 }, // E5
      { freq: 783.99, duration: 0.2 }   // G5
    ];
    
    this.playSequentialNotes(notes);
  }

  private playCustomerServingSound() {
    if (!this.audioContext) return;
    
    // Attention-getting but not harsh
    const notes = [
      { freq: 659.25, duration: 0.2 }, // E5
      { freq: 659.25, duration: 0.2 }, // E5
      { freq: 783.99, duration: 0.3 }  // G5
    ];
    
    this.playSequentialNotes(notes);
  }

  private playCustomerCompletedSound() {
    if (!this.audioContext) return;
    
    // Success fanfare
    const notes = [
      { freq: 523.25, duration: 0.12 }, // C5
      { freq: 659.25, duration: 0.12 }, // E5
      { freq: 783.99, duration: 0.12 }, // G5
      { freq: 1046.50, duration: 0.12 }, // C6
      { freq: 1318.51, duration: 0.25 }  // E6
    ];
    
    this.playSequentialNotes(notes);
  }

  private playPriorityCustomerSound() {
    if (!this.audioContext) return;
    
    // Urgent but pleasant priority sound
    const notes = [
      { freq: 880.00, duration: 0.15 }, // A5
      { freq: 1046.50, duration: 0.15 }, // C6
      { freq: 880.00, duration: 0.15 }, // A5
      { freq: 1046.50, duration: 0.15 }, // C6
      { freq: 1318.51, duration: 0.25 }  // E6
    ];
    
    this.playSequentialNotes(notes);
  }

  private playSequentialNotes(notes: { freq: number; duration: number }[]) {
    if (!this.audioContext) return;

    let currentTime = this.audioContext.currentTime;

    notes.forEach((note, index) => {
      // Create main oscillator
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.setValueAtTime(note.freq, currentTime);
      oscillator.type = 'sine';

      // Create smooth envelope
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.6, currentTime + 0.01);
      gainNode.gain.setValueAtTime(this.volume * 0.4, currentTime + note.duration * 0.8);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration);

      // Add subtle harmonic for richness
      if (index === notes.length - 1) { // Only on the last note
        const harmonic = this.audioContext!.createOscillator();
        const harmonicGain = this.audioContext!.createGain();

        harmonic.connect(harmonicGain);
        harmonicGain.connect(this.audioContext!.destination);

        harmonic.frequency.setValueAtTime(note.freq * 1.5, currentTime);
        harmonic.type = 'triangle';

        harmonicGain.gain.setValueAtTime(0, currentTime);
        harmonicGain.gain.linearRampToValueAtTime(this.volume * 0.2, currentTime + 0.02);
        harmonicGain.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration * 1.2);

        harmonic.start(currentTime + 0.05);
        harmonic.stop(currentTime + note.duration * 1.2);
      }

      currentTime += note.duration * 0.9; // Slight overlap between notes
    });
  }

  // Settings
  public setSoundsEnabled(enabled: boolean) {
    this.soundsEnabled = enabled;
    localStorage.setItem('notificationSoundsEnabled', enabled.toString());
  }

  public getSoundsEnabled(): boolean {
    const stored = localStorage.getItem('notificationSoundsEnabled');
    return stored !== null ? stored === 'true' : this.soundsEnabled;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('notificationVolume', this.volume.toString());
  }

  public getVolume(): number {
    const stored = localStorage.getItem('notificationVolume');
    return stored !== null ? parseFloat(stored) : this.volume;
  }

  // Initialize settings from localStorage
  public loadSettings() {
    this.soundsEnabled = this.getSoundsEnabled();
    this.volume = this.getVolume();
  }
}

// Export singleton instance
export const notificationSound = NotificationSound.getInstance();
