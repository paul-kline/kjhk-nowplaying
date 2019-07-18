let clocks = document.getElementsByClassName("clock");
console.log("version", "1.2.1");

let songStart = null;
let predictedEnd = null;
let gap = 0;
let DELAY = 4; //seconds.

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
    },
    checkSongDelay: 10000,
    defaultCheckSongDelay: 10000,
    frequentSongDelay: 3000,
    frequentSongCheckAttempts: 0,
    maxFrequentSongCheckAttempts: 4
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
    // showStatus: function() {
    //   return this.songdat.song_length && predictedEnd && predictedEnd.getTime() + DELAY <= new Date().getTime();
    // },
    artistTooltip: function() {
      return ""; //"View Artist on Spotify (if available)";
    },
    albumTooltip: function() {
      return ""; //"View Album on Spotify (if available)";
    },
    hasSpotify: function() {
      return this.spotifyArtistUrl.length > 1;
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

    async function recur_updateSong(obj) {
      await updateSong(obj);
      console.log("will check song data again in:", obj.checkSongDelay / 1000, "seconds");
      setTimeout(() => {
        recur_updateSong(obj);
      }, obj.checkSongDelay);
    }
    async function updateSong(obj) {
      console.log("checking for new song info");
      const songdata = await getNowPlaying();
      if (obj.songdat.timestamp == songdata.timestamp) {
        console.log("song data is still the same");
        //song is still the same? That is unexpected.
        //if the song had a length, we scheduled the next lookup nad found nothing new.
        //this could be because the DJ has started playing manually and not logged anything.
        //if we still find nothing after checking again a few times, default back to normal time.
        if (obj.songdat.song_length) {
          if (obj.frequentSongCheckAttempts < obj.maxFrequentSongCheckAttempts) {
            obj.frequentSongCheckAttempts++;
            obj.checkSongDelay = obj.frequentSongDelay;
          } else {
            //we have checked frequntly too many times!
            obj.checkSongDelay = obj.defaultCheckSongDelay;
          }
        } else {
          //if no song length is available and the song still hasn't changed...
          obj.checkSongDelay = obj.defaultCheckSongDelay;
        }
        return; // nothing to do!
      }
      //NEW SONG INFO!!!-----------------------------------------
      obj.frequentSongCheckAttempts = 0;
      obj.songdat = songdata;
      setTitle(obj.songdat.song + " - " + obj.songdat.artist);
      console.log("updating song");
      //reset progress bar;
      resetProgressBar();
      console.log("calling album art search with:", obj.songdat.artist, obj.songdat.album);

      const giverUpper = e => {
        console.log("no album art received:", e);
        imageurl = "";
        app.spotifyAlbumUrl = "#";
        app.spotifyArtistUrl = "#";
        app.linkTarget = "";
      };

      let albumArtData = await getAlbumArtData(obj.songdat.artist, obj.songdat.album);
      if (albumArtData.error) {
        console.log("there was an error getting the album art for", obj.songdat.artist, obj.songdat.album);
        giverUpper(albumArtData.error);
      }
      // let albumArtData = await getAlbumArtData("Silversun Pickups", "Widows Weeds");
      let albuminfo;
      let imageurl;

      const attempt = function() {
        app.linkTarget = "_blank";
        albuminfo = albumArtData.albums.items[0];
        imageurl = albuminfo.images[0].url; //zero is biggest.
        app.spotifyAlbumUrl = albuminfo.external_urls.spotify;
        app.spotifyArtistUrl = albuminfo.artists[0].external_urls.spotify;
        $('[data-toggle="tooltip"]').tooltip(); //reset tooltips.
      };
      try {
        attempt();
      } catch (e) {
        console.log("no album art received:", e);
        giverUpper(e);

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
          const matches = albumtext.match(/[\[\(]?clean[\]\)]?|[\[\(]?edited[\[\(]?|[\[\(]?ep[\]\)]?/g);
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
      //lastly, set the next song check delay.
      if (obj.songdat.song_length) {
        const endTime = fromUTC(obj.songdat.timestamp);
        endTime.setMilliseconds(endTime.getMilliseconds() + obj.songdat.song_length);
        obj.checkSongDelay = endTime.getTime() - Date.now() + 900 + Math.random() * 500; //random so server isn't bombarded at exact same time idk.
        console.log("song length found in new song. setting checksongdelay to ", obj.checkSongDelay / 1000, "seconds");
      } else {
        //the new song does not have a length! I guess just check every 10 seconds.
        obj.checkSongDelay = obj.defaultCheckSongDelay;
      }
    }
  }
});
function resetProgressBar() {
  songStart = null;
  predictedEnd = null;
  app.progressObject.width = "0%";
}
async function getNowPlaying() {
  let response = await axios.get("https://kjhk.org/nowplaying.php").catch(e => {
    return { error: e };
  });
  if (response.error) {
    console.log("error getting info from kjhk.org/nowplaying.php");
    await waitSeconds(10);
    console.log("waited 10 seconds. trying again to fetch song info");
    return getNowPlaying();
  }
  let answer = response.data;
  if (response.data instanceof Array) {
    answer = response.data[0];
  }
  // console.log(answer);
  return answer;
}
async function waitSeconds(seconds) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, seconds * 1000);
  });
}
async function getAlbumArtData(artist, album) {
  const fetcher = () =>
    axios.get("http://kjhkstream.org:3210/albumart", {
      params: {
        artist: artist,
        album: album
      }
    });
  const result = await fetcher()
    .then(response => response.data)
    .catch(er => {
      //somthing went wrong try one more time before failing
      return new Promise((resolve, reject) => {
        console.info("error fetching album art. trying a second time after a short delay.");
        setTimeout(() => {
          console.info("second attempt at getting album art after delay.");
          const r = fetcher()
            .then(x => x.data)
            .catch(e => {
              return { error: e };
            });
          if (r.error) {
            reject(r);
          } else {
            resolve(r);
          }
        }, 10000);
      });
    });

  console.log("result is", result);
  return result;
}
function setTitle(str) {
  document.getElementsByTagName("title")[0].innerHTML = replaceTag(str);
  // .replace("Â", "")
  // .replace("Â", "");
  // console.log("str was", str, "title set to:", replaceTag(str).replace("Â", ""));
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
