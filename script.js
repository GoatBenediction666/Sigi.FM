let dictionary = {};

async function loadLanguage(lang) {
  try {
    const response = await fetch(`${lang}.json`);
    dictionary = await response.json();
    
    if (dictionary.title) document.title = dictionary.title;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (dictionary[key]) el.textContent = dictionary[key];
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      if (dictionary[key]) el.setAttribute('title', dictionary[key]);
    });

    document.querySelectorAll('[data-i18n-src]').forEach(el => {
      const key = el.dataset.i18nSrc;
      if (dictionary[key]) el.src = dictionary[key];
    });

    localStorage.setItem('lang', lang);
  } catch (e) {
    console.error("Ошибка загрузки языка", e);
  }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    loadLanguage(e.target.dataset.lang);
  });
});

const savedLang = localStorage.getItem('lang') || 'ru';
loadLanguage(savedLang);

let currentArchiveId = null;
let songs = [];
let files = [];

const mainGif = document.getElementById('main-gif');
const playlistsGrid = document.getElementById('playlists-grid');

async function loadPlaylistFromArchive(id, cardElement) {
  try {
    document.querySelectorAll('.playlist-card').forEach(c => c.classList.remove('active'));
    if (cardElement) cardElement.classList.add('active');

    currentArchiveId = id;
    
    const newGifSource = `https://archive.org/download/${id}/inplay.gif`;
    const tempImg = new Image();
    tempImg.onload = () => { mainGif.src = newGifSource; };
    tempImg.onerror = () => { mainGif.src = 'shtr.gif'; }; 
    tempImg.src = newGifSource;
    
    if (isPlaying) playBtn.click();
    audio.src = '';
    trackNameDiv.textContent = "Загрузка...";

    const response = await fetch(`https://archive.org/metadata/${id}`);
    if (!response.ok) throw new Error(`server error: ${response.status}`);
    
    const metadata = await response.json();
    
    const archiveFiles = metadata.files || [];

    songs = archiveFiles
      .filter(file => file.name && file.name.endsWith('.mp3'))
      .map(file => file.name);
      
    files = songs.map(f => ({ 
      name: f, 
      filename: `https://archive.org/download/${id}/${encodeURIComponent(f)}` 
    }));

    if (files.length > 0) {
      createFileList();
      loadTrack(0, false);
    } else {
      fileListDiv.innerHTML = '<div style="color:red; text-align:center; padding:10px;">Плейлист пуст</div>';
      trackNameDiv.textContent = "Нет треков";
    }

  } catch (e) {
    console.error("ОШИБКА загрузки плейлиста:", e);
    trackNameDiv.textContent = "Ошибка сервера";
  }
}

async function initPlaylists() {
  try {
    const res = await fetch('playlists.json');
    if (!res.ok) throw new Error("JSON не найден");
    const playlistIds = await res.json();
    
    playlistsGrid.innerHTML = ''; 

    playlistIds.forEach(id => {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      
      const coverUrl = `https://archive.org/download/${id}/cover.png`;
      
      card.innerHTML = `
        <img class="playlist-cover" src="${coverUrl}" alt="cover" onerror="this.src='shtr.gif'">
        <div class="playlist-title" data-title-id="${id}">...</div>
      `;
      
      card.onclick = () => loadPlaylistFromArchive(id, card);
      playlistsGrid.appendChild(card);

      fetch(`https://archive.org/metadata/${id}`)
        .then(r => r.json())
        .then(data => {
          const titleText = data.metadata.title || id;
          const titleDiv = card.querySelector(`[data-title-id="${id}"]`);
          titleDiv.textContent = titleText;
          titleDiv.setAttribute('title', titleText);
        })
        .catch(() => {
          card.querySelector(`[data-title-id="${id}"]`).textContent = id;
        });
    });
    
    if (playlistIds.length > 0) {
      setTimeout(() => {
        loadPlaylistFromArchive(playlistIds[0], playlistsGrid.firstChild);
      }, 50);
    }

  } catch (e) {
    console.error("Не удалось прочитать playlists.json", e);
    playlistsGrid.innerHTML = '<p>Не удалось загрузить списки.</p>';
  }
}
initPlaylists();
  
const fileListDiv = document.getElementById('file-list');
const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const repeatBtn = document.getElementById('repeat');
const shuffleBtn = document.getElementById('shuffle');
const trackNameDiv = document.getElementById('track-name');
const progress = document.getElementById('progress');
const currentTimeDiv = document.getElementById('current-time');
const durationDiv = document.getElementById('duration');
const volumeSlider = document.getElementById('volume');
  
