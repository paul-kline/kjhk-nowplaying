var music = document.getElementById("music"); // id for audio element
var duration; // Duration of audio clip
var pButton = document.getElementById("pButton"); // play button

//Play and Pause
function play() {
  // start music
  if (music.paused) {
    console.log("music:", music);
    music.load();
    music.play();
    setTitle(app.songdat.song + " - " + app.songdat.artist);
    // remove play, add pause
    document.getElementById("play").style.display = "none";
    document.getElementById("pause").style.display = "block";
  } else {
    // STOP music
    music.pause();
    setTitle("KJHK Stream");
    // remove pause, add play
    document.getElementById("play").style.display = "block";
    document.getElementById("pause").style.display = "none";
  }
}

//John's code:
//Volume controls:

//var myPlayer = document.getElementById("audioplayer");

function getVolume() {
  alert(music.volume);
}
function increaseVolume() {
  music.volume = 0.5;
}
function decreaseFullVolume() {
  music.volume = 0.1;
}
