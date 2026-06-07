import type { AnimationConfig, MascotAnimation } from '@/types/mascot'

export const MASCOT_ANIMATIONS: Record<MascotAnimation, AnimationConfig> = {
  bounce: {
    animate: { y: [0, -12, 0] },
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2 },
  },
  shake: {
    animate: { x: [0, -8, 8, -8, 8, 0] },
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
  pulse: {
    animate: { scale: [1, 1.05, 1] },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  spin: {
    animate: { rotate: [0, 360] },
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  float: {
    animate: { y: [0, -8, 0] },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  entrance: {
    initial: { y: 60, opacity: 0, scale: 0.8 },
    animate: { y: 0, opacity: 1, scale: 1 },
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
  exit: {
    animate: { scale: 0, opacity: 0 },
    transition: { duration: 0.2 },
  },
  wiggle: {
    animate: { rotate: [-5, 5, -5, 5, 0] },
    transition: { duration: 0.5 },
  },
  nod: {
    animate: { rotateX: [0, 15, 0, 10, 0] },
    transition: { duration: 0.6 },
  },
}