let currentTrackIndex = -1;
let isPlaying = false;
let isRepeating = false;
let isShuffle = false;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function createFileList() {
  fileListDiv.innerHTML = '';
  const fragment = document.createDocumentFragment();

  files.forEach((file, index) => {
    const el = document.createElement('div');
    el.className = 'file-item';
    const lastDotIndex = file.name.lastIndexOf('.');
    const displayName = lastDotIndex !== -1 ? file.name.slice(0, lastDotIndex) : file.name;
    el.textContent = displayName;
    el.dataset.index = index;
    el.onclick = () => loadTrack(index, true);
    fragment.appendChild(el); 
  });
  fileListDiv.appendChild(fragment); 
}

/* SMOOTH TRACK LIST */
function highlightSelected() {
  document.querySelectorAll('.file-item').forEach((el, idx) => {
    const isActive = (idx === currentTrackIndex);
    el.classList.toggle('active', isActive);
    
    if (isActive) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  });
}

/* SMOOTH VOLUME CONTROL */
let targetVolume = parseFloat(volumeSlider.value);
let volumeAnimationId = null;

function animateVolumeTo(newTarget) {
  const clampedTarget = Math.max(0, Math.min(100, newTarget)); 
  
  if (clampedTarget === targetVolume && volumeAnimationId) {
    return;
  }
  
  targetVolume = clampedTarget;

  if (volumeAnimationId) cancelAnimationFrame(volumeAnimationId);

  const startVolume = parseFloat(volumeSlider.value);
  const diff = targetVolume - startVolume;
  
  if (diff === 0) return;

  const duration = 200; 
  let start = null;

  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);

    const easeProgress = 1 - Math.pow(1 - progress, 2);
    const currentVolume = startVolume + (diff * easeProgress);

    volumeSlider.value = currentVolume;
    audio.volume = currentVolume / 100;
    volumeSlider.style.setProperty('--val', currentVolume + '%');
    
    if (progress < 1) {
      volumeAnimationId = requestAnimationFrame(step);
    } else {
      volumeAnimationId = null;
    }
  }

  volumeAnimationId = requestAnimationFrame(step);
}
/* SMOOTH END */
  
function loadTrack(index, shouldPlay = false) {
  if (index < 0 || index >= files.length) return;
  currentTrackIndex = index;
  const file = files[index];
  audio.src = file.filename;
  
  const lastDotIndex = file.name.lastIndexOf('.');
  const displayName = lastDotIndex !== -1 ? file.name.slice(0, lastDotIndex) : file.name;
  
  trackNameDiv.textContent = displayName;
  trackNameDiv.setAttribute('title', displayName);
  trackNameDiv.removeAttribute('data-i18n');
  
  highlightSelected();
  audio.load();
  if (shouldPlay) audio.play().catch(() => {});
}

function getNextTrackIndex() {
  if (isShuffle && files.length > 1) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * files.length);
    } while (randomIndex === currentTrackIndex);
    return randomIndex;
  } else {
    let newIndex = currentTrackIndex + 1;
    if (newIndex >= files.length) newIndex = 0;
    return newIndex;
  }
}

function updateProgress() {
  if (!audio.duration) return;
  progress.max = Math.floor(audio.duration);
  progress.value = Math.floor(audio.currentTime);
  currentTimeDiv.textContent = formatTime(audio.currentTime);
  durationDiv.textContent = formatTime(audio.duration);

  const percent = (audio.currentTime / audio.duration) * 100;
  progress.style.setProperty('--val', percent + '%');
}
  
repeatBtn.addEventListener('click', () => {
  isRepeating = !isRepeating;
  repeatBtn.classList.toggle('repeat-on', isRepeating);
});

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('shuffle-on', isShuffle);
});

playBtn.addEventListener('click', () => {
  if (!audio.src) return;
  if (isPlaying) audio.pause();
  else audio.play();
});

audio.addEventListener('timeupdate', updateProgress);
  
audio.addEventListener('play', () => {
  isPlaying = true;
  playBtn.textContent = '❙❙';
  initAudio(); 
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});

audio.addEventListener('pause', () => {
  isPlaying = false;
  playBtn.textContent = '▶';
});

volumeSlider.addEventListener('input', () => {
  audio.volume = volumeSlider.value / 100;
  targetVolume = parseFloat(volumeSlider.value);
  volumeSlider.style.setProperty('--val', volumeSlider.value + '%');
});
  
prevBtn.addEventListener('click', () => {
  let newIndex = currentTrackIndex - 1;
  if (newIndex < 0) newIndex = files.length - 1;
  loadTrack(newIndex, true);
});

nextBtn.addEventListener('click', () => {
  loadTrack(getNextTrackIndex(), true);
});

audio.addEventListener('ended', () => {
  if (isRepeating) {
    audio.currentTime = 0;
    audio.play();
  } else {
    loadTrack(getNextTrackIndex(), true);
  }
});

