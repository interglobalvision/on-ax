/* jshint browser: true, devel: true, indent: 2, curly: true, eqeqeq: true, futurehostile: true, latedef: true, undef: true, unused: true */
/* global $, jQuery, document, Modernizr, THREE */

function l(data) {
  'use strict';
  console.log(data);
}

document.body.style.width = window.innerWidth + "px";
document.body.style.height = window.innerHeight + "px";

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// GLOBALS
var container, scene, camera, renderer, controls, stats, videoTexture;

/**
 *
 * WebCam Mesh by Felix Turner
 * @felixturner / www.airtight.cc
 * (c) Airtight Interactive Inc. 2012
 *
 * Connects HTML5 WebCam input to a WebGL 3D Mesh. It creates a 3D depth map by mapping pixel brightness to Z-depth.
 * Perlin noise is used for the ripple effect and CSS3 filters are used for color effects.
 * Use mouse move to tilt and scroll wheel to zoom. Requires Chrome or Opera.
 *
 */
var fov = 70;
var canvasWidth = 320 / 2;
var canvasHeight = 240 / 2;
var vidWidth = 1280;
var vidHeight = 960;
var tiltSpeed = 0.2;
var tiltAmount = 0.1;

var perlin = new ImprovedNoise();
var camera, scene, renderer;
var mouseX = 0;
var mouseY = 0;
var windowHalfX, windowHalfY;
var video, videoTexture;
var world3D;
var geometry;
var vidCanvas;
var ctx;
var pixels;
var noisePosn = 0;
var wireMaterial;
var meshMaterial;
var container;
var params;
var title, info, prompt;

var time = 0.0;

var gui;

var musicNoise;

var threeReady = false;

var webcamOn = false;
var isIframe = false;

function detectSpecs() {

  //init HTML elements
  container = document.querySelector('#threeContainer');
  prompt = document.querySelector('#prompt');
  info = document.querySelector('#info');
  title = document.querySelector('#title');
  container.style.opacity = 0;

  var hasWebgl = (function() {
    try {
      return !!window.WebGLRenderingContext && !! document.createElement('canvas').getContext('experimental-webgl');
    } catch (e) {
      return false;
    }
  })();

  var hasGetUserMedia = (function() {
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
  })();

  //console.log("hasWebGL: " + hasWebgl);
  //console.log("hasGetUserMedia: " + hasGetUserMedia);
  if (!hasGetUserMedia) {
    prompt.innerHTML = 'This demo requires webcam support (Chrome or Opera).';
  } else if (!hasWebgl) {
    prompt.innerHTML = 'No WebGL support detected. Please try restarting the browser.';
  } else {
    prompt.innerHTML = 'To enjoy the full experience allow camera access';
    init();
  }

}

