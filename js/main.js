/* jshint browser: true, devel: true, indent: 2, curly: true, eqeqeq: true, futurehostile: true, latedef: true, undef: true, unused: true */
/* global $, jQuery, document, Modernizr */

function l(data) {
  'use strict';
  console.log(data);
}

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;


$(document).ready(function () {
  'use strict';

  // You can use either `new PIXI.WebGLRenderer`, `new PIXI.CanvasRenderer`, or `PIXI.autoDetectRenderer`
  // which will try to choose the best renderer for the environment you are in.
  var renderer = new PIXI.autoDetectRenderer(800, 600);

  // Set renderer fulscreen
  renderer.view.style.position = "absolute"
  renderer.view.style.top = 0;
  renderer.view.style.left = 0;
  renderer.view.style.width = window.innerWidth + "px";
  renderer.view.style.height = window.innerHeight + "px";
  renderer.view.style.display = "block";

  // The renderer will create a canvas element for you that you can then insert into the DOM.
  document.getElementById('main-content').appendChild(renderer.view);

  // You need to create a root container that will hold the scene you want to draw.
  var stage = new PIXI.Container();

  /*
  // This creates a texture from a 'bunny.png' image.
  var bunnyTexture = PIXI.Texture.fromImage('bunny.png');
  var bunny = new PIXI.Sprite(bunnyTexture);

  // Setup the position and scale of the bunny
  bunny.position.x = 400;
  bunny.position.y = 300;

  bunny.scale.x = 2;
  bunny.scale.y = 2;

  // Add the bunny to the scene we are building.
  stage.addChild(bunny);
  */


  // ------- Video
  var webcamFeed = document.getElementById('webcamFeed');

  var initVideo = function(stream){
    webcamFeed.src = window.URL.createObjectURL(stream);

    var webcamTexture = PIXI.Texture.fromVideo(webcamFeed);
    var webcam = new PIXI.Sprite(webcamTexture);
    webcam.position.x = 0;
    webcam.position.y = 0;

    webcam.scale.x = 0.75;
    webcam.scale.y = 1;
    
    stage.addChild(webcam);

  }

  if(navigator.getUserMedia) {
    navigator.getUserMedia({video: true }, initVideo, function(e) { console.log(e); });
  }

  // kick off the animation loop (defined below)
  animate();

  function animate() {
    // start the timer for the next animation loop
    requestAnimationFrame(animate);

    // each frame we spin the bunny around a bit
    //bunny.rotation += 0.01;

    // this is the main render call that makes pixi draw your container and its children.
    renderer.render(stage);
  }

});

$(window).load(function () {

});