progress.addEventListener('input', () => {
  audio.currentTime = progress.value;

  const percent = (progress.value / progress.max) * 100;
  progress.style.setProperty('--val', percent + '%');
});

if (files.length > 0) {
  createFileList();
  loadTrack(0, false);
}

document.addEventListener('keydown', (event) => {
  
  if (event.target.tagName === 'INPUT') return;

  switch (event.code) {
    case 'Space':
      event.preventDefault();
      playBtn.click();
      break;

    case 'ArrowDown':
      event.preventDefault();
      nextBtn.click();
      break;

    case 'ArrowUp':
      event.preventDefault();
      prevBtn.click();
      break;

    case 'ArrowRight':
      event.preventDefault();
      let stepUp = Math.ceil((targetVolume + 1) / 10) * 10;
      animateVolumeTo(Math.min(100, stepUp));
      break;

    case 'ArrowLeft':
      event.preventDefault();
      let stepDown = Math.floor((targetVolume - 1) / 10) * 10;
      animateVolumeTo(Math.max(0, stepDown));
      break;

    case 'KeyM':
      if (targetVolume == 0) {
        let restoredVolume = volumeSlider.dataset.prevVolume || 100;
        animateVolumeTo(restoredVolume);
      } else {
        volumeSlider.dataset.prevVolume = targetVolume;
        animateVolumeTo(0);
      }
      break;
      
    case 'KeyR':
      repeatBtn.click();
      break;

    case 'KeyS':
      shuffleBtn.click();
      break;
  }
});

// ------
const mainContent = document.getElementById('player-main-content');
let savedHeight = 0; 

const tabs = [
  { btn: document.getElementById('btn-info'), content: document.getElementById('player-info-content') },
  { btn: document.getElementById('btn-settings'), content: document.getElementById('player-settings-content') },
  { btn: document.getElementById('btn-playlist'), content: document.getElementById('player-playlist-content') },
  { btn: document.getElementById('btn-eq'), content: document.getElementById('player-equalizer-content') }
];

tabs.forEach(tab => {
  tab.btn.addEventListener('click', () => {
    const isCurrentlyOpen = tab.content.style.display === 'block';

    if (mainContent.style.display !== 'none') {
      savedHeight = mainContent.offsetHeight;
    }

    tabs.forEach(t => {
      t.content.style.display = 'none';
      t.btn.style.textShadow = 'none';
    });

    if (isCurrentlyOpen) {
      mainContent.style.display = 'flex';
    } else {
      mainContent.style.display = 'none';
      tab.content.style.display = 'block';
      if (savedHeight > 0) {
        tab.content.style.height = savedHeight + 'px';
      }
      tab.btn.style.textShadow = '0 0 8px #fff';

      if (tab.btn.id === 'btn-eq') {
        resizeCanvas();
      }
    }
  });
});
// ------

/* eq eq eq */

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const slidersContainer = document.getElementById('eq-sliders-container');
const eqToggleBtn = document.getElementById('eq-toggle');
const presetSelect = document.getElementById('preset-select');

const eqFrequencies = [30, 60, 180, 320, 600, 1000, 3000, 6000, 8000, 16000];
const eqLabels = ['30', '60', '180', '320', '600', '1K', '3K', '6K', '8K', '16K'];
const presets = {
  flat:    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass:    [7, 6, 5, 2, 0, 0, 0, 0, 0, 0],
  rock:    [4, 3, 2, -1, -2, -1, 1, 2, 3, 4],
  electro: [5, 4, 1, 0, -1, 0, 2, 4, 5, 5],
  vocal:   [-3, -2, 0, 2, 4, 4, 3, 1, -1, -2]
};

let audioCtx = null;
let analyser = null;
let source = null;
let filters = [];
let eqEnabled = false;

function generateSliders() {
  slidersContainer.innerHTML = '';
  eqFrequencies.forEach((freq, i) => {
    const band = document.createElement('div'); band.className = 'eq-band';
    const wrapper = document.createElement('div'); wrapper.className = 'slider-wrapper';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.id = `eq-band-${i}`; slider.min = '-12'; slider.max = '12'; slider.step = '1'; slider.value = '0';
    const label = document.createElement('span'); label.innerText = eqLabels[i];
    wrapper.appendChild(slider); band.appendChild(wrapper); band.appendChild(label); slidersContainer.appendChild(band);

    slider.addEventListener('input', (e) => {
      presetSelect.value = 'flat';
      if (filters[i] && audioCtx) filters[i].gain.setValueAtTime(e.target.value, audioCtx.currentTime);
    });
  });
}
generateSliders();

function resizeCanvas() {
  if (canvas.clientWidth === 0) return; 
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);