function init() {

  // stop the user getting a text cursor
  document.onselectstart = function() {
    return false;
  };

  prompt.classList.add('active');
  //init control panel
  params = new WCMParams();
  gui = new dat.GUI();
  gui.add(params, 'zoom', 0.1, 5).name('Zoom').onChange(onParamsChange);
  gui.add(params, 'mOpac', 0, 1).name('Mesh Opacity').onChange(onParamsChange);
  gui.add(params, 'wfOpac', 0, 0.5).name('Grid Opacity').onChange(onParamsChange);
  gui.add(params, 'contrast', 1, 5).name('Contrast').onChange(onParamsChange);
  gui.add(params, 'saturation', 0, 2).name('Saturation').onChange(onParamsChange);
  gui.add(params, 'zDepth', 0, 1000).name('Z Depth');
  gui.add(params, 'noiseStrength', 0, 60).name('Noise Strength');
  gui.add(params, 'noiseSpeed', 0, 0.05).name('Noise Speed');
  gui.add(params, 'noiseScale', 0, 1).name('Noise Scale');
  gui.add(params, 'invertZ').name('Invert Z');
  //gui.add(this, 'saveImage').name('Snapshot');
  gui.close();
  gui.domElement.style.display = 'none';

  //Init 3D
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 5000);
  camera.target = new THREE.Vector3(0, 0, 0);
  scene.add(camera);
  camera.position.z = 300;

  //init webcam texture
  video = document.createElement('video');
  video.width = vidWidth;
  video.height = vidHeight;
  video.preload = 'auto';
  video.loop = true;

  //make it cross browser
  window.URL= window.URL || window.webkitURL;
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  //get webcam
  navigator.getUserMedia({
    video: true
  }, function(stream) {
    //on webcam enabled
    webcamOn = true;
    video.src = window.URL.createObjectURL(stream);
    prompt.classList.remove('active');
    gui.domElement.style.display = 'inline';
    threeReady = true;
    console.log('Three is ready');
  }, function(error) {
    var webmSource = document.createElement('source');
    webmSource.src = "vid/bg.webm";
    webmSource.type = 'video/webm; codecs="vp8, vorbis"';

    var mp4Source = document.createElement('source');
    mp4Source.src = 'vid/bg.mp4';
    mp4Source.type = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';

    video.appendChild(webmSource);
    video.appendChild(mp4Source);

    video.addEventListener('canplay', function() {
      video.play();
      prompt.classList.remove('active');
      gui.domElement.style.display = 'inline';
      //params.noiseScale = 0.05;
      threeReady = true;
      console.log('Three is ready');
    });
  });

  videoTexture = new THREE.Texture(video);

  world3D = new THREE.Object3D();
  scene.add(world3D);

  //add mirror plane
  geometry = new THREE.PlaneGeometry(640, 480, canvasWidth, canvasHeight);
  geometry.dynamic = true;
  meshMaterial = new THREE.MeshBasicMaterial({
    opacity: 1,
    map: videoTexture
  });

  /*
     var mirror = new THREE.Mesh(geometry, meshMaterial);
     world3D.add(mirror);
     */

  /*
  var coverTexture = THREE.ImageUtils.loadTexture( "img/texture.png" );
  coverTexture.wrapS = THREE.RepeatWrapping;
  coverTexture.wrapT = THREE.RepeatWrapping;
  */
  //add wireframe plane
  wireMaterial = new THREE.MeshBasicMaterial({
    opacity: 0.15,
    color: 0x7667c1,
    wireframe: true,
    //alphaMap: coverTexture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    wireframeLinejoin: "round"
  });
  var wiremirror = new THREE.Mesh(geometry, wireMaterial);
  world3D.add(wiremirror);
  wiremirror.position.z = 9;


  //init renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.sortObjects = false;
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  /*
  // add Stats
  stats = new Stats();
  document.querySelector('.fps').appendChild(stats.domElement);
  */

  //init vidCanvas - used to analyze the video pixels
  vidCanvas = document.createElement('canvas');
  document.body.appendChild(vidCanvas);
  vidCanvas.style.position = 'absolute';
  vidCanvas.style.display = 'none';
  ctx = vidCanvas.getContext('2d');

  //init listeners
  document.addEventListener('mousemove', onMouseMove, false);
  window.addEventListener('resize', onResize, false);
  document.addEventListener('mousewheel', onWheel, false);

  // If in iframe, dont show info
  if( window.self === window.top ) {
    isIframe = true;
    container.addEventListener('click', showInfo, false);
    document.getElementById("closeBtn").addEventListener('click', hideInfo, false);
    title.addEventListener('click', showInfo, false);

  }

  //handle WebGL context lost
  renderer.domElement.addEventListener("webglcontextlost", function(event) {
    prompt.style.display = 'inline';
    prompt.classList.add('active');
    prompt.innerHTML = 'WebGL Context Lost. Please try reloading the page.';
  }, false);

  onResize();

  animate();

}

// params for dat.gui

function WCMParams() {
  this.zoom = 1.1;
  this.mOpac = 0;
  this.wfOpac = 0.2;
  this.contrast = 2;
  this.saturation = 1.1;
  this.invertZ = true;
  this.zDepth = 100;
  this.noiseStrength = 91;
  this.noiseScale = 0.01;
  this.noiseSpeed = 0.0002;
  //this.doSnapshot = function() {};
}

function onParamsChange() {
  meshMaterial.opacity = params.mOpac;
  wireMaterial.opacity = params.wfOpac;
  container.style.webkitFilter = "contrast(" + params.contrast + ") saturate(" + params.saturation + ")";
}

