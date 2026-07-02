// Audio synthesizer using Web Audio API for alerts and ambient sounds.
// This requires no external files, is fully responsive, offline-capable, and avoids any network latency.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ---------------------------------------------------------------------------
// 1. Notification Alert Sounds (Synthesized)
// ---------------------------------------------------------------------------

export function playSynthAlert(type: 'start' | 'pause' | 'finish' | 'click', volumeEnabled = true) {
  if (!volumeEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    if (type === 'start') {
      // Pleasant upward chime: C5 -> E5 -> G5
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Pitch envelope
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      
      // Volume envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gainNode.gain.setValueAtTime(0.15, now + 0.24);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      
      osc.start(now);
      osc.stop(now + 0.5);
      
    } else if (type === 'pause') {
      // Gentle double-tap chord
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'triangle';
      osc2.type = 'sine';
      
      osc1.frequency.setValueAtTime(329.63, now); // E4
      osc2.frequency.setValueAtTime(392.00, now); // G4
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
      
    } else if (type === 'finish') {
      // Gorgeous, warm layered Tibetan-style bell chime
      const freqs = [220, 330, 440, 550, 660, 880];
      const gains = [0.15, 0.10, 0.08, 0.05, 0.03, 0.02];
      
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0); // slow rich decay
      
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = i === 0 ? 'sine' : 'sine';
        osc.frequency.setValueAtTime(f + (Math.random() * 2 - 1), now); // slight detune
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        gain.gain.setValueAtTime(gains[i], now);
        // High partials decay faster
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (3.0 / (i + 1)));
        
        osc.start(now);
        osc.stop(now + 3.1);
      });
      
    } else if (type === 'click') {
      // Minimal mechanical tap
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.05, now + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch (e) {
    console.warn('Audio synthesis alert failed:', e);
  }
}

// ---------------------------------------------------------------------------
// 2. Synthesized Ambient Sounds Engine (Custom Generators)
// ---------------------------------------------------------------------------

interface ActiveAmbient {
  sourceNode: AudioWorkletNode | ScriptProcessorNode;
  gainNode: GainNode;
  lfoNode?: OscillatorNode;
  timerId?: any;
}

let activeAmbient: ActiveAmbient | null = null;
let currentAmbientId: 'none' | 'rain' | 'forest' | 'whiteNoise' | 'cafe' = 'none';

// Generates white noise buffer (1 second)
function createNoiseBuffer(ctx: AudioContext, color: 'white' | 'brown' | 'pink'): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2; // 2 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  let lastOut = 0.0;
  
  // Variables for pink noise approximation
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    
    if (color === 'white') {
      data[i] = white;
    } else if (color === 'brown') {
      // Brownian noise: integrate white noise and filter
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // compensation volume boost
    } else if (color === 'pink') {
      // Paul Kellet's refined method
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11; // normalisation
    }
  }
  
  return buffer;
}

