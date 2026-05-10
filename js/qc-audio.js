(function () {
  'use strict';

  var BANDS = [
    { f: 32, label: '32', type: 'lowshelf' },
    { f: 64, label: '64', type: 'peaking' },
    { f: 125, label: '125', type: 'peaking' },
    { f: 250, label: '250', type: 'peaking' },
    { f: 500, label: '500', type: 'peaking' },
    { f: 1000, label: '1k', type: 'peaking' },
    { f: 2000, label: '2k', type: 'peaking' },
    { f: 4000, label: '4k', type: 'peaking' },
    { f: 8000, label: '8k', type: 'peaking' },
    { f: 16000, label: '16k', type: 'highshelf' }
  ];

  var FILTER_TYPES = [
    { value: 'peaking', label: 'PK' },
    { value: 'lowshelf', label: 'LS' },
    { value: 'highshelf', label: 'HS' },
    { value: 'lowpass', label: 'LP' },
    { value: 'highpass', label: 'HP' },
    { value: 'notch', label: 'NT' }
  ];

  var PRESETS = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'FLAC Warm': [2, 1.5, 1, 0.5, 0, 0, 0.5, 1, 1.5, 2],
    Vocal: [-2, -1.5, 0, 1, 2, 2, 1, 0, -0.5, -1],
    Bass: [5, 4, 2, 0, -1, -1, 0, 0, 0, 0],
    Bright: [-1, -1, -0.5, 0, 0.5, 1.5, 2.5, 3, 3.5, 4],
    'V-Shape': [3, 2, 0, -1, -2, -2, -1, 0, 2, 3]
  };

  function $(root, sel) { return root.querySelector(sel); }
  function $all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function text(node, val) { if (node) node.textContent = val; }

  function joinUrl(base, key) {
    return String(base || '').replace(/\/+$/, '') + '/' + String(key || '').replace(/^\/+/, '');
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var size = bytes, unit = 0;
    while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
    return size.toFixed(unit ? 1 : 0) + ' ' + units[unit];
  }

  function getStored(name, fallback) {
    try {
      var v = localStorage.getItem(name);
      return v === null ? (fallback || '') : v;
    } catch (e) { return fallback || ''; }
  }

  function setStored(name, value) {
    try { localStorage.setItem(name, value || ''); } catch (e) {}
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function AudioConsole(root) {
    this.root = root;
    this.audio = $(root, '[data-audio-player]');
    this.status = $(root, '[data-audio-status]');
    this.storageStatus = $(root, '[data-storage-status]');
    this.publicBase = root.getAttribute('data-public-base') || '';
    this.audioContext = null;
    this.source = null;
    this.filters = [];
    this.preamp = null;
    this.compressor = null;
    this.analyser = null;
    this.objectUrl = null;
    this.spectrumCanvas = $(root, '[data-spectrum-canvas]');
    this.spectrumCtx = null;
    this.spectrumReq = null;
    this.responseCanvas = $(root, '[data-response-canvas]');
    this.responseCtx = null;
    this.init();
  }

  AudioConsole.prototype.init = function () {
    this.setupCanvases();
    this.buildEq();
    this.bindPlayback();
    this.bindStorage();
    this.reportSupport();
    this.autoFetchList();
  };

  AudioConsole.prototype.setupCanvases = function () {
    var dpr = window.devicePixelRatio || 1;
    if (this.spectrumCanvas) {
      var r1 = this.spectrumCanvas.getBoundingClientRect();
      this.spectrumCanvas.width = (r1.width || 600) * dpr;
      this.spectrumCanvas.height = (r1.height || 120) * dpr;
      this.spectrumCtx = this.spectrumCanvas.getContext('2d');
      this.spectrumCtx.scale(dpr, dpr);
    }
    if (this.responseCanvas) {
      var r2 = this.responseCanvas.getBoundingClientRect();
      this.responseCanvas.width = (r2.width || 600) * dpr;
      this.responseCanvas.height = (r2.height || 120) * dpr;
      this.responseCtx = this.responseCanvas.getContext('2d');
      this.responseCtx.scale(dpr, dpr);
    }
  };

  AudioConsole.prototype.reportSupport = function () {
    if (!this.audio || !this.status) return;
    var flac = this.audio.canPlayType('audio/flac') || this.audio.canPlayType('audio/x-flac');
    if (!flac) {
      text(this.status, '当前浏览器未声明 FLAC 原生解码能力，可尝试 Chromium / Firefox / Safari 新版本或转换为 WAV。');
    }
  };

  AudioConsole.prototype.ensureAudioGraph = function () {
    if (!this.audio || this.audioContext) return;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      text(this.status, '当前浏览器不支持 Web Audio API，EQ 与频谱已禁用。');
      return;
    }

    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaElementSource(this.audio);
    this.preamp = this.audioContext.createGain();
    this.preamp.gain.value = 0.9;
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -4;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    var prev = this.source;
    var self = this;
    this.filters = BANDS.map(function (band) {
      var f = self.audioContext.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.f;
      f.Q.value = 1.05;
      f.gain.value = 0;
      prev.connect(f);
      prev = f;
      return f;
    });

    prev.connect(this.preamp);
    this.preamp.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.startSpectrum();
  };

  AudioConsole.prototype.startSpectrum = function () {
    if (!this.analyser || !this.spectrumCanvas || this.spectrumReq) return;
    var self = this;
    var bufferLength = this.analyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);

    function draw() {
      self.spectrumReq = requestAnimationFrame(draw);
      if (!self.analyser) return;
      self.analyser.getByteFrequencyData(dataArray);
      self.drawSpectrumFrame(dataArray, bufferLength);
    }
    draw();
  };

  AudioConsole.prototype.drawSpectrumFrame = function (dataArray, bufferLength) {
    var ctx = this.spectrumCtx;
    var canvas = this.spectrumCanvas;
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, w, h);

    var bars = 64;
    var barW = w / bars;

    for (var i = 0; i < bars; i++) {
      var start = Math.floor(bufferLength * Math.pow(i / bars, 2));
      var end = Math.floor(bufferLength * Math.pow((i + 1) / bars, 2));
      var sum = 0, count = 0;
      for (var j = start; j < end && j < bufferLength; j++) {
        sum += dataArray[j];
        count++;
      }
      var avg = count ? (sum / count) : 0;
      var bh = (avg / 255) * h * 0.92;
      var hue = 160 + (i / bars) * 60;
      ctx.fillStyle = 'hsla(' + hue + ', 75%, 55%, 0.85)';
      ctx.fillRect(i * barW + 1, h - bh, barW - 2, bh);
    }
  };

  AudioConsole.prototype.drawResponse = function () {
    var ctx = this.responseCtx;
    var canvas = this.responseCanvas;
    if (!ctx || !canvas) return;
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);

    var points = 200;
    var freqs = new Float32Array(points);
    for (var i = 0; i < points; i++) {
      freqs[i] = 20 * Math.pow(1000, i / (points - 1));
    }

    var total = new Float32Array(points);
    for (var i = 0; i < points; i++) total[i] = 1;

    if (this.filters && this.filters.length) {
      for (var fi = 0; fi < this.filters.length; fi++) {
        var filter = this.filters[fi];
        if (!filter) continue;
        var mag = new Float32Array(points);
        var phase = new Float32Array(points);
        filter.getFrequencyResponse(freqs, mag, phase);
        for (var i = 0; i < points; i++) {
          total[i] *= mag[i];
        }
      }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (var db = -12; db <= 12; db += 3) {
      var y = h / 2 - (db / 15) * (h / 2 - 8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    var marks = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    for (var m = 0; m < marks.length; m++) {
      var x = (Math.log10(marks[m] / 20) / 3) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.strokeStyle = '#19b3a6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var i = 0; i < points; i++) {
      var db = 20 * Math.log10(total[i] + 0.0001);
      var x = (i / (points - 1)) * w;
      var y = h / 2 - (db / 15) * (h / 2 - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.lineTo(w, h / 2);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(25, 179, 166, 0.15)';
    ctx.fill();
  };

  AudioConsole.prototype.buildEq = function () {
    var self = this;
    var sliderWraps = $all(this.root, '[data-eq-sliders]');
    sliderWraps.forEach(function (wrap) {
      wrap.innerHTML = '';
      BANDS.forEach(function (band, index) {
        var item = document.createElement('div');
        item.className = 'qc-eq-band';
        var typeOptions = FILTER_TYPES.map(function (t) {
          return '<option value="' + t.value + '"' + (t.value === band.type ? ' selected' : '') + '>' + t.label + '</option>';
        }).join('');
        item.innerHTML = '<span>' + band.label + '</span>' +
          '<select data-band-type="' + index + '">' + typeOptions + '</select>' +
          '<input type="range" min="-12" max="12" step="0.5" value="0" data-band="' + index + '">' +
          '<output>0 dB</output>';
        wrap.appendChild(item);
      });
    });

    $all(this.root, '[data-band-type]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var idx = Number(sel.getAttribute('data-band-type'));
        self.setFilterType(idx, sel.value);
        self.drawResponse();
      });
    });

    $all(this.root, '[data-band]').forEach(function (input) {
      input.addEventListener('input', function () {
        var idx = Number(input.getAttribute('data-band'));
        self.setBand(idx, Number(input.value));
        var out = input.parentNode.querySelector('output');
        text(out, Number(input.value).toFixed(1).replace('.0', '') + ' dB');
        self.drawResponse();
      });
    });

    var presetWrap = $(this.root, '[data-eq-presets]');
    if (presetWrap) {
      presetWrap.innerHTML = '';
      Object.keys(PRESETS).forEach(function (name) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = name;
        btn.addEventListener('click', function () {
          self.applyPreset(name);
        });
        presetWrap.appendChild(btn);
      });
    }

    var reset = $(this.root, '[data-reset-eq]');
    if (reset) {
      reset.addEventListener('click', function () {
        self.applyPreset('Flat');
      });
    }

    var preamp = $(this.root, '[data-preamp]');
    if (preamp) {
      preamp.addEventListener('input', function () {
        self.ensureAudioGraph();
        if (self.preamp) {
          self.preamp.gain.value = Math.pow(10, Number(preamp.value) / 20);
        }
      });
    }

    var limiter = $(this.root, '[data-limiter]');
    if (limiter) {
      limiter.addEventListener('change', function () {
        self.toggleLimiter(limiter.checked);
      });
    }

    this.drawResponse();
  };

  AudioConsole.prototype.setFilterType = function (index, type) {
    this.ensureAudioGraph();
    if (this.filters[index]) {
      this.filters[index].type = type;
    }
  };

  AudioConsole.prototype.setBand = function (index, gain) {
    this.ensureAudioGraph();
    if (this.filters[index]) {
      this.filters[index].gain.value = gain;
    }
  };

  AudioConsole.prototype.applyPreset = function (name) {
    var values = PRESETS[name] || PRESETS.Flat;
    var inputs = $all(this.root, '[data-band]');
    for (var i = 0; i < inputs.length && i < values.length; i++) {
      inputs[i].value = values[i];
      this.setBand(i, values[i]);
      var out = inputs[i].parentNode.querySelector('output');
      text(out, values[i].toFixed(1).replace('.0', '') + ' dB');
    }
    var typeSelects = $all(this.root, '[data-band-type]');
    for (var i = 0; i < typeSelects.length && i < BANDS.length; i++) {
      typeSelects[i].value = BANDS[i].type;
      this.setFilterType(i, BANDS[i].type);
    }
    text(this.status, '已应用 EQ 预设：' + name);
    this.drawResponse();
  };

  AudioConsole.prototype.toggleLimiter = function (enabled) {
    this.ensureAudioGraph();
    if (!this.compressor) return;
    this.compressor.threshold.value = enabled ? -4 : 0;
    this.compressor.ratio.value = enabled ? 6 : 1;
  };

  AudioConsole.prototype.bindPlayback = function () {
    var self = this;
    var input = $(this.root, '[data-audio-url]');
    var load = $(this.root, '[data-load-url]');
    var local = $(this.root, '[data-local-file]');

    if (load && input) {
      load.addEventListener('click', function () {
        self.loadUrl(input.value);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') self.loadUrl(input.value);
      });
    }

    if (local) {
      local.addEventListener('change', function () {
        var file = local.files && local.files[0];
        if (!file) return;
        if (self.objectUrl) URL.revokeObjectURL(self.objectUrl);
        self.objectUrl = URL.createObjectURL(file);
        self.loadUrl(self.objectUrl, file.name);
      });
    }

    if (this.audio) {
      this.audio.addEventListener('play', function () {
        self.ensureAudioGraph();
        if (self.audioContext && self.audioContext.state === 'suspended') {
          self.audioContext.resume();
        }
      });
      this.audio.addEventListener('loadedmetadata', function () {
        var label = self.audio.currentSrc.split('/').pop() || '当前音源';
        text(self.status, '已载入：' + decodeURIComponent(label));
      });
      this.audio.addEventListener('error', function () {
        text(self.status, '音源载入失败。若是 R2 公共地址，请检查 CORS 是否允许当前站点 GET。');
      });
    }
  };

  AudioConsole.prototype.loadUrl = function (url, label) {
    if (!this.audio || !url) {
      text(this.status, '请输入可访问的音源 URL。');
      return;
    }
    this.audio.src = url.trim();
    this.audio.load();
    text(this.status, '正在载入：' + (label || url));
  };

  AudioConsole.prototype.bindStorage = function () {
    var self = this;
    var apiInput = $(this.root, '[data-api-base]');
    var publicInput = $(this.root, '[data-public-base-input]');
    var devInput = $(this.root, '[data-dev-token]');
    var refresh = $(this.root, '[data-refresh-list]');
    var upload = $(this.root, '[data-upload]');

    if (apiInput) {
      apiInput.value = getStored('qcAudioApiBase', apiInput.value || '');
      apiInput.addEventListener('input', function () {
        setStored('qcAudioApiBase', apiInput.value);
      });
    }
    if (publicInput) {
      publicInput.value = getStored('qcAudioPublicBase', publicInput.value || this.publicBase);
      this.publicBase = publicInput.value;
      publicInput.addEventListener('input', function () {
        self.publicBase = publicInput.value;
        setStored('qcAudioPublicBase', publicInput.value);
      });
    }
    if (devInput) {
      devInput.value = getStored('qcAudioDevToken', '');
      devInput.addEventListener('input', function () {
        setStored('qcAudioDevToken', devInput.value);
      });
    }
    if (refresh) {
      refresh.addEventListener('click', function () {
        self.refreshList();
      });
    }
    if (upload) {
      upload.addEventListener('click', function () {
        self.uploadFile();
      });
    }
  };

  AudioConsole.prototype.apiBase = function () {
    var input = $(this.root, '[data-api-base]');
    return input ? input.value.replace(/\/+$/, '') : '';
  };

  AudioConsole.prototype.autoFetchList = function () {
    if (this.apiBase()) {
      this.refreshList();
    }
  };

  AudioConsole.prototype.refreshList = function () {
    var self = this;
    var api = this.apiBase();
    if (!api) {
      text(this.storageStatus, '请先填写 Worker API 地址。');
      return;
    }
    text(this.storageStatus, '正在读取 R2 音源列表...');
    fetch(api + '/api/audio/list')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        self.renderList(payload.objects || []);
        var len = (payload.objects || []).length;
        text(self.storageStatus, len ? '已加载 ' + len + ' 首音源' : 'R2 中暂无音源，请上传或检查前缀设置。');
      })
      .catch(function (error) {
        console.error('[qc-audio] list error:', error);
        text(self.storageStatus, '列表读取失败：' + (error.message || '网络错误'));
      });
  };

  AudioConsole.prototype.renderList = function (objects) {
    var list = $(this.root, '[data-track-list]');
    var self = this;
    if (!list) return;
    list.innerHTML = '';
    if (!objects.length) {
      list.innerHTML = '<p class="qc-empty">暂无音源。点击上方「上传音源」或「获取音源」。</p>';
      return;
    }
    objects.forEach(function (obj) {
      var row = document.createElement('div');
      row.className = 'qc-track-item';
      var url = joinUrl(self.publicBase, obj.key);
      var displayName = obj.originalName || obj.key.replace(/^audio\/\d{4}\/\d{2}\/[^-]+-/, '').replace(/-/g, ' ');
      row.innerHTML = '<div><strong>' + escapeHtml(displayName) + '</strong><span>' + formatSize(obj.size) + ' · ' + (obj.contentType || 'audio').replace('audio\/', '') + '</span></div>' +
        '<div class="qc-track-actions"><button type="button" data-play-key>播放</button><a download href="' + url + '">下载</a><button type="button" data-delete-key>删除</button></div>';
      row.querySelector('[data-play-key]').addEventListener('click', function () {
        self.loadUrl(url, displayName);
      });
      row.querySelector('[data-delete-key]').addEventListener('click', function () {
        self.deleteObject(obj.key);
      });
      list.appendChild(row);
    });
  };

  AudioConsole.prototype.uploadFile = function () {
    var api = this.apiBase();
    var input = $(this.root, '[data-upload-file]');
    var file = input && input.files && input.files[0];
    var self = this;
    if (!api) {
      text(this.storageStatus, '请先填写 Worker API 地址。');
      return;
    }
    if (!file) {
      text(this.storageStatus, '请选择要上传的音源文件。');
      return;
    }
    var MAX_SIZE = 90 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      text(this.storageStatus, '文件大小 ' + formatSize(file.size) + ' 超过 90MB 限制，请压缩后重试。');
      return;
    }
    var form = new FormData();
    form.append('file', file);
    text(this.storageStatus, '正在上传：' + file.name + '（' + formatSize(file.size) + '）');
    fetch(api + '/api/audio/upload', {
      method: 'POST',
      body: form
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        text(self.storageStatus, '上传完成：' + (payload.key || ''));
        self.refreshList();
      })
      .catch(function (error) {
        console.error('[qc-audio] upload error:', error);
        text(self.storageStatus, '上传失败：' + (error.message || '网络错误'));
      });
  };

  AudioConsole.prototype.deleteObject = function (key) {
    var api = this.apiBase();
    var tokenInput = $(this.root, '[data-dev-token]');
    var token = tokenInput ? tokenInput.value : '';
    var self = this;
    if (!token) {
      text(this.storageStatus, '删除需要开发者令牌。');
      return;
    }
    fetch(api + '/api/audio/delete?key=' + encodeURIComponent(key), {
      method: 'DELETE',
      headers: { 'x-developer-key': token }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function () {
        text(self.storageStatus, '已删除');
        self.refreshList();
      })
      .catch(function (error) {
        console.error('[qc-audio] delete error:', error);
        text(self.storageStatus, '删除失败：' + (error.message || '网络错误'));
      });
  };

  document.addEventListener('DOMContentLoaded', function () {
    $all(document, '[data-qc-audio]').forEach(function (root) {
      new AudioConsole(root);
    });
  });
}());