function getZDepths() {

  noisePosn += params.noiseSpeed;
  if( arpPlayer.isPlaying ) {
    var noiseData = arpPlayer.getAnalyserData();
  } else {
    var noiseData =  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
  }
  var noiseBass = noiseData[2] / 64.0;
  noiseBass += noiseData[3] / 64.0;

  var noiseMed = noiseData[8] / 128.0;
  var noiseHigh = noiseData[11] / 128.0;

  var noiseScale = params.noiseScale + ( noiseBass / 10000 );

  var noiseStrength = params.noiseStrength;

  var zDepth = params.zDepth * noiseHigh;

  //draw webcam video pixels to canvas for pixel analysis
  //double up on last pixel get because there is one more vert than pixels
  ctx.drawImage(video, 0, 0, canvasWidth + 1, canvasHeight + 1);
  pixels = ctx.getImageData(0, 0, canvasWidth + 1, canvasHeight + 1).data;

  for (var i = 0; i < canvasWidth + 1; i++) {
    for (var j = 0; j < canvasHeight + 1; j++) {
      var color = new THREE.Color(getColor(i, j));
      var brightness = getBrightness(color);
      var gotoZ = zDepth * brightness - zDepth / 1.3;

      //add 32 wobble
      gotoZ += perlin.noise(i * noiseScale, j * noiseScale, noiseMed) * noiseStrength;
      gotoZ = gotoZ * noiseHigh;
      //gotoZ += perlin.noise(i * params.noiseScale, j * params.noiseScale, noiseBass) * params.noiseStrength;
      //gotoZ += perlin.noise(i * params.noiseScale, j * params.noiseScale, noisePosn) * params.noiseStrength;
      //invert?
      if (params.invertZ) gotoZ = -gotoZ;
      //tween to stablize
      geometry.vertices[j * (canvasWidth + 1) + i].z += (gotoZ - geometry.vertices[j * (canvasWidth + 1) + i].z) / 5;
    }
  }
  geometry.verticesNeedUpdate = true;
}

function onMouseMove(event) {
  if( webcamOn ) {
    mouseX = (event.clientX - windowHalfX) / (windowHalfX);
    mouseY = (event.clientY - windowHalfY) / (windowHalfY);
  } else {
    mouseX = (event.clientX - windowHalfX) * 20  / (windowHalfX);
    mouseY = (event.clientY - windowHalfY) * 20  / (windowHalfY);
  }
}

function animate() {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    videoTexture.needsUpdate = true;
    getZDepths();
  }
  //console.log( arpPlayer.getAnalyserData() );
  //stats.update();
  requestAnimationFrame(animate);
  render();
}

function render() {
  time+=0.01;
  world3D.scale = new THREE.Vector3(params.zoom, params.zoom, 1);
  world3D.rotation.x += ((mouseY * tiltAmount) - world3D.rotation.x) * tiltSpeed;
  world3D.rotation.y += ((mouseX * tiltAmount) - world3D.rotation.y) * tiltSpeed;
  //camera.lookAt(camera.target);
  renderer.render(scene, camera);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;
}

// Returns a hexidecimal color for a given pixel in the pixel array.

function getColor(x, y) {
  var base = (Math.floor(y) * (canvasWidth + 1) + Math.floor(x)) * 4;
  var c = {
    r: pixels[base + 0],
    g: pixels[base + 1],
    b: pixels[base + 2],
    a: pixels[base + 3]
  };
  return (c.r << 16) + (c.g << 8) + c.b;
}

//return pixel brightness between 0 and 1 based on human perceptual bias

function getBrightness(c) {
  return (0.34 * c.r + 0.5 * c.g + 0.16 * c.b);
}

function hideInfo(e) {
  e.preventDefault();
  info.classList.remove('active');
  if( !arpPlayer.isPlaying ) {
    document.getElementById("playPlayer").classList.add('active');
  }
}

function showInfo(e) {
  e.preventDefault();
  info.classList.add('active');
  document.getElementById("playPlayer").classList.remove('active');
}

function onWheel(event) {

  params.zoom += event.wheelDelta * 0.002;
  //limit
  params.zoom = Math.max(params.zoom, 0.1);
  params.zoom = Math.min(params.zoom, 5);

  //update gui slider
  gui.__controllers[0].updateDisplay();
}

function saveImage() {
  render();
  window.open(renderer.domElement.toDataURL("image/png"));
}

/*
 *
 *
 *
 *  AUDIO STUFF
 *
 *
 *
 *  ////////////////////////////////////////////////////////////////
 */

/* jshint browser: true, devel: true, indent: 2, curly: true, eqeqeq: true, futurehostile: true, latedef: true, undef: true, unused: true */
/* global $, jQuery, document, Modernizr */

function l(data) {
  'use strict';
  console.log(data);
}
CLIENT_ID = '1af5bd17adc32f47529ce064b5e03361';

