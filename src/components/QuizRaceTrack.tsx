import { useEffect, useRef } from 'react';
import { AlertTriangle, Flag, Gauge, TrendingUp } from 'lucide-react';
import type { Brand } from '../types';

export type QuizBikeStyle = 'sport' | 'dual' | 'piston';
export type RaceTrackState = 'IDLE' | 'CLIMBING' | 'CRASHED' | 'VICTORY';

interface QuizRaceTrackProps {
  currentStep: number;
  totalSteps: number;
  trackState: RaceTrackState;
  bikeStyle: QuizBikeStyle;
  brandHint?: Brand | 'AMBAS';
  unitName?: string;
  unitColor?: string;
  lapNumber?: number;
  streak: number;
  lastEarned: number;
  eventNonce: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'smoke' | 'confetti';
}

interface FloatingCallout {
  text: string;
  subtext?: string;
  color: string;
  progressAtSpawn: number;
  life: number;
  maxLife: number;
}

function getBikeColor(bikeStyle: QuizBikeStyle, brandHint?: Brand | 'AMBAS') {
  if (brandHint === 'AMERICAN PISTON' && bikeStyle !== 'piston') {
    return '#DC2626';
  }
  if (bikeStyle === 'piston') return '#DC2626';
  if (bikeStyle === 'dual') return '#D97706';
  return '#EA580C';
}

function getTrackPoint(
  p: number,
  width: number,
  height: number
): { x: number; y: number; angle: number } {
  const clamped = Math.max(0, Math.min(1, p));
  const startX = width * 0.08;
  const endX = width * 0.91;
  const startY = height * 0.8;
  const endY = height * 0.26;

  // Smooth S-curve uphill racing ramp
  const x = startX + (endX - startX) * clamped;
  const hillCurve =
    clamped - 0.08 * Math.sin(clamped * Math.PI * 2) * (1 - clamped * 0.4);
  const y = startY + (endY - startY) * hillCurve;

  const eps = 0.005;
  const p2 = Math.min(1, clamped + eps);
  const p1 = Math.max(0, clamped - eps);
  const x2 = startX + (endX - startX) * p2;
  const x1 = startX + (endX - startX) * p1;
  const h2 = p2 - 0.08 * Math.sin(p2 * Math.PI * 2) * (1 - p2 * 0.4);
  const h1 = p1 - 0.08 * Math.sin(p1 * Math.PI * 2) * (1 - p1 * 0.4);
  const y2 = startY + (endY - startY) * h2;
  const y1 = startY + (endY - startY) * h1;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  return { x, y, angle };
}

