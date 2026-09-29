import { SceneManager } from './scene/SceneManager.js';
import { Avatar } from './avatar/Avatar.js';
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
  ui.debugPanel.log('Initializing Project Silate 3D Scene...', 'info');

  // 2. Initialize Three.js Scene, Camera, Lighting, Renderer & OrbitControls
  const sceneManager = new SceneManager(canvas, viewportContainer);
  sceneManager.start();
  ui.debugPanel.log('Three.js scene and OrbitControls initialized', 'success');

  // 3. Initialize Avatar
  let currentAvatar: Avatar | null = null;

  const loadAvatarModel = async () => {
    ui.setStatus('Loading avatar humanoid.glb...', 'loading');
    ui.debugPanel.setModelStatus('Loading...');

    // If an avatar was previously added, remove it from update loop and scene
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
      sceneManager.registerUpdatable(avatar);

      ui.hideOverlay();
      ui.setStatus(`Avatar Ready (${data.activeClip || 'Idle'})`, 'ready');
      ui.debugPanel.setModelStatus('Loaded');
      ui.debugPanel.updateModelData(data);
    } catch (err: any) {
      console.warn('Avatar model could not be loaded:', err.message);
      ui.showMissingModelOverlay();
    }
  };

  ui.onRetry(() => {
    loadAvatarModel();
  });

  // Attempt initial load
  await loadAvatarModel();
}

window.addEventListener('DOMContentLoaded', bootstrap);
