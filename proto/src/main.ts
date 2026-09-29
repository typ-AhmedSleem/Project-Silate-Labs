import { SceneManager } from './scene/SceneManager.js';
import { Avatar } from './avatar/Avatar.js';
import { SkeletonController } from './avatar/SkeletonController.js';
import { AvatarController } from './avatar/AvatarController.js';
import { GestureLibrary } from './motion/GestureLibrary.js';
import { appState } from './state/AppState.js';
import { UI } from './ui/UI.js';

async function bootstrap() {
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const viewportContainer = document.getElementById('viewport-container') as HTMLElement;

  if (!canvas || !viewportContainer) {
    console.error('Fatal: Canvas or container element not found');
    return;
  }

  // 1. Initialize UI & Debug Panel
  const ui = new UI();
  ui.debugPanel.log('Initializing Project Silate Phase 2...', 'info');

  // 2. Subscribe Debug Panel and UI to AppState changes
  appState.subscribe((state) => {
    ui.debugPanel.setAppState(state);
    if (state === 'PLAYING') {
      ui.setStatus('Avatar performing gesture...', 'ready');
    } else if (state === 'IDLE') {
      ui.setStatus('Avatar Ready (Idle playing)', 'ready');
    } else if (state === 'ERROR') {
      ui.setStatus('Error encountered', 'error');
    }
  });

  // 3. Initialize Three.js Scene, Camera, Lighting, Renderer & OrbitControls
  const sceneManager = new SceneManager(canvas, viewportContainer);
  sceneManager.start();
  ui.debugPanel.log('Three.js scene and OrbitControls initialized', 'success');

  // 4. Track Avatar and AvatarController instances
  let currentAvatar: Avatar | null = null;
  let currentAvatarController: AvatarController | null = null;
  let isExecutingGesture: boolean = false;

  const loadAvatarModel = async () => {
    appState.setState('LOADING');
    ui.setStatus('Loading avatar humanoid.glb...', 'loading');
    ui.debugPanel.setModelStatus('Loading...');

    // If an avatar was previously added, unregister from update loop and clean up scene
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

      // Register both in order: Avatar mixer (base) -> AvatarController (overlay)
      sceneManager.registerUpdatable(avatar);
      sceneManager.registerUpdatable(avatarController);

      ui.hideOverlay();
      appState.setState('IDLE');
      ui.setStatus(`Avatar Ready (${data.activeClip || 'Idle'})`, 'ready');
      ui.debugPanel.setModelStatus('Loaded');
      ui.debugPanel.updateModelData(data);

      ui.debugPanel.log(`Skeleton mapped: ${skeletonController.getAllBones().length} bones indexed`, 'success');
    } catch (err: any) {
      console.warn('Avatar model could not be loaded:', err.message);
      appState.setState('ERROR');
      ui.showMissingModelOverlay();
    }
  };

  // 5. Wire speed slider
  ui.debugPanel.onSpeedChange((speed) => {
    if (currentAvatarController) {
      currentAvatarController.setSpeed(speed);
      ui.debugPanel.log(`Animation speed set to ${speed.toFixed(1)}×`, 'info');
    }
  });

  // 6. Wire gesture buttons
  ui.debugPanel.onGestureTrigger(async (gestureName) => {
    if (!currentAvatarController) {
      ui.debugPanel.log('Cannot trigger gesture: Avatar model is not loaded yet.', 'warn');
      return;
    }

    if (isExecutingGesture) {
      ui.debugPanel.log(`Interrupted/Overriding with new gesture: ${gestureName}`, 'info');
    }

    try {
      isExecutingGesture = true;
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
      isExecutingGesture = false;
      appState.setState('IDLE');
      ui.debugPanel.setActiveGesture('Idle');
    }
  });

  ui.onRetry(() => {
    loadAvatarModel();
  });

  // Initial load
  await loadAvatarModel();
}

window.addEventListener('DOMContentLoaded', bootstrap);
