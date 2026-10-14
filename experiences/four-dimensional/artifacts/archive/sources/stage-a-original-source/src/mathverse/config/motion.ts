export const MOTION = {
  eyeHeight: 1.55,
  initialZ: 5.4,
  initialPitch: -Math.atan(0.35 / 5.4),
  entryDelay: 0.55,
  entryDuration: 3.3,
  entryEndZ: -4,
  explorationSpeed: 0.35,
  doorDuration: 1.6,
  doorAngle: Math.PI * 0.555,
  fov: 55,
  near: 0.05,
  far: 100,
  lookDamping: 15,
  pitchLimit: Math.PI * 55 / 180,
  maxPointerAngle: 0.55,
  maxDt: 0.05,
} as const;

export type Phase = 'idle' | 'entering' | 'exploring';
export type MotionState = {
  phase: Phase;
  elapsed: number;
  distance: number;
  z: number;
  paused: boolean;
  suspended: boolean;
  dragging: boolean;
  targetYaw: number;
  targetPitch: number;
  yaw: number;
  pitch: number;
};

export function createMotion(): MotionState {
  return {
    phase: 'idle', elapsed: 0, distance: 0, z: MOTION.initialZ,
    paused: false, suspended: false, dragging: false,
    targetYaw: 0, targetPitch: 0, yaw: 0, pitch: MOTION.initialPitch,
  };
}

export function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function entryZ(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * MOTION.initialZ
    + (-2 * u3 + 3 * u2) * MOTION.entryEndZ
    + (u3 - u2) * (-MOTION.explorationSpeed * MOTION.entryDuration);
}
