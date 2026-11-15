# Project Silate — Motion Authoring Schema Specification

This document defines the formal schema and authoring guidelines for motion definition files (`assets/motion/{word}.json`) in **Project Silate**.

---

## 1. Overview & Architecture

Project Silate uses a declarative, semantic JSON format to define humanoid motions and sign gestures. The schema is designed to:
- **Abstract 3D mechanics:** Authors specify semantic gesture names, hand poses, and intuitive bone rotations in Euler degrees rather than raw animation clips or matrix math.
- **Support Multi-Channel Parallelism:** Motions can concurrently drive multiple body parts (e.g., head nodding while the right hand makes a thumb up gesture and fingers close).
- **Enable Storage Agnosticism:** Files are loaded via `MotionRepository` (local JSON files in prototype, REST API or SQLite database in production).
- **Gracefully Handle Deferred Features:** Facial morphs and lip targets are represented in the schema and logged via `FacialController` until the 3D model supports them.

---

## 2. Schema Formats

Project Silate supports two authoring layouts:
1. **Multi-Channel Format (Recommended):** Organizes steps under independent body channels that run concurrently.
2. **Sequential Timeline Format:** A single list of steps executed in sequence.

Both formats can coexist, and the `MotionResolver` resolves either into a unified, composable `ResolvedMotion`.

---

## 3. Multi-Channel Specification

### 3.1 Root Object

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Unique motion identifier (must match the token/filename, e.g., `"hello"`). |
| `name` | `string` | Yes | Human-readable title for debug tooling (e.g., `"Hello / Greeting"`). |
| `category` | `string` | No | Semantic category: `"greeting"`, `"question"`, `"courtesy"`, `"response"`, etc. |
| `channels` | `object` | Conditional | Map of channel names to an array of steps. |
| `timeline` | `array` | Conditional | Flat array of sequential steps (alternative to `channels`). |

### 3.2 Supported Channels

The humanoid skeleton is decomposed into 9 independent channels:

| Channel | Scope / Affected Bones | Intended Use |
| :--- | :--- | :--- |
| `body` | `Hips`, `Spine`, `Spine1`, `Spine2` | Posture shifts, bowing, torso leaning |
| `head` | `Neck`, `Head` | Tilts, nods, shakes, orientation towards viewer |
| `leftArm` | `LeftShoulder`, `LeftArm`, `LeftForeArm` | Left arm gesturing, lifting, positioning |
| `rightArm` | `RightShoulder`, `RightArm`, `RightForeArm` | Primary right arm gesturing, waving, pointing |
| `leftHand` | `LeftHand` | Left wrist orientation |
| `rightHand` | `RightHand` | Right wrist orientation |
| `fingers` | `Thumb`, `Index`, `Middle`, `Ring`, `Pinky` digits | Hand poses (`open`, `closed`, `point`, etc.) |
| `face` | Facial morph targets / expression logs | Smiles, brow raises, emotional expressions |
| `lips` | Viseme morph targets / viseme logs | Speech/phoneme mouth shapes |

---

## 4. Step Action Types

Each step in a channel or timeline defines a discrete action with timing and easing.

### 4.1 `gesture`
Executes a high-level procedural gesture from `GestureLibrary`.

```json
{
  "type": "gesture",
  "gesture": "wave_right_hand",
  "duration": 650,
  "description": "Right hand waving"
}
```

**Available Predefined Gestures:**
- `raise_right_hand`
- `wave_right_hand`
- `nod`
- `shake_head`
- `thumbs_up`
- `point_right`
- `return_neutral`

### 4.2 `bone_rotation`
Rotates a specific bone to target Euler angles (in degrees).

```json
{
  "type": "bone_rotation",
  "bone": "Head",
  "rotation": { "x": 10, "y": 0, "z": -12 },
  "duration": 400,
  "easing": "easeInOutQuad",
  "description": "Tilt head slightly towards right shoulder"
}
```

*Note: Mixamo skeleton bone names (e.g. `mixamorigHead`, `Head`) are automatically normalized.*

### 4.3 `hand_pose` / Named Finger Poses
Applies a named hand pose to finger joints (`left` or `right`).

