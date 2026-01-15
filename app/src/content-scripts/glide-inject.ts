/**
 * Content Script - Injected into web pages
 * Handles Alt+F and creates Glide Mode overlay
 */

import * as Readability from '@mozilla/readability';
import { tokenize } from '../lib/rsvp/tokenizer';

// Track if Glide Mode is currently active
let isGlideActive = false;
let glideOverlay: HTMLDivElement | null = null;

/**
 * Extract main content from current page using Readability
 */
function extractPageContent(): { title: string; text: string } {
  const documentClone = document.cloneNode(true) as Document;
  const article = (Readability as unknown as { parse: (doc: Document, options?: unknown) => { title?: string; textContent?: string } | null }).parse(documentClone, {
    charThreshold: 0,
  });

  if (!article) {
    return {
      title: document.title,
      text: document.body.innerText,
    };
  }

  return {
    title: article.title || document.title,
    text: article.textContent || '',
  };
}

/**
 * Create Glide Mode overlay
 */
function createGlideOverlay(content: { title: string; text: string }): void {
  // Remove existing overlay if present
  removeGlideOverlay();

  // Create shadow DOM container
  const container = document.createElement('div');
  container.id = 'glide-reader-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483647;
    background: #000;
  `;

  // Create shadow DOM
  const shadow = container.attachShadow({ mode: 'open' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .glide-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #000;
      color: #fff;
      display: flex;
      flex-direction: column;
    }

    .glide-header {
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1a1a1a;
      border-bottom: 1px solid #333;
    }

    .glide-title {
      font-size: 14px;
      color: #ccc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;
    }

    .glide-close {
      background: transparent;
      border: none;
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      padding: 0 8px;
    }

    .glide-close:hover {
      color: #f55;
    }

    .glide-progress {
      height: 4px;
      background: #333;
      position: relative;
    }

    .glide-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #f55, #ff8c00);
      transition: width 0.1s linear;
    }

    .glide-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .glide-word {
      font-size: 64px;
      font-weight: 600;
      text-align: center;
      position: relative;
    }

    .glide-word .prefix {
      color: rgba(255, 255, 255, 0.7);
    }

    .glide-word .orp {
      color: #f55;
      font-weight: bold;
    }

    .glide-word .suffix {
      color: rgba(255, 255, 255, 0.7);
    }

    .glide-orp-line {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 1px;
      background: #f55;
      transform: translateX(-50%);
      pointer-events: none;
    }

    .glide-controls {
      padding: 16px;
      display: flex;
      justify-content: center;
      gap: 16px;
      background: #1a1a1a;
      border-top: 1px solid #333;
    }

    .glide-btn {
      background: #333;
      border: none;
      color: #fff;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }

    .glide-btn:hover {
      background: #444;
    }

    .glide-wpm {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ccc;
    }

    .glide-wpm input {
      width: 60px;
      background: #333;
      border: 1px solid #555;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      text-align: center;
    }
  `;

  // Create overlay structure
  const overlay = document.createElement('div');
  overlay.className = 'glide-overlay';

  // Header
  const header = document.createElement('div');
  header.className = 'glide-header';

  const title = document.createElement('div');
  title.className = 'glide-title';
  title.textContent = content.title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'glide-close';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => {
    removeGlideOverlay();
  };

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Progress bar
  const progress = document.createElement('div');
  progress.className = 'glide-progress';

  const progressBar = document.createElement('div');
  progressBar.className = 'glide-progress-bar';
  progressBar.style.width = '0%';

  progress.appendChild(progressBar);

  // Content area
  const contentArea = document.createElement('div');
  contentArea.className = 'glide-content';

  const wordDisplay = document.createElement('div');
  wordDisplay.className = 'glide-word';
  wordDisplay.id = 'glide-word-display';
  wordDisplay.innerHTML = '<div class="glide-orp-line"></div><div style="transform: translateX(-50%)">Press Play to Start</div>';

  contentArea.appendChild(wordDisplay);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'glide-controls';

  const playBtn = document.createElement('button');
  playBtn.className = 'glide-btn';
  playBtn.textContent = '▶ Play';
  playBtn.id = 'glide-play-btn';

  const wpmControl = document.createElement('div');
  wpmControl.className = 'glide-wpm';

  const wpmLabel = document.createElement('span');
  wpmLabel.textContent = 'WPM:';

  const wpmInput = document.createElement('input');
  wpmInput.type = 'number';
  wpmInput.value = '300';
  wpmInput.min = '200';
  wpmInput.max = '900';
  wpmInput.step = '10';
  wpmInput.id = 'glide-wpm-input';

  wpmControl.appendChild(wpmLabel);
  wpmControl.appendChild(wpmInput);

  controls.appendChild(playBtn);
  controls.appendChild(wpmControl);

  overlay.appendChild(header);
  overlay.appendChild(progress);
  overlay.appendChild(contentArea);
  overlay.appendChild(controls);

  shadow.appendChild(style);
  shadow.appendChild(overlay);

  document.body.appendChild(container);
  glideOverlay = container;

  // Set up RSVP engine
  setupRSVPEngine(content.text, progressBar, wordDisplay, playBtn, wpmInput);
}

