import { SceneManager } from './scene/SceneManager.js';
import { Avatar } from './avatar/Avatar.js';
import { SkeletonController } from './avatar/SkeletonController.js';
import { AvatarController } from './avatar/AvatarController.js';
import { GestureLibrary } from './motion/GestureLibrary.js';
import { PhraseTokenizer } from './translation/PhraseTokenizer.js';
import { FileMotionRepository } from './motion/MotionRepository.js';
import { MotionResolver, ResolvedMotion } from './motion/MotionResolver.js';
import { MotionComposer } from './motion/MotionComposer.js';
import { MotionExecutor } from './motion/MotionExecutor.js';
import { appState } from './state/AppState.js';
import { UI } from './ui/UI.js';
import { MotionPanel } from './ui/MotionPanel.js';
import { CameraController } from './capture/CameraController.js';
import { HolisticLandmarkerService } from './capture/HolisticLandmarkerService.js';
import { LandmarkExtractor } from './capture/LandmarkExtractor.js';
import { LandmarkRenderer } from './capture/LandmarkRenderer.js';
import { MotionCaptureSession } from './capture/MotionCaptureSession.js';

async function bootstrap() {
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const viewportContainer = document.getElementById('viewport-container') as HTMLElement;

  if (!canvas || !viewportContainer) {
    console.error('Fatal: Canvas or container element not found');
    return;
  }

  // 1. Initialize UI & Debug Panel
  const ui = new UI();
  ui.debugPanel.log('Initializing Project Silate Phase 4 (Multi-Word Pipeline)...', 'info');

  // 2. Initialize Translation Pipeline components
  const tokenizer = new PhraseTokenizer();
  const repository = new FileMotionRepository((msg, type) => {
    ui.debugPanel.log(msg, type || 'info');
  });
  const composer = new MotionComposer(180, (msg, type) => {
    ui.debugPanel.log(msg, type || 'info');
  });

  // 3. Subscribe Debug Panel and UI to AppState changes
  appState.subscribe((state) => {
    ui.debugPanel.setAppState(state);
    if (state === 'PLAYING') {
      ui.setStatus('Avatar performing motion sequence...', 'ready');
    } else if (state === 'IDLE') {
      ui.setStatus('Avatar Ready (Idle playing)', 'ready');
    } else if (state === 'ERROR') {
      ui.setStatus('Error encountered', 'error');
    }
  });

  // 4. Initialize Three.js Scene, Camera, Lighting, Renderer & OrbitControls
  const sceneManager = new SceneManager(canvas, viewportContainer);
  sceneManager.start();
  ui.debugPanel.log('Three.js scene and OrbitControls initialized', 'success');

  // 5. Track runtime controllers
  let currentAvatar: Avatar | null = null;
  let currentAvatarController: AvatarController | null = null;
  let currentResolver: MotionResolver | null = null;
  let currentExecutor: MotionExecutor | null = null;

  const loadAvatarModel = async () => {
    appState.setState('LOADING');
    ui.setStatus('Loading avatar humanoid.glb...', 'loading');
    ui.debugPanel.setModelStatus('Loading...');

    // Clean up any running motion executor
    if (currentExecutor) {
      currentExecutor.stop();
      currentExecutor = null;
    }

    if (currentAvatarController) {
      sceneManager.unregisterUpdatable(currentAvatarController);
      currentAvatarController = null;
    }

    if (currentAvatar) {
      sceneManager.unregisterUpdatable(currentAvatar);
      if (currentAvatar.model) {
        sceneManager.scene.remove(currentAvatar.model);
      }
      currentAvatar = null;
    }

    const avatar = new Avatar(sceneManager.scene, (msg) => {
      ui.debugPanel.log(msg, 'info');
    });

    try {
      const data = await avatar.load('assets/model/humanoid.glb');
      currentAvatar = avatar;

      if (!avatar.model) {
        throw new Error('Avatar model missing after load');
      }

      // Initialize Skeleton and Avatar Controllers
      const skeletonController = new SkeletonController(avatar.model, (msg, type) => {
        ui.debugPanel.log(msg, type || 'warn');
      });

      const avatarController = new AvatarController(
        avatar,
        skeletonController,
        avatar.facialController,
        (msg, type) => {
          ui.debugPanel.log(msg, type || 'info');
        }
      );

      currentAvatarController = avatarController;

      // Wire channel state updates to debug panel
      avatarController.onChannelChange((channels) => {
        ui.debugPanel.updateChannels(channels);
      });

      // Initialize Resolver and Executor
      currentResolver = new MotionResolver(skeletonController, (msg, type) => {
        ui.debugPanel.log(msg, type || 'info');
      });

      currentExecutor = new MotionExecutor(avatarController, {
        onMotionStart: (motionId) => {
          // If this is a transition segment (trans_word1_to_word2), show transition status
          if (motionId.startsWith('trans_')) {
            ui.debugPanel.setPipelineStatus({
              execution: `Transition: ${motionId.replace(/^trans_/, '').replace('_to_', ' → ')}`
            });
          } else {
            ui.debugPanel.updateActiveSequenceWord(motionId);
          }
        },
        onStepStart: (stepInfo, total, current) => {
          ui.debugPanel.setPipelineStatus({
            status: 'Playing',
            execution: `${current}/${total}: ${stepInfo.step.description}`
          });
        },
        onProgress: (progress) => {
          ui.debugPanel.setPipelineProgress(progress.elapsedMs, progress.totalDurationMs);
        },
        onStateChange: (state) => {
          if (state === 'playing') {
            ui.setPlaybackState('playing');
          } else if (state === 'paused') {
            ui.setPlaybackState('paused');
          } else {
            ui.setPlaybackState('idle');
          }
        },
        onComplete: () => {
          ui.debugPanel.completeSequenceFlow();
          ui.debugPanel.setPipelineStatus({
            status: 'Completed',
            execution: 'Returned to IDLE'
          });
          ui.setPlaybackState('idle');
        },
        onLog: (msg, type) => {
          ui.debugPanel.log(msg, type || 'info');
        }
      });

      // Register both in order: Avatar mixer (base) -> AvatarController (overlay)
      sceneManager.registerUpdatable(avatar);
      sceneManager.registerUpdatable(avatarController);

      ui.hideOverlay();
      appState.setState('IDLE');
      ui.setStatus(`Avatar Ready (${data.activeClip || 'Idle'})`, 'ready');
      ui.debugPanel.setModelStatus('Loaded');
      ui.debugPanel.updateModelData(data);
      ui.debugPanel.setPipelineProgress(0, 0);

      ui.debugPanel.log(`Skeleton mapped: ${skeletonController.getAllBones().length} bones indexed`, 'success');
      ui.debugPanel.setPipelineStatus({
        status: 'Ready',
        tokens: [],
        files: [],
        resolved: 'None',
        execution: 'Idle'
      });
      ui.debugPanel.setSequenceFlow([]);
    } catch (err: any) {
      console.warn('Avatar model could not be loaded:', err.message);
      appState.setState('ERROR');
      ui.showMissingModelOverlay();
    }
  };

  // 6. Wire speed slider
  ui.debugPanel.onSpeedChange((speed) => {
    if (currentAvatarController) {
      currentAvatarController.setSpeed(speed);
      ui.debugPanel.log(`Animation speed set to ${speed.toFixed(1)}×`, 'info');
    }
  });

  // 7. Wire idle animation toggle
  ui.debugPanel.onIdleToggle((enabled) => {
    if (currentAvatar) {
      currentAvatar.setIdleEnabled(enabled);
      ui.debugPanel.log(
        `Idle animation ${enabled ? 'enabled' : 'disabled (standing still)'}`,
        enabled ? 'info' : 'warn'
      );
    }
  });

  // 8. Wire skeleton overlay toggle (Task 6.2)
  ui.debugPanel.onSkeletonToggle((enabled) => {
    if (currentAvatar) {
      currentAvatar.setSkeletonHelperVisible(enabled);
      ui.debugPanel.log(
        `Skeleton visualization overlay ${enabled ? 'enabled' : 'disabled'}`,
        'info'
      );
    }
  });

  // 9. Wire playback controls (Task 6.5)
  ui.onPause(() => {
    if (currentExecutor && currentExecutor.getIsRunning()) {
      currentExecutor.pause();
    }
  });

  ui.onResume(() => {
    if (currentExecutor && currentExecutor.getIsRunning()) {
      currentExecutor.resume();
    }
  });

  ui.onStop(() => {
    if (currentExecutor && currentExecutor.getIsRunning()) {
      currentExecutor.stop();
      ui.setPlaybackState('idle');
      ui.debugPanel.setPipelineStatus({
        status: 'Stopped',
        execution: 'Stopped by user'
      });
      ui.showToast('Motion playback stopped', 'info', 2000);
    }
  });

  // 10. Wire gesture buttons (individual manual triggers)
  ui.debugPanel.onGestureTrigger(async (gestureName) => {
    if (!currentAvatarController) {
      ui.showToast('Avatar model is not loaded yet', 'warn');
      ui.debugPanel.log('Cannot trigger gesture: Avatar model is not loaded yet.', 'warn');
      return;
    }

    if (currentExecutor && currentExecutor.getIsRunning()) {
      currentExecutor.stop();
      ui.setPlaybackState('idle');
    }

    try {
      currentAvatar?.stopIdle();
      appState.setState('PLAYING');
      ui.debugPanel.setActiveGesture(gestureName);
      ui.debugPanel.log(`▶ Triggering gesture: ${gestureName}`, 'info');

      const success = await GestureLibrary.execute(gestureName, currentAvatarController);

      if (success) {
        ui.debugPanel.log(`✔ Completed gesture: ${gestureName} → Returned to Idle`, 'success');
      } else {
        ui.debugPanel.log(`✖ Unknown gesture: ${gestureName}`, 'error');
      }
    } catch (err: any) {
      ui.debugPanel.log(`Error executing gesture: ${err.message}`, 'error');
    } finally {
      currentAvatar?.resumeIdle();
      appState.setState('IDLE');
      ui.debugPanel.setActiveGesture('Idle');
    }
  });

  // 11. Wire Translate button (Phase 4 Multi-Word Motion Pipeline + Phase 6 Polish)
  ui.onTranslate(async (phrase: string) => {
    if (!currentAvatarController || !currentResolver || !currentExecutor) {
      ui.showToast('Cannot translate: Avatar model is not loaded yet', 'error');
      ui.debugPanel.log('Cannot translate: Avatar model is not loaded yet.', 'warn');
      return;
    }

    ui.debugPanel.log(`═════════════ [Pipeline Start] "${phrase}" ═════════════`, 'info');

    // 11.1. Tokenize (Task 3.3)
    const tokens = tokenizer.tokenize(phrase);
    if (tokens.length === 0) {
      ui.showToast('Please enter a phrase containing words to translate', 'warn');
      ui.debugPanel.log('[Pipeline] Empty phrase after tokenization.', 'warn');
      ui.debugPanel.setPipelineStatus({ status: 'Empty input', execution: 'Aborted' });
      ui.debugPanel.setSequenceFlow([]);
      return;
    }

    ui.debugPanel.log(`[Pipeline: Tokenizer] Tokens (${tokens.length}): [${tokens.join(', ')}]`, 'info');
    ui.debugPanel.setPipelineStatus({
      status: 'Tokenized',
      tokens,
      files: [],
      resolved: 'Loading JSON files...',
      execution: 'Waiting'
    });

    // Initialize sequence flow visualizer chips
    const chipItems: Array<{ word: string; status: 'pending' | 'active' | 'completed' | 'skipped' }> = tokens.map(
      (t) => ({ word: t, status: 'pending' })
    );
    ui.debugPanel.setSequenceFlow(chipItems);

    // 11.2. Fetch Motion Definitions & Resolve (Task 4.1 & Task 4.6)
    const resolvedMotions: ResolvedMotion[] = [];
    const loadedFiles: string[] = [];
    const skippedWords: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const def = await repository.getMotion(token);

      if (def) {
        loadedFiles.push(`${token}.json`);
        const resolved = currentResolver.resolve(def);
        resolvedMotions.push(resolved);
      } else {
        // Task 4.6 & 6.6: Unknown word handling — skip gracefully with warning
        ui.debugPanel.log(`[Pipeline: Repository] ⚠️ Skipped unknown word "${token}" (no motion file found)`, 'warn');
        skippedWords.push(token);
        chipItems[i].status = 'skipped';
        ui.debugPanel.setSequenceFlow(chipItems);
      }
    }

    ui.debugPanel.setPipelineStatus({
      files: loadedFiles
    });

    if (resolvedMotions.length === 0) {
      ui.showToast(
        `None of the words in "${phrase}" have motion files. Try: hello, how, are, you, thank, yes, no, please, goodbye, welcome`,
        'warn',
        6000
      );
      ui.debugPanel.log(`[Pipeline] ⚠️ No valid motion definitions found for phrase "${phrase}".`, 'warn');
      ui.debugPanel.setPipelineStatus({ status: 'No Motions Found', execution: 'None available' });
      return;
    }

    if (skippedWords.length > 0) {
      ui.showToast(`Skipped unknown word(s): ${skippedWords.join(', ')}`, 'info', 3500);
    }

    // 11.3. Compose sequence with smooth transition blending (Task 4.2 & 4.3)
    const sequence = composer.compose(resolvedMotions, {
      transitionDurationMs: 180,
      sequenceId: `seq_${tokens.filter((_, idx) => chipItems[idx].status !== 'skipped').join('_')}`
    });

    ui.debugPanel.setPipelineStatus({
      resolved: `${sequence.getFlattenedSteps().length} steps (${sequence.getTotalDuration()}ms)`,
      status: 'Executing',
      execution: 'Starting playback...'
    });

    // 11.4. Execute Sequence with automatic interruption handling (Task 4.4 & Task 4.5 & Task 6.5)
    await currentExecutor.execute(sequence);
  });

  ui.onRetry(() => {
    loadAvatarModel();
  });

  // 12. Initialize Motion Capture System (Phase 2: MotionCapture Feature)
  const motionPanel = new MotionPanel();
  let cameraController: CameraController | null = null;
  let landmarkerService: HolisticLandmarkerService | null = null;
  let landmarkRenderer: LandmarkRenderer | null = null;
  let captureSession: MotionCaptureSession | null = null;
  let inferenceLoopId: number | null = null;

  motionPanel.onCameraToggle(async () => {
    if (cameraController && cameraController.isRunning()) {
      if (inferenceLoopId !== null) {
        cancelAnimationFrame(inferenceLoopId);
        inferenceLoopId = null;
      }
      cameraController.stop();
      landmarkRenderer?.clear();
      landmarkerService?.dispose();
      motionPanel.setCameraStatus(false);
      motionPanel.setModelStatus('off');
      motionPanel.setLatency(0);
      ui.debugPanel.log('Camera and Holistic model stopped', 'info');
    } else {
      try {
        motionPanel.setModelStatus('loading');
        ui.debugPanel.log('Starting camera and loading MediaPipe Holistic model...', 'info');

        cameraController = new CameraController(motionPanel.videoEl);
        await cameraController.start();
        motionPanel.setCameraStatus(true);

        landmarkerService = new HolisticLandmarkerService();
        await landmarkerService.initialize('/ai/holistic_landmarker.task', 'GPU');
        motionPanel.setModelStatus('ready');
        landmarkRenderer = new LandmarkRenderer(motionPanel.canvasEl);

        ui.debugPanel.log('Camera running & Holistic model initialized successfully', 'success');

        const runInference = () => {
          if (cameraController?.isRunning() && landmarkerService?.isReady()) {
            const video = cameraController.getVideo();
            const result = landmarkerService.detectFrame(video, performance.now());
            if (result) {
              landmarkRenderer?.draw(result, video.videoWidth || 640, video.videoHeight || 480);
              motionPanel.setLatency(landmarkerService.getLatency());

              if (captureSession && captureSession.isRecording()) {
                const frame = LandmarkExtractor.extract(result, performance.now());
                captureSession.addFrame(frame);
                motionPanel.setCapturedFramesCount(captureSession.getFrameCount());
              }
            }
          }
          inferenceLoopId = requestAnimationFrame(runInference);
        };

        inferenceLoopId = requestAnimationFrame(runInference);
      } catch (err: any) {
        motionPanel.setCameraStatus(false);
        motionPanel.setModelStatus('error');
        ui.showToast(err.message || 'Failed to start camera/model', 'error');
        ui.debugPanel.log(`Camera/Model Error: ${err.message}`, 'error');
      }
    }
  });

  motionPanel.onCaptureStart(async () => {
    if (!landmarkerService?.isReady()) {
      ui.showToast('Please start camera and model first', 'warn');
      return;
    }

    motionPanel.setCaptureState('countdown');
    ui.debugPanel.log('Starting 3s capture countdown...', 'info');
    await motionPanel.showCountdown(3);

    captureSession = new MotionCaptureSession();
    captureSession.start();
    motionPanel.setCaptureState('recording');
    motionPanel.setCapturedFramesCount(0);
    motionPanel.setSaveEnabled(false);
    ui.debugPanel.log('⏺ MotionCapture recording started', 'info');
  });

  motionPanel.onCaptureStop(() => {
    if (captureSession && captureSession.isRecording()) {
      captureSession.stop();
      const count = captureSession.getFrameCount();
      motionPanel.setCaptureState('idle');
      motionPanel.setSaveEnabled(count > 0);
      ui.debugPanel.log(`⏹ MotionCapture stopped. Total frames: ${count}`, 'success');
    }
  });

  motionPanel.onCaptureSave((suggestedPath) => {
    if (!captureSession || captureSession.getFrameCount() === 0) {
      ui.showToast('No motion frames captured to save', 'warn');
      return;
    }

    const jsonStr = captureSession.toJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `captured_motion_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ui.showToast(`Saved ${captureSession.getFrameCount()} frames`, 'success');
    ui.debugPanel.log(`💾 Saved motion to ${a.download} (Target path: ${suggestedPath})`, 'success');
  });

  // Initial load
  await loadAvatarModel();
}

window.addEventListener('DOMContentLoaded', bootstrap);