var arpPlayer = {
  audioContext: '',
  sourceNode: '',
  audioPlayer: null,
  analyserNode: null,
  dataArray: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  soundBuffer: null,
  isReady: false,
  isPlaying: false,
  bpmCounter: null,
  init: function() {
    l('init');
    var _this = this;

    _this.setBodySize();
    window.addEventListener('resize', _this.setBodySize, false);
    document.getElementById("pause-btn").addEventListener('click', function(e) {
      e.preventDefault();
      if( arpPlayer.isPlaying === true ) {
        arpPlayer.pause();
      }
    });
    document.getElementById("play-btn").addEventListener('click', function(e) {
      e.preventDefault();
      if( arpPlayer.isPlaying === false ) {
        arpPlayer.play();
      }

    });

    // Set audio context
    _this.audioContext = new (window.AudioContext || window.webkitAudioContext);

    // Set audio player
    _this.audioPlayer = document.getElementById('audioPlayer');

    // Stop if is playing
    if( _this.isPlaying ) {
      _this.pause();
    }

    _this.audioPlayer.addEventListener('canplay', function() {

      // Create media element source
      _this.sourceNode = _this.audioContext.createMediaElementSource( _this.audioPlayer );

      // Create a analyser node
      _this.analyserNode = _this.audioContext.createAnalyser();
      _this.analyserNode.fftSize = 32;
      _this.dataArray = new Uint8Array(_this.analyserNode.frequencyBinCount);

      // Connect source with audio destination
      _this.sourceNode.connect(_this.analyserNode);       // connect the source to the context's destination (the speakers)
      _this.analyserNode.connect(_this.audioContext.destination);       // connect the source to the context's destination (the speakers)
      _this.sourceNode.buffer = _this.soundBuffer;                    // tell the source which sound to play


      _this.isReady = true;
      console.log('Player is ready');

    });

    /*
       var request = new XMLHttpRequest();
       request.open('GET', streamUrl, true);
       request.responseType = 'arraybuffer';

       request.onload = function() {
       _this.audioContext.decodeAudioData(request.response, function(buffer) {
       _this.soundBuffer = buffer;
       _this.isReady = true;
    //_this.play();
    }, function(err) {
    console.log(err);
    });
    }

    request.send();
    */

    detectSpecs();

  },
  play: function() {
    var _this = this;

    // Check if video is paused
    if ( video.paused ) {
      video.play();
    }

    // Set bpm counter interval
    // BPM: 124
    _this.bpmCounter = setInterval( function() {
      var time = _this.audioPlayer.currentTime;

      // Show info in 5 sec
      if( time > 8 && time < 9 && isIframe ) {
        info.classList.add('active');
        document.getElementById("playPlayer").classList.remove('active');
      }

      // Animation effects
      if( time > 0 && time < 0.484 ) {
        if( !webcamOn ) {
          params.invertZ = false;
        }
      }
      if( time > 13.552 && time < 14.52 ) {
        params.invertZ = true;
        params.noiseScale = 0.01;
      }

      if( time > 60.016 && time < 60.984 ) {
        if( !webcamOn ) {
          params.invertZ = false;
        } else {
          video.pause();
        }
        params.noiseScale = 0.05;
      }
      if( time > 75.504 && time < 76.472 ) {
        params.invertZ = true;
        if( webcamOn ) {
          video.play();
        }
      }

      if( time > 85.184 && time < 86.152 ) {
        params.noiseScale = 0.01;
      }

      if( time > 185.856 && time < 186.824 ) {
        params.invertZ = false;
        params.zDepth = 150;
        params.noiseScale = 0.05;
      }
      if( time > 197.472 && time < 198.44 ) {
        params.invertZ = true;
        params.zDepth = 100;
        params.noiseScale = 0.01;
      }

    }, 242);

    // Play track
    _this.audioPlayer.play();

    // fade In animation
    container.style.opacity = 1;
    document.getElementById("pausePlayer").classList.add('active');
    document.getElementById("playPlayer").classList.remove('active');

    _this.isPlaying = true;

  },
  pause: function() {
    var _this = this;

    container.style.opacity = 0;
    clearInterval( _this.bpmCounter );
    _this.audioPlayer.pause();
    video.pause();
    _this.isPlaying = false;
    document.getElementById("pausePlayer").classList.remove('active');
    if( document.getElementById('info').classList == false ) {
      document.getElementById("playPlayer").classList.add('active');
    }
  },
  getAnalyserData: function() {
    var _this = this;

    _this.analyserNode.getByteTimeDomainData(_this.dataArray);
    return _this.dataArray;
  },
  setBodySize: function() {
    document.body.style.width = window.innerWidth + "px";
    document.body.style.height = window.innerHeight + "px";
  },
};

$(document).ready(function () {
  'use strict';

  arpPlayer.init();

  // Set interval checker
  var intervalId = setInterval( function() {
    if( arpPlayer.isReady == true && threeReady == true ) {
      // Set controls
      document.getElementById("playPlayer").classList.add('active');
      clearInterval( intervalId );
    }
  }, 300);

});

$(window).load(function () {
});