export function startAmbientSound(
  type: 'none' | 'rain' | 'forest' | 'whiteNoise' | 'cafe',
  volumeEnabled = true
) {
  stopAmbientSound();
  if (type === 'none' || !volumeEnabled) {
    currentAmbientId = 'none';
    return;
  }
  
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Create master gain for ambient
    const ambientGain = ctx.createGain();
    ambientGain.connect(ctx.destination);
    
    // Smooth fade in
    ambientGain.gain.setValueAtTime(0, now);
    ambientGain.gain.linearRampToValueAtTime(0.2, now + 1.5);
    
    currentAmbientId = type;
    
    if (type === 'whiteNoise') {
      // Pure constant, focused stream
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = createNoiseBuffer(ctx, 'white');
      bufferSource.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now); // deep, soft low-pass white noise
      
      bufferSource.connect(filter);
      filter.connect(ambientGain);
      
      bufferSource.start(0);
      
      activeAmbient = {
        sourceNode: bufferSource as any,
        gainNode: ambientGain
      };
      
    } else if (type === 'rain') {
      // Brown noise (heavy water rumble) + high frequency sizzle + occasional random droplets
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = createNoiseBuffer(ctx, 'brown');
      bufferSource.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now); // deep rain rumble
      
      bufferSource.connect(filter);
      filter.connect(ambientGain);
      
      // High frequency rain sizzle
      const sizzleSource = ctx.createBufferSource();
      sizzleSource.buffer = createNoiseBuffer(ctx, 'pink');
      sizzleSource.loop = true;
      const sizzleFilter = ctx.createBiquadFilter();
      sizzleFilter.type = 'bandpass';
      sizzleFilter.frequency.setValueAtTime(1200, now);
      sizzleFilter.Q.setValueAtTime(1.0, now);
      
      const sizzleGain = ctx.createGain();
      sizzleGain.gain.setValueAtTime(0.04, now);
      
      sizzleSource.connect(sizzleFilter);
      sizzleFilter.connect(sizzleGain);
      sizzleGain.connect(ambientGain);
      
      bufferSource.start(0);
      sizzleSource.start(0);
      
      // Synthesize periodic rain droplet taps
      const timer = setInterval(() => {
        if (currentAmbientId !== 'rain') {
          clearInterval(timer);
          return;
        }
        // Random droplet sound
        if (Math.random() > 0.4) {
          const dropOsc = ctx.createOscillator();
          const dropGain = ctx.createGain();
          dropOsc.type = 'sine';
          dropOsc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
          dropOsc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
          
          dropGain.gain.setValueAtTime(0.015 * Math.random(), ctx.currentTime);
          dropGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
          
          dropOsc.connect(dropGain);
          dropGain.connect(ambientGain);
          dropOsc.start();
          dropOsc.stop(ctx.currentTime + 0.1);
        }
      }, 300);
      
      activeAmbient = {
        sourceNode: bufferSource as any,
        gainNode: ambientGain,
        timerId: timer
      };
      
    } else if (type === 'forest') {
      // Wind rustle (modulated pink noise) + soft birds
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = createNoiseBuffer(ctx, 'pink');
      bufferSource.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, now);
      filter.Q.setValueAtTime(1.5, now);
      
      // LFO to modulate the wind frequency (simulates rustling wind gustiness)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      
      lfo.frequency.setValueAtTime(0.08, now); // very slow oscillation (12s cycle)
      lfoGain.gain.setValueAtTime(120, now); // swing back and forth by 120Hz
      
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      
      bufferSource.connect(filter);
      filter.connect(ambientGain);
      
      lfo.start(0);
      bufferSource.start(0);
      
      // Synthesize soft, occasional distant bird chirps
      const timer = setInterval(() => {
        if (currentAmbientId !== 'forest') {
          clearInterval(timer);
          return;
        }
        if (Math.random() > 0.82) {
          // Play a sweet bird chirp sequence
          const chirpTime = ctx.currentTime;
          const numChirps = 2 + Math.floor(Math.random() * 3);
          
          for (let i = 0; i < numChirps; i++) {
            const startOffset = i * 0.12;
            const chirpOsc = ctx.createOscillator();
            const chirpGain = ctx.createGain();
            
            chirpOsc.type = 'sine';
            chirpOsc.frequency.setValueAtTime(2500 + Math.random() * 500, chirpTime + startOffset);
            chirpOsc.frequency.exponentialRampToValueAtTime(3500, chirpTime + startOffset + 0.08);
            
            chirpGain.gain.setValueAtTime(0, chirpTime + startOffset);
            chirpGain.gain.linearRampToValueAtTime(0.005, chirpTime + startOffset + 0.02);
            chirpGain.gain.exponentialRampToValueAtTime(0.0001, chirpTime + startOffset + 0.09);
            
            chirpOsc.connect(chirpGain);
            chirpGain.connect(ambientGain);
            
            chirpOsc.start(chirpTime + startOffset);
            chirpOsc.stop(chirpTime + startOffset + 0.1);
          }
        }
      }, 2000);
      
      activeAmbient = {
        sourceNode: bufferSource as any,
        gainNode: ambientGain,
        lfoNode: lfo,
        timerId: timer
      };
      
    } else if (type === 'cafe') {
      // Low hum / murmur (filtered brown noise) + randomized faint coffee cup clinks
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = createNoiseBuffer(ctx, 'brown');
      bufferSource.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now); // warm low cafe hum
      
      bufferSource.connect(filter);
      filter.connect(ambientGain);
      
      bufferSource.start(0);
      
      // Randomized coffee shop cup/spoon clinks
      const timer = setInterval(() => {
        if (currentAmbientId !== 'cafe') {
          clearInterval(timer);
          return;
        }
        if (Math.random() > 0.75) {
          const clinkTime = ctx.currentTime;
          const osc = ctx.createOscillator();
          const clinkGain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1500 + Math.random() * 1500, clinkTime);
          
          clinkGain.gain.setValueAtTime(0, clinkTime);
          clinkGain.gain.linearRampToValueAtTime(0.006 * Math.random(), clinkTime + 0.005);
          clinkGain.gain.exponentialRampToValueAtTime(0.0001, clinkTime + 0.25);
          
          osc.connect(clinkGain);
          clinkGain.connect(ambientGain);
          
          osc.start(clinkTime);
          osc.stop(clinkTime + 0.3);
        }
      }, 800);
      
      activeAmbient = {
        sourceNode: bufferSource as any,
        gainNode: ambientGain,
        timerId: timer
      };
    }
  } catch (e) {
    console.warn('Ambient sound system error:', e);
  }
}

export function stopAmbientSound() {
  if (activeAmbient) {
    try {
      const now = getAudioContext().currentTime;
      // Smooth fade out
      const gain = activeAmbient.gainNode;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      
      const source = activeAmbient.sourceNode;
      const lfo = activeAmbient.lfoNode;
      const timerId = activeAmbient.timerId;
      
      setTimeout(() => {
        try {
          if (source) {
            (source as any).stop?.();
            (source as any).disconnect?.();
          }
          if (lfo) {
            lfo.stop();
            lfo.disconnect();
          }
          if (timerId) {
            clearInterval(timerId);
          }
        } catch (e) {
          // Quiet catch
        }
      }, 1100);
    } catch (e) {
      // Quiet catch
    }
    activeAmbient = null;
  }
  currentAmbientId = 'none';
}