export default function QuizRaceTrack({
  currentStep,
  totalSteps,
  trackState,
  bikeStyle,
  brandHint,
  unitName,
  unitColor,
  lapNumber,
  streak,
  lastEarned,
  eventNonce,
}: QuizRaceTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetProgress =
    totalSteps > 0 ? Math.max(0, Math.min(1, currentStep / totalSteps)) : 0;
  const virtualSpeed =
    trackState === 'CRASHED'
      ? 0
      : trackState === 'CLIMBING'
        ? 92 + Math.min(streak * 14, 70)
        : 48 + Math.min(streak * 10, 50);

  // Mutable animation state kept inside ref for 60fps rendering
  const animRef = useRef({
    visualProgress: targetProgress,
    wheelAngle: 0,
    tiltAngle: 0,
    wheelieAngle: 0,
    shakeTimer: 0,
    crashElapsed: 0,
    climbElapsed: 0,
    prevState: trackState as RaceTrackState,
    prevNonce: eventNonce,
    particles: [] as Particle[],
    callouts: [] as FloatingCallout[],
    skidMarks: [] as { fromP: number; toP: number; alpha: number }[],
    time: 0,
  });

  // React to state / step changes without resetting the canvas
  useEffect(() => {
    const a = animRef.current;
    const canvas = canvasRef.current;
    const width = canvas ? canvas.clientWidth || 720 : 720;
    const height = canvas ? canvas.clientHeight || 200 : 200;

    if (eventNonce !== a.prevNonce) {
      a.prevNonce = eventNonce;

      if (trackState === 'CLIMBING' || trackState === 'VICTORY') {
        a.climbElapsed = 0.85;
        a.crashElapsed = 0;
        const pt = getTrackPoint(a.visualProgress, width, height);
        // Spawn turbo sparks & exhaust burst
        for (let i = 0; i < 18; i++) {
          a.particles.push({
            x: pt.x - Math.cos(pt.angle) * 20,
            y: pt.y - Math.sin(pt.angle) * 20,
            vx: -Math.cos(pt.angle) * (80 + Math.random() * 140) + (Math.random() - 0.5) * 40,
            vy: -Math.sin(pt.angle) * (80 + Math.random() * 140) - Math.random() * 35,
            life: 0,
            maxLife: 0.45 + Math.random() * 0.25,
            size: 2.5 + Math.random() * 3,
            color: i % 2 === 0 ? '#FB923C' : '#FACC15',
            kind: 'spark',
          });
        }
        if (trackState === 'VICTORY') {
          const fin = getTrackPoint(1, width, height);
          const palette = ['#EA580C', '#10B981', '#FACC15', '#FFFFFF'];
          for (let i = 0; i < 28; i++) {
            a.particles.push({
              x: fin.x,
              y: fin.y - 35,
              vx: (Math.random() - 0.5) * 210,
              vy: -90 - Math.random() * 140,
              life: 0,
              maxLife: 1.1 + Math.random() * 0.6,
              size: 4 + Math.random() * 3,
              color: palette[i % palette.length],
              kind: 'confetti',
            });
          }
        }
        a.callouts.push({
          text: trackState === 'VICTORY' ? '¡META ALCANZADA!' : `+${lastEarned} PTS`,
          subtext:
            trackState === 'VICTORY'
              ? 'Subida completada'
              : streak > 1
                ? `Racha ${streak}x · Subiendo`
                : '¡Acelerando!',
          color: '#34D399',
          progressAtSpawn: Math.min(0.92, targetProgress),
          life: 0,
          maxLife: 1.35,
        });
      } else if (trackState === 'CRASHED') {
        a.shakeTimer = 0.45;
        a.crashElapsed = 0.01;
        a.climbElapsed = 0;
        const fromP = a.visualProgress;
        const toP = Math.max(0, targetProgress);
        a.skidMarks.push({ fromP, toP, alpha: 0.9 });
        if (a.skidMarks.length > 6) a.skidMarks.shift();

        const pt = getTrackPoint(fromP, width, height);
        for (let i = 0; i < 22; i++) {
          const isSmoke = i % 3 === 0;
          a.particles.push({
            x: pt.x + (Math.random() - 0.5) * 16,
            y: pt.y - 6,
            vx: (Math.random() - 0.6) * 150,
            vy: -35 - Math.random() * 110,
            life: 0,
            maxLife: isSmoke ? 0.85 : 0.5,
            size: isSmoke ? 7 + Math.random() * 6 : 2.5 + Math.random() * 2.5,
            color: isSmoke ? '#9CA3AF' : i % 2 === 0 ? '#F87171' : '#FBBF24',
            kind: isSmoke ? 'smoke' : 'spark',
          });
        }
        a.callouts.push({
          text: '¡CAÍDA EN PISTA!',
          subtext: 'Pierdes la racha',
          color: '#F87171',
          progressAtSpawn: Math.max(0.08, fromP),
          life: 0,
          maxLife: 1.5,
        });
      }
    }
    a.prevState = trackState;
  }, [trackState, eventNonce, lastEarned, streak, targetProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTs = performance.now();

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 720;
      const h = canvas.clientHeight || 200;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(() => syncSize());
    observer.observe(canvas);
    syncSize();

    const drawCheckeredFlag = (x: number, y: number, t: number) => {
      ctx.save();
      ctx.translate(x, y);
      // Pole
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -44);
      ctx.stroke();

      // Waving checkered cloth
      const cols = 4;
      const rows = 3;
      const cellW = 6;
      const cellH = 5.5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wave = reducedMotion ? 0 : Math.sin(t * 7 + c * 0.9) * (c * 0.9);
          ctx.fillStyle = (r + c) % 2 === 0 ? '#FFFFFF' : '#18181B';
          ctx.fillRect(1 + c * cellW, -43 + r * cellH + wave, cellW, cellH);
        }
      }
      ctx.strokeStyle = '#52525B';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(1, -43, cols * cellW, rows * cellH);
      ctx.restore();
    };

    const drawMotorcycle = (
      x: number,
      y: number,
      slopeAngle: number,
      bikeColor: string,
      a: typeof animRef.current
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(slopeAngle);

      const isCrashed = trackState === 'CRASHED';

      // Shadow under bike
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 3, isCrashed ? 28 : 22, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Apply crash roll/fall or climbing wheelie tilt
      if (isCrashed) {
        // Bike tipped over onto its side on the asphalt
        const bounce = reducedMotion
          ? 0
          : Math.exp(-a.crashElapsed * 6) * Math.sin(a.crashElapsed * 24) * 5;
        ctx.translate(-2, -6 - Math.abs(bounce));
        ctx.rotate(a.tiltAngle);
      } else {
        const idleBob = reducedMotion ? 0 : Math.sin(a.time * 12) * 0.8;
        ctx.translate(0, idleBob);
        // Pivot wheelie around rear wheel (-14, -7)
        ctx.translate(-14, -7);
        ctx.rotate(a.wheelieAngle);
        ctx.translate(14, 7);
      }

      // Exhaust flame when climbing
      if ((trackState === 'CLIMBING' || a.climbElapsed > 0.1) && !isCrashed) {
        const flameLen = 12 + (reducedMotion ? 4 : Math.sin(a.time * 40) * 6);
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.moveTo(-22, -11);
        ctx.lineTo(-22 - flameLen, -9);
        ctx.lineTo(-22, -7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(-22, -10.5);
        ctx.lineTo(-22 - flameLen * 0.55, -9);
        ctx.lineTo(-22, -7.5);
        ctx.closePath();
        ctx.fill();
      }

      // Wheels
      const drawWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(a.wheelAngle);
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#52525B';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Rim & spokes
        ctx.fillStyle = '#E4E4E7';
        ctx.beginPath();
        ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = bikeColor;
        ctx.lineWidth = 1.3;
        for (let s = 0; s < 3; s++) {
          const sa = (s * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sa) * -3.5, Math.sin(sa) * -3.5);
          ctx.lineTo(Math.cos(sa) * 3.5, Math.sin(sa) * 3.5);
          ctx.stroke();
        }
        ctx.restore();
      };

      drawWheel(-14, -7.5);
      drawWheel(15, -7.5);

      // Swingarm & Exhaust Pipe
      ctx.strokeStyle = '#9CA3AF';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-14, -7.5);
      ctx.lineTo(-3, -10);
      ctx.stroke();

      ctx.fillStyle = '#71717A';
      ctx.beginPath();
      ctx.roundRect(-22, -11, 14, 3.5, 1.5);
      ctx.fill();

      // Engine Block
      ctx.fillStyle = '#52525B';
      ctx.fillRect(-5, -16, 11, 8);

      // Front Fork
      ctx.strokeStyle = '#D4D4D8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(15, -7.5);
      ctx.lineTo(8, -23);
      ctx.stroke();

      // Fairing / Tank / Tail by bikeStyle
      ctx.fillStyle = bikeColor;
      ctx.beginPath();
      if (bikeStyle === 'dual') {
        // High fender + tall tank
        ctx.moveTo(-17, -17);
        ctx.lineTo(-3, -18);
        ctx.lineTo(7, -23);
        ctx.lineTo(14, -19);
        ctx.lineTo(10, -14);
        ctx.lineTo(-10, -14);
      } else {
        // Sporty streamlined fairing
        ctx.moveTo(-19, -18);
        ctx.lineTo(-4, -17);
        ctx.lineTo(8, -22);
        ctx.lineTo(16, -17);
        ctx.lineTo(11, -12);
        ctx.lineTo(-9, -12);
      }
      ctx.closePath();
      ctx.fill();

      // Seat
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.moveTo(-14, -17.5);
      ctx.lineTo(-2, -17.5);
      ctx.lineTo(1, -15.5);
      ctx.lineTo(-13, -15.5);
      ctx.closePath();
      ctx.fill();

      // Headlight beam (only when upright)
      if (!isCrashed) {
        const beamGrad = ctx.createLinearGradient(14, -19, 54, -19);
        beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.35)');
        beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(14, -20);
        ctx.lineTo(54, -27);
        ctx.lineTo(54, -11);
        ctx.closePath();
        ctx.fill();
      }

      // Rider (crouched on bike, or tumbled beside bike when crashed)
      ctx.save();
      if (isCrashed) {
        ctx.translate(-12, -12);
        ctx.rotate(-0.6);
      }
      // Rider torso & jacket
      ctx.strokeStyle = '#F4F4F5';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, -18);
      ctx.lineTo(1, -27);
      ctx.stroke();

      // Rider arm reaching handlebar
      ctx.strokeStyle = bikeColor;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(8, -22);
      ctx.stroke();

      // Rider leg
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-7, -18);
      ctx.lineTo(-2, -12);
      ctx.lineTo(-5, -8);
      ctx.stroke();

      // Helmet
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(3, -31, 5.2, 0, Math.PI * 2);
      ctx.fill();
      // Helmet racing stripe & visor
      ctx.fillStyle = bikeColor;
      ctx.fillRect(-1, -35.5, 6, 2);
      ctx.fillStyle = '#18181B';
      ctx.fillRect(4, -32.5, 4.5, 3);
      ctx.restore();

      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const width = canvas.clientWidth || 720;
      const height = canvas.clientHeight || 200;
      const a = animRef.current;
      a.time += dt;

      // Update physics state
      if (reducedMotion) {
        a.visualProgress = targetProgress;
        a.tiltAngle = trackState === 'CRASHED' ? 1.38 : 0;
        a.wheelieAngle = 0;
        a.shakeTimer = 0;
      } else {
        const diff = targetProgress - a.visualProgress;
        a.visualProgress += diff * Math.min(1, dt * 6.5);

        if (a.climbElapsed > 0) {
          a.climbElapsed = Math.max(0, a.climbElapsed - dt);
        }

        if (trackState === 'CRASHED') {
          a.crashElapsed += dt;
          a.tiltAngle += (1.42 - a.tiltAngle) * Math.min(1, dt * 11);
          a.wheelieAngle += (0 - a.wheelieAngle) * Math.min(1, dt * 10);
          if (a.shakeTimer > 0) a.shakeTimer = Math.max(0, a.shakeTimer - dt);

          // Continuous subtle engine smoke while fallen
          if (Math.random() < dt * 7) {
            const pt = getTrackPoint(a.visualProgress, width, height);
            a.particles.push({
              x: pt.x - 4 + (Math.random() - 0.5) * 10,
              y: pt.y - 10,
              vx: (Math.random() - 0.5) * 14,
              vy: -22 - Math.random() * 20,
              life: 0,
              maxLife: 0.9,
              size: 5 + Math.random() * 5,
              color: '#71717A',
              kind: 'smoke',
            });
          }
        } else {
          a.tiltAngle += (0 - a.tiltAngle) * Math.min(1, dt * 12);
          const targetWheelie =
            trackState === 'CLIMBING' && a.climbElapsed > 0.15 ? -0.25 : 0;
          a.wheelieAngle += (targetWheelie - a.wheelieAngle) * Math.min(1, dt * 10);

          const speedFactor =
            trackState === 'CLIMBING' || a.climbElapsed > 0 ? 15 : 5;
          a.wheelAngle += dt * speedFactor;

          if (trackState === 'CLIMBING' && a.climbElapsed > 0.1 && Math.random() < dt * 24) {
            const pt = getTrackPoint(a.visualProgress, width, height);
            a.particles.push({
              x: pt.x - Math.cos(pt.angle) * 20,
              y: pt.y - Math.sin(pt.angle) * 20,
              vx: -Math.cos(pt.angle) * 65 + (Math.random() - 0.5) * 20,
              vy: -Math.sin(pt.angle) * 65 - Math.random() * 20,
              life: 0,
              maxLife: 0.35,
              size: 2.2,
              color: '#FB923C',
              kind: 'spark',
            });
          }
        }
      }

      // Clear & draw background
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      if (a.shakeTimer > 0 && !reducedMotion) {
        const mag = a.shakeTimer * 12;
        ctx.translate(
          (Math.random() - 0.5) * mag,
          (Math.random() - 0.5) * mag
        );
      }

      // 1. Arena Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#0E1015');
      skyGrad.addColorStop(1, '#1A1D24');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle floodlight beams
      for (let i = 0; i < 3; i++) {
        const lx = width * (0.2 + i * 0.32);
        const beam = ctx.createLinearGradient(lx, 0, lx + 40, height);
        beam.addColorStop(0, 'rgba(255, 255, 255, 0.045)');
        beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(lx - 18, 0);
        ctx.lineTo(lx + 18, 0);
        ctx.lineTo(lx + 90, height);
        ctx.lineTo(lx - 50, height);
        ctx.closePath();
        ctx.fill();
      }

      // Distant elevation grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let g = 1; g <= 3; g++) {
        const gy = (height / 4) * g;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Speed lines during climb
      if ((trackState === 'CLIMBING' || a.climbElapsed > 0.1) && !reducedMotion) {
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.25)';
        ctx.lineWidth = 1.5;
        for (let s = 0; s < 6; s++) {
          const sx = ((width * 0.85 - ((a.time * 420 + s * 130) % (width * 0.85))) + width) % width;
          const sy = 25 + ((s * 31) % (height - 60));
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - 28, sy + 12);
          ctx.stroke();
        }
      }

      // 2. Track Embankment & Asphalt Ramp
      const samples = 48;
      ctx.beginPath();
      const firstPt = getTrackPoint(0, width, height);
      ctx.moveTo(0, height);
      ctx.lineTo(firstPt.x - 40, firstPt.y + 18);
      for (let i = 0; i <= samples; i++) {
        const pt = getTrackPoint(i / samples, width, height);
        ctx.lineTo(pt.x, pt.y + 8);
      }
      const lastPt = getTrackPoint(1, width, height);
      ctx.lineTo(width, lastPt.y + 8);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = '#111318';
      ctx.fill();

      // Asphalt surface ribbon
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const pt = getTrackPoint(i / samples, width, height);
        if (i === 0) ctx.moveTo(pt.x - 30, pt.y + 6);
        else ctx.lineTo(pt.x, pt.y + 6);
      }
      ctx.lineTo(lastPt.x + 36, lastPt.y + 6);
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Racing piano curbs (red & white blocks along lower edge)
      for (let i = 0; i < samples; i++) {
        const pA = getTrackPoint(i / samples, width, height);
        const pB = getTrackPoint((i + 1) / samples, width, height);
        ctx.strokeStyle = i % 2 === 0 ? '#DC2626' : '#F4F4F5';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y + 14);
        ctx.lineTo(pB.x, pB.y + 14);
        ctx.stroke();
      }

      // Dashed white center line
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = 'rgba(244, 244, 245, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const pt = getTrackPoint(i / samples, width, height);
        if (i === 0) ctx.moveTo(pt.x - 20, pt.y + 6);
        else ctx.lineTo(pt.x, pt.y + 6);
      }
      ctx.stroke();
      ctx.restore();

      // Skid marks from past crashes
      for (const skid of a.skidMarks) {
        ctx.strokeStyle = `rgba(9, 9, 11, ${skid.alpha})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let s = 0; s <= 10; s++) {
          const sp = skid.fromP + ((skid.toP - skid.fromP) * s) / 10;
          const pt = getTrackPoint(sp, width, height);
          if (s === 0) ctx.moveTo(pt.x, pt.y + 2);
          else ctx.lineTo(pt.x, pt.y + 2);
        }
        ctx.stroke();
      }

      // 3. Checkpoint Milestones (1..totalSteps) & Start/Finish
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      for (let step = 0; step <= totalSteps; step++) {
        const p = totalSteps > 0 ? step / totalSteps : 0;
        const pt = getTrackPoint(p, width, height);
        const reached = currentStep >= step && step > 0;

        ctx.fillStyle = reached ? '#EA580C' : '#52525B';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y + 15, step === 0 || step === totalSteps ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();

        if (step > 0 && step < totalSteps) {
          ctx.fillStyle = reached ? '#FDBA74' : '#71717A';
          ctx.fillText(`${step}`, pt.x, pt.y + 29);
        }
      }

      ctx.fillStyle = '#A1A1AA';
      ctx.fillText('SALIDA', firstPt.x, firstPt.y + 30);

      // Checkered flag at summit
      drawCheckeredFlag(lastPt.x, lastPt.y - 2, a.time);
      ctx.fillStyle = '#F4F4F5';
      ctx.fillText('META', lastPt.x, lastPt.y + 30);

      // 4. Draw Motorcycle at current visualProgress
      const bikePt = getTrackPoint(a.visualProgress, width, height);
      const bikeColor = unitColor || getBikeColor(bikeStyle, brandHint);
      drawMotorcycle(bikePt.x, bikePt.y + 1, bikePt.angle, bikeColor, a);

      // 5. Particles (sparks, smoke, confetti)
      for (let i = a.particles.length - 1; i >= 0; i--) {
        const p = a.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          a.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'confetti') p.vy += 260 * dt;
        if (p.kind === 'smoke') {
          p.size += dt * 9;
        }
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.kind === 'confetti') {
          ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 6. Floating Callouts on Canvas
      for (let i = a.callouts.length - 1; i >= 0; i--) {
        const c = a.callouts[i];
        c.life += dt;
        if (c.life >= c.maxLife) {
          a.callouts.splice(i, 1);
          continue;
        }
        const pt = getTrackPoint(c.progressAtSpawn, width, height);
        const rise = reducedMotion ? 0 : (c.life / c.maxLife) * 26;
        const alpha = c.life < 0.15 ? c.life / 0.15 : 1 - Math.max(0, (c.life - 0.6) / (c.maxLife - 0.6));
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.textAlign = 'center';
        ctx.font = '700 14px "Barlow Condensed", sans-serif';
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, pt.x, pt.y - 46 - rise);
        if (c.subtext) {
          ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#E4E4E7';
          ctx.fillText(c.subtext, pt.x, pt.y - 33 - rise);
        }
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [targetProgress, currentStep, totalSteps, trackState, bikeStyle, brandHint, unitColor]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#111318]">
      {/* Compact Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2.5 text-xs text-zinc-300">
        <div className="flex items-center gap-2 font-medium">
          {trackState === 'CRASHED' ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="font-semibold text-red-400">
                ¡Caída en pista! Pierdes tracción
              </span>
            </>
          ) : trackState === 'VICTORY' ? (
            <>
              <Flag className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-emerald-400">
                ¡Meta superada en pista!
              </span>
            </>
          ) : trackState === 'CLIMBING' ? (
            <>
              <TrendingUp className="h-3.5 w-3.5 text-[#FB923C]" />
              <span className="font-semibold text-[#FB923C]">
                ¡Subiendo tramo! Buen ritmo
              </span>
            </>
          ) : (
            <>
              <Gauge className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-zinc-200">
                Circuito de ascenso · Responde para acelerar
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums">
          {unitName && (
            <span className="hidden text-zinc-300 sm:inline">
              Unidad: <strong className="text-white">{unitName}</strong>
            </span>
          )}
          {lapNumber && lapNumber > 1 && (
            <span className="text-zinc-400">
              Vuelta <strong className="text-white">{lapNumber}</strong>
            </span>
          )}
          <span className="text-zinc-400">
            Tramo{' '}
            <strong className="text-white">
              {Number.isInteger(currentStep)
                ? currentStep
                : currentStep.toFixed(1)}
              /{totalSteps}
            </strong>
          </span>
          <span className="text-zinc-400">
            Ritmo{' '}
            <strong
              className={
                trackState === 'CRASHED' ? 'text-red-400' : 'text-[#FB923C]'
              }
            >
              {virtualSpeed} km/h
            </strong>
          </span>
        </div>
      </div>

      {/* 60fps Race Track Canvas */}
      <canvas
        ref={canvasRef}
        aria-label="Animación de motocicleta subiendo la pista de carreras"
        className="block h-[175px] w-full sm:h-[200px]"
      />
    </div>
  );
}
