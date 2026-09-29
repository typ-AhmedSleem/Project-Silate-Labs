/**
 * Motion Definition Interfaces
 * Represents the JSON motion schema and in-memory motion models.
 */

export type MotionStepType =
  | 'gesture'
  | 'rotateBone'
  | 'moveBone'
  | 'pose'
  | 'morph'
  | 'delay'
  | 'hold';

export interface Vector3Data {
  x: number;
  y: number;
  z: number;
  isDegrees?: boolean;
}

export interface BaseMotionStep {
  type: MotionStepType;
  durationMs?: number;
  atMs?: number;
}

export interface GestureStep extends BaseMotionStep {
  type: 'gesture';
  name: string;
}

export interface RotateBoneStep extends BaseMotionStep {
  type: 'rotateBone';
  bone: string;
  rotation: Vector3Data;
  from?: Vector3Data;
  to?: Vector3Data;
}

export interface MoveBoneStep extends BaseMotionStep {
  type: 'moveBone';
  bone: string;
  position: Vector3Data;
}

export interface PoseStep extends BaseMotionStep {
  type: 'pose';
  name: string;
}

export interface MorphStep extends BaseMotionStep {
  type: 'morph';
  target: string;
  value: number;
}

export interface DelayStep extends BaseMotionStep {
  type: 'delay';
}

export interface HoldStep extends BaseMotionStep {
  type: 'hold';
}

export type MotionStep =
  | GestureStep
  | RotateBoneStep
  | MoveBoneStep
  | PoseStep
  | MorphStep
  | DelayStep
  | HoldStep;

export interface MotionTimelineEntry extends BaseMotionStep {
  type: MotionStepType;
  name?: string;
  bone?: string;
  rotation?: Vector3Data;
  position?: Vector3Data;
  target?: string;
  value?: number;
}

export type ChannelMap = Record<string, MotionStep[]>;

export interface MotionDefinition {
  id: string;
  version?: number;
  durationMs?: number;
  timeline?: MotionTimelineEntry[];
  channels?: ChannelMap;
}
