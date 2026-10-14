export const MOTION = {
  eyeHeight: 1.55,
  initialZ: 9.6,
  initialPitch: -Math.atan(0.16 / 9.6),
  entryDelay: 0.85,
  entryDuration: 6.0,
  entryEndZ: -4,
  explorationSpeed: 0.35,
  doorDuration: 2.55,
  doorAngle: Math.PI * 0.555,
  fov: 55,
  near: 0.05,
  far: 180,
  lookFrequency: 3,
  lookDampingRatio: 0.94,
  maxAngularVelocity: 7.5,
  integrationStep: 1 / 120,
  pitchLimit: Math.PI * 55 / 180,
  pitchSoftZone: Math.PI * 7 / 180,
  dragThreshold: 6,
  speedHalfLife: 0.12,
  speedSnapThreshold: 0.00005,
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
  spaceFrozen: boolean;
  spaceTime: number;
  targetYaw: number;
  targetPitch: number;
  yaw: number;
  pitch: number;
  yawVelocity: number;
  pitchVelocity: number;
  speed: number;
  speedScale: number;
  targetSpeed: number;
  entryExitSpeed: number;
  frameDt: number;
  skipNextFrame: boolean;
};

export function createMotion(): MotionState {
  return {
    phase: 'idle', elapsed: 0, distance: 0, z: MOTION.initialZ,
    paused: false, suspended: false, dragging: false, spaceFrozen: false, spaceTime: 0,
    targetYaw: 0, targetPitch: 0, yaw: 0, pitch: MOTION.initialPitch,
    yawVelocity: 0, pitchVelocity: 0, speed: 0, speedScale: 1,
    targetSpeed: 0, entryExitSpeed: MOTION.explorationSpeed,
    frameDt: 0, skipNextFrame: false,
  };
}

export function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function minimumJerk(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (10 - 15 * t + 6 * t * t);
}

export function entryZ(t: number, endSpeed: number = MOTION.explorationSpeed): number {
  const u = Math.max(0, Math.min(1, t));
  const u3 = u * u * u, u4 = u3 * u, u5 = u4 * u;
  return MOTION.initialZ + (MOTION.entryEndZ - MOTION.initialZ) * minimumJerk(u)
    - endSpeed * MOTION.entryDuration * (-4 * u3 + 7 * u4 - 3 * u5);
}

export function entrySpeed(t: number, endSpeed: number = MOTION.explorationSpeed): number {
  const u = Math.max(0, Math.min(1, t)), u2 = u * u, u3 = u2 * u, u4 = u3 * u;
  return -(MOTION.entryEndZ - MOTION.initialZ) * (30 * u2 - 60 * u3 + 30 * u4) / MOTION.entryDuration
    + endSpeed * (-12 * u2 + 28 * u3 - 15 * u4);
}