/**
 * Remove Glide Mode overlay
 */
function removeGlideOverlay(): void {
  if (glideOverlay && glideOverlay.parentNode) {
    glideOverlay.parentNode.removeChild(glideOverlay);
    glideOverlay = null;
  }
  isGlideActive = false;
}

/**
 * Set up RSVP reading engine
 */
function setupRSVPEngine(
  text: string,
  progressBar: HTMLElement,
  wordDisplay: HTMLElement,
  playBtn: HTMLElement,
  wpmInput: HTMLInputElement
): void {
  const tokens = tokenize(text);
  let currentIndex = 0;
  let isPlaying = false;
  let timer: number | null = null;

  function updateWordDisplay(): void {
    if (currentIndex >= tokens.length) {
      stopReading();
      return;
    }

    const token = tokens[currentIndex];
    const prefix = token.text.slice(0, token.orpIndex);
    const orp = token.text[token.orpIndex] || '';
    const suffix = token.text.slice(token.orpIndex + 1);

    // Calculate approximate character widths for alignment
    const fontSize = parseInt(wordDisplay.style?.fontSize || '64', 10);
    const avgCharWidth = fontSize * 0.6; // Approximate width ratio
    const prefixWidth = prefix.length * avgCharWidth;
    const orpWidth = avgCharWidth;
    const orpOffset = prefixWidth + (orpWidth / 2);

    wordDisplay.innerHTML = `
      <div class="glide-orp-line"></div>
      <div style="transform: translateX(calc(-50% + ${orpOffset}px))">
        <span class="prefix">${prefix}</span><span class="orp">${orp}</span><span class="suffix">${suffix}</span>
      </div>
    `;

    // Update progress
    const progress = (currentIndex / tokens.length) * 100;
    progressBar.style.width = `${progress}%`;
  }

  function tick(): void {
    if (!isPlaying) return;

    updateWordDisplay();
    currentIndex++;

    const wpm = parseInt(wpmInput.value, 10);
    const baseMs = 60000 / wpm;
    const ms = baseMs * (1 + tokens[currentIndex]?.pauseMultiplier || 0);

    timer = window.setTimeout(tick, ms);
  }

  function startReading(): void {
    if (isPlaying) return;
    isPlaying = true;
    playBtn.textContent = '⏸ Pause';
    tick();
  }

  function stopReading(): void {
    isPlaying = false;
    playBtn.textContent = '▶ Play';
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  playBtn.onclick = () => {
    if (isPlaying) {
      stopReading();
    } else {
      startReading();
    }
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!glideOverlay) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (isPlaying) {
        stopReading();
      } else {
        startReading();
      }
    } else if (e.code === 'Escape') {
      e.preventDefault();
      removeGlideOverlay();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      currentIndex = Math.max(0, currentIndex - 10);
      updateWordDisplay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      currentIndex = Math.min(tokens.length - 1, currentIndex + 10);
      updateWordDisplay();
    }
  });
}

/**
 * Toggle Glide Mode on/off
 */
function toggleGlideMode(): void {
  if (isGlideActive) {
    removeGlideOverlay();
  } else {
    const content = extractPageContent();
    if (content.text.trim().length > 0) {
      isGlideActive = true;
      createGlideOverlay(content);
    } else {
      alert('No readable content found on this page.');
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle-glide') {
    toggleGlideMode();
    sendResponse({ success: true });
  }
});

// Also listen for keyboard event directly as backup
document.addEventListener('keydown', (e) => {
  // Alt+F to toggle Glide Mode
  if (e.altKey && e.code === 'KeyF') {
    e.preventDefault();
    toggleGlideMode();
  }
});

export {};
