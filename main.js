let clocks = document.getElementsByClassName("clock");
console.log("version", "1.2.1");

let songStart = null;
let predictedEnd = null;
let gap = 0;
let DELAY = 5; //seconds.
function startTime() {
  Array.prototype.forEach.call(clocks, function(el) {
    el.innerHTML = new Date().toLocaleTimeString();
  });

  //set progress, if present.
  if (app && app.songdat.song_length) {
    if (!songStart) {
      songStart = fromUTC(app.songdat.timestamp);
    }
    if (!predictedEnd) {
      predictedEnd = new Date(songStart);
      predictedEnd.setMilliseconds(predictedEnd.getMilliseconds() + app.songdat.song_length);
      gap = predictedEnd.getTime() - songStart.getTime();
    }
    const elapsedTime = new Date().getTime() - (songStart.getTime() + DELAY * 1000);
    const percent = Math.max(0, Math.min((elapsedTime / gap) * 100, 100));
    app.progressObject.width = "" + percent + "%";
  }

  setTimeout(startTime, 1000);
}
function fromUTC(str) {
  const wrongDate = new Date(str);
  return new Date(
    Date.UTC(
      wrongDate.getFullYear(),
      wrongDate.getMonth(),
      wrongDate.getDate(),
      wrongDate.getHours(),
      wrongDate.getMinutes(),
      wrongDate.getSeconds(),
      wrongDate.getMilliseconds()
    )
  );
}

startTime();

var app = new Vue({
  el: "#app",
  data: {
    message: "Hello Vue!",
    songdat: {},
    albumurl: "",
    spotifyAlbumUrl: "#",
    spotifyArtistUrl: "#",
    linkTarget: "",
    progressObject: {
      width: "0%"
    }
  },
  computed: {
    calclocal: function() {
      if (this.songdat == undefined) {
        return "";
      }
      console.log("here is songdat:", this.songdat);
      let d = new Date(this.songdat.timestamp.replace(" ", "T"));
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
    },
    showStatus: function() {
      return this.songdat.song_length && predictedEnd && predictedEnd.getTime() + DELAY <= new Date().getTime();
    },
    artistTooltip: function() {
      return this.albumurl ? "View Artist on Spotify" : "";
    },
    albumTooltip: function() {
      return this.albumurl ? "View Album on Spotify" : "";
    }
  },
  mounted() {
    console.log("mounted");
    if (INCLUDE_PLAY_BUTTON) {
      handleIncludePlay();
    }
    setTimeout(() => {
      $(function() {
        console.log("data toggle");
        $('[data-toggle="tooltip"]').tooltip();
      });
    }, 1500);
  },
  created() {
    console.log("about to axios:");
    //update every 10 seconds:
    recur_updateSong(this);

    function recur_updateSong(obj) {
      updateSong(obj);
      setTimeout(() => {
        recur_updateSong(obj);
      }, 10000);
    }
    async function updateSong(obj) {
      const songdata = await getNowPlaying();
      if (obj.songdat.timestamp == songdata.timestamp) {
        return; // nothing to do!
      }
      //NEW SONG INFO!!!
      obj.songdat = songdata;
      setTitle(obj.songdat.song + " - " + obj.songdat.artist);
      console.log("updating song");
      //reset progress bar;
      resetProgressBar();
      console.log("calling with:", obj.songdat.artist, obj.songdat.album);

      let albumArtData = await getAlbumArtData(obj.songdat.artist, obj.songdat.album);
      // let albumArtData = await getAlbumArtData("Silversun Pickups", "Widows Weeds");
      let albuminfo;
      let imageurl;

      const attempt = function() {
        app.linkTarget = "_blank";
        albuminfo = albumArtData.albums.items[0];
        imageurl = albuminfo.images[0].url; //zero is biggest.
        app.spotifyAlbumUrl = albuminfo.external_urls.spotify;
        app.spotifyArtistUrl = albuminfo.artists[0].external_urls.spotify;
      };
      try {
        attempt();
      } catch (e) {
        console.log("no album art received:", e);
        imageurl = "";
        app.spotifyAlbumUrl = "#";
        app.spotifyArtistUrl = "#";
        app.linkTarget = "";

        //see if you can fix it.
        let albumtext = obj.songdat.album.trim().toLowerCase();

        //check if the problem was because it was a SINGLE
        if (albumtext.endsWith("single") || albumtext == "na" || albumtext == "n/a" || albumtext == "[na]") {
          console.log("trying to fix album art away from single");
          albumArtData = await getAlbumArtData(obj.songdat.artist, obj.songdat.song);
          try {
            attempt();
          } catch (e) {
            console.log("nope. can't fix. I tried because I thought it was a single or NA.", e);
          }
        } else {
          //see if it contains apostrophies. IDK why spotify sometiems has a problem with that?

          //see if it's the clean/edited version.
          const matches = albumtext.match(/[\[\(]?clean[\]\)]?|[\[\(]?edited[\[\(]?|[\[\(]?ep[\]\(]?|'/g);
          if (matches) {
            matches.forEach(m => {
              albumtext = albumtext.replace(m, "");
            });
            albumtext = albumtext.trim();
            console.log(
              "trying again, but this time looking for album: '",
              albumtext,
              "' instead of: ",
              obj.songdat.album
            );
            albumArtData = await getAlbumArtData(obj.songdat.artist, albumtext);
            try {
              attempt();
            } catch (e) {
              console.log("nope. can't fix. I tried because I thought it was an edited/clean version.", e);
            }
          }
        }
      }
      app.albumurl = imageurl;
    }
  }
});
function resetProgressBar() {
  songStart = null;
  predictedEnd = null;
  app.progressObject.width = "0%";
}
async function getNowPlaying() {
  let response = await axios.get("https://kjhk.org/nowplaying.php");
  let answer = response.data;
  if (response.data instanceof Array) {
    answer = response.data[0];
  }
  // console.log(answer);
  return answer;
}
async function getAlbumArtData(artist, album) {
  const result = await axios.get("http://kjhkstream.org:3210/albumart", {
    params: {
      artist: artist,
      album: album
    }
  });
  console.log("result is", result);
  return result.data;
}
function setTitle(str) {
  document.getElementsByTagName("title")[0].innerHTML = replaceTag(str)
    .replace("Â", "")
    .replace("Â", "");
  console.log("str was", str, "title set to:", replaceTag(str).replace("Â", ""));
}
let tagsToReplace = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
};

function replaceTag(tag) {
  return tagsToReplace[tag] || tag;
}

function safe_tags_replace(str) {
  return str.replace(/[&<>]/g, replaceTag);
}

function handleIncludePlay() {
  var music = document.getElementById("music"); // id for audio element
  var duration; // Duration of audio clip
  var pButton = document.getElementById("pButton"); // play button

  //Play and Pause
  function play() {
    // start music
    if (music.paused) {
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

  // Gets audio file duration
  music.addEventListener(
    "canplaythrough",
    function() {
      duration = music.duration;
    },
    false
  );
}
