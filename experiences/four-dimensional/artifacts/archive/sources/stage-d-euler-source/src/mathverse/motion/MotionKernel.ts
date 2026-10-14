import { MOTION, entrySpeed, entryZ, minimumJerk, type MotionState } from '../config/motion.ts';

export function resumeMotion(motion: MotionState): void {
  if (motion.suspended) motion.skipNextFrame = true;
  motion.suspended = false;
}

export function suspendMotion(motion: MotionState): void {
  motion.suspended = true;
  motion.frameDt = 0;
  motion.yawVelocity = motion.pitchVelocity = 0;
  motion.dragging = false;
  if (motion.phase === 'exploring') {
    motion.targetYaw = motion.yaw;
    motion.targetPitch = motion.pitch;
  }
  motion.speed = 0;
}

export function beginEntrance(motion: MotionState): boolean {
  if (motion.phase !== 'idle') return false;
  resumeMotion(motion);
  motion.phase = 'entering';
  motion.elapsed = 0;
  motion.targetYaw = motion.yaw = 0;
  motion.targetPitch = 0;
  motion.yawVelocity = motion.pitchVelocity = 0;
  motion.entryExitSpeed = motion.paused ? 0 : MOTION.explorationSpeed * motion.speedScale;
  return true;
}

export function addLookInput(motion: MotionState, yawDelta: number, pitchDelta: number): void {
  motion.targetYaw += yawDelta;
  if (pitchDelta === 0) return;
  const sign = Math.sign(pitchDelta), amount = Math.abs(pitchDelta);
  const start = sign * motion.targetPitch;
  const core = MOTION.pitchLimit - MOTION.pitchSoftZone;
  if (start + amount <= core) {
    motion.targetPitch += pitchDelta;
  } else {
    const boundaryStart = Math.max(core, start);
    const outward = amount - Math.max(0, core - start);
    motion.targetPitch = sign * (MOTION.pitchLimit - (MOTION.pitchLimit - boundaryStart) * Math.exp(-outward / MOTION.pitchSoftZone));
  }
}

export function lookForward(motion: MotionState): void {
  motion.targetYaw = Math.round(motion.yaw / (Math.PI * 2)) * Math.PI * 2;
  motion.targetPitch = 0;
}

function advanceAxis(motion: MotionState, axis: 'yaw' | 'pitch', h: number): void {
  const velocityKey = axis === 'yaw' ? 'yawVelocity' : 'pitchVelocity';
  const target = axis === 'yaw' ? motion.targetYaw : motion.targetPitch;
  const value = motion[axis], velocity = motion[velocityKey], offset = value - target;
  const omega = 2 * Math.PI * MOTION.lookFrequency;
  const alpha = omega * MOTION.lookDampingRatio;
  const beta = omega * Math.sqrt(1 - MOTION.lookDampingRatio ** 2);
  const decay = Math.exp(-alpha * h), c = Math.cos(beta * h), s = Math.sin(beta * h);
  const next = target + decay * (offset * c + (velocity + alpha * offset) * s / beta);
  const nextVelocity = decay * (velocity * c - (alpha * velocity + omega * omega * offset) * s / beta);
  const maximumStep = MOTION.maxAngularVelocity * h;
  motion[axis] = value + Math.max(-maximumStep, Math.min(maximumStep, next - value));
  motion[velocityKey] = Math.max(-MOTION.maxAngularVelocity, Math.min(MOTION.maxAngularVelocity, nextVelocity));
  if (axis === 'pitch' && Math.abs(motion.pitch) > MOTION.pitchLimit) {
    motion.pitch = Math.sign(motion.pitch) * MOTION.pitchLimit;
    if (motion.pitch * motion.pitchVelocity > 0) motion.pitchVelocity = 0;
  }
  if (Math.abs(motion[axis] - target) < 0.000001 && Math.abs(motion[velocityKey]) < 0.00001) {
    motion[axis] = target;
    motion[velocityKey] = 0;
  }
}

function advanceTravel(motion: MotionState, dt: number): void {
  const target = motion.paused ? 0 : MOTION.explorationSpeed * Math.max(0, motion.speedScale);
  const rate = Math.LN2 / MOTION.speedHalfLife;
  const decay = Math.exp(-rate * dt), start = motion.speed;
  motion.targetSpeed = target;
  motion.distance += target * dt + (start - target) * (1 - decay) / rate;
  motion.speed = target + (start - target) * decay;
  if (Math.abs(motion.speed - target) < MOTION.speedSnapThreshold) motion.speed = target;
  motion.z = MOTION.entryEndZ - motion.distance;
}

export function advanceMotion(motion: MotionState, rawDt: number): void {
  motion.frameDt = 0;
  if (motion.suspended || !Number.isFinite(rawDt) || rawDt <= 0) return;
  if (motion.skipNextFrame) { motion.skipNextFrame = false; return; }
  const dt = Math.min(rawDt, MOTION.maxDt);
  motion.frameDt = dt;
  if (motion.phase === 'idle') {
    motion.z = MOTION.initialZ;
    motion.pitch = MOTION.initialPitch;
    motion.speed = 0;
    return;
  }
  let exploreDt = dt;
  if (motion.phase === 'entering') {
    const end = MOTION.entryDelay + MOTION.entryDuration;
    const entryDt = Math.min(dt, Math.max(0, end - motion.elapsed));
    motion.elapsed = Math.min(end, motion.elapsed + entryDt);
    const t = (motion.elapsed - MOTION.entryDelay) / MOTION.entryDuration;
    motion.z = entryZ(t, motion.entryExitSpeed);
    motion.speed = t <= 0 ? 0 : entrySpeed(t, motion.entryExitSpeed);
    motion.pitch = MOTION.initialPitch * (1 - minimumJerk(t));
    if (motion.elapsed < end - 0.00000001) return;
    motion.phase = 'exploring';
    motion.pitch = 0;
    motion.speed = motion.entryExitSpeed;
    motion.z = MOTION.entryEndZ;
    exploreDt = dt - entryDt;
  }
  if (exploreDt > 0) advanceTravel(motion, exploreDt);
  const steps = Math.ceil(exploreDt / MOTION.integrationStep);
  for (let step = 0; step < steps; step++) {
    const h = exploreDt / steps;
    advanceAxis(motion, 'yaw', h);
    advanceAxis(motion, 'pitch', h);
  }
}