function routeAudio() {
  if (!source || !analyser) return;
  source.disconnect(); filters.forEach(f => f.disconnect()); analyser.disconnect();
  if (eqEnabled) {
    let currentSource = source;
    filters.forEach(filter => { currentSource.connect(filter); currentSource = filter; });
    currentSource.connect(analyser);
  } else {
    source.connect(analyser);
  }
  analyser.connect(audioCtx.destination);
  //console.log("Цепь собрана - ", analyser.context.destination);
}

function initAudio() {
  if (audioCtx) return; 
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  const audioEl = document.getElementById('audio'); 
  source = audioCtx.createMediaElementSource(audioEl);

  filters = eqFrequencies.map((freq, index) => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = index === 0 ? 'lowshelf' : (index === eqFrequencies.length - 1 ? 'highshelf' : 'peaking');
    filter.frequency.value = freq; filter.Q.value = 1.2;
    filter.gain.value = document.getElementById(`eq-band-${index}`).value;
    return filter;
  });

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.75;
  
  routeAudio();
  draw();
}

eqToggleBtn.addEventListener('click', () => {
  eqEnabled = !eqEnabled;
  //eqToggleBtn.innerText = eqEnabled ? 'EQ: ON' : 'EQ: OFF';
  eqToggleBtn.classList.toggle('off', !eqEnabled);
  slidersContainer.classList.toggle('bypass', !eqEnabled);
  routeAudio();
});

presetSelect.addEventListener('change', (e) => {
  const selectedPreset = presets[e.target.value];
  if (!selectedPreset) return;
  selectedPreset.forEach((gainValue, i) => {
    const slider = document.getElementById(`eq-band-${i}`);
    if (slider) slider.value = gainValue;
    if (filters[i] && audioCtx) filters[i].gain.setValueAtTime(gainValue, audioCtx.currentTime);
  });
});

function draw() {
  requestAnimationFrame(draw);
  const w = canvas.width / window.devicePixelRatio, h = canvas.height / window.devicePixelRatio;
  ctx.clearRect(0, 0, w, h);
  
  if (!analyser) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  ctx.beginPath(); ctx.strokeStyle = 'rgba(255, 0, 0, 0.15)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); 
  for (let i = 0; i < eqFrequencies.length; i++) {
    const val = parseFloat(document.getElementById(`eq-band-${i}`).value); 
    const eqY = (h / 2) - (val / 12) * (h / 3.5);
    const eqX = (i / (eqFrequencies.length - 1)) * (w - 40) + 20;
    if (i === 0) ctx.moveTo(eqX, eqY);
    else {
      const prevX = ((i - 1) / (eqFrequencies.length - 1)) * (w - 40) + 20;
      const prevVal = parseFloat(document.getElementById(`eq-band-${i-1}`).value);
      const prevEqY = (h / 2) - (prevVal / 12) * (h / 3.5);
      ctx.bezierCurveTo((prevX + eqX) / 2, prevEqY, (prevX + eqX) / 2, eqY, eqX, eqY);
    }
  }
  ctx.stroke(); ctx.setLineDash([]);

  ctx.beginPath();
  let gradientFill = ctx.createLinearGradient(0, 0, 0, h);
  gradientFill.addColorStop(0, 'rgba(255, 0, 0, 0.3)'); gradientFill.addColorStop(1, 'rgba(0, 0, 0, 0)');
  let gradientLine = ctx.createLinearGradient(0, 0, w, 0);
  gradientLine.addColorStop(0, '#ff0000'); gradientLine.addColorStop(1, '#990000');
  
  ctx.moveTo(0, h);
  for (let i = 0; i <= 90; i++) {
    const percent = i / 90;
    const exactIndex = Math.exp(Math.log(3) + percent * (Math.log(analyser.frequencyBinCount * 0.75) - Math.log(3)));
    const valLower = dataArray[Math.floor(exactIndex)] || 0;
    const valUpper = dataArray[Math.ceil(exactIndex)] || 0;
    const val = valLower * (1 - (exactIndex - Math.floor(exactIndex))) + valUpper * (exactIndex - Math.floor(exactIndex));
    
    let fade = 1;
    if (i < 5) fade = 0.8 + (i * 0.04);
    if (i > 80) fade = (90 - i) / 10;

    const value = (val / 255) * fade;
    ctx.lineTo(percent * w, h - (value * h * 0.5) - (5 * fade));
  }
  ctx.fillStyle = gradientFill; ctx.fill();
  ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
  ctx.strokeStyle = gradientLine; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
}
  
/* eq eq eq */

document.querySelectorAll('input[type="range"], button').forEach(element => {
  element.addEventListener('mouseup', () => {
    element.blur();
  });
});














