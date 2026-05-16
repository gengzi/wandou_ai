# Wandou AI Design Language

This document captures the product design language for Wandou AI. It should guide future UI work, workflow design, and component decisions.

## Product Positioning

Wandou AI is a creative production workspace for story videos, character assets, derivative designs, and AI-generated media. The product should feel like a professional creative control room: calm, visual, responsive, and trustworthy.

The first screen should expose the actual creative workflow. Avoid marketing-style landing pages inside the product workspace. Users should immediately see conversation, canvas, assets, and generation state.

## Core Principles

- Real capability over decoration. Every visible button, card action, toolbar icon, and node control must either execute a real backend action, open a real editor, or clearly explain why it is unavailable.
- Chinese first. The default product language is Simplified Chinese. English can be supported through i18n, but raw English labels should not appear in the default UI unless they are model names, provider names, or industry terms such as Shot.
- Workflow as the interface. The canvas is not just visualization; it is the operational map of the production pipeline. Node state, assets, tasks, and dependencies must stay synchronized with backend truth.
- Assets are durable. Generated or uploaded media should be persisted into project assets/object storage. Temporary third-party URLs should not be treated as durable product outputs.
- User intent carries forward. Reference images, generated characters, edited scripts, model selections, and node parameters should be reused downstream instead of ignored.
- Progressive control. The default path should be simple, but users must be able to refine scripts, regenerate nodes, choose models, adjust aspect ratio/duration, and inspect outputs.

## Visual System

### Theme

The primary workspace uses a dark theme. Dark mode is the default for creative flow screens because it keeps generated media and canvas relationships in focus.

Use restrained surfaces:

- Page background: near-black canvas with subtle grid or dots.
- Panels: dark neutral surfaces with low-contrast borders.
- Primary action: Wandou green.
- Warning/error: warm yellow/red, shown sparingly and with actionable copy.
- Avoid large decorative gradients, floating blobs, and ornamental cards that do not carry workflow information.

### Density

This is a production tool, not a promo page. Prefer compact, scan-friendly UI:

- Node titles: small, bold, single-line where possible.
- Node body copy: smaller than previous iterations; use scroll areas for long prompts/errors.
- Buttons: compact icon-first controls with tooltips.
- Cards: use cards for nodes, assets, modals, and repeated items only. Do not nest decorative cards inside cards.

### Typography

- Default UI text should be compact and readable.
- Avoid oversized text in sidebars, nodes, tool panels, and asset lists.
- Long URLs, provider errors, prompts, and JSON-like output must wrap safely and never overflow cards.
- Debug output should be hidden in collapsible sections unless actively needed.

## Layout

### Workspace

The primary workspace has three major zones:

- Left conversation panel: user intent, model selection, run progress, confirmation controls, uploads.
- Center canvas: node graph of the creative workflow.
- Right inspector: selected node controls, parameters, regeneration prompt, and optional debug output.

The center canvas should remain the visual anchor. Side panels must not cover important canvas content by default, and canvas default zoom should show the active workflow rather than one oversized node.

### Canvas

The default story-video workflow structure is:

角色设定 -> 角色参考图 -> 分镜列表 -> 每个分镜关键帧 -> 每个分镜视频片段 -> 音频/字幕 -> 最终合成长视频

For multiple characters and shots:

- Extract multiple characters from the script.
- Generate or attach separate reference images/design sheets for each character.
- Generate first/last keyframes per shot where the provider supports them.
- Generate one short video clip per storyboard shot.
- Aggregate clips in the final node and show the timeline.

Canvas nodes should expose real operational state:

- `idle`: waiting for input or upstream dependency.
- `running`: backend task or model call is in progress.
- `success`: output is usable and persisted where needed.
- `failed`: backend/provider returned a real error.
- `cancelled`: user or system stopped the run.

## Node And Card Behavior

Every node/card action must be backed by one of these behaviors:

- Trigger an Agent Run mode.
- Persist a node output or parameter.
- Create/update/delete a durable asset.
- Open a real editor or inspector.
- Download/open a durable asset URL.

Do not ship inert icons. If a capability is planned but unavailable, hide it or render it disabled with a short reason.

Expected node capabilities:

- Script node: edit, quote into chat, regenerate through text model.
- Character node: show multiple characters, design sheets, reference images, regenerate character design, generate video from a selected character image.
- Storyboard node: show shots, durations, camera notes, quote/regenerate storyboard.
- Image/keyframe node: show friendly thumbnails, generate variants, batch generate, image-to-video, download.
- Audio node: show sound plan/audio preview when available, regenerate, quote, download.
- Video clip node: preview clip, regenerate through video provider, download.
- Final node: show final preview, timeline clips, regenerate export summary, download final asset.

## Conversation And Process Feedback

The chat should show useful process information without exposing noisy internals by default.

Show:

- Current model/provider when relevant.
- Agent step started/completed messages.
- Confirmation checkpoints.
- Real provider errors and retry guidance.
- Generated media previews, not raw temporary URLs.

Avoid:

- Long raw URLs in chat bubbles.
- Large JSON dumps in normal conversation.
- English-only system messages.
- Fake success messages when providers fail.

## Asset Library

The asset library is a durable project memory, not a temporary gallery.

Assets should support:

- Image, video, audio, project model, character, scene, derivative, print-ready outputs.
- Dark theme by default.
- Friendly preview and detail panels.
- Search/filter in Chinese.
- Regeneration/source node relationship.
- Object-storage-backed URLs for generated and imported media.

For generated characters, allow downstream derivative creation:

- T-shirt/print artwork.
- 3D model concept or printable model export.
- Poster/sticker/product mockup.
- Additional poses, expressions, and style variants.

## Model Selection

Users can choose models in the conversation flow. Model selection must be passed through the run request and respected by backend execution.

Support capability-specific model selection:

- Text model for script, planning, storyboard, edit, review.
- Image model for character art, reference images, keyframes, variants.
- Video model for image-to-video, shot clips, final video.
- Audio model for voice, music, and sound effects when available.

Generation settings should be confirmed before a workflow starts. The default confirmation controls should include:

- Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16.
- Resolution: 720p and 1080p where the provider/account supports it.
- Duration: a compact slider or stepper, persisted as seconds.
- Audio/effects toggle.
- Multi-camera toggle when the selected provider can use it.

These settings should be sent to the backend request and written into node output metadata so reruns, debugging, and asset history can explain how a result was produced.

Provider compatibility should prefer OpenAI-compatible configuration shapes: base URL, API key, model name, capability, and compatibility mode.

## Error Design

Errors should be useful and compact:

- Show provider name and short reason.
- Keep long raw provider payloads collapsed or scrollable.
- Do not let error text overflow cards.
- Preserve partial success for batch operations.
- Make next action obvious: retry, change model, reduce batch size, or edit prompt.

## Implementation Guidance

- Reuse existing React components, API helpers, React Flow patterns, and lucide icons.
- Keep UI state synchronized with backend events and persisted canvas state.
- Store node parameters in node output/data so reruns can reuse them.
- Use object storage for durable media and serve app-owned asset URLs to the UI.
- Add new components only when they reduce repeated UI or clarify a workflow boundary.
- Use i18n-ready copy. New user-facing labels should be easy to move into a translation table.