```json
{
  "type": "gesture",
  "gesture": "pose_right_open",
  "duration": 300,
  "description": "Open all fingers fully"
}
```

**Supported Hand Poses:**
- `open` — All fingers extended and relaxed.
- `closed` — Fist / curled fingers.
- `point` — Index finger extended, remaining fingers closed.
- `thumb_up` — Thumb upright, remaining fingers closed.
- `peace` — Index and middle fingers extended in a V-shape.

### 4.4 `morph_target`
Controls facial expression or speech viseme morph targets (0.0 to 1.0).

```json
{
  "type": "morph_target",
  "target": "mouthSmile",
  "value": 0.8,
  "duration": 350,
  "description": "Warm welcoming smile"
}
```

*Note: In the current prototype, morph target calls are gracefully logged to the debug console without crashing models that lack blendshapes.*

### 4.5 `pause`
Holds the current pose for a specified duration in milliseconds.

```json
{
  "type": "pause",
  "duration": 250,
  "description": "Hold gesture momentarily"
}
```

---

## 5. Easing Functions

Transitions support smooth velocity curves:

| Easing Key | Behavior |
| :--- | :--- |
| `linear` | Uniform constant rate |
| `easeInQuad` | Slow start, accelerating |
| `easeOutQuad` | Fast start, decelerating smoothly (Recommended for returns) |
| `easeInOutQuad` | Smooth S-curve start and finish (Default) |
| `easeInCubic` | Aggressive acceleration |
| `easeOutCubic` | Aggressive deceleration |
| `easeInOutCubic` | Pronounced S-curve |

---

## 6. Complete Authoring Examples

### Example A: Multi-Channel Motion (`assets/motion/hello.json`)

```json
{
  "id": "hello",
  "name": "Hello / Wave",
  "category": "greeting",
  "description": "Multi-channel greeting with right-hand wave, head tilt, open fingers, and welcoming facial expression",
  "channels": {
    "rightArm": [
      {
        "type": "gesture",
        "gesture": "wave_right_hand",
        "duration": 850,
        "description": "Right arm waving gesture"
      }
    ],
    "fingers": [
      {
        "type": "bone_rotation",
        "bone": "RightHandIndex1",
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "duration": 200,
        "description": "Fingers extended open"
      }
    ],
    "head": [
      {
        "type": "bone_rotation",
        "bone": "Head",
        "rotation": { "x": 5, "y": 0, "z": -8 },
        "duration": 400,
        "easing": "easeInOutQuad",
        "description": "Slight welcoming head tilt"
      },
      {
        "type": "bone_rotation",
        "bone": "Head",
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "duration": 400,
        "easing": "easeInOutQuad",
        "description": "Head back to center"
      }
    ],
    "face": [
      {
        "type": "morph_target",
        "target": "mouthSmile",
        "value": 0.8,
        "duration": 300,
        "description": "Warm welcoming smile"
      }
    ]
  }
}
```

### Example B: Sequential Motion (`assets/motion/yes.json`)

```json
{
  "id": "yes",
  "name": "Yes / Affirmation",
  "category": "affirmation",
  "timeline": [
    {
      "type": "gesture",
      "gesture": "nod",
      "duration": 600,
      "description": "Nod head in affirmation"
    },
    {
      "type": "gesture",
      "gesture": "thumbs_up",
      "duration": 500,
      "description": "Thumbs up sign"
    }
  ]
}
```

---

## 7. Motion Sequencer & Blending Rules

When multiple words are translated (e.g., `"hello how are you"`):
1. **Transition Blending:** The `MotionComposer` automatically synthesizes intermediate transition segments (`trans_wordA_to_wordB`) lasting ~180ms.
2. **Quaternion SLERP:** Rotations blend using spherical linear interpolation, preventing gimbal lock or unnatural joint twists.
3. **Channel Independence:** Each channel blends back to its neutral rest pose independently.
4. **Interruption:** Submitting a new phrase immediately cancels the active sequence, blending all bones smoothly back to neutral in 150ms before launching the new sequence.
