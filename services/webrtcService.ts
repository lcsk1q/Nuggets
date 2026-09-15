import { realtime } from './websocket';
import { api } from './api';
import { soundNotification } from './soundNotification';

export type CallState = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended';

export interface CallPeerInfo {
  id: string;
  name: string;
  avatar: string;
}

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
}

export type CallEventCallback = (state: CallState, payload?: any) => void;

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  public state: CallState = 'idle';
  public callId: string | null = null;
  public targetUser: CallPeerInfo | null = null;
  public isInitiator = false;
  public isMuted = false;
  public isDeafened = false;
  public selectedMicId: string = '';
  public selectedOutputId: string = '';

  private listeners = new Set<CallEventCallback>();

  constructor() {
    this.setupRemoteAudio();
    this.setupSocketListeners();
    this.fetchIceServers();
  }

  private async fetchIceServers() {
    try {
      const config = await api.webrtc.getConfig();
      if (config && config.iceServers && config.iceServers.length > 0) {
        this.iceServers = config.iceServers;
      }
    } catch (e) {
      // Keep default STUN
    }
  }

  private setupRemoteAudio() {
    if (typeof window === 'undefined') return;
    this.remoteAudioElement = document.createElement('audio');
    this.remoteAudioElement.autoplay = true;
    // Keep in DOM so browsers don't garbage-collect or pause it
    this.remoteAudioElement.id = 'nuggets-remote-audio';
    this.remoteAudioElement.style.display = 'none';
    document.body.appendChild(this.remoteAudioElement);
  }

  public subscribe(cb: CallEventCallback) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setState(newState: CallState, payload?: any) {
    this.state = newState;
    this.listeners.forEach(cb => cb(newState, payload));
  }

  private setupSocketListeners() {
    // Incoming call from someone else
    realtime.on('call:incoming', (data: { callId: string; caller: any; callType: string }) => {
      // If already in a call, reject automatically
      if (this.state !== 'idle') {
        realtime.send('call:reject', {
          callId: data.callId,
          callerId: data.caller.id,
          reason: 'O usuário já está em outra chamada.'
        });
        return;
      }

      this.callId = data.callId;
      this.targetUser = {
        id: data.caller.id,
        name: data.caller.displayName || data.caller.username,
        avatar: data.caller.avatar
      };
      this.isInitiator = false;
      this.setState('incoming', { caller: this.targetUser });
      soundNotification.startRinging();
    });

    // Ringing feedback for caller
    realtime.on('call:ringing', () => {
      if (this.state === 'calling') {
        soundNotification.startRinging();
      }
    });

    // Target accepted call
    realtime.on('call:accepted', async (data: { callId: string }) => {
      if (this.state === 'calling' && this.isInitiator) {
        soundNotification.stopRinging();
        this.setState('connecting');
        await this.createOffer();
      }
    });

    // Target rejected call
    realtime.on('call:rejected', (data: { reason?: string }) => {
      soundNotification.stopRinging();
      soundNotification.playCallEnded();
      this.setState('ended', { reason: data.reason || 'Chamada recusada' });
      this.cleanup();
      setTimeout(() => this.setState('idle'), 2000);
    });

    // Target offline
    realtime.on('call:user_offline', (data: { message?: string }) => {
      soundNotification.stopRinging();
      this.setState('ended', { reason: data.message || 'Usuário offline' });
      this.cleanup();
      setTimeout(() => this.setState('idle'), 2500);
    });

    // Call ended by either party
    realtime.on('call:ended', () => {
      soundNotification.stopRinging();
      soundNotification.playCallEnded();
      this.setState('ended', { reason: 'Chamada encerrada' });
      this.cleanup();
      setTimeout(() => this.setState('idle'), 1500);
    });

    // WebRTC signaling message
    realtime.on('call:signal', async (data: { callId: string; fromUserId: string; signal: any }) => {
      if (this.callId && data.callId !== this.callId) return;
      const { signal } = data;

      try {
        if (!this.peerConnection) {
          await this.initPeerConnection();
        }

        if (signal.type === 'offer') {
          await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await this.peerConnection!.createAnswer();
          await this.peerConnection!.setLocalDescription(answer);

          realtime.send('call:signal', {
            callId: this.callId,
            targetUserId: this.targetUser!.id,
            signal: answer
          });
        } else if (signal.type === 'answer') {
          await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          try {
            await this.peerConnection!.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.warn('Error adding ICE candidate:', err);
          }
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    });
  }

  // Get user audio devices (microphones and speakers)
  public async getAudioDevices(): Promise<{ microphones: AudioDeviceInfo[]; speakers: AudioDeviceInfo[] }> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { microphones: [], speakers: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microfone ${idx + 1}`
        }));

      const speakers = devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Alto-falante / Fone ${idx + 1}`
        }));

      return { microphones, speakers };
    } catch (e) {
      return { microphones: [], speakers: [] };
    }
  }

  // Initiate call
  public async startCall(target: CallPeerInfo) {
    if (this.state !== 'idle') return;

    this.targetUser = target;
    this.isInitiator = true;
    this.callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.setState('calling', { target });

    try {
      // Acquire real microphone stream
      await this.acquireLocalMedia();

      // Notify target through WebSocket
      realtime.send('call:initiate', {
        targetUserId: target.id,
        callType: 'audio'
      });
    } catch (err: any) {
      this.setState('ended', { reason: err.message || 'Falha ao acessar microfone' });
      this.cleanup();
      setTimeout(() => this.setState('idle'), 3000);
    }
  }

  // Accept incoming call
  public async acceptCall() {
    if (this.state !== 'incoming' || !this.targetUser) return;
    soundNotification.stopRinging();
    this.setState('connecting');

    try {
      await this.acquireLocalMedia();
      await this.initPeerConnection();

      realtime.send('call:accept', {
        callId: this.callId,
        callerId: this.targetUser.id
      });
    } catch (err: any) {
      this.rejectCall('Microfone não autorizado ou indisponível.');
      this.setState('ended', { reason: err.message });
      this.cleanup();
      setTimeout(() => this.setState('idle'), 3000);
    }
  }

  // Reject incoming call
  public rejectCall(reason = 'Chamada recusada') {
    soundNotification.stopRinging();
    if (this.targetUser && this.callId) {
      realtime.send('call:reject', {
        callId: this.callId,
        callerId: this.targetUser.id,
        reason
      });
    }
    this.cleanup();
    this.setState('idle');
  }

  // End active call
  public endCall() {
    soundNotification.stopRinging();
    soundNotification.playCallEnded();

    if (this.targetUser && this.callId) {
      realtime.send('call:end', {
        callId: this.callId,
        targetUserId: this.targetUser.id
      });
    }

    this.setState('ended', { reason: 'Chamada finalizada' });
    this.cleanup();
    setTimeout(() => this.setState('idle'), 1200);
  }

  // Toggle microphone
  public toggleMute(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.isMuted = !this.isMuted;
        audioTracks.forEach(track => {
          track.enabled = !this.isMuted;
        });
      }
    }
    return this.isMuted;
  }

  // Toggle deafen (hear remote audio)
  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = this.isDeafened;
    }
    return this.isDeafened;
  }

  // Switch microphone device
  public async switchMicrophone(deviceId: string) {
    this.selectedMicId = deviceId;
    if (!this.localStream || !this.peerConnection) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });

      const newTrack = newStream.getAudioTracks()[0];
      const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');

      if (sender) {
        await sender.replaceTrack(newTrack);
      }

      // Stop old tracks
      this.localStream.getAudioTracks().forEach(t => t.stop());
      this.localStream = newStream;
      newTrack.enabled = !this.isMuted;
    } catch (e) {
      console.error('Failed to switch microphone:', e);
    }
  }

  // Switch audio output device (speaker)
  public async switchAudioOutput(deviceId: string): Promise<boolean> {
    this.selectedOutputId = deviceId;
    if (!this.remoteAudioElement) return false;

    if (typeof (this.remoteAudioElement as any).setSinkId === 'function') {
      try {
        await (this.remoteAudioElement as any).setSinkId(deviceId);
        return true;
      } catch (e) {
        console.error('Failed to set audio output device:', e);
        return false;
      }
    }
    return false;
  }

  private async acquireLocalMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Navegador não suporta chamadas de áudio.');
    }

    const audioConstraints: MediaTrackConstraints = this.selectedMicId
      ? { deviceId: { exact: this.selectedMicId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });
      this.isMuted = false;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Permissão do microfone negada. Permita o acesso nas configurações do navegador.');
      }
      throw new Error(`Erro no microfone: ${err.message || 'Indisponível'}`);
    }
  }

  private async initPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Send ICE candidates to the other peer via WebSocket
    this.peerConnection.onicecandidate = event => {
      if (event.candidate && this.targetUser && this.callId) {
        realtime.send('call:signal', {
          callId: this.callId,
          targetUserId: this.targetUser.id,
          signal: { candidate: event.candidate }
        });
      }
    };

    // Receive remote audio stream
    this.peerConnection.ontrack = event => {
      if (this.remoteAudioElement && event.streams && event.streams[0]) {
        this.remoteAudioElement.srcObject = event.streams[0];
        this.remoteAudioElement.play().catch(() => {});
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const connectionState = this.peerConnection?.connectionState;
      if (connectionState === 'connected') {
        soundNotification.stopRinging();
        soundNotification.playCallConnected();
        this.setState('connected');
      } else if (connectionState === 'failed' || connectionState === 'disconnected') {
        this.endCall();
      }
    };

    // Add local audio tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }
  }

  private async createOffer() {
    if (!this.peerConnection) {
      await this.initPeerConnection();
    }

    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true
    });
    await this.peerConnection!.setLocalDescription(offer);

    realtime.send('call:signal', {
      callId: this.callId,
      targetUserId: this.targetUser!.id,
      signal: offer
    });
  }

  private cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
    }

    this.callId = null;
    this.targetUser = null;
    this.isInitiator = false;
    this.isMuted = false;
    this.isDeafened = false;
  }
}

export const webrtcService = new WebRTCService();
