(function () {
  'use strict';

  var BANDS = [
    { label: '32', frequency: 32 },
    { label: '64', frequency: 64 },
    { label: '125', frequency: 125 },
    { label: '250', frequency: 250 },
    { label: '500', frequency: 500 },
    { label: '1k', frequency: 1000 },
    { label: '4k', frequency: 4000 },
    { label: '12k', frequency: 12000 }
  ];

  var PRESETS = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0],
    'FLAC Warm': [1.5, 1, 0.5, 0, -0.5, 0.5, 1, 1.5],
    Vocal: [-1.5, -1, 0, 1.5, 2, 1, 0, -0.5],
    Bass: [4, 3, 2, 0, -1, -1, 0, 0],
    Bright: [-1, -1, -0.5, 0, 1, 2, 3, 3.5]
  };

  function $(root, selector) {
    return root.querySelector(selector);
  }

  function $all(root, selector) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function text(node, value) {
    if (node) {
      node.textContent = value;
    }
  }

  function joinUrl(base, key) {
    return String(base || '').replace(/\/+$/, '') + '/' + String(key || '').replace(/^\/+/, '');
  }

  function formatSize(bytes) {
    if (!bytes) {
      return '0 B';
    }
    var units = ['B', 'KB', 'MB', 'GB'];
    var size = bytes;
    var unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size = size / 1024;
      unit += 1;
    }
    return size.toFixed(unit ? 1 : 0) + ' ' + units[unit];
  }

  function getStored(name, fallback) {
    try {
      var v = localStorage.getItem(name);
      return v === null ? (fallback || '') : v;
    } catch (e) {
      return fallback || '';
    }
  }

  function setStored(name, value) {
    try {
      localStorage.setItem(name, value || '');
    } catch (e) {
      return;
    }
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
    this.objectUrl = null;
    this.init();
  }

  AudioConsole.prototype.init = function () {
    this.buildEq();
    this.bindPlayback();
    this.bindStorage();
    this.reportSupport();
  };

  AudioConsole.prototype.reportSupport = function () {
    if (!this.audio || !this.status) {
      return;
    }
    var flac = this.audio.canPlayType('audio/flac') || this.audio.canPlayType('audio/x-flac');
    if (!flac) {
      text(this.status, '当前浏览器未声明 FLAC 原生解码能力，可尝试 Chromium / Firefox / Safari 新版本或转换为 WAV。');
    }
  };

  AudioConsole.prototype.ensureAudioGraph = function () {
    if (!this.audio || this.audioContext) {
      return;
    }
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      text(this.status, '当前浏览器不支持 Web Audio API，EQ 已禁用。');
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

    var previous = this.source;
    var self = this;
    this.filters = BANDS.map(function (band) {
      var filter = self.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = band.frequency;
      filter.Q.value = 1.05;
      filter.gain.value = 0;
      previous.connect(filter);
      previous = filter;
      return filter;
    });
    previous.connect(this.preamp);
    this.preamp.connect(this.compressor);
    this.compressor.connect(this.audioContext.destination);
  };

  AudioConsole.prototype.buildEq = function () {
    var sliderWraps = $all(this.root, '[data-eq-sliders]');
    var self = this;
    sliderWraps.forEach(function (wrap) {
      wrap.innerHTML = '';
      BANDS.forEach(function (band, index) {
        var item = document.createElement('label');
        item.className = 'qc-eq-band';
        item.innerHTML = '<span>' + band.label + '</span><input type="range" min="-12" max="12" step="0.5" value="0" data-band="' + index + '"><output>0 dB</output>';
        wrap.appendChild(item);
      });
    });

    var presetWrap = $(this.root, '[data-eq-presets]');
    if (presetWrap) {
      presetWrap.innerHTML = '';
      Object.keys(PRESETS).forEach(function (name) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = name;
        button.addEventListener('click', function () {
          self.applyPreset(name);
        });
        presetWrap.appendChild(button);
      });
    }

    $all(this.root, '[data-band]').forEach(function (input) {
      input.addEventListener('input', function () {
        self.setBand(Number(input.getAttribute('data-band')), Number(input.value));
        var output = input.parentNode.querySelector('output');
        text(output, Number(input.value).toFixed(1).replace('.0', '') + ' dB');
      });
    });

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
    for (var i = 0; i < inputs.length; i += 1) {
      var bandIndex = Number(inputs[i].getAttribute('data-band'));
      inputs[i].value = values[bandIndex];
      this.setBand(bandIndex, values[bandIndex]);
      text(inputs[i].parentNode.querySelector('output'), values[bandIndex].toFixed(1).replace('.0', '') + ' dB');
    }
    text(this.status, '已应用 EQ 预设：' + name);
  };

  AudioConsole.prototype.toggleLimiter = function (enabled) {
    this.ensureAudioGraph();
    if (!this.compressor) {
      return;
    }
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
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          self.loadUrl(input.value);
        }
      });
    }

    if (local) {
      local.addEventListener('change', function () {
        var file = local.files && local.files[0];
        if (!file) {
          return;
        }
        if (self.objectUrl) {
          URL.revokeObjectURL(self.objectUrl);
        }
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

  AudioConsole.prototype.refreshList = function () {
    var self = this;
    var api = this.apiBase();
    if (!api) {
      text(this.storageStatus, '请先填写 Worker API 地址。');
      return;
    }
    text(this.storageStatus, '正在读取 R2 列表...');
    fetch(api + '/api/audio/list')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (payload) {
        self.renderList(payload.objects || []);
        text(self.storageStatus, '已读取 ' + (payload.objects || []).length + ' 个对象。');
      })
      .catch(function (error) {
        console.error('[qc-audio] list error:', error);
        text(self.storageStatus, '列表读取失败：' + (error.message || '网络错误'));
      });
  };

  AudioConsole.prototype.renderList = function (objects) {
    var list = $(this.root, '[data-track-list]');
    var self = this;
    if (!list) {
      return;
    }
    list.innerHTML = '';
    if (!objects.length) {
      list.innerHTML = '<p class="qc-empty">R2 桶当前没有音源对象。</p>';
      return;
    }
    objects.forEach(function (object) {
      var row = document.createElement('div');
      row.className = 'qc-track-item';
      var url = joinUrl(self.publicBase, object.key);
      row.innerHTML = '<div><strong>' + object.key.replace(/^audio\//, '') + '</strong><span>' + formatSize(object.size) + '</span></div>' +
        '<div class="qc-track-actions"><button type="button" data-play-key>播放</button><a download href="' + url + '">下载</a><button type="button" data-delete-key>删除</button></div>';
      row.querySelector('[data-play-key]').addEventListener('click', function () {
        self.loadUrl(url, object.key);
      });
      row.querySelector('[data-delete-key]').addEventListener('click', function () {
        self.deleteObject(object.key);
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
    var form = new FormData();
    form.append('file', file);
    text(this.storageStatus, '正在上传：' + file.name);
    fetch(api + '/api/audio/upload', {
      method: 'POST',
      body: form
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (payload) {
        text(self.storageStatus, '上传完成：' + payload.key);
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
      headers: {
        'x-developer-key': token
      }
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function () {
        text(self.storageStatus, '已删除：' + key);
        self.refreshList();
      })
      .catch(function (error) {
        text(self.storageStatus, '删除失败：' + error.message);
      });
  };

  document.addEventListener('DOMContentLoaded', function () {
    $all(document, '[data-qc-audio]').forEach(function (root) {
      new AudioConsole(root);
    });
  });
}());
